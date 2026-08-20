/** Reference solution for `toggle`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { DFlipFlop, Led, Nand } from '@simten/core/std';

export const Toggle1 = circuit('Toggle1', {
  // A NAND with both inputs tied together is an inverter — the trick from the
  // NOT level, reused so the flip-flop is the only new part here.
  nodes: { dff: DFlipFlop(), n1: Nand, q: Led },
  connect: ({ nodes: { dff, n1, q } }) => [
    dff.q.to(n1.a, n1.b, q.in),
    n1.out.to(dff.d),
  ],
});
