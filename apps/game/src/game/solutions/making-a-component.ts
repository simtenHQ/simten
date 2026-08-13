/** Reference solution for `making-a-component`. Proven by `__tests__/levels.test.ts`. */

import { bit, circuit } from '@simten/core/circuit';
import { Xor } from '@simten/core/std';

export const Xor2 = circuit('Xor2', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  nodes: { xor1: Xor },
  connect: ({ inputs, outputs, nodes: { xor1 } }) => [
    inputs.a.to(xor1.a),
    inputs.b.to(xor1.b),
    xor1.out.to(outputs.out),
  ],
});
