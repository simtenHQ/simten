/**
 * NES/HDMI project descriptor.
 *
 * The NES is `NesBoard` from @simten/nes, exported to Verilog; nes_top.v
 * wraps it with a PLL, the cartridge, a frame buffer, HDMI out and the
 * board's buttons (ulx3s_nes.lpf, ULX3S 85K).
 *
 * The cartridge lives in the wrapper, in block RAM: the board's two ROMs
 * become ports, and so does the mirroring, which a real cart sets. Games are
 * loaded over USB serial with load.ts, no rebuild. Set NES_ROM to an NROM
 * .nes file to also bake one in, so the board boots into it. The file is
 * read at build time and never stored in the repo.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE_2C02 } from '@simten/core/std';
import { exportVerilog } from '@simten/core/verilog';
import { NesBoard } from '@simten/nes/src/board.js';
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

/** Replaces the one match of `re` in `text`, or throws. */
function rewrite(text: string, re: RegExp, to: string, what: string): string {
  const hits = text.match(new RegExp(re.source, `${re.flags.replace('g', '')}g`));
  if (hits?.length !== 1) {
    throw new Error(`nes: expected one ${what} in the exported board, found ${hits?.length ?? 0}`);
  }
  return text.replace(re, to);
}

/**
 * Moves the cartridge out of the exported board: the PRG and CHR ROMs become
 * address outputs and data inputs, and the nametable mirroring an input.
 */
export function cartPorts(board: string): string {
  let v = board;
  v = rewrite(
    v,
    /^( {2}input rst_n,\n)/m,
    '$1  input mirror_v,\n  output [15:0] prg_addr,\n  input [7:0] prg_data,\n  output [15:0] chr_addr,\n  input [7:0] chr_data,\n',
    'rst_n port',
  );
  for (const rom of ['prg', 'chr']) {
    v = rewrite(
      v,
      new RegExp(`^ *reg \\[7:0\\] mem_${rom} \\[0:\\d+\\];\\n`, 'm'),
      '',
      `${rom} ROM`,
    );
    v = rewrite(
      v,
      new RegExp(`assign (w_${rom}_data_out) = mem_${rom}\\[(\\w+)\\];`),
      `assign ${rom}_addr = $2;\n  assign $1 = ${rom}_data;`,
      `${rom} ROM read`,
    );
  }
  return rewrite(
    v,
    /assign vbus_page = \(\((\w+) >> 1[01]\) & 1\);/,
    'assign vbus_page = mirror_v ? (($1 >> 10) & 1) : (($1 >> 11) & 1);',
    'nametable page',
  );
}

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

/** The full design: the board, Snake's TMDS blocks, the palette, the wrapper. */
export function nesVerilog(baked?: Cart): { verilog: string; files: Record<string, string> } {
  const { verilog: board } = exportVerilog(NesBoard({ prgSize: 0x8000 }), { target: 'synthesis' });
  const snake = readFileSync(resolve(__dirname, '../snake/snake_top.v'), 'utf8');
  const tmds = snake.slice(0, snake.indexOf('// ECP5 PLL'));
  const wrapper = readFileSync(resolve(__dirname, 'nes_top.v'), 'utf8');
  const defines = baked
    ? `\`define NES_BAKED\n\`define NES_BAKED_VERTICAL 1'b${baked.vertical ? 1 : 0}\n`
    : '';
  return {
    verilog: [defines + cartPorts(board), tmds, palette(), wrapper].join('\n\n'),
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
