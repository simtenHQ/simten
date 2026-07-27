/**
 * Verilog import spike — integration tests.
 *
 * The fixture (demo.v → demo.json via yosys 0.64) is deliberately engineered to
 * force the hard reconstruction paths; the golden is captured from iverilog 13.0
 * on the source (independent oracle). See __fixtures__ and the plan.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildFromIR } from '../../circuit/index.js';
import { simulate } from '../../sim/index.js';
import { importNetlist, type YosysNetlist } from '../index.js';

const fix = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url)), 'utf8');

const netlist = JSON.parse(fix('demo.json')) as YosysNetlist;
const golden = JSON.parse(fix('demo.golden.json')) as {
  vectors: { in: Record<string, number>; out: Record<string, number> }[];
};

describe('fixture integrity (hard paths survived yosys proc/opt_clean)', () => {
  const top = netlist.modules.top;
  const cell = (t: string) => Object.values(top.cells).find((c) => c.type === t)!;

  it('$add.A carries a run + replicated MSB (sign extension)', () => {
    const a = cell('$add').connections.A as number[];
    expect(a).toHaveLength(8);
    const msb = a[3];
    // low nibble is a strict ascending run; top nibble is the MSB repeated
    expect(a.slice(4)).toEqual([msb, msb, msb, msb]);
    expect(a[0]).not.toBe(msb);
  });

  it('u_sub.din is a multi-driver concat crossing the module boundary', () => {
    const sub = Object.values(top.cells).find((c) => c.type === 'sub')!;
    const din = sub.connections.din as number[];
    expect(din).toHaveLength(8);
    // two distinct 4-bit runs from two different source ports (lo then hi)
    const loRun = din.slice(0, 4);
    const hiRun = din.slice(4, 8);
    expect(new Set([...loRun, ...hiRun]).size).toBe(8); // all distinct nets
  });

  it('$mux select is a single independent bit', () => {
    expect((cell('$mux').connections.S as number[]).length).toBe(1);
  });
});

describe('end-to-end: imported IR simulates to the iverilog golden', () => {
  it('matches all golden vectors', () => {
    const { top, library } = importNetlist(netlist, 'top');
    const deps = [...library.values()].filter((c) => c.name !== 'top');
    const sim = simulate(buildFromIR(top, deps));
    for (const v of golden.vectors) {
      sim.set(v.in);
      sim.tick();
      for (const [k, want] of Object.entries(v.out)) {
        expect(sim.get(k), `${k} for in=${JSON.stringify(v.in)}`).toBe(want);
      }
    }
  });
});

describe('hierarchy is load-bearing (not decorative)', () => {
  it('structural: the top instantiates sub and the library defines it', () => {
    const { top, library } = importNetlist(netlist, 'top');
    const subNode = top.nodes.find((n) => n.componentRef === 'sub');
    expect(subNode, 'top must contain a node referencing sub').toBeDefined();
    expect(library.has('sub'), 'library must define sub').toBe(true);
  });

  it('failure differential: removing sub breaks simulation', () => {
    const { top, library } = importNetlist(netlist, 'top');
    // drop the submodule dependency — regd depends on it, so this must fail.
    const depsWithoutSub = [...library.values()].filter(
      (c) => c.name !== 'top' && c.name !== 'sub',
    );
    expect(() => {
      const sim = simulate(buildFromIR(top, depsWithoutSub));
      sim.set(golden.vectors[0].in);
      sim.tick();
    }).toThrow(/sub/i);
  });
});
