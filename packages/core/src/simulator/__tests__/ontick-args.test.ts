/**
 * Regression: onTick must receive node.arguments under their plain names,
 * exactly like eval does.
 *
 * The onTick input-build path (propagate.ts) previously added arguments with a
 * `__` prefix (`__k`), while the eval path adds them plainly (`k`). So a
 * primitive whose onTick read a construction argument saw `undefined`. No
 * stdlib component tripped it (their onTicks read only ports/state), but it is
 * a real correctness footgun — a primitive that, say, masks by a `width`
 * argument in onTick would silently misbehave.
 */

import { describe, expect, it } from 'vitest';
import { bit, bus, circuit } from '../../circuit/index.js';
import { simulate } from '../../sim/index.js';

describe('onTick receives node arguments', () => {
  it('reads a construction argument by its plain name (parity with eval)', () => {
    // A tiny sequential primitive: onTick stores its `k` argument into state;
    // eval echoes the state out. If onTick gets `k`, state (and out) == k.
    const P = circuit('ArgToOnTick', ({ width = 8 }: { width?: number; k?: number } = {}) => ({
      inputs: { tick: bit },
      outputs: { out: bus(width) },
      state: { s: 0 },
      // biome-ignore lint/suspicious/noExplicitAny: reads the `k` arg
      eval: (io: any) => ({ out: (io.s ?? 0) & 0xff }),
      // biome-ignore lint/suspicious/noExplicitAny: reads the `k` arg
      onTick: (io: any) => ({ s: (io.k ?? 111) & 0xff }), // 111 = the pre-fix bug's default
    }));

    const W = circuit('ArgToOnTickWrap', {
      inputs: { tick: bit },
      outputs: { out: bus(8) },
      nodes: { p: P({ width: 8, k: 7 }) },
      connect: ({ inputs: i, outputs: o, nodes: { p } }: any) => [
        i.tick.to(p.tick),
        p.out.to(o.out),
      ],
    } as any);

    const sim = simulate(W);
    sim.set({ tick: 0 });
    sim.tick();
    expect(sim.get('out')).toBe(7); // onTick got k=7 → stored 7 (would be 111 with the bug)
  });

  it('ports and state still take precedence over same-named arguments', () => {
    // If an argument shares a name with an input port, the PORT value must win
    // in onTick — matching eval, where ports override arguments.
    const P = circuit('ArgVsPort', ({ width = 8 }: { width?: number; d?: number } = {}) => ({
      inputs: { d: bus(width) }, // same name as the `d` argument below
      outputs: { out: bus(width) },
      state: { s: 0 },
      // biome-ignore lint/suspicious/noExplicitAny: dynamic access
      eval: (io: any) => ({ out: (io.s ?? 0) & 0xff }),
      // biome-ignore lint/suspicious/noExplicitAny: dynamic access
      onTick: (io: any) => ({ s: (io.d ?? 0) & 0xff }), // should capture the PORT d, not the arg
    }));

    const W = circuit('ArgVsPortWrap', {
      inputs: { d: bus(8) },
      outputs: { out: bus(8) },
      nodes: { p: P({ width: 8, d: 200 }) }, // arg d=200 (should be shadowed by the port)
      connect: ({ inputs: i, outputs: o, nodes: { p } }: any) => [i.d.to(p.d), p.out.to(o.out)],
    } as any);

    const sim = simulate(W);
    sim.set({ d: 42 }); // drive the port to 42
    sim.tick();
    expect(sim.get('out')).toBe(42); // port (42) wins over arg (200)
  });
});
