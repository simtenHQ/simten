/**
 * Determinism Properties
 *
 * The README claims the simulator runs "deterministic tick-based execution
 * with cycle-accurate visibility." This file backs that claim with tests
 * that fail loudly the moment any non-determinism creeps in.
 *
 * Each test runs the same circuit twice with the same input sequence and
 * asserts the resulting trace is byte-identical. Coverage spans:
 *   - combinational circuits (HalfAdder)
 *   - composite combinational circuits (FullAdder built from HalfAdders)
 *   - sequential bit-level circuits (Counter2Bit, free-running)
 *   - sequential bus-level circuits (8-bit accumulator)
 *   - reset behavior (a reset followed by the same inputs reproduces the
 *     same trace as a fresh simulator)
 *
 * If any of these break, the entire premise of "I can replay a debugging
 * session" or "the AI tutor's simulate_circuit tool returns reproducible
 * results" goes with them.
 */

import { describe, it, expect } from 'vitest';
import { simulate } from '../../sim/simulate.js';
import { circuit, bit } from '../../circuit/index.js';
import { And, Or, Xor, Adder, Register, DFlipFlop, Not } from '../../std/index.js';

// ============================================================================
// Fixtures
// ============================================================================

const HalfAdder = circuit('HalfAdder', {
  in: { a: bit, b: bit },
  out: { sum: bit, carry: bit },
  nodes: { x1: Xor, a1: And },
  connect: ({ in: inp, out, x1, a1 }) => [
    inp.a.to(x1.a, a1.a),
    inp.b.to(x1.b, a1.b),
    x1.out.to(out.sum),
    a1.out.to(out.carry),
  ],
});

const FullAdder = circuit('FullAdder', {
  in: { a: bit, b: bit, cin: bit },
  out: { sum: bit, cout: bit },
  nodes: { ha1: HalfAdder, ha2: HalfAdder, or1: Or },
  connect: ({ in: inp, out, ha1, ha2, or1 }) => [
    inp.a.to(ha1.a),
    inp.b.to(ha1.b),
    ha1.sum.to(ha2.a),
    inp.cin.to(ha2.b),
    ha2.sum.to(out.sum),
    ha1.carry.to(or1.a),
    ha2.carry.to(or1.b),
    or1.out.to(out.cout),
  ],
});

const Counter2Bit = circuit('Counter2Bit', {
  out: { bit0: bit, bit1: bit },
  nodes: { dff0: DFlipFlop, dff1: DFlipFlop, inv: Not, xor1: Xor },
  connect: ({ out, dff0, dff1, inv, xor1 }) => [
    dff0.q.to(inv.in, xor1.b, out.bit0),
    inv.out.to(dff0.d),
    dff1.q.to(xor1.a, out.bit1),
    xor1.out.to(dff1.d),
  ],
});

const Accumulator = circuit('Accumulator', {
  in: { addend: 8, we: bit },
  out: { q: 8, carry: bit },
  nodes: { reg: Register, add: Adder },
  nodeArgs: { add: { carry_in: 0 } },
  connect: ({ in: inp, out, reg, add }) => [
    reg.q.to(add.a, out.q),
    inp.addend.to(add.b),
    add.sum.to(reg.data),
    inp.we.to(reg.we),
    add.carry_out.to(out.carry),
  ],
});

// ============================================================================
// Helper: run a scripted scenario against a fresh simulator and return its
// full output trace. The driver is a pure function of the simulator handle,
// so calling runTwice(...) lets us assert determinism without leaking state
// between runs.
// ============================================================================

function runTwice<T>(
  build: () => { tick(): void; dispose(): void },
  drive: (sim: any) => T[],
): { a: T[]; b: T[] } {
  const simA = build();
  let a: T[];
  try {
    a = drive(simA);
  } finally {
    simA.dispose();
  }

  const simB = build();
  let b: T[];
  try {
    b = drive(simB);
  } finally {
    simB.dispose();
  }

  return { a, b };
}

// ============================================================================
// Combinational
// ============================================================================

