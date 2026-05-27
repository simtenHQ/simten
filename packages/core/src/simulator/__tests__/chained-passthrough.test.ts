/**
 * Regression test for simtenHQ/simten#138.
 *
 * A direct input→output passthrough wire inside a composite (a "feedthrough",
 * e.g. `inputs.x.to(outputs.y)` with no gate between) must propagate when such
 * composites are chained. The bug: depth 1 worked but depth ≥2 silently yielded
 * 0, because connection resolution only collapsed a single composite-port hop
 * instead of the full transitive chain across composite boundaries.
 */
import { describe, it, expect } from 'vitest';
import { simulate } from '../../sim/simulate.js';
import { circuit, bit } from '../../circuit/index.js';
import { Not } from '../../std/index.js';

// Composite whose output is a DIRECT wire from its input (plus a dummy gate so
// it isn't a degenerate node-less composite — mirrors a real combinational
// step that has both gated outputs and pure shift/passthrough outputs).
const Passthrough = circuit('Passthrough', {
  inputs: { x: bit },
  outputs: { y: bit },
  nodes: { d: Not },
  connect: ({ inputs, outputs, nodes: { d } }) => [
    inputs.x.to(outputs.y), // direct passthrough (the suspect)
    inputs.x.to(d.in),      // dummy gate, output unused
  ],
});

function makePassthroughChain(n: number) {
  const nodes: Record<string, typeof Passthrough> = {};
  for (let k = 0; k < n; k++) nodes['p' + k] = Passthrough;
  return circuit('PassthroughChain' + n, {
    inputs: { x: bit },
    outputs: { y: bit },
    nodes,
    connect: ({ inputs, outputs, nodes }: any) => {
      const c = [inputs.x.to(nodes['p0'].x)];
      for (let k = 0; k < n - 1; k++) c.push(nodes['p' + k].y.to(nodes['p' + (k + 1)].x));
      c.push(nodes['p' + (n - 1)].y.to(outputs.y));
      return c;
    },
  });
}

describe('chained composite passthrough wires (#138)', () => {
  for (const depth of [1, 2, 3, 4, 8]) {
    it(`propagates a feedthrough through ${depth} chained composite(s)`, () => {
      const sim = simulate(makePassthroughChain(depth));
      try {
        sim.set({ x: 1 });
        expect(sim.get('y')).toBe(1);
        sim.set({ x: 0 });
        expect(sim.get('y')).toBe(0);
      } finally {
        sim.dispose();
      }
    });
  }
});
