/** Reference solution for `negate`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { Led, Or, Switch, Xor } from '@simten/core/std';

// Flip and add one, worked out per bit: everything up to and including the
// lowest 1 stays, everything above it flips. So a bit flips exactly when some
// bit below it is on. Bit 0 is a bare wire, and five gates is the minimum an
// exhaustive search finds.
export const Negate4 = circuit('Negate4', {
  nodes: {
    a3: Switch,
    a2: Switch,
    a1: Switch,
    a0: Switch,
    x1: Xor,
    below2: Or,
    x2: Xor,
    below3: Or,
    x3: Xor,
    n3: Led,
    n2: Led,
    n1: Led,
    n0: Led,
  },
  connect: ({ nodes: { a3, a2, a1, a0, x1, below2, x2, below3, x3, n3, n2, n1, n0 } }) => [
    a0.out.to(n0.in, x1.b, below2.b),
    a1.out.to(x1.a, below2.a),
    x1.out.to(n1.in),
    a2.out.to(x2.a, below3.a),
    below2.out.to(x2.b, below3.b),
    x2.out.to(n2.in),
    a3.out.to(x3.a),
    below3.out.to(x3.b),
    x3.out.to(n3.in),
  ],
});
