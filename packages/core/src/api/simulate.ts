/**
 * Simulate Circuit Handler
 *
 * Pure function to compile and simulate a circuit.
 * Accepts already-resolved source string, returns typed result.
 */

import { parseDSL, compileToIR, compressTrace, detectSteadyState } from '../dsl/index.js';
import type { SimulationTrace } from '../dsl/index.js';
import {
  createSimulatorFromCircuit,
  createComponentLibrary,
  TOP_LEVEL_NODE,
} from '../simulator/index.js';
import type { BitValue, BusValue } from '../types/circuit.js';
import { createMutableLibrary } from './lib.js';

export type RLEValue = { value: BitValue | BusValue; count: number };

export interface SimulateResult {
  circuit: string;
  ticks: number;
  inputs: string[];
  outputs: string[];
  signals: Record<string, RLEValue[]>;
  steadyStateAt?: number;
}

export interface SimulateError {
  error: string;
}

export function simulateCircuit(
  params: {
    source: string;
    sourceName?: string;
    circuitName?: string;
    ticks?: number;
    inputs?: Record<string, number | boolean>;
    memoryData?: Map<string, Map<number, number>>;
  },
): SimulateResult | SimulateError {
  const sourceName = params.sourceName ?? '<inline>';
  const ticks = params.ticks ?? 10;

  // Parse
  const { ast, errors: parseErrors } = parseDSL(params.source, sourceName);
  if (parseErrors.length > 0) {
    const messages = parseErrors.map(
      (e) => `${e.location.start.line}:${e.location.start.column} ${e.message}`
    );
    return { error: `Parse errors:\n${messages.join('\n')}` };
  }

  // Compile
  const { library: mutableLibrary, circuits: allCircuits } = createMutableLibrary();

  let compiledCircuits: typeof allCircuits;
  try {
    compiledCircuits = compileToIR(ast, mutableLibrary);
    allCircuits.push(...compiledCircuits);
  } catch (e) {
    return {
      error: `Compilation error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Find target circuit
  const target = params.circuitName
    ? compiledCircuits.find((c) => c.name === params.circuitName)
    : compiledCircuits[compiledCircuits.length - 1];

  if (!target) {
    const names = compiledCircuits.map((c) => c.name).join(', ');
    return {
      error: params.circuitName
        ? `Circuit "${params.circuitName}" not found. Available: ${names}`
        : `No circuits found in source.`,
    };
  }

  // Create simulator
  const library = createComponentLibrary(allCircuits);
  const simulator = createSimulatorFromCircuit(target, library, params.memoryData);

  // Set inputs
  if (params.inputs) {
    for (const [name, value] of Object.entries(params.inputs)) {
      simulator.setInput(name, value as BitValue | BusValue);
    }
  }

  // Run simulation
  const outputNames = target.outputs.map((o) => o.name);
  const inputNames = target.inputs.map((i) => i.name);
  const signalNames = [...inputNames, ...outputNames];
  const signals: Record<string, (BitValue | BusValue)[]> = {};

  for (const name of signalNames) {
    signals[name] = [];
  }

  for (let tick = 0; tick < ticks; tick++) {
    const result = simulator.tick();

    for (const name of signalNames) {
      const key = `${TOP_LEVEL_NODE}.${name}`;
      const val = result.portValues.get(key);
      signals[name].push(val ?? (typeof val === 'boolean' ? false : 0));
    }
  }

  // Wrap raw signals into a SimulationTrace for compression
  const trace: SimulationTrace = {
    cycles: ticks,
    signals,
    registers: {},
    sampleRate: 1,
    sampledCycles: Array.from({ length: ticks }, (_, i) => i),
  };

  const compressed = compressTrace(trace);
  const steadyStateAt = detectSteadyState(trace);

  return {
    circuit: target.name,
    ticks,
    inputs: inputNames,
    outputs: outputNames,
    signals: compressed,
    ...(steadyStateAt !== undefined ? { steadyStateAt } : {}),
  };
}
