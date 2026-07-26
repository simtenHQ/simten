/**
 * Equivalence tests for the extended comparators — the six flags eq/ne/lt/le/gt/ge
 * on Comparator (unsigned) and SignedComparator (signed, width-parameterized),
 * checked against a plain-JS reference across random inputs and at the widths the
 * Verilog importer uses (8/16/32). This is the "pin comparator semantics once"
 * gate: the importer maps $lt/$le/$gt/$ge/$eq/$ne uniformly onto these flags.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { bus, circuit } from '../../circuit/index.js';
import type { BuiltCircuit } from '../../circuit/types.js';
import { simulate } from '../../sim/index.js';
import { Comparator, SignedComparator } from '../arithmetic.js';

let uid = 0;
const mask = (w: number) => (w >= 32 ? 0xffffffff : (1 << w) - 1) >>> 0;
const sext = (v: number, w: number) => (v >>> 0 >= 2 ** (w - 1) ? (v >>> 0) - 2 ** w : v >>> 0);
const uOf = (w: number) => fc.integer({ min: 0, max: mask(w) }).map((n) => n >>> 0);

function flags(prim: BuiltCircuit, w: number, a: number, b: number): Record<string, number> {
  const wrap = circuit(`C${uid++}`, {
    inputs: { a: bus(32), b: bus(32) } as any,
    outputs: { eq: 1, ne: 1, lt: 1, le: 1, gt: 1, ge: 1 } as any,
    nodes: { p: prim } as any,
    connect: ({ inputs: i, outputs: o, nodes: { p } }: any) => [
      i.a.to(p.a),
      i.b.to(p.b),
      p.eq.to(o.eq),
      p.ne.to(o.ne),
      p.lt.to(o.lt),
      p.le.to(o.le),
      p.gt.to(o.gt),
      p.ge.to(o.ge),
    ],
  } as any);
  const sim = simulate(wrap);
  sim.set({ a, b });
  const out = {
    eq: sim.get('eq'),
    ne: sim.get('ne'),
    lt: sim.get('lt'),
    le: sim.get('le'),
    gt: sim.get('gt'),
    ge: sim.get('ge'),
  };
  sim.dispose();
  return out;
}

const bit = (x: boolean) => (x ? 1 : 0);

describe('Comparator (unsigned) — all six flags', () => {
  for (const w of [8, 16, 32]) {
    it(`width ${w}`, () => {
      const p = Comparator({ width: w });
      fc.assert(
        fc.property(uOf(w), uOf(w), (a, b) => {
          const f = flags(p, w, a, b);
          return (
            f.eq === bit(a === b) &&
            f.ne === bit(a !== b) &&
            f.lt === bit(a < b) &&
            f.le === bit(a <= b) &&
            f.gt === bit(a > b) &&
            f.ge === bit(a >= b)
          );
        }),
      );
    });
  }
});

describe('SignedComparator — all six flags, width-aware sign', () => {
  for (const w of [8, 16, 32]) {
    it(`width ${w}`, () => {
      const p = SignedComparator({ width: w });
      fc.assert(
        fc.property(uOf(w), uOf(w), (a, b) => {
          const as = sext(a, w);
          const bs = sext(b, w);
          const f = flags(p, w, a, b);
          return (
            f.eq === bit(as === bs) &&
            f.ne === bit(as !== bs) &&
            f.lt === bit(as < bs) &&
            f.le === bit(as <= bs) &&
            f.gt === bit(as > bs) &&
            f.ge === bit(as >= bs)
          );
        }),
      );
    });
  }

  it('signed differs from unsigned on high operands', () => {
    // -1 (all ones) < 1 signed, but > 1 unsigned
    expect(flags(SignedComparator({ width: 32 }), 32, 0xffffffff, 1).lt).toBe(1);
    expect(flags(Comparator({ width: 32 }), 32, 0xffffffff, 1).lt).toBe(0);
  });
});
