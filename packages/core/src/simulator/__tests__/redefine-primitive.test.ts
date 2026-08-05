/**
 * Redefining a primitive replaces its behaviour.
 *
 * Component behaviour is cached in two places keyed by name: the eval-registry
 * (written by `circuit()` at definition time) and the compiled EVALUATORS table
 * (built from a registry entry at compile time). Both used to keep the *first*
 * value for a given name and silently drop later ones.
 *
 * That is invisible in a normal build — each name is defined once — but the
 * browser editor re-executes source in the same realm, so these module-level
 * caches survive a re-run. Editing `eval: ({a, b}) => ({out: a & b})` to
 * `a ^ b` left the circuit computing AND, with the source on screen disagreeing
 * with the simulation and nothing reporting a conflict.
 *
 * `onTick` had the same problem through its own cache, so the sequential case
 * is covered too.
 */

import { describe, expect, it } from 'vitest';
import { bit, bus, circuit, reg } from '../../circuit/index.js';
import { simulate } from '../../sim/index.js';
import '../../std/index.js';

function evaluate(
  built: Parameters<typeof simulate>[0],
  inputs: Record<string, number>,
  output: string,
  ticks = 0,
) {
  const sim = simulate(built);
  try {
    sim.set(inputs);
    for (let i = 0; i < ticks; i++) sim.tick();
    return sim.get(output);
  } finally {
    sim.dispose();
  }
}

describe('redefining a primitive under the same name', () => {
  it('uses the new eval, not the first one registered', () => {
    const asAnd = circuit('RedefEvalGate', {
      inputs: { a: bit, b: bit },
      outputs: { out: bit },
      eval: ({ a, b }) => ({ out: a & b }),
    });
    expect(evaluate(asAnd, { a: 1, b: 0 }, 'out')).toBe(0);
    expect(evaluate(asAnd, { a: 1, b: 1 }, 'out')).toBe(1);

    const asXor = circuit('RedefEvalGate', {
      inputs: { a: bit, b: bit },
      outputs: { out: bit },
      eval: ({ a, b }) => ({ out: a ^ b }),
    });
    expect(evaluate(asXor, { a: 1, b: 0 }, 'out')).toBe(1);
    expect(evaluate(asXor, { a: 1, b: 1 }, 'out')).toBe(0);
  });

  it('uses the new onTick, not the first one registered', () => {
    const increment = circuit('RedefTickCounter', {
      inputs: { unused: bus(8) },
      outputs: { q: bus(8) },
      state: { v: reg(8) },
      eval: ({ v }) => ({ q: v }),
      onTick: ({ v }) => ({ v: v + 1 }),
    });
    expect(evaluate(increment, { unused: 0 }, 'q', 3)).toBe(3);

    const double = circuit('RedefTickCounter', {
      inputs: { unused: bus(8) },
      outputs: { q: bus(8) },
      state: { v: reg(8, 1) },
      eval: ({ v }) => ({ q: v }),
      onTick: ({ v }) => ({ v: v * 2 }),
    });
    expect(evaluate(double, { unused: 0 }, 'q', 3)).toBe(8);
  });

  it('keeps a redefinition working when the port shape changes too', () => {
    const oneBit = circuit('RedefWidth', {
      inputs: { a: bit },
      outputs: { out: bit },
      eval: ({ a }) => ({ out: a }),
    });
    expect(evaluate(oneBit, { a: 1 }, 'out')).toBe(1);

    const wide = circuit('RedefWidth', {
      inputs: { a: bus(8) },
      outputs: { out: bus(8) },
      eval: ({ a }) => ({ out: (a << 1) & 0xff }),
    });
    expect(evaluate(wide, { a: 3 }, 'out')).toBe(6);
  });

  it('leaves an unrelated component alone', () => {
    const stable = circuit('RedefBystander', {
      inputs: { a: bit },
      outputs: { out: bit },
      eval: ({ a }) => ({ out: a ? 0 : 1 }),
    });
    expect(evaluate(stable, { a: 1 }, 'out')).toBe(0);

    circuit('RedefOther', {
      inputs: { a: bit },
      outputs: { out: bit },
      eval: ({ a }) => ({ out: a }),
    });

    expect(evaluate(stable, { a: 1 }, 'out')).toBe(0);
    expect(evaluate(stable, { a: 0 }, 'out')).toBe(1);
  });
});
