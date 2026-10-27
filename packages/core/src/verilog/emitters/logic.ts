/** Logic gates, their bus forms, and reductions: one `assign` each. */

import { type Emitter, getWidth, ones, pins } from './helpers.js';

/** One `assign` to `out` from an expression over the node's input nets. */
function assignOut(expr: (i: (port: string) => string, width: number) => string): Emitter {
  return ({ wires, args }) => {
    const { i, o } = pins(wires);
    return { lines: [`assign ${o('out')} = ${expr(i, getWidth(args))};`], declarations: [] };
  };
}

export const logicEmitters: Readonly<Record<string, Emitter>> = {
  // ── Logic Gates ──────────────────────────────────────────────────
  And: assignOut((i) => `${i('a')} & ${i('b')}`),
  Or: assignOut((i) => `${i('a')} | ${i('b')}`),
  Not: assignOut((i) => `~${i('in')}`),
  Nand: assignOut((i) => `~(${i('a')} & ${i('b')})`),
  Nor: assignOut((i) => `~(${i('a')} | ${i('b')})`),
  Xor: assignOut((i) => `${i('a')} ^ ${i('b')}`),
  Xnor: assignOut((i) => `~(${i('a')} ^ ${i('b')})`),
  Buffer: assignOut((i) => i('in')),
  Probe: assignOut((i) => i('in')),

  // ── Bus Logic ────────────────────────────────────────────────────
  BusAnd: assignOut((i) => `${i('a')} & ${i('b')}`),
  BusOr: assignOut((i) => `${i('a')} | ${i('b')}`),
  BusXor: assignOut((i) => `${i('a')} ^ ${i('b')}`),
  BusNot: assignOut((i) => `~${i('in')}`),
  BusXnor: assignOut((i) => `~(${i('a')} ^ ${i('b')})`),

  // ── Reductions ───────────────────────────────────────────────────
  // Over the low `width` bits of `a`, as the simulator masks them: the input
  // net can be wider than the port when a narrower source widens into it.
  ReduceAnd: assignOut((i, w) => `((${i('a')} & ${ones(w)}) == ${ones(w)})`),
  ReduceXor: assignOut((i, w) => `^(${i('a')} & ${ones(w)})`),
  ReduceXnor: assignOut((i, w) => `~^(${i('a')} & ${ones(w)})`),
};
