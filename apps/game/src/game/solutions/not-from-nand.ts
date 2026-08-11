/** Reference solution for `not-from-nand`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { Led, Nand, Switch } from '@simten/core/std';

export const Not1 = circuit('Not1', {
  nodes: { a: Switch, n1: Nand, result: Led },
  connect: ({ nodes: { a, n1, result } }) => [a.out.to(n1.a, n1.b), n1.out.to(result.in)],
});
