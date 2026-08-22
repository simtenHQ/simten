/**
 * Cleanliness metric — the scale guard (plan "Verification: cleanliness").
 *
 * "No Rtl* names" is necessary but insufficient: you can satisfy it and still
 * emit 8-node dumps. So we bound the **reconstruction ratio** = reconstruction
 * nodes ÷ semantic nodes (using the single-source-of-truth `kind` classification
 * in component-homes.ts), plus a per-module node ceiling. The bounds are
 * **measured-then-ratcheted, not derived**: captured on the first clean output
 * and set just above it, so they act as a regression guard and ratchet *down* as
 * Workstream A lifts the remaining Rtl* semantic ops to stdlib.
 *
 * Two fixtures, because one was not enough:
 *
 *  - **RV32I_CPU_Core** — our own exported CPU
 *    (`hardware/ulx3s/projects/cpu/combined.v`, via
 *    `yosys … proc; opt_clean; memory_collect; write_json`). The worst-case
 *    slice-heavy design we author, where reconstruction explosion shows up.
 *  - **SERV `serv_rf_top`** — third-party RTL, 18 files from
 *    github.com/olofk/serv. Added because the bound had only ever been measured
 *    against a design written for this importer, and unmodified upstream Verilog
 *    turned out to be *worse*: SERV measured 0.414 against a 0.35 bound the
 *    fixture passed comfortably. A guard calibrated only on your own code
 *    understates the problem it exists to catch.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { buildFromIR } from '../../circuit/index.js';
import { simulate } from '../../sim/index.js';
import { isReconstruction } from '../component-homes.js';
import { importNetlist, type YosysNetlist } from '../index.js';

// Fixture is committed gzipped (51 KB vs 563 KB raw) — a real netlist is large.
const fixGz = (name: string) =>
  gunzipSync(readFileSync(fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url))));

function measure(file: string, top: string) {
  const { top: t, library } = importNetlist(
    JSON.parse(fixGz(file).toString('utf8')) as YosysNetlist,
    top,
  );
  const mods = [...library.values()].filter((c) => c.metadata?.description?.includes('Imported'));
  let recon = 0;
  let semantic = 0;
  let rtl = 0;
  let maxNodes = 0;
  for (const c of mods) {
    maxNodes = Math.max(maxNodes, c.nodes.length);
    for (const n of c.nodes) {
      if (/^Rtl[A-Z]/.test(n.componentRef) || /^Rtl_/.test(n.componentRef)) rtl++;
      if (isReconstruction(n.componentRef)) recon++;
      else semantic++;
    }
  }
  return { t, library, recon, semantic, rtl, maxNodes, ratio: recon / Math.max(1, semantic) };
}

describe('cleanliness — RV32I_CPU_Core scale guard (measured-then-ratcheted)', () => {
  const m = measure('rv32i_cpu.json.gz', 'RV32I_CPU_Core');

  // Baseline measured 2026-07-22 after B1 (extension collapse + Slice/Concat):
  //   recon 263 / semantic 804 → ratio 0.33 ; maxNodes 1067 ; Rtl* 66.
  // Ratcheted 2026-08-22 after identical reconstruction nodes were shared:
  //   recon 153 / semantic 503 → ratio 0.304 ; maxNodes 656.
  it('reconstruction ratio stays below the ratcheted bound', () => {
    expect(m.ratio).toBeLessThanOrEqual(0.32);
  });

  it('per-module node count stays below the ceiling', () => {
    expect(m.maxNodes).toBeLessThanOrEqual(700);
  });

  it('reconstruction node count does not regress (ratchets down as B lands)', () => {
    expect(m.recon).toBeLessThanOrEqual(165);
  });

  it('has ZERO residual Rtl* — a real CPU lifts entirely to clean components', () => {
    // 66 → 57 (bitwise+add) → 50 (compares) → 14 (logical+reductions) → 11
    // (shifts) → 0 (Pmux/Mem/Dlatch renamed + serialized as factory calls).
    expect(m.rtl).toBe(0);
  });

  it('still builds and simulates (structure valid)', () => {
    const deps = [...m.library.values()].filter((c) => c.name !== m.t.name);
    const sim = simulate(buildFromIR(m.t, deps));
    sim.tick();
    sim.dispose();
  });
});

describe('cleanliness — SERV serv_rf_top, unmodified third-party RTL', () => {
  const m = measure('serv_rf_top.json.gz', 'serv_rf_top');

  // Measured 2026-08-22. Before reconstruction nodes were shared this design
  // sat at recon 295 / semantic 713 → ratio 0.414, over the bound the
  // hand-written fixture passed; sharing took it to 184 / 700 → 0.263.
  it('reconstruction ratio stays below the ratcheted bound', () => {
    expect(m.ratio).toBeLessThanOrEqual(0.28);
  });

  it('per-module node count stays below the ceiling', () => {
    // 262 → 183. This is the number that decides whether drilling into a module
    // shows a readable diagram or a wall.
    expect(m.maxNodes).toBeLessThanOrEqual(200);
  });

  it('reconstruction node count does not regress', () => {
    expect(m.recon).toBeLessThanOrEqual(195);
  });

  it('has ZERO residual Rtl*', () => {
    expect(m.rtl).toBe(0);
  });

  it('still builds and simulates (structure valid)', () => {
    const deps = [...m.library.values()].filter((c) => c.name !== m.t.name);
    const sim = simulate(buildFromIR(m.t, deps));
    sim.tick();
    sim.dispose();
  });
});
