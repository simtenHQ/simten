/** Reference solution for `program-counter`. Proven by `__tests__/levels.test.ts`. */

import { bit, circuit } from '@simten/core';
import {
  And,
  Combiner,
  DFlipFlop,
  HexDisplay,
  Input,
  Splitter,
  Switch,
  Xor,
} from '@simten/core/std';

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

const CounterBit = circuit('CounterBit', {
  inputs: { carry: bit, jump: bit, a: bit },
  outputs: { q: bit, carryOut: bit },
  nodes: {
    ff: DFlipFlop(),
    add: HalfAdder,
    pick: Mux2,
  },
  connect: ({ inputs, outputs, nodes: { ff, add, pick } }) => [
    ff.q.to(add.a, outputs.q),
    inputs.carry.to(add.b),
    add.sum.to(pick.a),
    inputs.a.to(pick.b),
    inputs.jump.to(pick.sel),
    pick.out.to(ff.d),
    add.carry.to(outputs.carryOut),
  ],
});

export const ProgramCounter4 = circuit('ProgramCounter4', {
  nodes: {
    jump: Switch,
    a: Input({ width: 4 }),
    aBits: Splitter({ width: 4 }),
    pc: HexDisplay({ width: 4 }),
    pcBits: Combiner({ width: 4 }),
    ff0: DFlipFlop(),
    pick0: Mux2,
    bit1: CounterBit,
    bit2: CounterBit,
    bit3: CounterBit,
  },
  connect: ({ nodes: { jump, a, aBits, pc, pcBits, ff0, pick0, bit1, bit2, bit3 } }) => [
    a.out.to(aBits.in),
    pcBits.out.to(pc.in),
    // Bit 0 flips every tick; q_bar is already the flipped bit.
    ff0.q_bar.to(pick0.a),
    aBits.bit0.to(pick0.b),
    jump.out.to(pick0.sel, bit1.jump, bit2.jump, bit3.jump),
    pick0.out.to(ff0.d),
    ff0.q.to(pcBits.bit0, bit1.carry),
    bit1.carryOut.to(bit2.carry),
    bit2.carryOut.to(bit3.carry),
    aBits.bit1.to(bit1.a),
    aBits.bit2.to(bit2.a),
    aBits.bit3.to(bit3.a),
    bit1.q.to(pcBits.bit1),
    bit2.q.to(pcBits.bit2),
    bit3.q.to(pcBits.bit3),
  ],
});
