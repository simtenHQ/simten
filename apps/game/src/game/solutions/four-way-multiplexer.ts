/** Reference solution for `four-way-multiplexer`. Proven by `__tests__/levels.test.ts`. */

import { bit, circuit } from '@simten/core';
import { And, Led, Switch, Xor } from '@simten/core/std';

const Mux2 = circuit('Mux2', {
  inputs: { a: bit, b: bit, sel: bit },
  outputs: { out: bit },
  nodes: { x1: Xor, a1: And, x2: Xor },
  connect: ({ inputs, outputs, nodes: { x1, a1, x2 } }) => [
    inputs.a.to(x1.a, x2.a),
    inputs.b.to(x1.b),
    inputs.sel.to(a1.b),
    x1.out.to(a1.a),
    a1.out.to(x2.b),
    x2.out.to(outputs.out),
  ],
});

// s0 picks within each pair, then s1 picks between the pairs.
export const Mux4 = circuit('Mux4', {
  nodes: {
    d0: Switch,
    d1: Switch,
    d2: Switch,
    d3: Switch,
    s1: Switch,
    s0: Switch,
    low: Mux2,
    high: Mux2,
    pick: Mux2,
    out: Led,
  },
  connect: ({ nodes: { d0, d1, d2, d3, s1, s0, low, high, pick, out } }) => [
    d0.out.to(low.a),
    d1.out.to(low.b),
    d2.out.to(high.a),
    d3.out.to(high.b),
    s0.out.to(low.sel, high.sel),
    low.out.to(pick.a),
    high.out.to(pick.b),
    s1.out.to(pick.sel),
    pick.out.to(out.in),
  ],
});
