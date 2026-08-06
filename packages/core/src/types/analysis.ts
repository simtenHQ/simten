/**
 * Analysis Types
 *
 * Simulation-trace types and helpers consumed by `api/simulate.ts`, plus the
 * `getCircuitAPISummary` reference snippet returned by `api/grammar.ts`.
 *
 * The richer validation/envelope/diagnostic surface that used to live here
 * was removed in the Diagnostics-sidebar cleanup (issue #99) — it had no
 * runtime producer, and every consumer was dead code.
 */

import type { BitValue, BusValue } from './circuit.js';

// ============================================================================
// Simulation Traces
// ============================================================================

export interface SimulationTrace {
  cycles: number;
  signals: Record<string, (BitValue | BusValue)[]>;
  registers: Record<string, (BitValue | BusValue)[]>;
  sampleRate: number;
  sampledCycles: number[];
  steadyStateAt?: number;
  signalMetrics?: Record<string, SignalMetrics>;
}

export interface SignalMetrics {
  transitions: number;
  dutyCycle?: number;
}

// ============================================================================
// Trace utilities
// ============================================================================

/**
 * Compress unchanged runs in a trace for efficiency (RLE encoding).
 */
export function compressTrace(
  trace: SimulationTrace,
): Record<string, Array<{ value: BitValue | BusValue; count: number }>> {
  const compressed: Record<string, Array<{ value: BitValue | BusValue; count: number }>> = {};

  for (const [signal, values] of Object.entries(trace.signals)) {
    compressed[signal] = compressRuns(values);
  }

  for (const [reg, values] of Object.entries(trace.registers)) {
    compressed[reg] = compressRuns(values);
  }

  return compressed;
}

function compressRuns<T>(values: T[]): Array<{ value: T; count: number }> {
  if (values.length === 0) return [];
  const runs: Array<{ value: T; count: number }> = [];
  let currentRun = { value: values[0], count: 1 };
  for (let i = 1; i < values.length; i++) {
    if (values[i] === currentRun.value) {
      currentRun.count++;
    } else {
      runs.push(currentRun);
      currentRun = { value: values[i], count: 1 };
    }
  }
  runs.push(currentRun);
  return runs;
}

/**
 * Detect steady state: the earliest cycle at which all signals become constant.
 */
export function detectSteadyState(trace: SimulationTrace): number | undefined {
  const STEADY_STATE_WINDOW = 5;
  const allSeries = [...Object.values(trace.signals), ...Object.values(trace.registers)];
  const totalSamples = trace.sampledCycles.length;
  if (totalSamples < STEADY_STATE_WINDOW) return undefined;

  for (let startIdx = 0; startIdx <= totalSamples - STEADY_STATE_WINDOW; startIdx++) {
    let allConstant = true;
    for (const series of allSeries) {
      if (series.length === 0) continue;
      const ref = series[startIdx];
      for (let i = startIdx + 1; i < series.length; i++) {
        if (series[i] !== ref) {
          allConstant = false;
          break;
        }
      }
      if (!allConstant) break;
    }
    if (allConstant) return trace.sampledCycles[startIdx];
  }
  return undefined;
}

// ============================================================================
// Circuit API Summary
// ============================================================================

export function getCircuitAPISummary(): string {
  return `// Circuit API — write circuit files as standalone TS modules with imports,
// and EXPORT the top-level circuit so a testbench (.verify.ts) can import it.
// Valid in your editor, runnable with tsx/vitest.

import { circuit, bit, bus } from '@simten/core/circuit';
import { Xor, And, Register, Adder, Constant } from '@simten/core/std';

// Composite circuit — wire stdlib components together (export it):
export const HalfAdder = circuit('HalfAdder', {
  inputs:  { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes:   { xor1: Xor, and1: And },
  connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
    inputs.a.to(xor1.a, and1.a),
    inputs.b.to(xor1.b, and1.b),
    xor1.out.to(outputs.sum),
    and1.out.to(outputs.carry),
  ],
});

// Sequential circuit — Register + Adder feedback loop:
const Counter = circuit('Counter', {
  outputs: { count: bus(8) },
  nodes: {
    reg: Register({ width: 8 }),
    adder: Adder({ width: 8 }),
    one: Constant({ value: 1 }),
    we: Constant({ value: 1 }),
    zero: Constant({ value: 0 }),
  },
  connect: ({ outputs, nodes: { reg, adder, one, we, zero } }) => [
    reg.q.to(adder.a),
    one.out.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(reg.data),
    we.out.to(reg.we),  // write-enable must be wired — Constant({ value: 1 }) for always-on
    reg.q.to(outputs.count),
  ],
});

// Need N of something? A nodes entry can be an array, expanded to \`n0\`, \`n1\`,
// … and wired as \`n[i]\`. Ordinary TypeScript — no helper, and \`n[i].a\`
// autocompletes because an array keeps its element type:
const ByteNot = circuit('ByteNot', {
  nodes: {
    a:   Array.from({ length: 8 }, () => Switch),
    n:   Array.from({ length: 8 }, () => Nand),
    out: Array.from({ length: 8 }, () => Led),
  },
  connect: ({ nodes: { a, n, out } }) =>
    a.flatMap((sw, i) => [
      sw.out.to(n[i].a, n[i].b),
      n[i].out.to(out[i].in),
    ]),
});

// Parameterized components are factory calls — call them with the options
// you want to specialize:
const Adder8 = circuit('Adder8', {
  inputs:  { a: bus(8), b: bus(8) },
  outputs: { sum: bus(8), carry: bit },
  nodes:   { add: Adder({ width: 8 }) },
  connect: ({ inputs, outputs, nodes: { add } }) => [
    inputs.a.to(add.a),
    inputs.b.to(add.b),
    add.sum.to(outputs.sum),
    add.carry_out.to(outputs.carry),
  ],
});

// Stdlib components import from '@simten/core/std':
// And, Or, Not, Xor, Nand, Nor, Adder, Register, Mux, Decoder,
// ROM, RAM, DFlipFlop, Switch, Led, Input, Output, Constant, ...
// (circuit/bit/bus/reg/mem come from '@simten/core/circuit'.)
`;
}
