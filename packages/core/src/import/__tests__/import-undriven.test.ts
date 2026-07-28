/**
 * Undriven nets are tolerated, not fatal.
 *
 * An undriven net (usually an unassigned or misspelled signal in the source —
 * yosys keeps it as a floating wire) used to throw `net N has no driver`, which
 * aborted the whole import. The importer now ties undriven nets to 0 — simten's
 * 2-state analog of how yosys/iverilog tolerate a floating wire (x/z) — and
 * records a warning, so the (broken) design still imports and the user can see
 * it. This mirrors real-tool behavior and turns a hard stop into a note.
 */

import { describe, expect, it } from 'vitest';
import { buildFromIR, circuitToSource } from '../../circuit/index.js';
import { importNetlist, type YosysNetlist } from '../index.js';

describe('undriven nets tie to 0 with a warning (not a hard error)', () => {
  // `module top(output y);` where y reads net 2, which nothing drives.
  const undriven: YosysNetlist = {
    modules: { top: { ports: { y: { direction: 'output', bits: [2] } }, cells: {} } },
  };

  it('imports without throwing and reports a warning', () => {
    const result = importNetlist(undriven, 'top');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/undriven/i);
  });

  it('ties the undriven output to a Constant(0) in the generated source', () => {
    const { top, library } = importNetlist(undriven, 'top');
    const deps = [...library.values()].filter((c) => c.name !== top.name);
    const source = circuitToSource(buildFromIR(top, deps));
    expect(source).toContain('Constant({ width: 1, value: 0 })');
    expect(source).not.toMatch(/inWidth: null/); // tied constant carries its width
  });

  it('dedupes repeated warnings across a module', () => {
    // y and z both read undriven nets → one deduped warning, not two.
    const twoUndriven: YosysNetlist = {
      modules: {
        top: {
          ports: {
            y: { direction: 'output', bits: [2] },
            z: { direction: 'output', bits: [3] },
          },
          cells: {},
        },
      },
    };
    expect(importNetlist(twoUndriven, 'top').warnings).toHaveLength(1);
  });
});
