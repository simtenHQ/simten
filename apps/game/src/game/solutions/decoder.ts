/** Reference solution for `decoder`. Proven by `__tests__/levels.test.ts`. */

import { circuit } from '@simten/core/circuit';
import { And, Led, Nor, Switch } from '@simten/core/std';

// y0 and y3 are one gate each. y1 is "a0 on, a1 off", which is the same as
// "neither a1 nor y0": with y0 off at least one bit is on, and a1 being off
// leaves a0. y2 mirrors it. One gate per output, so four is the floor.
export const Decoder2 = circuit('Decoder2', {
  nodes: {
    a1: Switch,
    a0: Switch,
    g0: Nor,
    g1: Nor,
    g2: Nor,
    g3: And,
    y0: Led,
    y1: Led,
    y2: Led,
    y3: Led,
  },
  connect: ({ nodes: { a1, a0, g0, g1, g2, g3, y0, y1, y2, y3 } }) => [
    a1.out.to(g0.a, g1.a, g3.a),
    a0.out.to(g0.b, g2.a, g3.b),
    g0.out.to(g1.b, g2.b, y0.in),
    g1.out.to(y1.in),
    g2.out.to(y2.in),
    g3.out.to(y3.in),
  ],
});
