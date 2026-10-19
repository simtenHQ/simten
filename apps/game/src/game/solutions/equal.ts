/** Reference solution for `equal`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { And, Led, Switch, Xnor } from '@simten/core/std';

// XNOR says whether one pair of bits matches, and a four-wide AND needs all
// four to.
export const Equal4 = circuit('Equal4', {
  nodes: {
    a3: Switch,
    a2: Switch,
    a1: Switch,
    a0: Switch,
    b3: Switch,
    b2: Switch,
    b1: Switch,
    b0: Switch,
    m3: Xnor,
    m2: Xnor,
    m1: Xnor,
    m0: Xnor,
    low: And,
    high: And,
    both: And,
    eq: Led,
  },
  connect: ({ nodes: { a3, a2, a1, a0, b3, b2, b1, b0, m3, m2, m1, m0, low, high, both, eq } }) => [
    a3.out.to(m3.a),
    b3.out.to(m3.b),
    a2.out.to(m2.a),
    b2.out.to(m2.b),
    a1.out.to(m1.a),
    b1.out.to(m1.b),
    a0.out.to(m0.a),
    b0.out.to(m0.b),
    m0.out.to(low.a),
    m1.out.to(low.b),
    m2.out.to(high.a),
    m3.out.to(high.b),
    low.out.to(both.a),
    high.out.to(both.b),
    both.out.to(eq.in),
  ],
});
