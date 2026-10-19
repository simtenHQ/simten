/** Reference solution for `adder-4`. Proven by `__tests__/levels.test.ts`. */

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

const FullAdder = circuit('FullAdder', {
  inputs: { a: bit, b: bit, cin: bit },
  outputs: { sum: bit, cout: bit },
  nodes: { h1: HalfAdder, h2: HalfAdder, o1: Or },
  connect: ({ inputs, outputs, nodes: { h1, h2, o1 } }) => [
    inputs.a.to(h1.a),
    inputs.b.to(h1.b),
    h1.sum.to(h2.a),
    inputs.cin.to(h2.b),
    h2.sum.to(outputs.sum),
    h1.carry.to(o1.a),
    h2.carry.to(o1.b),
    o1.out.to(outputs.cout),
  ],
});

// Bit 0 has no carry coming in, so a half adder covers it. Every carry out
// feeds the next bit's carry in.
export const Adder4 = circuit('Adder4', {
  nodes: {
    a3: Switch,
    a2: Switch,
    a1: Switch,
    a0: Switch,
    b3: Switch,
    b2: Switch,
    b1: Switch,
    b0: Switch,
    add0: HalfAdder,
    add1: FullAdder,
    add2: FullAdder,
    add3: FullAdder,
    s3: Led,
    s2: Led,
    s1: Led,
    s0: Led,
    cout: Led,
  },
  connect: ({
    nodes: { a3, a2, a1, a0, b3, b2, b1, b0, add0, add1, add2, add3, s3, s2, s1, s0, cout },
  }) => [
    a0.out.to(add0.a),
    b0.out.to(add0.b),
    add0.sum.to(s0.in),
    add0.carry.to(add1.cin),
    a1.out.to(add1.a),
    b1.out.to(add1.b),
    add1.sum.to(s1.in),
    add1.cout.to(add2.cin),
    a2.out.to(add2.a),
    b2.out.to(add2.b),
    add2.sum.to(s2.in),
    add2.cout.to(add3.cin),
    a3.out.to(add3.a),
    b3.out.to(add3.b),
    add3.sum.to(s3.in),
    add3.cout.to(cout.in),
  ],
});
