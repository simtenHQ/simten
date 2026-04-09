/**
 * Property-Based Testing with fast-check
 *
 * Demonstrates using npm libraries to exhaustively verify circuit behavior.
 * This is something you literally cannot do in Logisim or Verilog without
 * writing a testbench — here it's 5 lines with fast-check.
 *
 * These tests verify algebraic properties of circuits across hundreds of
 * random inputs, catching edge cases that hand-written truth tables miss.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { simulate } from '../../sim/simulate.js';
import { circuit, bit, bus } from '../../circuit/index.js';
import { And, Or, Xor, Not, Adder, Comparator } from '../../std/index.js';

// ============================================================================
// Fixtures
// ============================================================================

const HalfAdder = circuit('HalfAdder', {
  in: { a: bit, b: bit },
  out: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
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

// ============================================================================
// Property-based tests
// ============================================================================

describe('property-based circuit verification', () => {
  it('HalfAdder: sum + 2*carry always equals a + b', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (a, b) => {
        const sim = simulate(HalfAdder);
        try {
          sim.set({ a: a ? 1 : 0, b: b ? 1 : 0 });
          const sum = sim.get('sum');
          const carry = sim.get('carry');
          return sum + 2 * carry === (a ? 1 : 0) + (b ? 1 : 0);
        } finally {
          sim.dispose();
        }
      }),
      { numRuns: 100 },
    );
  });

  it('FullAdder: sum + 2*cout always equals a + b + cin', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.boolean(), (a, b, cin) => {
        const sim = simulate(FullAdder);
        try {
          sim.set({ a: a ? 1 : 0, b: b ? 1 : 0, cin: cin ? 1 : 0 });
          const sum = sim.get('sum');
          const cout = sim.get('cout');
          return sum + 2 * cout === (a ? 1 : 0) + (b ? 1 : 0) + (cin ? 1 : 0);
        } finally {
          sim.dispose();
        }
      }),
      { numRuns: 100 },
    );
  });

  it('Adder: 8-bit addition matches JavaScript arithmetic', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        (a, b) => {
          const sim = simulate(Adder);
          try {
            sim.set({ a, b, carry_in: 0 });
            const sum = sim.get('sum');
            const carry_out = sim.get('carry_out');
            return sum + 256 * carry_out === a + b;
          } finally {
            sim.dispose();
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('XOR is its own inverse: a ^ b ^ b === a', () => {
    const DoubleXor = circuit('DoubleXor', {
      in: { a: bit, b: bit },
      out: { result: bit },
      nodes: { xor1: Xor, xor2: Xor },
      connect: ({ in: inp, out, xor1, xor2 }) => [
        inp.a.to(xor1.a),
        inp.b.to(xor1.b, xor2.b),
        xor1.out.to(xor2.a),
        xor2.out.to(out.result),
      ],
    });

    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (a, b) => {
        const sim = simulate(DoubleXor);
        try {
          sim.set({ a: a ? 1 : 0, b: b ? 1 : 0 });
          return sim.get('result') === (a ? 1 : 0);
        } finally {
          sim.dispose();
        }
      }),
      { numRuns: 100 },
    );
  });

  it('Comparator: eq/lt/gt flags are consistent and exhaustive', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        (a, b) => {
          const sim = simulate(Comparator);
          try {
            sim.set({ a, b });
            const eq = sim.get('eq');
            const lt = sim.get('lt');
            const gt = sim.get('gt');

            // Exactly one flag is set
            if (eq + lt + gt !== 1) return false;
            // Flags match JavaScript comparison
            if (a === b) return eq === 1;
            if (a < b) return lt === 1;
            return gt === 1;
          } finally {
            sim.dispose();
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});
