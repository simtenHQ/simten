/**
 * Equivalence test for BusXnor ($xnor) — bitwise XNOR, checked vs a JS reference
 * at the importer's widths.
 */
import fc from 'fast-check';
import { describe, it } from 'vitest';
import { bus, circuit } from '../../circuit/index.js';
import { simulate } from '../../sim/index.js';
import { BusXnor } from '../arithmetic.js';

let uid = 0;
const mask = (w: number) => (w >= 32 ? 0xffffffff : (1 << w) - 1) >>> 0;
const uOf = (w: number) => fc.integer({ min: 0, max: mask(w) }).map((n) => n >>> 0);

function xnor(width: number, a: number, b: number): number {
  const w = circuit(`X${uid++}`, {
    inputs: { a: bus(width), b: bus(width) } as any,
    outputs: { out: bus(width) } as any,
    nodes: { p: BusXnor({ width }) } as any,
    connect: ({ inputs: i, outputs: o, nodes: { p } }: any) => [
      i.a.to(p.a),
      i.b.to(p.b),
      p.out.to(o.out),
    ],
  } as any);
  const sim = simulate(w);
  sim.set({ a, b });
  const out = sim.get('out') >>> 0;
  sim.dispose();
  return out;
}

describe('BusXnor ($xnor)', () => {
  for (const w of [8, 16, 32]) {
    it(`width ${w} = ~(a ^ b)`, () => {
      fc.assert(
        fc.property(uOf(w), uOf(w), (a, b) => xnor(w, a, b) === ((~(a ^ b) >>> 0) & mask(w)) >>> 0),
      );
    });
  }
});
