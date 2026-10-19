/** Reference solution for `subtract`. Proven by `__tests__/levels.test.ts`. */

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

// NOT a is 15 - a, so NOT (NOT a + b) is 15 - (15 - a + b), which is a - b.
// No carry in is needed, and the sum passes 15, setting cout, exactly when b
// is the larger, so cout is the borrow as it stands.
export const Subtract4 = circuit('Subtract4', {
  nodes: {
    a3: Switch,
    a2: Switch,
    a1: Switch,
    a0: Switch,
    b3: Switch,
    b2: Switch,
    b1: Switch,
    b0: Switch,
    na3: Not,
    na2: Not,
    na1: Not,
    na0: Not,
    add: Adder4,
    ns3: Not,
    ns2: Not,
    ns1: Not,
    ns0: Not,
    d3: Led,
    d2: Led,
    d1: Led,
    d0: Led,
    borrow: Led,
  },
  connect: ({
    nodes: {
      a3,
      a2,
      a1,
      a0,
      b3,
      b2,
      b1,
      b0,
      na3,
      na2,
      na1,
      na0,
      add,
      ns3,
      ns2,
      ns1,
      ns0,
      d3,
      d2,
      d1,
      d0,
      borrow,
    },
  }) => [
    a3.out.to(na3.in),
    a2.out.to(na2.in),
    a1.out.to(na1.in),
    a0.out.to(na0.in),
    na3.out.to(add.a3),
    na2.out.to(add.a2),
    na1.out.to(add.a1),
    na0.out.to(add.a0),
    b3.out.to(add.b3),
    b2.out.to(add.b2),
    b1.out.to(add.b1),
    b0.out.to(add.b0),
    add.s3.to(ns3.in),
    add.s2.to(ns2.in),
    add.s1.to(ns1.in),
    add.s0.to(ns0.in),
    ns3.out.to(d3.in),
    ns2.out.to(d2.in),
    ns1.out.to(d1.in),
    ns0.out.to(d0.in),
    add.cout.to(borrow.in),
  ],
});
