/** Reference solution for `parity`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { Led, Switch, Xor } from '@simten/core/std';

// XOR is on for an odd number of ones, and stays that way when chained.
export const Parity4 = circuit('Parity4', {
  nodes: { a: Switch, b: Switch, c: Switch, d: Switch, x1: Xor, x2: Xor, x3: Xor, odd: Led },
  connect: ({ nodes: { a, b, c, d, x1, x2, x3, odd } }) => [
    a.out.to(x1.a),
    b.out.to(x1.b),
    c.out.to(x2.a),
    d.out.to(x2.b),
    x1.out.to(x3.a),
    x2.out.to(x3.b),
    x3.out.to(odd.in),
  ],
});
