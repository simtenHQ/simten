/**
 * A demo cartridge for the NES, and the NES wired to a screen. The program
 * waits for the PPU's first vblank, loads a palette, writes the simten logo
 * (the square wave from the site's header) into the middle of the first
 * nametable, and turns the background on. From the next frame the PPU draws
 * it, dot by dot.
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
 *   8016  BD 4B 80  LDA $804B,X    four colours
 *   8019  8D 07 20  STA $2007
 *   801C  E8        INX
 *   801D  E0 04     CPX #4
 *   801F  D0 F5     BNE $8016
 *   8021  A0 00     LDY #0         Y: logo row, 0 to 7
 *   8023  A2 00     LDX #0         X: logo tile, 0 to 95
 *   8025  B9 59 80  LDA $8059,Y    PPUADDR = the row's first tile
 *   8028  8D 06 20  STA $2006
 *   802B  B9 61 80  LDA $8061,Y
 *   802E  8D 06 20  STA $2006
 *   8031  A9 0C     LDA #12        12 tiles to the row, counted in $00
 *   8033  85 00     STA $00
 *   8035  BD 69 80  LDA $8069,X    the tile number
 *   8038  8D 07 20  STA $2007
 *   803B  E8        INX
 *   803C  C6 00     DEC $00
 *   803E  D0 F5     BNE $8035
 *   8040  C8        INY            next row
 *   8041  C0 08     CPY #8
 *   8043  D0 E0     BNE $8025
 *   8045  A9 00     LDA #0         scroll to 0, 0
 *   8047  8D 05 20  STA $2005
 *   804A  8D 05 20  STA $2005
 *   804D  A9 0A     LDA #$0A       PPUMASK: background on, left column too
 *   804F  8D 01 20  STA $2001
 *   8052  4C 52 80  JMP $8052      done; the PPU does the rest
 *   8055  0F 30 21 11              palette: black, white, light blue, blue
 *   8059  21 21 21 21 21 22 22 22  each row's address, high bytes
 *   8061  6A 8A AA CA EA 0A 2A 4A  and low: row 11 + n, column 10
 *   8069  ...                      the logo's 96 tile numbers, row by row
 *
 * It all has to happen inside the one vblank: turned on mid-frame, the PPU
 * would draw from wherever the writes left its address, as it only takes the
 * scroll at the top of a frame. So only the logo's 96 tiles are written (the
 * rest of the nametable is 0 already, the blank tile), about 2,060 CPU cycles
 * of vblank's 2,273. Frame 1 is blank while the program waits; frame 2 has
 * the logo.
 */

import { circuit } from '@simten/core';
import { HexDisplay, Input, PaletteDisplay, romFromBytes } from '@simten/core/std';
import { Nes } from './board.js';

const DEMO_PROGRAM = [
  0x78, 0xd8, 0xa2, 0xff, 0x9a, 0x2c, 0x02, 0x20, 0x10, 0xfb, 0xa9, 0x3f, 0x8d, 0x06, 0x20, 0xa9,
  0x00, 0x8d, 0x06, 0x20, 0xa2, 0x00, 0xbd, 0x55, 0x80, 0x8d, 0x07, 0x20, 0xe8, 0xe0, 0x04, 0xd0,
  0xf5, 0xa0, 0x00, 0xa2, 0x00, 0xb9, 0x59, 0x80, 0x8d, 0x06, 0x20, 0xb9, 0x61, 0x80, 0x8d, 0x06,
  0x20, 0xa9, 0x0c, 0x85, 0x00, 0xbd, 0x69, 0x80, 0x8d, 0x07, 0x20, 0xe8, 0xc6, 0x00, 0xd0, 0xf5,
  0xc8, 0xc0, 0x08, 0xd0, 0xe0, 0xa9, 0x00, 0x8d, 0x05, 0x20, 0x8d, 0x05, 0x20, 0xa9, 0x0a, 0x8d,
  0x01, 0x20, 0x4c, 0x52, 0x80,
];
const PALETTE = [0x0f, 0x30, 0x21, 0x11];
/** Where the program's tables sit after it: palette, row addresses, tiles. */
const AT_PALETTE = 0x55;
const AT_ROW_HI = 0x59;
const AT_ROW_LO = 0x61;
const AT_TILES = 0x69;

/** The logo is 12×8 tiles (96×64 pixels), at column 10, row 11: centred. */
const LOGO_COLS = 12;
const LOGO_ROWS = 8;
const LOGO_COL = 10;
const LOGO_ROW = 11;

/**
 * The logo's square wave as corners, in pixels within its 96×64 box: a wide
 * pulse, then two narrow ones, on a 3-pixel line.
 */
