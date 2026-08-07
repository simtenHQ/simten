/** Reference solution for `half-adder`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { And, Led, Switch, Xor } from '@simten/core/std';

export const HalfAdder = circuit('HalfAdder', {
  nodes: { a: Switch, b: Switch, x1: Xor, a1: And, sum: Led, carry: Led },
  connect: ({ nodes: { a, b, x1, a1, sum, carry } }) => [
    a.out.to(x1.a, a1.a),
    b.out.to(x1.b, a1.b),
    x1.out.to(sum.in),
    a1.out.to(carry.in),
  ],
});
