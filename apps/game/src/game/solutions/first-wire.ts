/** Reference solution for `first-wire`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { Led, Nand, Switch } from '@simten/core/std';

export const Nand1 = circuit('Nand1', {
  nodes: { a: Switch, b: Switch, n1: Nand, result: Led },
  connect: ({ nodes: { a, b, n1, result } }) => [
    a.out.to(n1.a),
    b.out.to(n1.b),
    n1.out.to(result.in),
  ],
});
