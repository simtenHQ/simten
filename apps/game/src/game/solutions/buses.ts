/** Reference solution for `buses`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core';
import { Combiner, HexDisplay, Input, Not, Splitter } from '@simten/core/std';

export const Invert4 = circuit('Invert4', {
  nodes: {
    a: Input({ width: 4 }),
    bits: Splitter({ width: 4 }),
    n0: Not,
    n1: Not,
    n2: Not,
    n3: Not,
    join: Combiner({ width: 4 }),
    out: HexDisplay({ width: 4 }),
  },
  connect: ({ nodes: { a, bits, n0, n1, n2, n3, join, out } }) => [
    a.out.to(bits.in),
    bits.bit0.to(n0.in),
    bits.bit1.to(n1.in),
    bits.bit2.to(n2.in),
    bits.bit3.to(n3.in),
    n0.out.to(join.bit0),
    n1.out.to(join.bit1),
    n2.out.to(join.bit2),
    n3.out.to(join.bit3),
    join.out.to(out.in),
  ],
});
