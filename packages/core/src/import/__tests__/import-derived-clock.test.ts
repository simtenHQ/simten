/**
 * Derived clocks are rejected on import.
 *
 * simten has exactly one implicit clock, so `$dff` CLK is always dropped (see
 * `import-drop-clock-ports.test.ts` for the port-interface half of that). That
 * is sound when CLK is the module's own clock port. It is unsound when CLK is a
 * *data* signal — a clock divider's `div[15]`, the previous stage of a ripple
 * counter, a gated clock — because dropping it silently re-clocks the flip-flop
 * onto the main clock and imports a different circuit.
 *
 * That failure was real and silent: before this check, `ripple-counter.v`
 * imported cleanly and simulated as 15, 0, 15, 0 … (four flip-flops toggling
 * together) instead of counting 1, 2, 3, 4. Since unsupported cell types throw
 * rather than mis-lift everywhere else in this importer, derived clocks throw
 * too.
 *
 * Fixtures are real yosys output (`read_verilog; hierarchy; proc; opt_clean;
 * write_json`) from the `.v` files beside them.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { importNetlist, type YosysNetlist } from '../index.js';

const fix = (name: string) =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url)), 'utf8'),
  ) as YosysNetlist;

describe('derived clocks are refused rather than silently re-clocked', () => {
  it('rejects a ripple counter, naming the flip-flop and its clock', () => {
    expect(() => importNetlist(fix('ripple-counter.json'))).toThrow(
      /flip-flop 'q\[3\]' is clocked by 'q\[2\]'/,
    );
  });

  it('rejects the classic clock-divider blinky', () => {
    expect(() => importNetlist(fix('clock-divider.json'))).toThrow(
      /flip-flop 'led' is clocked by 'div\[15\]'/,
    );
  });

  it('explains the single-clock model and points at the clock-enable rewrite', () => {
    expect(() => importNetlist(fix('clock-divider.json'))).toThrow(
      /single synchronous clock domain[\s\S]*clock enable/,
    );
  });
});

describe('ordinary synchronous logic still imports', () => {
  it('accepts a counter with async reset and enable (CLK is the clock port)', () => {
    const { top } = importNetlist(fix('sync-counter.json'), 'sync_counter');
    expect(top.name).toBe('sync_counter');
    // The clock port is dropped; rst_n and en survive as real inputs.
    expect(top.inputs.map((p) => p.name).sort()).toEqual(['en', 'rst_n']);
    expect(top.nodes.length).toBeGreaterThan(0);
  });
});
