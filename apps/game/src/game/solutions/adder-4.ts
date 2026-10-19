/** Reference solution for `adder-4`. Proven by `__tests__/levels.test.ts`. */

import { bit, circuit } from '@simten/core/circuit';
import { And, Combiner, HexDisplay, Input, Led, Or, Splitter, Xor } from '@simten/core/std';

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
    a: Input({ width: 4 }),
    aBits: Splitter({ width: 4 }),
    b: Input({ width: 4 }),
    bBits: Splitter({ width: 4 }),
    add0: HalfAdder,
    add1: FullAdder,
    add2: FullAdder,
    add3: FullAdder,
    s: HexDisplay({ width: 4 }),
    sBits: Combiner({ width: 4 }),
    cout: Led,
  },
  connect: ({ nodes: { a, aBits, b, bBits, add0, add1, add2, add3, s, sBits, cout } }) => [
    a.out.to(aBits.in),
    b.out.to(bBits.in),
    sBits.out.to(s.in),
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
    add3.cout.to(cout.in),
  ],
});
