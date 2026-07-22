/**
 * Equivalence test for SignedRightShifter — Verilog `$sshr` (arithmetic right
 * shift, sign-replicating). Checked vs a plain-JS reference using the native
 * arithmetic `>>` over random inputs at the importer's widths.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { bus, circuit } from '../../circuit/index.js';
import { simulate } from '../../sim/index.js';
import { SignedRightShifter } from '../arithmetic.js';

let uid = 0;
const mask = (w: number) => ((w >= 32 ? 0xffffffff : (1 << w) - 1) >>> 0);
const uOf = (w: number) => fc.integer({ min: 0, max: mask(w) }).map((n) => n >>> 0);

function sshr(width: number, value: number, shift: number): number {
  const w = circuit(`S${uid++}`, {
    inputs: { value: bus(32), shift: bus(32) } as any,
    outputs: { result: bus(width) } as any,
    nodes: { p: SignedRightShifter({ width }) } as any,
    connect: ({ inputs: i, outputs: o, nodes: { p } }: any) => [
      i.value.to(p.value),
      i.shift.to(p.shift),
      p.result.to(o.result),
    ],
  } as any);
  const sim = simulate(w);
  sim.set({ value, shift });
  const out = sim.get('result') >>> 0;
  sim.dispose();
  return out;
}

// Independent reference using native arithmetic `>>`.
function ref(value: number, shift: number, w: number): number {
  const u = value >>> 0;
  const s = u >= 2 ** (w - 1) ? u - 2 ** w : u; // two's-complement
  const shifted = shift >= w ? (s < 0 ? -1 : 0) : s >> shift;
  return (shifted & mask(w)) >>> 0;
}

describe('SignedRightShifter ($sshr, arithmetic)', () => {
  for (const w of [8, 16, 32]) {
    it(`width ${w}`, () => {
      fc.assert(
        fc.property(uOf(w), fc.integer({ min: 0, max: w + 2 }), (v, sh) => sshr(w, v, sh) === ref(v, sh, w)),
      );
    });
  }
  it('replicates the sign bit: 0x80000000 >>> 4 = 0xF8000000', () => {
    expect(sshr(32, 0x80000000, 4)).toBe(0xf8000000);
    expect(sshr(8, 0x80, 3)).toBe(0xf0); // -128 >> 3 = -16 = 0xF0
    expect(sshr(8, 0x40, 3)).toBe(0x08); // +64 >> 3 = +8 (no sign fill)
  });
});
