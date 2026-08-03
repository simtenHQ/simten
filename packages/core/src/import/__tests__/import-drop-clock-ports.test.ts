/**
 * Clock-only ports are dropped on import (#clk-round-trip).
 *
 * simten sequential primitives share a single implicit clock — `$dff` CLK is
 * never lifted. A top-level `clk` port therefore carries no signal: it lands as
 * a dangling input and duplicates the `clk` the Verilog exporter re-adds, so an
 * imported-then-re-exported design won't compile. `moduleShapes` drops any input
 * whose net feeds only clock pins. This guards three claims:
 *
 *  1. The clock port is gone from the imported interface, at every level of the
 *     hierarchy (so drill-down is clean too).
 *  2. Reset ports survive — their nets feed `Register.rst`, not a clock pin.
 *  3. Re-export emits exactly one `clk` (the exporter's own), i.e. no duplicate.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildFromIR } from '../../circuit/index.js';
import type { Circuit, CircuitLibrary } from '../../index.js';
import { exportVerilog } from '../../verilog/index.js';
import { importNetlist, type YosysNetlist } from '../index.js';

const fix = (name: string) =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url)), 'utf8'),
  ) as YosysNetlist;

const inputNames = (c: Circuit) => c.inputs.map((p) => p.name);

/** Re-export the imported top back to Verilog and count `input clk` declarations. */
function reexportClkCount(top: Circuit, deps: Circuit[]): number {
  const built = buildFromIR(top, deps);
  const lib: CircuitLibrary = {
    resolveCircuit: (n) =>
      n === built.circuit.name ? built.circuit : built._dependencies?.get(n)?.circuit,
    getAllPrimitiveNames: () => [...(built._dependencies?.keys() ?? [])],
  };
  const { verilog } = exportVerilog(built.circuit, lib);
  return verilog.split('\n').filter((l) => /^\s*input\s+clk\s*[,;]/.test(l)).length;
}

describe('import drops clock-only ports', () => {
  it('syncfifo: clk dropped, reset kept, single clk on re-export', () => {
    const { top, library, warnings } = importNetlist(fix('syncfifo.json'), 'syncfifo');
    expect(inputNames(top)).not.toContain('clk');
    expect(inputNames(top)).toContain('reset'); // reset feeds Register.rst — kept
    expect(warnings.some((w) => /clock port/i.test(w) && /implicit clock/i.test(w))).toBe(true);

    const deps = [...library.values()].filter((c) => c.name !== top.name);
    expect(reexportClkCount(top, deps)).toBe(1);
  });

  it('counter4bit: clk dropped, non-zero reset port still kept', () => {
    const { top } = importNetlist(fix('counter4bit.json'), 'counter4bit');
    expect(inputNames(top)).not.toContain('clk');
    expect(inputNames(top)).toContain('reset'); // preset reset routed via Mux, port still real
  });

  it('demo (hierarchical): clk dropped at every level, single clk on re-export', () => {
    const { top, library } = importNetlist(fix('demo.json'), 'top');
    // Top-level clk dropped...
    expect(inputNames(top)).not.toContain('clk');
    // ...and the submodule's clk too (the fixpoint propagates the child's clock
    // port up, so the parent's clk — which only feeds sub.clk — is also dropped).
    for (const c of library.values()) {
      expect(inputNames(c), `${c.name} should have no clk port`).not.toContain('clk');
    }
    const deps = [...library.values()].filter((c) => c.name !== top.name);
    expect(reexportClkCount(top, deps)).toBe(1);
  });
});
