/**
 * Simulate Circuit Handler
 *
 * Pure function to compile and simulate a circuit.
 * Accepts TypeScript circuit builder code.
 */

import { createSimulator, elaborate, TOP_LEVEL_NODE } from '../simulator/index.js';
import type { SimulationTrace } from '../types/analysis.js';
import { compressTrace, detectSteadyState } from '../types/analysis.js';
import type { BitValue, BusValue } from '../types/circuit.js';
import { compileSource } from './compile-source.js';
import { exportVCD } from './vcd.js';

export type RLEValue = { value: BitValue | BusValue; count: number };

export interface SimulateResult {
  circuit: string;
  ticks: number;
  inputs: string[];
  outputs: string[];
  signals: Record<string, RLEValue[]>;
  steadyStateAt?: number;
  vcd: string;
}

export interface SimulateError {
  error: string;
}

export function simulateCircuit(params: {
  source: string;
  sourceName?: string;
  circuitName?: string;
  ticks?: number;
  inputs?: Record<string, number | boolean>;
  memoryData?: Map<string, Map<number, number>>;
}): SimulateResult | SimulateError {
  const ticks = params.ticks ?? 10;

  // Compile TypeScript circuit code
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

  // Elaborate to flat circuit — needed for VCD hierarchy
  const flatCircuit = elaborate(target, compiled.library);

  // Create simulator from flat circuit
  const simulator = createSimulator(flatCircuit, { componentLibrary: compiled.library });

  // Load memory data if provided
  if (params.memoryData) {
    for (const [nodeId, data] of Object.entries(params.memoryData)) {
      simulator.setNode(nodeId, data);
    }
  }

  // Set inputs
  if (params.inputs) {
    for (const [name, value] of Object.entries(params.inputs)) {
      simulator.setNode(name, value as BitValue | BusValue);
    }
  }

  // Run simulation — capture full portValues each tick for VCD
  const outputNames = target.outputs.map((o) => o.name);
  const inputNames = target.inputs.map((i) => i.name);
  const signalNames = [...inputNames, ...outputNames];
  const signals: Record<string, (BitValue | BusValue)[]> = {};
  const portValuesByTick: Array<ReadonlyMap<string, BitValue | BusValue>> = [];

  for (const name of signalNames) {
    signals[name] = [];
  }

  for (let tick = 0; tick < ticks; tick++) {
    const result = simulator.tick();

    // Capture full port values for VCD (all internal signals)
    portValuesByTick.push(result.portValues);

    // Capture top-level signals for RLE compression
    for (const name of signalNames) {
      const key = `${TOP_LEVEL_NODE}.${name}`;
      const val = result.portValues.get(key);
      signals[name].push(val ?? (typeof val === 'boolean' ? false : 0));
    }
  }

  // Export hierarchical VCD
  const vcd = exportVCD({
    circuit: target.name,
    nodes: flatCircuit.nodes,
    topLevelInputs: inputNames,
    topLevelOutputs: outputNames,
    portValuesByTick,
    ticks,
  });

  // Compress top-level signals for MCP return value
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
    vcd,
    ...(steadyStateAt !== undefined ? { steadyStateAt } : {}),
  };
}
