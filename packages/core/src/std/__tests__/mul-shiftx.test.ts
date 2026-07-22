/**
 * Equivalence tests for the two foreign-Verilog cells added last: WrappingMultiplier
 * ($mul, low width bits) and DynamicSlice ($shiftx, indexed part-select). Checked
 * vs plain-JS references (BigInt for the exact truncated product) at 8/16/32-bit.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { bus, circuit } from '../../circuit/index.js';
import { simulate } from '../../sim/index.js';
import { DynamicSlice } from '../reconstruction.js';
import { WrappingMultiplier } from '../arithmetic.js';

let uid = 0;
const mask = (w: number) => ((w >= 32 ? 0xffffffff : (1 << w) - 1) >>> 0);
const uOf = (w: number) => fc.integer({ min: 0, max: mask(w) }).map((n) => n >>> 0);

function mul(width: number, a: number, b: number): number {
  const w = circuit(`M${uid++}`, {
    inputs: { a: bus(32), b: bus(32) } as any,
    outputs: { out: bus(width) } as any,
    nodes: { p: WrappingMultiplier({ width }) } as any,
    connect: ({ inputs: i, outputs: o, nodes: { p } }: any) => [i.a.to(p.a), i.b.to(p.b), p.out.to(o.out)],
  } as any);
  const sim = simulate(w);
  sim.set({ a, b });
  const out = sim.get('out') >>> 0;
  sim.dispose();
  return out;
}

function dslice(inWidth: number, shiftWidth: number, outWidth: number, v: number, s: number): number {
  const w = circuit(`D${uid++}`, {
    inputs: { in: bus(inWidth), shift: bus(shiftWidth) } as any,
    outputs: { out: bus(outWidth) } as any,
    nodes: { p: DynamicSlice({ inWidth, shiftWidth, outWidth }) } as any,
    connect: ({ inputs: i, outputs: o, nodes: { p } }: any) => [i.in.to(p.in), i.shift.to(p.shift), p.out.to(o.out)],
  } as any);
  const sim = simulate(w);
  sim.set({ in: v, shift: s });
  const out = sim.get('out') >>> 0;
  sim.dispose();
  return out;
}

describe('WrappingMultiplier ($mul, low width bits)', () => {
  for (const w of [8, 16, 32]) {
    it(`width ${w} matches BigInt truncated product`, () => {
      const ref = (a: number, b: number) => Number((BigInt(a >>> 0) * BigInt(b >>> 0)) & BigInt(mask(w)));
      fc.assert(fc.property(uOf(w), uOf(w), (a, b) => mul(w, a, b) === ref(a, b)));
    });
  }
  it('exactness at 32-bit (product exceeds 2^53): 0xFFFFFFFF * 0xFFFFFFFF = 0x00000001', () => {
    expect(mul(32, 0xffffffff, 0xffffffff)).toBe(1);
  });
});

describe('DynamicSlice ($shiftx, indexed part-select)', () => {
  it('in[shift +: outWidth] with out-of-range → 0', () => {
    const cases: [number, number, number][] = [
      [8, 4, 1], // led_sreg_driver shape
      [16, 32, 4],
      [32, 32, 8],
      [32, 8, 16],
    ];
    for (const [inW, shW, outW] of cases) {
      fc.assert(
        fc.property(uOf(inW), fc.integer({ min: 0, max: inW + 4 }), (v, s) => {
          const ref = s >= inW ? 0 : (((v >>> 0) >>> s) & mask(outW)) >>> 0;
          return dslice(inW, shW, outW, v, s) === ref;
        }),
      );
    }
  });
});
