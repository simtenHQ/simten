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

const RegisterBit = circuit('RegisterBit', {
  inputs: { load: bit, d: bit },
  outputs: { q: bit },
  nodes: {
    ff: DFlipFlop(),
    pick: Mux2,
  },
  connect: ({ inputs, outputs, nodes: { ff, pick } }) => [
    ff.q.to(pick.a, outputs.q),
    inputs.d.to(pick.b),
    inputs.load.to(pick.sel),
    pick.out.to(ff.d),
  ],
});

export const Register4 = circuit('Register4', {
  nodes: {
    load: Switch,
    d: Input({ width: 4 }),
    dBits: Splitter({ width: 4 }),
    q: HexDisplay({ width: 4 }),
    qBits: Combiner({ width: 4 }),
    b0: RegisterBit,
    b1: RegisterBit,
    b2: RegisterBit,
    b3: RegisterBit,
  },
  connect: ({ nodes: { load, d, dBits, q, qBits, b0, b1, b2, b3 } }) => [
    d.out.to(dBits.in),
    qBits.out.to(q.in),
    load.out.to(b0.load, b1.load, b2.load, b3.load),
    dBits.bit0.to(b0.d),
    b0.q.to(qBits.bit0),
    dBits.bit1.to(b1.d),
    b1.q.to(qBits.bit1),
    dBits.bit2.to(b2.d),
    b2.q.to(qBits.bit2),
    dBits.bit3.to(b3.d),
    b3.q.to(qBits.bit3),
  ],
});
