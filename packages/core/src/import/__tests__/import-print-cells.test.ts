/**
 * `$display` is dropped with a warning, not thrown on.
 *
 * yosys lifts `$display`/`$write` to a `$print` cell. It has no hardware
 * meaning, so there is nothing to lift it *to* — but throwing takes an entire
 * design down over a debug statement, and real RTL is full of them. The servant
 * SoC (SERV's reference platform) was unimportable for exactly this reason: one
 * `$display` in its RAM's preload path failed the whole import.
 *
 * So the cell is skipped and the user is told, via the same `warnings` channel
 * the dropped-clock-ports notice uses. This guards four claims:
 *
 *  1. A design containing `$display` imports rather than throwing.
 *  2. The `$print` cell produces no node — nothing is silently mis-lifted.
 *  3. The rest of the module survives (the `$add` still lands).
 *  4. The warning names the module and the *source* line, with neither the
 *     `$paramod…\` mangling nor the synth container's temp path leaking out.
 *
 * Genuinely unsupported cells must still throw — the whole point of the
 * importer is that it refuses to mis-lift. That is asserted here too, so this
 * relaxation can't quietly widen.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { importNetlist, type YosysNetlist } from '../index.js';

const fix = (name: string) =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url)), 'utf8'),
  ) as YosysNetlist;

describe('import: $print cells', () => {
  it('imports a design containing $display instead of throwing', () => {
    expect(() => importNetlist(fix('display.json'), 'display_demo')).not.toThrow();
  });

  it('emits no node for the $print, but keeps the rest of the module', () => {
    const { top } = importNetlist(fix('display.json'), 'display_demo');
    const types = top.nodes.map((n) => n.componentRef);
    expect(types).toContain('Adder');
    expect(types.some((t) => /print/i.test(t))).toBe(false);
  });

  it('warns, naming the module and source line without leaking internals', () => {
    const { warnings } = importNetlist(fix('display.json'), 'display_demo');
    const w = warnings.find((x) => x.includes('$display'));
    expect(w).toBeDefined();
    expect(w).toContain('display_demo');
    expect(w).toMatch(/display\.v:\d+/); // basename + line, not an absolute path
    expect(w).not.toMatch(/\$paramod/); // module name de-mangled
    expect(w).not.toMatch(/\/tmp\//); // container scratch dir never reaches the user
  });

  it('still throws on a genuinely unsupported cell', () => {
    const netlist = fix('display.json');
    const mod = Object.values(netlist.modules)[0] as unknown as {
      cells: Record<string, { type: string; connections: Record<string, unknown[]> }>;
    };
    mod.cells.bogus = { type: '$not_a_real_cell', connections: {} };
    expect(() => importNetlist(netlist, 'display_demo')).toThrow(/unsupported cell type/);
  });
});
