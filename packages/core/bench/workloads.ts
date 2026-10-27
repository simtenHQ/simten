import { internalsOf } from '../src/circuit/internals.js';
import { EXAMPLES } from '../src/examples/catalog.js';
import { createEngine, elaborate } from '../src/simulator/index.js';
import type { SimulatorEngine } from '../src/simulator/types.js';
import { executeCircuitCode } from '../src/source/execute.js';

export interface Workload {
  id: string;
  /** Ticks per timed run, and the point the fingerprint is taken at. */
  ticks: number;
  /** Drive every top-level input with fresh pseudo-random values before each tick. */
  randomInputs: boolean;
}

// The bundled examples are what people run in the editor, and the browser
// bench uses the same ones.
export const WORKLOADS: Workload[] = [
  { id: 'rule30', ticks: 60_000, randomInputs: false },
  { id: 'hack-alu', ticks: 90_000, randomInputs: true },
  { id: 'snake', ticks: 15_000, randomInputs: false },
  { id: 'rv32i-computer', ticks: 8_000, randomInputs: false },
  { id: '6502-computer', ticks: 15_000, randomInputs: false },
];

export interface Loaded {
  engine: SimulatorEngine;
  /** Applies the next set of inputs (if any) and ticks once. */
  step(): void;
}

export function load(workload: Workload): Loaded {
  const example = EXAMPLES.find((e) => e.id === workload.id);
  if (!example) throw new Error(`no example '${workload.id}'`);
  const compiled = executeCircuitCode(example.code);
  if (compiled.error) throw new Error(`${workload.id}: ${compiled.error}`);
  // An example's top is the last circuit it builds, the one the editor runs.
  const top = internalsOf(compiled.circuits[compiled.circuits.length - 1]).ir;
  const engine = createEngine(elaborate(top, compiled.library.definitions), {
    library: compiled.library,
  });

  if (!workload.randomInputs) return { engine, step: () => engine.tick() };

  const inputs = top.inputs.map((p) => ({
    name: p.name,
    mask: p.portType.kind === 'bus' ? 2 ** p.portType.width - 1 : 1,
  }));
  let seed = 1;
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  };
  return {
    engine,
    step: () => {
      for (const { name, mask } of inputs) engine.setNode(name, next() & mask);
      engine.tick();
    },
  };
}
