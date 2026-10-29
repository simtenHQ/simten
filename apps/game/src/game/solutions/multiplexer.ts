/** Reference solution for `multiplexer`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core';
import { And, Led, Switch, Xor } from '@simten/core/std';

// out = a XOR (sel AND (a XOR b)). With sel off the AND is 0 and a passes
// unchanged; with it on, a XOR a XOR b leaves b. Three gates, which an
// exhaustive search over the level's gates confirms is the minimum.
export const Mux2 = circuit('Mux2', {
  nodes: { a: Switch, b: Switch, sel: Switch, x1: Xor, a1: And, x2: Xor, out: Led },
  connect: ({ nodes: { a, b, sel, x1, a1, x2, out } }) => [
    a.out.to(x1.a, x2.a),
    b.out.to(x1.b),
    x1.out.to(a1.a),
    sel.out.to(a1.b),
    a1.out.to(x2.b),
    x2.out.to(out.in),
  ],
});
