/** Reference solution for `arithmetic-logic-unit`. Proven by `__tests__/levels.test.ts`. */

import { bit, bus, circuit } from '@simten/core/circuit';
import { And, Combiner, HexDisplay, Input, Not, Or, Splitter, Switch, Xor } from '@simten/core/std';

const Mux2 = circuit('Mux2', {
  inputs: { a: bit, b: bit, sel: bit },
  outputs: { out: bit },
  nodes: {
    x1: Xor,
    a1: And,
    x2: Xor,
  },
  connect: ({ inputs, outputs, nodes: { x1, a1, x2 } }) => [
    inputs.a.to(x1.a, x2.a),
    inputs.b.to(x1.b),
    inputs.sel.to(a1.b),
    x1.out.to(a1.a),
    a1.out.to(x2.b),
    x2.out.to(outputs.out),
  ],
});

const Mux4 = circuit('Mux4', {
  inputs: { d0: bit, d1: bit, d2: bit, d3: bit, s1: bit, s0: bit },
  outputs: { out: bit },
  nodes: {
    low: Mux2,
    high: Mux2,
    pick: Mux2,
  },
  connect: ({ inputs, outputs, nodes: { low, high, pick } }) => [
    inputs.d0.to(low.a),
    inputs.d1.to(low.b),
    inputs.d2.to(high.a),
    inputs.d3.to(high.b),
    inputs.s0.to(low.sel, high.sel),
    low.out.to(pick.a),
    high.out.to(pick.b),
    inputs.s1.to(pick.sel),
    pick.out.to(outputs.out),
  ],
});

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

const Subtract4 = circuit('Subtract4', {
  inputs: { a: bus(4), b: bus(4) },
  outputs: { d: bus(4), borrow: bit },
  nodes: {
    flipA: Invert4,
    add: Adder4,
    flipSum: Invert4,
  },
  connect: ({ inputs, outputs, nodes: { flipA, add, flipSum } }) => [
    inputs.a.to(flipA.a),
    flipA.out.to(add.a),
    inputs.b.to(add.b),
    add.s.to(flipSum.a),
    flipSum.out.to(outputs.d),
    add.cout.to(outputs.borrow),
  ],
});

const BitwiseAnd = circuit('BitwiseAnd', {
  inputs: { a: bus(4), b: bus(4) },
  outputs: { out: bus(4) },
  nodes: {
    aBits: Splitter({ width: 4 }),
    bBits: Splitter({ width: 4 }),
    outBits: Combiner({ width: 4 }),
    g0: And,
    g1: And,
    g2: And,
    g3: And,
  },
  connect: ({ inputs, outputs, nodes: { aBits, bBits, outBits, g0, g1, g2, g3 } }) => [
    inputs.a.to(aBits.in),
    inputs.b.to(bBits.in),
    outBits.out.to(outputs.out),
    aBits.bit0.to(g0.a),
    bBits.bit0.to(g0.b),
    g0.out.to(outBits.bit0),
    aBits.bit1.to(g1.a),
    bBits.bit1.to(g1.b),
    g1.out.to(outBits.bit1),
    aBits.bit2.to(g2.a),
    bBits.bit2.to(g2.b),
    g2.out.to(outBits.bit2),
    aBits.bit3.to(g3.a),
    bBits.bit3.to(g3.b),
    g3.out.to(outBits.bit3),
  ],
});

const BitwiseOr = circuit('BitwiseOr', {
  inputs: { a: bus(4), b: bus(4) },
  outputs: { out: bus(4) },
  nodes: {
    aBits: Splitter({ width: 4 }),
    bBits: Splitter({ width: 4 }),
    outBits: Combiner({ width: 4 }),
    g0: Or,
    g1: Or,
    g2: Or,
    g3: Or,
  },
  connect: ({ inputs, outputs, nodes: { aBits, bBits, outBits, g0, g1, g2, g3 } }) => [
    inputs.a.to(aBits.in),
    inputs.b.to(bBits.in),
    outBits.out.to(outputs.out),
    aBits.bit0.to(g0.a),
    bBits.bit0.to(g0.b),
    g0.out.to(outBits.bit0),
    aBits.bit1.to(g1.a),
    bBits.bit1.to(g1.b),
    g1.out.to(outBits.bit1),
    aBits.bit2.to(g2.a),
    bBits.bit2.to(g2.b),
    g2.out.to(outBits.bit2),
    aBits.bit3.to(g3.a),
    bBits.bit3.to(g3.b),
    g3.out.to(outBits.bit3),
  ],
});

const BusMux4 = circuit('BusMux4', {
  inputs: { s1: bit, s0: bit, d0: bus(4), d1: bus(4), d2: bus(4), d3: bus(4) },
  outputs: { out: bus(4) },
  nodes: {
    d0Bits: Splitter({ width: 4 }),
    d1Bits: Splitter({ width: 4 }),
    d2Bits: Splitter({ width: 4 }),
    d3Bits: Splitter({ width: 4 }),
    outBits: Combiner({ width: 4 }),
    m0: Mux4,
    m1: Mux4,
    m2: Mux4,
    m3: Mux4,
  },
  connect: ({
    inputs,
    outputs,
    nodes: { d0Bits, d1Bits, d2Bits, d3Bits, outBits, m0, m1, m2, m3 },
  }) => [
    inputs.d0.to(d0Bits.in),
    inputs.d1.to(d1Bits.in),
    inputs.d2.to(d2Bits.in),
    inputs.d3.to(d3Bits.in),
    outBits.out.to(outputs.out),
    inputs.s1.to(m0.s1, m1.s1, m2.s1, m3.s1),
    inputs.s0.to(m0.s0, m1.s0, m2.s0, m3.s0),
    d0Bits.bit0.to(m0.d0),
    d1Bits.bit0.to(m0.d1),
    d2Bits.bit0.to(m0.d2),
    d3Bits.bit0.to(m0.d3),
    m0.out.to(outBits.bit0),
    d0Bits.bit1.to(m1.d0),
    d1Bits.bit1.to(m1.d1),
    d2Bits.bit1.to(m1.d2),
    d3Bits.bit1.to(m1.d3),
    m1.out.to(outBits.bit1),
    d0Bits.bit2.to(m2.d0),
    d1Bits.bit2.to(m2.d1),
    d2Bits.bit2.to(m2.d2),
    d3Bits.bit2.to(m2.d3),
    m2.out.to(outBits.bit2),
    d0Bits.bit3.to(m3.d0),
    d1Bits.bit3.to(m3.d1),
    d2Bits.bit3.to(m3.d2),
    d3Bits.bit3.to(m3.d3),
    m3.out.to(outBits.bit3),
  ],
});

export const Alu4 = circuit('Alu4', {
  nodes: {
    op1: Switch,
    op0: Switch,
    a: Input({ width: 4 }),
    b: Input({ width: 4 }),
    r: HexDisplay({ width: 4 }),
    add: Adder4,
    sub: Subtract4,
    and: BitwiseAnd,
    or: BitwiseOr,
    pick: BusMux4,
  },
  connect: ({ nodes: { op1, op0, a, b, r, add, sub, and, or, pick } }) => [
    a.out.to(add.a, sub.a, and.a, or.a),
    b.out.to(add.b, sub.b, and.b, or.b),
    add.s.to(pick.d0),
    sub.d.to(pick.d1),
    and.out.to(pick.d2),
    or.out.to(pick.d3),
    op1.out.to(pick.s1),
    op0.out.to(pick.s0),
    pick.out.to(r.in),
  ],
});
