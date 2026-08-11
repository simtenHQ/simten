/** Reference solution for `and-from-nand`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { Led, Nand, Switch } from '@simten/core/std';

export const And2 = circuit('And2', {
  nodes: { a: Switch, b: Switch, n1: Nand, n2: Nand, result: Led },
  connect: ({ nodes: { a, b, n1, n2, result } }) => [
    a.out.to(n1.a),
    b.out.to(n1.b),
    n1.out.to(n2.a, n2.b),
    n2.out.to(result.in),
  ],
});
