/** Reference solution for `wider-gates`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core';
import { And, Led, Or, Switch } from '@simten/core/std';

// Pairs first, then the pairs together: two levels deep rather than three.
export const Gates4 = circuit('Gates4', {
  nodes: {
    a: Switch,
    b: Switch,
    c: Switch,
    d: Switch,
    and1: And,
    and2: And,
    and3: And,
    or1: Or,
    or2: Or,
    or3: Or,
    all: Led,
    any: Led,
  },
  connect: ({ nodes: { a, b, c, d, and1, and2, and3, or1, or2, or3, all, any } }) => [
    a.out.to(and1.a, or1.a),
    b.out.to(and1.b, or1.b),
    c.out.to(and2.a, or2.a),
    d.out.to(and2.b, or2.b),
    and1.out.to(and3.a),
    and2.out.to(and3.b),
    or1.out.to(or3.a),
    or2.out.to(or3.b),
    and3.out.to(all.in),
    or3.out.to(any.in),
  ],
});
