/** Reference solution for `register`. Proven by `__tests__/levels.test.ts`. */

import { bit, circuit } from '@simten/core/circuit';
import { And, DFlipFlop, Led, Switch, Xor } from '@simten/core/std';

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
    d3: Switch,
    d2: Switch,
    d1: Switch,
    d0: Switch,
    b3: RegisterBit,
    b2: RegisterBit,
    b1: RegisterBit,
    b0: RegisterBit,
    q3: Led,
    q2: Led,
    q1: Led,
    q0: Led,
  },
  connect: ({ nodes: { load, d3, d2, d1, d0, b3, b2, b1, b0, q3, q2, q1, q0 } }) => [
    load.out.to(b3.load, b2.load, b1.load, b0.load),
    d3.out.to(b3.d),
    d2.out.to(b2.d),
    d1.out.to(b1.d),
    d0.out.to(b0.d),
    b3.q.to(q3.in),
    b2.q.to(q2.in),
    b1.q.to(q1.in),
    b0.q.to(q0.in),
  ],
});
