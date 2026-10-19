/** Reference solution for `register`. Proven by `__tests__/levels.test.ts`. */

import { bit, circuit } from '@simten/core/circuit';
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

// One bit: the flip-flop's next value is d when load is on and its own q when
// it is off, which is a multiplexer: q XOR (load AND (q XOR d)).
const RegisterBit = circuit('RegisterBit', {
  inputs: { load: bit, d: bit },
  outputs: { q: bit },
  nodes: { ff: DFlipFlop(), x1: Xor, a1: And, x2: Xor },
  connect: ({ inputs, outputs, nodes: { ff, x1, a1, x2 } }) => [
    ff.q.to(x1.a, x2.a, outputs.q),
    inputs.d.to(x1.b),
    x1.out.to(a1.a),
    inputs.load.to(a1.b),
    a1.out.to(x2.b),
    x2.out.to(ff.d),
  ],
});

export const Register4 = circuit('Register4', {
  nodes: {
    load: Switch,
    d: Input({ width: 4 }),
    dBits: Splitter({ width: 4 }),
    b3: RegisterBit,
    b2: RegisterBit,
    b1: RegisterBit,
    b0: RegisterBit,
    q: HexDisplay({ width: 4 }),
    qBits: Combiner({ width: 4 }),
  },
  connect: ({ nodes: { load, d, dBits, b3, b2, b1, b0, q, qBits } }) => [
    d.out.to(dBits.in),
    qBits.out.to(q.in),
    load.out.to(b3.load, b2.load, b1.load, b0.load),
    dBits.bit3.to(b3.d),
    dBits.bit2.to(b2.d),
    dBits.bit1.to(b1.d),
    dBits.bit0.to(b0.d),
    b3.q.to(qBits.bit3),
    b2.q.to(qBits.bit2),
    b1.q.to(qBits.bit1),
    b0.q.to(qBits.bit0),
  ],
});
