/**
 * uart_test project descriptor — standalone Verilog module that streams
 * "HELLO\r\n" over the UART. No firmware, no @simten/core circuit — just
 * readFileSync on uart_test_top.v. Exercises the no-firmware path in the
 * generic pipeline.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Project } from '../../lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const project: Project = {
  name: 'uart_test',
  projectDir: __dirname,
  bitFile: 'uart_test.bit',
  uart: { baud: 115200 },

  async buildVerilog() {
    const verilog = readFileSync(resolve(__dirname, 'uart_test_top.v'), 'utf8');
    const lpf = readFileSync(resolve(__dirname, 'ulx3s_uart_test.lpf'), 'utf8');
    return {
      verilog,
      topModule: 'uart_test_top',
      lpf,
      device: { chip: 'LFE5U-85F', package: 'CABGA381', sizeFlag: '85k' },
    };
  },
};
