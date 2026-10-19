/** Reference solution for `subtract`. Proven by `__tests__/levels.test.ts`. */

import { bit, bus, circuit } from '@simten/core/circuit';
import { And, Combiner, HexDisplay, Input, Led, Not, Or, Splitter, Xor } from '@simten/core/std';

const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: {
    x1: Xor,
    a1: And,
  },
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
  nodes: {
    h1: HalfAdder,
    h2: HalfAdder,
    o1: Or,
  },
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

const Invert4 = circuit('Invert4', {
  inputs: { a: bus(4) },
  outputs: { out: bus(4) },
  nodes: {
    bits: Splitter({ width: 4 }),
    join: Combiner({ width: 4 }),
    n0: Not,
    n1: Not,
    n2: Not,
    n3: Not,
  },
  connect: ({ inputs, outputs, nodes: { bits, join, n0, n1, n2, n3 } }) => [
    inputs.a.to(bits.in),
    bits.bit0.to(n0.in),
    bits.bit1.to(n1.in),
    bits.bit2.to(n2.in),
    bits.bit3.to(n3.in),
    n0.out.to(join.bit0),
    n1.out.to(join.bit1),
    n2.out.to(join.bit2),
    n3.out.to(join.bit3),
    join.out.to(outputs.out),
  ],
});

const Adder4 = circuit('Adder4', {
  inputs: { a: bus(4), b: bus(4) },
  outputs: { s: bus(4), cout: bit },
  nodes: {
    aBits: Splitter({ width: 4 }),
    bBits: Splitter({ width: 4 }),
    sBits: Combiner({ width: 4 }),
    add0: HalfAdder,
    add1: FullAdder,
    add2: FullAdder,
    add3: FullAdder,
  },
  connect: ({ inputs, outputs, nodes: { aBits, bBits, sBits, add0, add1, add2, add3 } }) => [
    inputs.a.to(aBits.in),
    inputs.b.to(bBits.in),
    sBits.out.to(outputs.s),
    aBits.bit0.to(add0.a),
    bBits.bit0.to(add0.b),
    add0.sum.to(sBits.bit0),
    add0.carry.to(add1.cin),
    aBits.bit1.to(add1.a),
    bBits.bit1.to(add1.b),
    add1.sum.to(sBits.bit1),
    add1.cout.to(add2.cin),
    aBits.bit2.to(add2.a),
    bBits.bit2.to(add2.b),
    add2.sum.to(sBits.bit2),
    add2.cout.to(add3.cin),
    aBits.bit3.to(add3.a),
    bBits.bit3.to(add3.b),
    add3.sum.to(sBits.bit3),
    add3.cout.to(outputs.cout),
  ],
});

export const Subtract4 = circuit('Subtract4', {
  nodes: {
    a: Input({ width: 4 }),
    b: Input({ width: 4 }),
    d: HexDisplay({ width: 4 }),
    borrow: Led,
    flipA: Invert4,
    add: Adder4,
    flipSum: Invert4,
  },
  connect: ({ nodes: { a, b, d, borrow, flipA, add, flipSum } }) => [
    a.out.to(flipA.a),
    flipA.out.to(add.a),
    b.out.to(add.b),
    add.s.to(flipSum.a),
    flipSum.out.to(d.in),
    add.cout.to(borrow.in),
  ],
});
