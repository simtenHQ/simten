/** Reference solution for `counter`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { DFlipFlop, Led, Nand } from '@simten/core/std';

export const Counter2 = circuit('Counter2', {
  // Synchronous, not ripple. Simten wires one clock to every flip-flop, so the
  // second cannot be clocked off the first; both tick together and the logic
  // decides which of them changes. bit0 flips every tick, and bit1 flips only
  // when bit0 is already set, which is the XOR of the two.
  nodes: {
    dff0: DFlipFlop(),
    dff1: DFlipFlop(),
    n1: Nand,
    n2: Nand,
    n3: Nand,
    n4: Nand,
    bit0: Led,
    bit1: Led,
  },
  connect: ({ nodes: { dff0, dff1, n1, n2, n3, n4, bit0, bit1 } }) => [
    // bit0: hold the opposite of what you hold, so it alternates.
    dff0.q_bar.to(dff0.d),
    dff0.q.to(bit0.in, n1.a, n2.a),

    // bit1: XOR(bit0, bit1), built from four NANDs.
    dff1.q.to(bit1.in, n1.b, n3.b),
    n1.out.to(n2.b, n3.a),
    n2.out.to(n4.a),
    n3.out.to(n4.b),
    n4.out.to(dff1.d),
  ],
});
