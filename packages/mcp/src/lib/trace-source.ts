/**
 * Simulate Circuit Handler
 *
 * Pure function to compile and simulate a circuit.
 * Accepts TypeScript circuit builder code.
 */

import {
  type BitValue,
  type BusValue,
  compressTrace,
  createEngine,
  detectSteadyState,
  elaborate,
  type MemoryContents,
  type SimulationTrace,
  TOP_LEVEL_NODE,
} from '@simten/core/internal';
import type { Compiled } from './compile-file.js';
import { compileSource } from './compile-source.js';
import { exportVCD } from './vcd-export.js';

type RLEValue = { value: BitValue | BusValue; count: number };

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

/** What to simulate and how, for circuits already compiled. */
export interface TraceOptions {
  circuitName?: string;
  ticks?: number;
  // Numeric: `setNode` does not coerce, and this map feeds `topLevelInputs`,
  // which propagate.ts reads raw when building onTick's inputs. A boolean here
  // would land in sequential state verbatim.
  inputs?: Record<string, number>;
  /**
   * Memory contents to load before the first tick, by node: the node's ID
   * (`rom`) or its path inside the circuit (`cpu.imem`), each holding
   * `{ address: value }` contents.
   */
  memoryData?: Record<string, MemoryContents>;
}

export function traceSource(
  params: TraceOptions & { source: string; sourceName?: string },
): SimulateResult | SimulateError {
  return traceCompiled(compileSource(params.source, params.sourceName), params);
}

/** Simulate one of the compiled circuits: `circuitName`, else the last one built. */
export function traceCompiled(
  compiled: Compiled,
  params: TraceOptions,
): SimulateResult | SimulateError {
  const ticks = params.ticks ?? 10;

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
  const flatCircuit = elaborate(target, compiled.library.definitions);

  // Create simulator from flat circuit
  const simulator = createEngine(flatCircuit, { library: compiled.library });

  // Load memory data if provided. The engine's memories run on a Map, and its
  // setNode takes exact node paths only, so check the names here and report a
  // miss as a tool error.
  if (params.memoryData) {
    for (const [nodeId, contents] of Object.entries(params.memoryData)) {
      if (!flatCircuit.nodes.some((n) => n.id === nodeId)) {
        return { error: `memoryData: no node "${nodeId}" in circuit "${target.name}"` };
      }
      simulator.setNode(nodeId, memoryContentsToMap(contents));
    }
  }

  // Set inputs
  if (params.inputs) {
    const ports = target.inputs.map((i) => i.name);
    for (const [name, value] of Object.entries(params.inputs)) {
      if (!ports.includes(name)) {
        return {
          error: `inputs: "${name}" is not an input of circuit "${target.name}". Inputs: ${ports.join(', ') || '(none)'}`,
        };
      }
      simulator.setNode(name, value);
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
      // (The old fallback tested `typeof val === 'boolean'` on the right of
      // `??`, where val is always nullish — it could only ever yield 0.)
      signals[name].push(val ?? 0);
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

function memoryContentsToMap(contents: MemoryContents): Map<number, number> {
  return new Map(Object.entries(contents).map(([address, value]) => [Number(address), value]));
}
