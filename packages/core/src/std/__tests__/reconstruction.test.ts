/**
 * Equivalence tests for the stdlib reconstruction components (Slice, Concat,
 * SignExtend, ZeroExtend) — the clean, authored-construct replacements for the
 * importer's RtlSlice/RtlConcat2 plumbing. Each is wrapped in a one-node
 * circuit, simulated, and checked against a plain-JS reference across random
 * inputs (fast-check) — the same "lift equivalence" gate as rtl-primitives.
 *
 * Per-instance widths/offsets are passed as node arguments and must reach eval
 * via the bridge merge (same mechanism as BitSlice's low/high) — these tests
 * exercise that path, not just the factory defaults.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { bit, bus, circuit } from '../../circuit/index.js';
import type { BuiltCircuit } from '../../circuit/types.js';
import { simulate } from '../../sim/index.js';
import { SignExtend, Slice, ZeroExtend } from '../reconstruction.js';
import { Concat } from '../routing.js';

let uid = 0;
const port = (w: number) => (w === 1 ? bit : bus(w));
const mask = (w: number) => ((w >= 32 ? 0xffffffff : (1 << w) - 1) >>> 0);
const sext = (v: number, w: number) => ((v >>> 0) >= 2 ** (w - 1) ? (v >>> 0) - 2 ** w : v >>> 0);
const uOf = (w: number) => fc.integer({ min: 0, max: mask(w) }).map((n) => n >>> 0);

/** One-input `in → out` primitive. */
function run1(prim: BuiltCircuit, inW: number, outW: number, v: number): number {
  const w = circuit(`W${uid++}`, {
    inputs: { in: port(inW) } as any,
    outputs: { out: port(outW) } as any,
    nodes: { p: prim } as any,
    connect: ({ inputs: i, outputs, nodes: { p } }: any) => [i.in.to(p.in), p.out.to(outputs.out)],
  } as any);
  const sim = simulate(w);
  sim.set({ in: v });
  const out = sim.get('out') >>> 0;
  sim.dispose();
  return out;
}

/** Two-input `high, low → out` (Concat). */
function run2(prim: BuiltCircuit, hiW: number, loW: number, hi: number, lo: number): number {
  const w = circuit(`W${uid++}`, {
    inputs: { high: port(hiW), low: port(loW) } as any,
    outputs: { out: port(hiW + loW) } as any,
    nodes: { p: prim } as any,
    connect: ({ inputs: i, outputs, nodes: { p } }: any) => [
      i.high.to(p.high),
      i.low.to(p.low),
      p.out.to(outputs.out),
    ],
  } as any);
  const sim = simulate(w);
  sim.set({ high: hi, low: lo });
  const out = sim.get('out') >>> 0;
  sim.dispose();
  return out;
}

describe('Slice — in[offset +: width]', () => {
  const cases: [number, number, number][] = [
    [8, 0, 4],
    [8, 4, 4],
    [32, 0, 7], // RV32I opcode
    [32, 12, 20],
    [16, 15, 1], // MSB → bit output
    [32, 20, 12],
  ];
  it.each(cases)('inWidth=%i offset=%i width=%i', (inW, off, wid) => {
    const p = Slice({ inWidth: inW, offset: off, width: wid });
    fc.assert(
      fc.property(uOf(inW), (v) => run1(p, inW, wid, v) === (((v >>> off) & mask(wid)) >>> 0)),
    );
  });
});

describe('Concat — {high, low}', () => {
  it('default 4+4→8 is backward-compatible ((high<<4)|low)', () => {
    const p = Concat();
    fc.assert(fc.property(uOf(4), uOf(4), (hi, lo) => run2(p, 4, 4, hi, lo) === (((hi << 4) | lo) >>> 0)));
  });
  const cases: [number, number][] = [
    [4, 4],
    [1, 31], // 1-bit hi above a 31-bit low (the *2**lw wide path)
    [16, 16],
    [24, 8],
    [8, 24],
  ];
  it.each(cases)('hiWidth=%i loWidth=%i', (hiW, loW) => {
    const p = Concat({ hiWidth: hiW, loWidth: loW });
    fc.assert(
      fc.property(uOf(hiW), uOf(loW), (hi, lo) => run2(p, hiW, loW, hi, lo) === ((hi * 2 ** loW + lo) >>> 0)),
    );
  });
});

describe('SignExtend — replicate MSB', () => {
  const cases: [number, number][] = [
    [4, 8],
    [12, 32], // RV32I immediate
    [8, 32],
    [1, 8], // single sign bit fanned out
    [16, 32],
  ];
  it.each(cases)('inWidth=%i outWidth=%i', (inW, outW) => {
    const p = SignExtend({ inWidth: inW, outWidth: outW });
    fc.assert(
      fc.property(uOf(inW), (v) => run1(p, inW, outW, v) === ((sext(v, inW) & mask(outW)) >>> 0)),
    );
  });
  it('concrete: 0xF (4-bit −1) → 0xFF (8-bit); 0x7 (4-bit +7) → 0x07', () => {
    expect(run1(SignExtend({ inWidth: 4, outWidth: 8 }), 4, 8, 0xf)).toBe(0xff);
    expect(run1(SignExtend({ inWidth: 4, outWidth: 8 }), 4, 8, 0x7)).toBe(0x07);
    // 12-bit −1 → 32-bit all ones
    expect(run1(SignExtend({ inWidth: 12, outWidth: 32 }), 12, 32, 0xfff)).toBe(0xffffffff);
  });
});

describe('ZeroExtend — pad high with 0', () => {
  const cases: [number, number][] = [
    [8, 32],
    [4, 8],
    [16, 32],
    [1, 8],
  ];
  it.each(cases)('inWidth=%i outWidth=%i (value unchanged)', (inW, outW) => {
    const p = ZeroExtend({ inWidth: inW, outWidth: outW });
    fc.assert(fc.property(uOf(inW), (v) => run1(p, inW, outW, v) === (v >>> 0)));
  });
});
