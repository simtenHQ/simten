/** Reference solution for `full-adder`. Proven by `__tests__/levels.test.ts`. */

import { bit, circuit } from '@simten/core/circuit';
import { And, Led, Or, Switch, Xor } from '@simten/core/std';

const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { x1: Xor, a1: And },
  connect: ({ inputs, outputs, nodes: { x1, a1 } }) => [
    inputs.a.to(x1.a, a1.a),
    inputs.b.to(x1.b, a1.b),
    x1.out.to(outputs.sum),
    a1.out.to(outputs.carry),
  ],
});

export const FullAdder = circuit('FullAdder', {
  nodes: {
    a: Switch,
    b: Switch,
    cin: Switch,
    h1: HalfAdder,
    h2: HalfAdder,
    o1: Or,
    sum: Led,
    cout: Led,
  },
  connect: ({ nodes: { a, b, cin, h1, h2, o1, sum, cout } }) => [
    a.out.to(h1.a),
    b.out.to(h1.b),
    h1.sum.to(h2.a),
    cin.out.to(h2.b),
    h2.sum.to(sum.in),
    h1.carry.to(o1.a),
    h2.carry.to(o1.b),
    o1.out.to(cout.in),
  ],
});