const LOGO_WAVE: [number, number][] = [
  [1, 60],
  [22, 60],
  [22, 3],
  [44, 3],
  [44, 60],
  [58, 60],
  [58, 3],
  [66, 3],
  [66, 60],
  [72, 60],
  [72, 3],
  [80, 3],
  [80, 60],
  [94, 60],
];

/** The logo as rows of pixels, 1 where the line is. */
export function logoBitmap(): number[][] {
  const w = LOGO_COLS * 8;
  const h = LOGO_ROWS * 8;
  const px = Array.from({ length: h }, () => new Array<number>(w).fill(0));
  for (let i = 1; i < LOGO_WAVE.length; i++) {
    const [x0, y0] = LOGO_WAVE[i - 1];
    const [x1, y1] = LOGO_WAVE[i];
    for (let y = Math.min(y0, y1) - 1; y <= Math.max(y0, y1) + 1; y++) {
      for (let x = Math.min(x0, x1) - 1; x <= Math.max(x0, x1) + 1; x++) {
        if (y >= 0 && y < h && x >= 0 && x < w) px[y][x] = 1;
      }
    }
  }
  return px;
}

/**
 * The logo cut into 8×8 tiles: each distinct tile once, as its 8 rows of
 * bits (tile 0, blank, is left out), and which tile goes where.
 */
function logoTiles(): { tiles: number[][]; map: number[][] } {
  const px = logoBitmap();
  const tiles: number[][] = [];
  const ids = new Map<string, number>();
  const map = Array.from({ length: LOGO_ROWS }, (_, ty) =>
    Array.from({ length: LOGO_COLS }, (_, tx) => {
      const rows = Array.from({ length: 8 }, (_, y) =>
        px[ty * 8 + y].slice(tx * 8, tx * 8 + 8).reduce((b, bit) => (b << 1) | bit, 0),
      );
      if (rows.every((r) => r === 0)) return 0;
      const key = rows.join(',');
      let id = ids.get(key);
      if (id === undefined) {
        tiles.push(rows);
        id = tiles.length;
        ids.set(key, id);
      }
      return id;
    }),
  );
  return { tiles, map };
}

/** Each logo row's nametable address: row LOGO_ROW + n, column LOGO_COL. */
const rowAddresses = Array.from(
  { length: LOGO_ROWS },
  (_, n) => 0x2000 + (LOGO_ROW + n) * 32 + LOGO_COL,
);

/** The 16 KB PRG ROM: the program at $8000, the reset vector pointing at it. */
export function demoPrg(): number[] {
  const prg = new Array(0x4000).fill(0);
  const put = (at: number, bytes: number[]) => {
    bytes.forEach((b, i) => {
      prg[at + i] = b;
    });
  };
  put(0, DEMO_PROGRAM);
  put(AT_PALETTE, PALETTE);
  put(
    AT_ROW_HI,
    rowAddresses.map((a) => a >> 8),
  );
  put(
    AT_ROW_LO,
    rowAddresses.map((a) => a & 0xff),
  );
  put(AT_TILES, logoTiles().map.flat());
  prg[0x3ffc] = 0x00; // reset vector, $FFFC (mirrored from $BFFC)
  prg[0x3ffd] = 0x80;
  return prg;
}

/** The 8 KB CHR ROM: tile 0 blank, then the logo's tiles (plane 0 only). */
export function demoChr(): number[] {
  const chr = new Array(0x2000).fill(0);
  logoTiles().tiles.forEach((rows, t) => {
    rows.forEach((row, y) => {
      chr[(t + 1) * 16 + y] = row;
    });
  });
  return chr;
}

/**
 * The NES with the demo cartridge in, drawing to a screen, with a byte to
 * type in as controller 1 and its audio shown. Press Run and turn the clock
 * up: one frame is 89,342 ticks, about 9 seconds at the editor's top speed.
 * The first frame is blank while the program waits for the PPU; the second
 * draws the logo.
 */
export const NesDemo = circuit('NesDemo', {
  nodes: {
    pad1: Input(),
    nes: Nes({ prgSize: 0x4000, prg: romFromBytes(demoPrg()), chr: romFromBytes(demoChr()) }),
    tv: PaletteDisplay(),
    audio: HexDisplay({ width: 16 }),
  },
  connect: ({ nodes: { pad1, nes, tv, audio } }) => [
    pad1.out.to(nes.pad1),
    nes.video_x.to(tv.x),
    nes.video_y.to(tv.y),
    nes.color.to(tv.color),
    nes.video_we.to(tv.we),
    nes.audio.to(audio.in),
  ],
});
