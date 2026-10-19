/** Reference solution for `negative-numbers`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { Combiner, HexDisplay, Input, Or, Splitter, Xor } from '@simten/core/std';

// Flip and add one, worked out per bit: everything up to and including the
// lowest 1 stays, everything above it flips. So a bit flips exactly when some
// bit below it is on. Bit 0 is a bare wire, and five gates is the minimum an
// exhaustive search finds.
export const Negate4 = circuit('Negate4', {
  nodes: {
    a: Input({ width: 4 }),
    aBits: Splitter({ width: 4 }),
    x1: Xor,
    below2: Or,
    x2: Xor,
    below3: Or,
    x3: Xor,
    n: HexDisplay({ width: 4 }),
    nBits: Combiner({ width: 4 }),
  },
  connect: ({ nodes: { a, aBits, x1, below2, x2, below3, x3, n, nBits } }) => [
    a.out.to(aBits.in),
    nBits.out.to(n.in),
    aBits.bit0.to(nBits.bit0, x1.b, below2.b),
    aBits.bit1.to(x1.a, below2.a),
    x1.out.to(nBits.bit1),
    aBits.bit2.to(x2.a, below3.a),
    below2.out.to(x2.b, below3.b),
    x2.out.to(nBits.bit2),
    aBits.bit3.to(x3.a),
    below3.out.to(x3.b),
    x3.out.to(nBits.bit3),
  ],
});
