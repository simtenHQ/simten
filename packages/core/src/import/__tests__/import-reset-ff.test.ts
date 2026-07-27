/**
 * Import bar for the reset/enable flip-flop family ($adff / $sdff / $dffe).
 *
 * A synchronous FIFO with active-low async-reset pointers/count exercises `$adff`
 * (via `always @(posedge clk or negedge reset)`). The importer lifts those onto
 * stdlib `Register` + its synchronous `rst`. Two claims are guarded:
 *
 *  1. Clean source — the generated source is `Rtl*`-free and drives `Register.rst`
 *     (no opaque reset primitive, no mux pile).
 *  2. Fidelity — the imported circuit simulates identically to the iverilog golden
 *     (`syncfifo.golden.json`) across reset, the full/empty flags, and every
 *     defined data value. `out` is omitted from the golden for cycles where
 *     iverilog leaves it undefined (X) before the first read — a 2-state vs
 *     4-state artifact, not a reset-modeling difference.
 *
 * See the Verilog source in `../__fixtures__/syncfifo.v`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildFromIR, circuitToSource } from '../../circuit/index.js';
import { simulate } from '../../sim/index.js';
import { importNetlist, type YosysNetlist } from '../index.js';

const fix = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url)), 'utf8');

const netlist = JSON.parse(fix('syncfifo.json')) as YosysNetlist;
const golden = JSON.parse(fix('syncfifo.golden.json')) as {
  vectors: { in: Record<string, number>; out: Record<string, number> }[];
};

function importFifo() {
  const { top, library } = importNetlist(netlist, 'syncfifo');
  const deps = [...library.values()].filter((c) => c.name !== top.name);
  return { top, deps };
}

describe('reset/enable flip-flop import ($adff → Register.rst)', () => {
  it('generates clean source: no Rtl*, drives Register.rst', () => {
    const { top, deps } = importFifo();
    const source = circuitToSource(buildFromIR(top, deps));
    expect(source).not.toMatch(/\bRtl[A-Z]/);
    expect(source).toMatch(/\.rst\b/); // async-reset registers wired to Register.rst
  });

  it('simulates identically to the iverilog golden (reset, flags, defined data)', () => {
    const { top, deps } = importFifo();
    const sim = simulate(buildFromIR(top, deps));
    golden.vectors.forEach((v, cycle) => {
      sim.set(v.in);
      sim.tick();
      for (const [port, want] of Object.entries(v.out)) {
        const got = sim.get(port);
        const gotNum = typeof got === 'boolean' ? (got ? 1 : 0) : (got as number) & 0xff;
        expect(gotNum, `${port} @ cycle ${cycle}, in=${JSON.stringify(v.in)}`).toBe(want);
      }
    });
    sim.dispose();
  });
});
