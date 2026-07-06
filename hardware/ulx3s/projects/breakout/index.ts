/**
 * Breakout/HDMI project descriptor (no firmware).
 *
 * The playable Breakout circuit lives in the blog demo
 * (apps/web/src/features/blog/breakout-in-hardware/circuits.ts). Its
 * synthesizable Verilog is exported to `breakout_core.v` here; this file wraps
 * it with breakout_top.v (PLL + 640×480 VGA/HDMI + 32×16 cell grid + game-clock
 * enable + button input) and ulx3s_breakout.lpf for the ULX3S 85K.
 *
 * `breakout_core.v` is a generated artifact — regenerate it after changing the
 * circuit with:
 *
 *   cd apps/web && npx tsx -e "…exportVerilog(Breakout, …target:'synthesis'…)…"
 *
 * TODO: consolidate the circuit into @simten/core/examples like snake, so this
 * regenerates from a single source instead of a committed .v (avoids drift).
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Project } from '../../lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const project: Project = {
  name: 'breakout',
  projectDir: __dirname,
  bitFile: 'breakout.bit',

  async buildVerilog() {
    const core = readFileSync(resolve(__dirname, 'breakout_core.v'), 'utf8');
    const wrapper = readFileSync(resolve(__dirname, 'breakout_top.v'), 'utf8');
    const lpf = readFileSync(resolve(__dirname, 'ulx3s_breakout.lpf'), 'utf8');

    return {
      verilog: core + '\n\n' + wrapper,
      topModule: 'breakout_top',
      lpf,
      device: { chip: 'LFE5U-85F', package: 'CABGA381', sizeFlag: '85k' },
      extraFiles: {},
    };
  },
};
