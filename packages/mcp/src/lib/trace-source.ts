/**
 * Simulate Circuit Handler
 *
 * Pure function to compile and simulate a circuit.
 * Accepts TypeScript circuit builder code.
 */

import type { Simulation } from '@simten/core';
import {
  type BitValue,
  type BusValue,
  type CircuitIR,
  compressTrace,
  createSimulation,
  detectSteadyState,
  elaborate,
  type MemoryContents,
  nodesOf,
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
  /**
   * Input values at cycle 0, keyed as `simulate(top).set()` takes them: input
   * port names and Switch or Input node paths. Numbers only: the engine does
   * not coerce, so a boolean would land in sequential state verbatim.
   */
  inputs?: Record<string, number>;
  /** Memory contents loaded before cycle 0, by exact node path (`rom`, `cpu.imem`). */
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

  // The run starts the way simulate(top, { memory }) and set() start one.
  const started = startSimulation(target, compiled, params);
  if ('error' in started) return started;
  const { simulation } = started;
  const nodes = nodesOf(simulation);

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
    simulation.tick();
    const portValues = nodes.ports();

    // Capture full port values for VCD (all internal signals)
    portValuesByTick.push(portValues);

    // Capture top-level signals for RLE compression
    for (const name of signalNames) {
      signals[name].push(portValues.get(`${TOP_LEVEL_NODE}.${name}`) ?? 0);
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

/**
 * A simulation of `target` with `memoryData` loaded and `inputs` set, at cycle
 * 0. Memory paths and input keys resolve exactly, as in `simulate(top, {
 * memory })` and `set()`: a miss is a tool error naming the parameter.
 */
function startSimulation(
  target: CircuitIR,
  compiled: Compiled,
  params: TraceOptions,
): { simulation: Simulation } | SimulateError {
  const simulation = createSimulation(target, compiled.library);
  const nodes = nodesOf(simulation);
  for (const [path, contents] of Object.entries(params.memoryData ?? {})) {
    if (nodes.primitiveOf(path) === undefined) {
      return { error: `memoryData: no node "${path}" in circuit "${target.name}"` };
    }
    try {
      nodes.set(path, contents);
    } catch (e) {
      return { error: `memoryData: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  try {
    simulation.set(params.inputs ?? {});
  } catch (e) {
    return { error: `inputs: ${e instanceof Error ? e.message : String(e)}` };
  }
  // Cycle 0 is with the program and the inputs in place.
  simulation.reset();
  return { simulation };
}
