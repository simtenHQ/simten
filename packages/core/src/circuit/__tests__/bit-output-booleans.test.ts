/**
 * `eval` may return a boolean for a 1-bit output.
 *
 * The runtime always accepted it — the value lands in a typed array, where
 * `true`/`false` coerce to 1/0 — but `PortValues<Outs>` demanded a number, so
 * the natural spelling of a NOR
 *
 *   eval: ({ a, b }) => ({ out: !(a | b) })
 *
 * simulated correctly while showing a red squiggle, and had to be written
 * `(a | b) ? 0 : 1` to compile.
 *
 * The widening stops at one bit on purpose. The Verilog exporter emits JS `!`
 * as `~` (see eval-synth), which matches logical negation at one bit and
 * diverges above it — `!(2 | 0)` simulates to 0 while `~8'd2` is 253. So a
 * boolean on a `bus` port stays a type error, and this file is where that
 * intent is recorded: the tests below cover the runtime half, and `pnpm
 * typecheck` covers the type half by compiling this file at all.
 */

import { describe, expect, it } from 'vitest';
import { simulate } from '../../sim/index.js';
import { bit, bus } from '../bit-bus.js';
import { circuit } from '../circuit.js';

function evaluate(
  built: Parameters<typeof simulate>[0],
  inputs: Record<string, number>,
  output: string,
) {
  const sim = simulate(built);
  try {
    sim.set(inputs);
    return sim.get(output);
  } finally {
    sim.dispose();
  }
}

describe('boolean returns on 1-bit outputs', () => {
  it('coerces a negation to 1/0', () => {
    const Nor = circuit('BoolNor', {
      inputs: { a: bit, b: bit },
      outputs: { out: bit },
      eval: ({ a, b }) => ({ out: !(a | b) }),
    });

    expect(evaluate(Nor, { a: 0, b: 0 }, 'out')).toBe(1);
    expect(evaluate(Nor, { a: 1, b: 0 }, 'out')).toBe(0);
    expect(evaluate(Nor, { a: 0, b: 1 }, 'out')).toBe(0);
    expect(evaluate(Nor, { a: 1, b: 1 }, 'out')).toBe(0);
  });

  it('coerces comparison results across several outputs', () => {
    const Cmp = circuit('BoolCmp', {
      inputs: { a: bit, b: bit },
      outputs: { eq: bit, ne: bit },
      eval: ({ a, b }) => ({ eq: a === b, ne: a !== b }),
    });

    expect(evaluate(Cmp, { a: 1, b: 1 }, 'eq')).toBe(1);
    expect(evaluate(Cmp, { a: 1, b: 1 }, 'ne')).toBe(0);
    expect(evaluate(Cmp, { a: 1, b: 0 }, 'eq')).toBe(0);
    expect(evaluate(Cmp, { a: 1, b: 0 }, 'ne')).toBe(1);
  });

  it('agrees with the explicit ternary spelling the stdlib uses', () => {
    const asBoolean = circuit('BoolStyleA', {
      inputs: { a: bit, b: bit },
      outputs: { out: bit },
      eval: ({ a, b }) => ({ out: !(a & b) }),
    });
    const asTernary = circuit('BoolStyleB', {
      inputs: { a: bit, b: bit },
      outputs: { out: bit },
      eval: ({ a, b }) => ({ out: a && b ? 0 : 1 }),
    });

    for (const a of [0, 1]) {
      for (const b of [0, 1]) {
        expect(evaluate(asBoolean, { a, b }, 'out'), `a=${a} b=${b}`).toBe(
          evaluate(asTernary, { a, b }, 'out'),
        );
      }
    }
  });

  it('still requires a number on a multi-bit output', () => {
    // A boolean here would type-error, which is the point — `!` on a bus
    // simulates as logical NOT but exports as Verilog `~`. Returning a number
    // keeps simulation and synthesis in agreement.
    const Wide = circuit('BoolWide', {
      inputs: { a: bus(8), b: bus(8) },
      outputs: { out: bus(8) },
      eval: ({ a, b }) => ({ out: (a | b) === 0 ? 1 : 0 }),
    });

    expect(evaluate(Wide, { a: 0, b: 0 }, 'out')).toBe(1);
    expect(evaluate(Wide, { a: 2, b: 0 }, 'out')).toBe(0);
  });
});
