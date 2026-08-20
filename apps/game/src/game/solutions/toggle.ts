/** Reference solution for `toggle`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { DFlipFlop, Led } from '@simten/core/std';

export const Toggle1 = circuit('Toggle1', {
  // No gate at all. `q_bar` is already the opposite of what is stored, so
  // wiring it to `d` says "next tick, hold the opposite of this" — which is a
  // circuit that can never settle.
  nodes: { dff: DFlipFlop(), q: Led },
  connect: ({ nodes: { dff, q } }) => [dff.q_bar.to(dff.d), dff.q.to(q.in)],
});
