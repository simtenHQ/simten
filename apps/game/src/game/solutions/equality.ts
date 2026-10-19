/** Reference solution for `equality`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { And, Input, Led, Splitter, Xnor } from '@simten/core/std';

// XNOR says whether one pair of bits matches, and a four-wide AND needs all
// four to.
export const Equal4 = circuit('Equal4', {
  nodes: {
    a: Input({ width: 4 }),
    aBits: Splitter({ width: 4 }),
    b: Input({ width: 4 }),
    bBits: Splitter({ width: 4 }),
    m3: Xnor,
    m2: Xnor,
    m1: Xnor,
    m0: Xnor,
    low: And,
    high: And,
    both: And,
    eq: Led,
  },
  connect: ({ nodes: { a, aBits, b, bBits, m3, m2, m1, m0, low, high, both, eq } }) => [
    a.out.to(aBits.in),
    b.out.to(bBits.in),
    aBits.bit3.to(m3.a),
    bBits.bit3.to(m3.b),
    aBits.bit2.to(m2.a),
    bBits.bit2.to(m2.b),
    aBits.bit1.to(m1.a),
    bBits.bit1.to(m1.b),
    aBits.bit0.to(m0.a),
    bBits.bit0.to(m0.b),
    m0.out.to(low.a),
    m1.out.to(low.b),
    m2.out.to(high.a),
    m3.out.to(high.b),
    low.out.to(both.a),
    high.out.to(both.b),
    both.out.to(eq.in),
  ],
});
