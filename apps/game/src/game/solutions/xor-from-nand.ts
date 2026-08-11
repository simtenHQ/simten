/** Reference solution for `xor-from-nand`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { Led, Nand, Switch } from '@simten/core/std';

export const Xor1 = circuit('Xor1', {
  nodes: { a: Switch, b: Switch, n1: Nand, n2: Nand, n3: Nand, n4: Nand, result: Led },
  connect: ({ nodes: { a, b, n1, n2, n3, n4, result } }) => [
    a.out.to(n1.a, n2.a),
    b.out.to(n1.b, n3.b),
    n1.out.to(n2.b, n3.a),
    n2.out.to(n4.a),
    n3.out.to(n4.b),
    n4.out.to(result.in),
  ],
});
