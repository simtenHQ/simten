/**
 * uart_test project descriptor — standalone Verilog module that streams
 * "HELLO\r\n" over the UART. No firmware, no @simten/core circuit — just
 * readFileSync on uart_test_top.v. Exercises the no-firmware path in the
 * generic pipeline.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Project } from '../lib/types.js';

export const uartTestProject: Project = {
  name: 'uart_test',
  bitFile: 'uart_test.bit',
  uart: { baud: 115200 },

  async buildVerilog(ctx) {
    const verilog = readFileSync(resolve(ctx.baseDir, 'uart_test_top.v'), 'utf8');
    const lpf = readFileSync(resolve(ctx.baseDir, 'ulx3s_uart_test.lpf'), 'utf8');
    return {
      verilog,
      topModule: 'uart_test_top',
      lpf,
      device: { chip: 'LFE5U-85F', package: 'CABGA381', sizeFlag: '85k' },
    };
  },
};
