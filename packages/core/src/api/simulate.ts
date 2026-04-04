/**
 * Simulate Circuit Handler
 *
 * Pure function to compile and simulate a circuit.
 * Accepts TypeScript builder code or DSL source string.
 */

import {
  createSimulatorFromCircuit,
  TOP_LEVEL_NODE,
} from '../simulator/index.js';
import type { BitValue, BusValue } from '../types/circuit.js';
import { compileSource } from './compile-source.js';
import { compressTrace, detectSteadyState } from '../dsl/analysis/simulate.js';
import type { SimulationTrace } from '../dsl/analysis/types.js';

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
  const ticks = params.ticks ?? 10;

  // Compile (auto-detects TS vs DSL)
  const compiled = compileSource(params.source, params.sourceName);
  if (compiled.error) {
    return { error: compiled.error };
  }

  // Find target circuit
  const target = params.circuitName
    ? compiled.circuits.find((c) => c.name === params.circuitName)
    : compiled.circuits[compiled.circuits.length - 1];

  if (!target) {
    const names = compiled.circuits.map((c) => c.name).join(', ');
    return {
      error: params.circuitName
        ? `Circuit "${params.circuitName}" not found. Available: ${names}`
        : `No circuits found in source.`,
    };
  }

  // Create simulator
  const simulator = createSimulatorFromCircuit(target, compiled.library, params.memoryData);

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

  // Compress
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
