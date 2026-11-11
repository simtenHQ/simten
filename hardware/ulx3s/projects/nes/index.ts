/**
 * NES/HDMI project descriptor.
 *
 * The NES is `NesConsole` from @simten/nes, exported to Verilog: the console
 * without a cartridge, its ports the cartridge connector. nes_top.v wraps it
 * with a PLL, a frame buffer, HDMI out and the board's buttons (ulx3s_nes.lpf,
 * ULX3S 85K), and is the cartridge: an NROM flash cart in block RAM.
 *
 * Games are loaded over USB serial with load.ts, no rebuild. Set NES_ROM to
 * an NROM .nes file to also bake one in, so the board boots into it. The file
 * is read at build time and never stored in the repo.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE_2C02 } from '@simten/core/std';
import { exportVerilog } from '@simten/core/verilog';
import { NesConsole } from '@simten/nes/src/board.js';
import { parseINes } from '@simten/nes/src/ines.js';

import type { Project } from '../../lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** An NROM game as the cartridge holds it: 32 KB of PRG and 8 KB of CHR. */
export interface Cart {
  prg: Uint8Array;
  chr: Uint8Array;
  vertical: boolean;
}

/** Reads an iNES file into a cart; a 16 KB PRG is repeated to fill 32 KB. */
export function cartFromINes(bytes: Uint8Array): Cart {
  const rom = parseINes(bytes);
  if (rom.mapper !== 0) throw new Error(`nes: mapper ${rom.mapper}; only NROM (0) is supported`);
  if (rom.prg.length !== 0x4000 && rom.prg.length !== 0x8000) {
    throw new Error(`nes: NROM PRG must be 16 or 32 KB, got ${rom.prg.length} bytes`);
  }
  if (rom.chr.length !== 0x2000) throw new Error('nes: NROM needs 8 KB of CHR ROM');
  const prg = new Uint8Array(0x8000);
  prg.set(rom.prg);
  if (rom.prg.length === 0x4000) prg.set(rom.prg, 0x4000);
  return { prg, chr: rom.chr, vertical: rom.mirroring === 'vertical' };
}

/** One byte per line, for `$readmemh`. */
const hex = (bytes: Uint8Array) =>
  `${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('\n')}\n`;

/** The 2C02 palette as a 64-entry lookup. */
function palette(): string {
  const rows = PALETTE_2C02.map(
    (rgb, i) => `      6'd${i}: rgb = 24'h${rgb.toString(16).padStart(6, '0')};`,
  );
  return `module nes_palette (input wire [5:0] index, output reg [23:0] rgb);
  always @(*) begin
    case (index)
${rows.join('\n')}
      default: rgb = 24'h000000;
    endcase
  end
endmodule`;
}

/** The full design: the console, Snake's TMDS blocks, the palette, the wrapper. */
export function nesVerilog(baked?: Cart): { verilog: string; files: Record<string, string> } {
  const { verilog: nes } = exportVerilog(NesConsole(), { target: 'synthesis' });
  const snake = readFileSync(resolve(__dirname, '../snake/snake_top.v'), 'utf8');
  const tmds = snake.slice(0, snake.indexOf('// ECP5 PLL'));
  const wrapper = readFileSync(resolve(__dirname, 'nes_top.v'), 'utf8');
  const defines = baked
    ? `\`define NES_BAKED\n\`define NES_BAKED_VERTICAL 1'b${baked.vertical ? 1 : 0}\n`
    : '';
  return {
    verilog: [defines + nes, tmds, palette(), wrapper].join('\n\n'),
    files: baked ? { 'nes_prg.hex': hex(baked.prg), 'nes_chr.hex': hex(baked.chr) } : {},
  };
}

export const project: Project = {
  name: 'nes',
  projectDir: __dirname,
  bitFile: 'nes.bit',

  async buildVerilog() {
    const path = process.env.NES_ROM;
    const baked = path ? cartFromINes(new Uint8Array(readFileSync(path))) : undefined;
    const { verilog, files } = nesVerilog(baked);
    return {
      verilog,
      topModule: 'nes_top',
      lpf: readFileSync(resolve(__dirname, 'ulx3s_nes.lpf'), 'utf8'),
      device: { chip: 'LFE5U-85F', package: 'CABGA381', sizeFlag: '85k' },
      extraFiles: files,
    };
  },
};
