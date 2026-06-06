/**
 * Snake/HDMI project descriptor (no firmware).
 *
 * The SnakeAdvanced circuit itself lives in @simten/core/examples (single
 * source of truth, shared with the blog demo and the exporter's bitstream
 * test); this file wraps it with snake_top.v + ulx3s_snake.lpf for the
 * ULX3S 85K. Gameplay is pinned by gameplay.verify.ts, copy drift by
 * parity-check.ts, harness validity by fault-check.ts.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { exportVerilog } from '@simten/core/verilog';
import { buildSnakeAdvanced } from '@simten/core/examples';

import type { Project } from '../../lib/types.js';

export { buildSnakeAdvanced };

const __dirname = dirname(fileURLToPath(import.meta.url));

export const project: Project = {
  name: 'snake',
  projectDir: __dirname,
  bitFile: 'snake.bit',

  async buildVerilog(ctx) {
    const { circuit: snakeCircuit, lib } = buildSnakeAdvanced();
    const { verilog: snakeVerilog, files } = exportVerilog(snakeCircuit, lib, {
      target: 'synthesis',
      topModuleName: 'SnakeAdvanced',
    });

    const wrapperVerilog = readFileSync(resolve(__dirname, 'snake_top.v'), 'utf8');
    const lpf = readFileSync(resolve(__dirname, 'ulx3s_snake.lpf'), 'utf8');

    return {
      verilog: snakeVerilog + '\n\n' + wrapperVerilog,
      topModule: 'snake_top',
      lpf,
      device: { chip: 'LFE5U-85F', package: 'CABGA381', sizeFlag: '85k' },
      extraFiles: files ?? {},
    };
  },
};
