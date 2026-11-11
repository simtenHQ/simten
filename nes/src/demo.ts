/**
 * A demo cartridge for the NES, and the NES wired to a screen. The program
 * waits for the PPU's first vblank, loads a palette, writes "SIMTEN" into the
 * middle of the first nametable, and turns the background on. From the next
 * frame the PPU draws it, dot by dot.
 *
 *   8000  78        SEI            no interrupts
 *   8001  D8        CLD
 *   8002  A2 FF     LDX #$FF       stack at $01FF
 *   8004  9A        TXS
 *   8005  2C 02 20  BIT $2002      wait for vblank: PPUSTATUS bit 7
 *   8008  10 FB     BPL $8005
 *   800A  A9 3F     LDA #$3F       PPUADDR = $3F00, the palette
 *   800C  8D 06 20  STA $2006
 *   800F  A9 00     LDA #$00
 *   8011  8D 06 20  STA $2006
 *   8014  A2 00     LDX #0
 *   8016  BD 48 80  LDA $8048,X    four colours
 *   8019  8D 07 20  STA $2007
 *   801C  E8        INX
 *   801D  E0 04     CPX #4
 *   801F  D0 F5     BNE $8016
 *   8021  A9 21     LDA #$21       PPUADDR = $21CB: row 14, column 11
 *   8023  8D 06 20  STA $2006
 *   8026  A9 CB     LDA #$CB
 *   8028  8D 06 20  STA $2006
 *   802B  A2 00     LDX #0
 *   802D  BD 4C 80  LDA $804C,X    six tiles, S I M T E N
 *   8030  8D 07 20  STA $2007
 *   8033  E8        INX
 *   8034  E0 06     CPX #6
 *   8036  D0 F5     BNE $802D
 *   8038  A9 00     LDA #0         scroll to 0, 0
 *   803A  8D 05 20  STA $2005
 *   803D  8D 05 20  STA $2005
 *   8040  A9 0A     LDA #$0A       PPUMASK: background on, left column too
 *   8042  8D 01 20  STA $2001
 *   8045  4C 45 80  JMP $8045      done; the PPU does the rest
 *   8048  0F 30 21 11              palette: black, white, light blue, blue
 *   804C  01 02 03 04 05 06        the text, as tile numbers
 */

import { bus, circuit } from '@simten/core';
import { PaletteDisplay, romFromBytes } from '@simten/core/std';
import { Nes } from './board.js';

const DEMO_PROGRAM = [
  0x78, 0xd8, 0xa2, 0xff, 0x9a, 0x2c, 0x02, 0x20, 0x10, 0xfb, 0xa9, 0x3f, 0x8d, 0x06, 0x20, 0xa9,
  0x00, 0x8d, 0x06, 0x20, 0xa2, 0x00, 0xbd, 0x48, 0x80, 0x8d, 0x07, 0x20, 0xe8, 0xe0, 0x04, 0xd0,
  0xf5, 0xa9, 0x21, 0x8d, 0x06, 0x20, 0xa9, 0xcb, 0x8d, 0x06, 0x20, 0xa2, 0x00, 0xbd, 0x4c, 0x80,
  0x8d, 0x07, 0x20, 0xe8, 0xe0, 0x06, 0xd0, 0xf5, 0xa9, 0x00, 0x8d, 0x05, 0x20, 0x8d, 0x05, 0x20,
  0xa9, 0x0a, 0x8d, 0x01, 0x20, 0x4c, 0x45, 0x80, 0x0f, 0x30, 0x21, 0x11, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06,
];

/** Tiles 1-6: S I M T E N, 8×8, one bit per pixel (plane 0; plane 1 stays 0). */
const DEMO_FONT = [
  [0x3c, 0x66, 0x60, 0x3c, 0x06, 0x66, 0x3c, 0x00], // S
  [0x3c, 0x18, 0x18, 0x18, 0x18, 0x18, 0x3c, 0x00], // I
  [0x63, 0x77, 0x7f, 0x6b, 0x63, 0x63, 0x63, 0x00], // M
  [0x7e, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x00], // T
  [0x7e, 0x60, 0x60, 0x7c, 0x60, 0x60, 0x7e, 0x00], // E
  [0x66, 0x76, 0x7e, 0x7e, 0x6e, 0x66, 0x66, 0x00], // N
];

/** The 16 KB PRG ROM: the program at $8000, the reset vector pointing at it. */
export function demoPrg(): number[] {
  const prg = new Array(0x4000).fill(0);
  DEMO_PROGRAM.forEach((b, i) => {
    prg[i] = b;
  });
  prg[0x3ffc] = 0x00; // reset vector, $FFFC (mirrored from $BFFC)
  prg[0x3ffd] = 0x80;
  return prg;
}

/** The 8 KB CHR ROM: tile 0 blank, tiles 1-6 the letters. */
export function demoChr(): number[] {
  const chr = new Array(0x2000).fill(0);
  DEMO_FONT.forEach((rows, t) => {
    rows.forEach((row, y) => {
      chr[(t + 1) * 16 + y] = row;
    });
  });
  return chr;
}

/**
 * The NES with the demo cartridge in, drawing to a screen. Press Run and
 * turn the clock up: one frame is 89,342 ticks, so at the editor's top speed
 * the first, empty frame takes about 9 seconds, then the next draws the text.
 */
export const NesDemo = circuit('NesDemo', {
  inputs: { pad1: bus(8) },
  outputs: { audio: bus(16) },
  nodes: {
    nes: Nes({ prgSize: 0x4000, prg: romFromBytes(demoPrg()), chr: romFromBytes(demoChr()) }),
    tv: PaletteDisplay(),
  },
  connect: ({ inputs: i, outputs: o, nodes: { nes, tv } }) => [
    i.pad1.to(nes.pad1),
    nes.video_x.to(tv.x),
    nes.video_y.to(tv.y),
    nes.color.to(tv.color),
    nes.video_we.to(tv.we),
    nes.audio.to(o.audio),
  ],
});
