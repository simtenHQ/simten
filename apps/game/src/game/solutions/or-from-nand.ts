/** Reference solution for `or-from-nand`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { Led, Nand, Switch } from '@simten/core/std';

export const Or1 = circuit('Or1', {
  nodes: { a: Switch, b: Switch, n1: Nand, n2: Nand, n3: Nand, result: Led },
  connect: ({ nodes: { a, b, n1, n2, n3, result } }) => [
    a.out.to(n1.a, n1.b),
    b.out.to(n2.a, n2.b),
    n1.out.to(n3.a),
    n2.out.to(n3.b),
    n3.out.to(result.in),
  ],
});
