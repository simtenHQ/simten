/** Reference solution for `making-a-component`. Proven by `__tests__/levels.test.ts`. */

import { bit, circuit } from '@simten/core/circuit';
import { Nand } from '@simten/core/std';

export const Xor2 = circuit('Xor2', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  nodes: { n1: Nand, n2: Nand, n3: Nand, n4: Nand },
  connect: ({ inputs, outputs, nodes: { n1, n2, n3, n4 } }) => [
    inputs.a.to(n1.a, n2.a),
    inputs.b.to(n1.b, n3.b),
    n1.out.to(n2.b, n3.a),
    n2.out.to(n4.a),
    n3.out.to(n4.b),
    n4.out.to(outputs.out),
  ],
});
