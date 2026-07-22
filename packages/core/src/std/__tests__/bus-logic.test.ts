/**
 * Equivalence tests for the bus-width logical (&&, ||, !) and reduction
 * (|a, &a, ^a) operators, checked against a plain-JS reference over random
 * inputs at the widths the Verilog importer uses. The importer lifts the
 * yosys $logic_ and $reduce_ cells onto these, so semantics must match exactly.
 */

import fc from 'fast-check';
import { describe, it } from 'vitest';
import { bit, bus, circuit } from '../../circuit/index.js';
import type { BuiltCircuit } from '../../circuit/types.js';
import { simulate } from '../../sim/index.js';
import { LogicAnd, LogicNot, LogicOr, ReduceAnd, ReduceOr, ReduceXor } from '../logic.js';

let uid = 0;
const mask = (w: number) => ((w >= 32 ? 0xffffffff : (1 << w) - 1) >>> 0);
const uOf = (w: number) => fc.integer({ min: 0, max: mask(w) }).map((n) => n >>> 0);
const parity = (a: number) => {
  let x = a >>> 0;
  let p = 0;
  while (x) {
    p ^= x & 1;
    x >>>= 1;
  }
  return p;
};

function unary(prim: BuiltCircuit, v: number): number {
  const w = circuit(`U${uid++}`, {
    inputs: { a: bus(32) } as any,
    outputs: { out: bit } as any,
    nodes: { p: prim } as any,
    connect: ({ inputs: i, outputs: o, nodes: { p } }: any) => [i.a.to(p.a), p.out.to(o.out)],
  } as any);
  const sim = simulate(w);
  sim.set({ a: v });
  const out = sim.get('out');
  sim.dispose();
  return out;
}

function binary(prim: BuiltCircuit, a: number, b: number): number {
  const w = circuit(`B${uid++}`, {
    inputs: { a: bus(32), b: bus(32) } as any,
    outputs: { out: bit } as any,
    nodes: { p: prim } as any,
    connect: ({ inputs: i, outputs: o, nodes: { p } }: any) => [
      i.a.to(p.a),
      i.b.to(p.b),
      p.out.to(o.out),
    ],
  } as any);
  const sim = simulate(w);
  sim.set({ a, b });
  const out = sim.get('out');
  sim.dispose();
  return out;
}

describe('logical (bus → bit)', () => {
  it('LogicAnd = (a!=0) && (b!=0)', () => {
    const p = LogicAnd({ aWidth: 8, bWidth: 16 });
    fc.assert(fc.property(uOf(8), uOf(16), (a, b) => binary(p, a, b) === (a !== 0 && b !== 0 ? 1 : 0)));
  });
  it('LogicOr = (a!=0) || (b!=0)', () => {
    const p = LogicOr({ aWidth: 8, bWidth: 16 });
    fc.assert(fc.property(uOf(8), uOf(16), (a, b) => binary(p, a, b) === (a !== 0 || b !== 0 ? 1 : 0)));
  });
  it('LogicNot = (a==0)', () => {
    const p = LogicNot({ width: 32 });
    fc.assert(fc.property(uOf(32), (a) => unary(p, a) === (a === 0 ? 1 : 0)));
  });
});

describe('reductions (bus → bit)', () => {
  for (const w of [8, 32]) {
    it(`ReduceOr |a (width ${w})`, () => {
      const p = ReduceOr({ width: w });
      fc.assert(fc.property(uOf(w), (a) => unary(p, a) === (a !== 0 ? 1 : 0)));
    });
    it(`ReduceAnd &a (width ${w})`, () => {
      const p = ReduceAnd({ width: w });
      fc.assert(fc.property(uOf(w), (a) => unary(p, a) === (a === mask(w) ? 1 : 0)));
    });
    it(`ReduceXor ^a (width ${w})`, () => {
      const p = ReduceXor({ width: w });
      fc.assert(fc.property(uOf(w), (a) => unary(p, a) === parity(a)));
    });
  }
});
