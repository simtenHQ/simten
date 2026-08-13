/** Reference solution for `xor`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { And, Led, Nand, Or, Switch } from '@simten/core/std';

export const Xor1 = circuit('Xor1', {
  nodes: { a: Switch, b: Switch, or1: Or, nand1: Nand, and1: And, result: Led },
  connect: ({ nodes: { a, b, or1, nand1, and1, result } }) => [
    a.out.to(or1.a, nand1.a),
    b.out.to(or1.b, nand1.b),
    or1.out.to(and1.a),
    nand1.out.to(and1.b),
    and1.out.to(result.in),
  ],
});
