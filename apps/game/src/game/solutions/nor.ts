/** Reference solution for `nor`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { Led, Not, Or, Switch } from '@simten/core/std';

export const Nor1 = circuit('Nor1', {
  nodes: { a: Switch, b: Switch, or1: Or, not1: Not, result: Led },
  connect: ({ nodes: { a, b, or1, not1, result } }) => [
    a.out.to(or1.a),
    b.out.to(or1.b),
    or1.out.to(not1.in),
    not1.out.to(result.in),
  ],
});
