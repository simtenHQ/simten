/** Reference solution for `latch`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { Led, Nand, Switch } from '@simten/core/std';

export const Latch1 = circuit('Latch1', {
  nodes: { s: Switch, r: Switch, n1: Nand, n2: Nand, q: Led },
  connect: ({ nodes: { s, r, n1, n2, q } }) => [
    s.out.to(n1.a),
    r.out.to(n2.b),
    // Each gate reads the other's answer. That loop is the memory: with both
    // switches high neither gate can change, so the pair holds.
    n1.out.to(n2.a, q.in),
    n2.out.to(n1.b),
  ],
});
