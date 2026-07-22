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
 * Scale fixture: RV32I_CPU_Core — the plan's phantom NES PPU does not exist, so
 * we use our own exported CPU (`hardware/ulx3s/projects/cpu/combined.v`,
 * top RV32I_CPU_Core, via `yosys … proc; opt_clean; memory_collect; write_json`).
 * It is the worst-case slice-heavy design in the corpus (374 cells → wide flat
 * module) — exactly where reconstruction explosion shows up.
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
  const { top: t, library } = importNetlist(JSON.parse(fixGz(file).toString('utf8')) as YosysNetlist, top);
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
  it('reconstruction ratio stays below the ratcheted bound', () => {
    expect(m.ratio).toBeLessThanOrEqual(0.35);
  });

  it('per-module node count stays below the ceiling', () => {
    expect(m.maxNodes).toBeLessThanOrEqual(1100);
  });

  it('reconstruction node count does not regress (ratchets down as B lands)', () => {
    expect(m.recon).toBeLessThanOrEqual(275);
  });

  it('residual Rtl* count does not regress (ratchets to 0 as A lifts ops to stdlib)', () => {
    expect(m.rtl).toBeLessThanOrEqual(66);
  });

  it('still builds and simulates (structure valid)', () => {
    const deps = [...m.library.values()].filter((c) => c.name !== m.t.name);
    const sim = simulate(buildFromIR(m.t, deps));
    sim.tick();
    sim.dispose();
  });
});
