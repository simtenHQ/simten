/** Reference solution for `d-latch`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { Led, Nand, Switch } from '@simten/core/std';

export const DLatch1 = circuit('DLatch1', {
  // The SR latch from last level (n3, n4) with two steering gates in front.
  // `en` low forces both steering outputs high, which is the latch's hold
  // state; `en` high lets `d` and its inverse through as set and reset, so the
  // pair can never be asked for the invalid both-low case.
  nodes: { d: Switch, en: Switch, n1: Nand, n2: Nand, n3: Nand, n4: Nand, q: Led },
  connect: ({ nodes: { d, en, n1, n2, n3, n4, q } }) => [
    d.out.to(n1.a),
    en.out.to(n1.b, n2.b),
    n1.out.to(n2.a, n3.a),
    n2.out.to(n4.b),
    n3.out.to(n4.a, q.in),
    n4.out.to(n3.b),
  ],
});
