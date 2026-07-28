/**
 * Import bar for `$div` / `$mod` (integer divide + remainder, signed & unsigned).
 *
 * A design computing `a/b`, `a%b`, `$signed(a)/$signed(b)`, and `$signed(a)%$signed(b)`
 * exercises all four lifted components (`Divider`/`Modulo`/`SignedDivider`/`SignedModulo`).
 * Guards two claims: the source is `Rtl*`-free, and it simulates identically to
 * the iverilog golden over a b≠0 grid — including signed division's truncate-toward
 * -zero semantics (`-7/2 = -3`) and remainder's sign-of-dividend (`-7%2 = -1`).
 *
 * See the Verilog in `../__fixtures__/divtest.v`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildFromIR, circuitToSource } from '../../circuit/index.js';
import { simulate } from '../../sim/index.js';
import { importNetlist, type YosysNetlist } from '../index.js';

const fix = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url)), 'utf8');

const netlist = JSON.parse(fix('divtest.json')) as YosysNetlist;
const golden = JSON.parse(fix('divtest.golden.json')) as {
  vectors: { in: Record<string, number>; out: Record<string, number> }[];
};

function importDiv() {
  const { top, library } = importNetlist(netlist, 'divtest');
  const deps = [...library.values()].filter((c) => c.name !== top.name);
  return { top, deps };
}

describe('divide/remainder import ($div/$mod → Divider/Modulo + Signed*)', () => {
  it('generates clean source using the divide/remainder components', () => {
    const { top, deps } = importDiv();
    const source = circuitToSource(buildFromIR(top, deps));
    expect(source).not.toMatch(/\bRtl[A-Z]/);
    expect(source).toMatch(/\bDivider\(/);
    expect(source).toMatch(/\bModulo\(/);
    expect(source).toMatch(/SignedDivider\(/);
    expect(source).toMatch(/SignedModulo\(/);
    expect(source).toMatch(/ReduceXnor\(/); // $reduce_xnor also lifted here
  });

  it('simulates identically to the iverilog golden (unsigned + signed div/mod)', () => {
    const { top, deps } = importDiv();
    const sim = simulate(buildFromIR(top, deps));
    golden.vectors.forEach((v, i) => {
      sim.set(v.in);
      sim.tick();
      for (const [port, want] of Object.entries(v.out)) {
        expect(
          (sim.get(port) as number) & 0xff,
          `${port} @ cycle ${i}, in=${JSON.stringify(v.in)}`,
        ).toBe(want);
      }
    });
    sim.dispose();
  });
});
