/** Reference solution for `less-than`. Proven by `__tests__/levels.test.ts`. */

import { bit, circuit } from '@simten/core/circuit';
import { And, Led, Not, Or, Switch, Xor } from '@simten/core/std';

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
const Adder4 = circuit('Adder4', {
  inputs: { a3: bit, a2: bit, a1: bit, a0: bit, b3: bit, b2: bit, b1: bit, b0: bit },
  outputs: { s3: bit, s2: bit, s1: bit, s0: bit, cout: bit },
  nodes: { add0: HalfAdder, add1: FullAdder, add2: FullAdder, add3: FullAdder },
  connect: ({ inputs, outputs, nodes: { add0, add1, add2, add3 } }) => [
    inputs.a0.to(add0.a),
    inputs.b0.to(add0.b),
    add0.sum.to(outputs.s0),
    add0.carry.to(add1.cin),
    inputs.a1.to(add1.a),
    inputs.b1.to(add1.b),
    add1.sum.to(outputs.s1),
    add1.cout.to(add2.cin),
    inputs.a2.to(add2.a),
    inputs.b2.to(add2.b),
    add2.sum.to(outputs.s2),
    add2.cout.to(add3.cin),
    inputs.a3.to(add3.a),
    inputs.b3.to(add3.b),
    add3.sum.to(outputs.s3),
    add3.cout.to(outputs.cout),
  ],
});

const Subtract4 = circuit('Subtract4', {
  inputs: { a3: bit, a2: bit, a1: bit, a0: bit, b3: bit, b2: bit, b1: bit, b0: bit },
  outputs: { d3: bit, d2: bit, d1: bit, d0: bit, borrow: bit },
  nodes: {
    na3: Not,
    na2: Not,
    na1: Not,
    na0: Not,
    add: Adder4,
    ns3: Not,
    ns2: Not,
    ns1: Not,
    ns0: Not,
  },
  connect: ({ inputs, outputs, nodes: { na3, na2, na1, na0, add, ns3, ns2, ns1, ns0 } }) => [
    inputs.a3.to(na3.in),
    inputs.a2.to(na2.in),
    inputs.a1.to(na1.in),
    inputs.a0.to(na0.in),
    na3.out.to(add.a3),
    na2.out.to(add.a2),
    na1.out.to(add.a1),
    na0.out.to(add.a0),
    inputs.b3.to(add.b3),
    inputs.b2.to(add.b2),
    inputs.b1.to(add.b1),
    inputs.b0.to(add.b0),
    add.s3.to(ns3.in),
    add.s2.to(ns2.in),
    add.s1.to(ns1.in),
    add.s0.to(ns0.in),
    ns3.out.to(outputs.d3),
    ns2.out.to(outputs.d2),
    ns1.out.to(outputs.d1),
    ns0.out.to(outputs.d0),
    add.cout.to(outputs.borrow),
  ],
});

// a is less than b exactly when a - b has to borrow.
export const LessThan4 = circuit('LessThan4', {
  nodes: {
    a3: Switch,
    a2: Switch,
    a1: Switch,
    a0: Switch,
    b3: Switch,
    b2: Switch,
    b1: Switch,
    b0: Switch,
    sub: Subtract4,
    lt: Led,
  },
  connect: ({ nodes: { a3, a2, a1, a0, b3, b2, b1, b0, sub, lt } }) => [
    a3.out.to(sub.a3),
    a2.out.to(sub.a2),
    a1.out.to(sub.a1),
    a0.out.to(sub.a0),
    b3.out.to(sub.b3),
    b2.out.to(sub.b2),
    b1.out.to(sub.b1),
    b0.out.to(sub.b0),
    sub.borrow.to(lt.in),
  ],
});