describe('determinism — combinational', () => {
  it('HalfAdder: same input sequence → same output sequence', () => {
    const inputs: Array<{ a: number; b: number }> = [
      { a: 0, b: 0 },
      { a: 1, b: 0 },
      { a: 0, b: 1 },
      { a: 1, b: 1 },
      { a: 1, b: 0 },
      { a: 0, b: 0 },
    ];

    const { a, b } = runTwice(
      () => simulate(HalfAdder),
      (sim) => {
        const trace: Array<{ sum: number; carry: number }> = [];
        for (const inp of inputs) {
          sim.set(inp);
          trace.push({ sum: sim.get('sum'), carry: sim.get('carry') });
        }
        return trace;
      },
    );

    expect(b).toEqual(a);
    // Sanity: at least one non-zero output, otherwise determinism is trivial.
    expect(a.some((row) => row.sum === 1 || row.carry === 1)).toBe(true);
  });

  it('FullAdder (composite): every 3-bit input combination is reproducible', () => {
    // Iterate every (a, b, cin) tuple — covers all 8 cases of the truth
    // table, plus the elaboration path through the nested HalfAdders.
    const inputs: Array<{ a: number; b: number; cin: number }> = [];
    for (let a = 0; a < 2; a++) {
      for (let b = 0; b < 2; b++) {
        for (let cin = 0; cin < 2; cin++) {
          inputs.push({ a, b, cin });
        }
      }
    }

    const { a, b } = runTwice(
      () => simulate(FullAdder),
      (sim) => {
        const trace: Array<{ sum: number; cout: number }> = [];
        for (const inp of inputs) {
          sim.set(inp);
          trace.push({ sum: sim.get('sum'), cout: sim.get('cout') });
        }
        return trace;
      },
    );

    expect(b).toEqual(a);
  });
});

// ============================================================================
// Sequential
// ============================================================================

describe('determinism — sequential', () => {
  it('Counter2Bit: free-running trace is reproducible across fresh simulators', () => {
    const { a, b } = runTwice(
      () => simulate(Counter2Bit),
      (sim) => {
        const trace: number[] = [];
        for (let i = 0; i < 16; i++) {
          sim.tick();
          trace.push((sim.get('bit1') << 1) | sim.get('bit0'));
        }
        return trace;
      },
    );

    expect(b).toEqual(a);
    // Counter should visit every state at least once across 16 ticks.
    expect(new Set(a)).toEqual(new Set([0, 1, 2, 3]));
  });

  it('Accumulator: bus-level sequential trace is reproducible', () => {
    const script: Array<{ addend: number; we: number; ticks: number }> = [
      { addend: 1, we: 1, ticks: 4 },
      { addend: 5, we: 1, ticks: 3 },
      { addend: 0, we: 0, ticks: 2 }, // hold (write disabled)
      { addend: 10, we: 1, ticks: 5 },
    ];

    const { a, b } = runTwice(
      () => simulate(Accumulator),
      (sim) => {
        const trace: number[] = [];
        for (const step of script) {
          sim.set({ addend: step.addend, we: step.we });
          for (let i = 0; i < step.ticks; i++) {
            sim.tick();
            trace.push(sim.get('q'));
          }
        }
        return trace;
      },
    );

    expect(b).toEqual(a);
    // Sanity: the hold-step should leave q unchanged across its window.
    // Step 1+2 produces 4 + 15 = 19 entries before the hold; step 3 adds
    // 2 entries that should equal the value at the end of step 2.
    const beforeHold = a[6]; // last entry of step 2 (4 + 3 = 7, index 6)
    expect(a[7]).toBe(beforeHold);
    expect(a[8]).toBe(beforeHold);
  });

  it('reset followed by the same inputs reproduces the original trace', () => {
    const sim = simulate(Counter2Bit);
    try {
      const drive = () => {
        const trace: number[] = [];
        for (let i = 0; i < 8; i++) {
          sim.tick();
          trace.push((sim.get('bit1') << 1) | sim.get('bit0'));
        }
        return trace;
      };

      const first = drive();
      sim.reset();
      const second = drive();

      expect(second).toEqual(first);
    } finally {
      sim.dispose();
    }
  });
});
