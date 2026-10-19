/** Reference solution for `majority`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { And, Led, Or, Switch } from '@simten/core/std';

// a and b together carry it, and otherwise c needs one of them. Four gates is
// the minimum an exhaustive search finds.
export const Majority3 = circuit('Majority3', {
  nodes: { a: Switch, b: Switch, c: Switch, ab: And, either: Or, ce: And, o1: Or, out: Led },
  connect: ({ nodes: { a, b, c, ab, either, ce, o1, out } }) => [
    a.out.to(ab.a, either.a),
    b.out.to(ab.b, either.b),
    c.out.to(ce.a),
    either.out.to(ce.b),
    ab.out.to(o1.a),
    ce.out.to(o1.b),
    o1.out.to(out.in),
  ],
});
