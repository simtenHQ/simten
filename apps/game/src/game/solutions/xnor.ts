/** Reference solution for `xnor`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { Led, Not, Switch, Xor } from '@simten/core/std';

export const Xnor1 = circuit('Xnor1', {
  nodes: { a: Switch, b: Switch, xor1: Xor, not1: Not, result: Led },
  connect: ({ nodes: { a, b, xor1, not1, result } }) => [
    a.out.to(xor1.a),
    b.out.to(xor1.b),
    xor1.out.to(not1.in),
    not1.out.to(result.in),
  ],
});
