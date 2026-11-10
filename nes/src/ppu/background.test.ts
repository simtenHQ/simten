/**
 * The background on the full board, against a reference drawn straight from
 * what the program put in memory. The program fills both nametables, sets a
 * palette and a scroll that crosses into the second nametable horizontally
 * and wraps coarse Y past row 29, then turns the background on. About 4
 * frames per case, so ~8 s each.
 */

import { describe, expect, it } from 'vitest';
import { cartridge as build, differences, frame, randomChr, type TestRom } from './test-frame.js';

const PALETTE = [
  0x0f, 0x16, 0x27, 0x18, 0x0f, 0x1a, 0x30, 0x27, 0x0f, 0x12, 0x2c, 0x30, 0x0f, 0x14, 0x24, 0x34,
];
const SCROLL_X = 13;
const SCROLL_Y = 21;

/** Byte `i` of nametable RAM ($2000-$27FF) as the program fills it. */
const fill = (i: number) => (i & 0xff) ^ (((i >> 8) * 0x35) & 0xff);

function cartridge(mask: number): TestRom {
  const code = [
    [0xa2, 0x00], // LDX #0
    [0x8e, 0x01, 0x20], // STX $2001        rendering off
    [0xa9, 0x3f, 0x8d, 0x06, 0x20, 0x8e, 0x06, 0x20], // $2006 = $3F, $00
    [0xbd, 0x00, 0x81], // pal: LDA $8100,X
    [0x8d, 0x07, 0x20], // STA $2007
    [0xe8, 0xe0, 0x10, 0xd0, 0xf5], // INX / CPX #16 / BNE pal
    [0xa9, 0x20, 0x8d, 0x06, 0x20, 0xa9, 0x00, 0x8d, 0x06, 0x20], // $2006 = $20, $00
    [0x85, 0x00, 0xa0, 0x08], // STA $00 / LDY #8
    [0xa2, 0x00], // page: LDX #0
    [0x8a, 0x45, 0x00, 0x8d, 0x07, 0x20, 0xe8, 0xd0, 0xf7], // byte: TXA / EOR $00 / STA $2007 / INX / BNE byte
    [0xa5, 0x00, 0x18, 0x69, 0x35, 0x85, 0x00, 0x88, 0xd0, 0xeb], // $00 += $35 / DEY / BNE page
    [0xa9, SCROLL_X, 0x8d, 0x05, 0x20, 0xa9, SCROLL_Y, 0x8d, 0x05, 0x20], // $2005 = x, y
    [0xa9, 0x00, 0x8d, 0x00, 0x20], // $2000 = 0: nametable 0, background at $0000
    [0xa9, mask, 0x8d, 0x01, 0x20], // $2001 = mask
  ].flat();
  return build(code, [{ at: 0x100, bytes: PALETTE }], randomChr());
}

/** The frame the background should draw, colour by colour. */
function reference(rom: TestRom, mask: number): number[] {
  const out: number[] = [];
  for (let y = 0; y < 240; y++) {
    for (let x = 0; x < 256; x++) {
      const wx = x + SCROLL_X;
      const wy = (y + SCROLL_Y) % 240;
      // Vertical mirroring: crossing right goes to the second nametable,
      // crossing down stays in the same one.
      const base = ((wx >> 8) & 1) * 0x400;
      const cx = wx & 0xff;
      const tile = fill(base + (wy >> 3) * 32 + (cx >> 3));
      const attr = fill(base + 0x3c0 + (wy >> 5) * 8 + (cx >> 5));
      const palette = (attr >> ((((wy >> 4) & 1) << 2) | (((cx >> 4) & 1) << 1))) & 3;
      const row = tile * 16 + (wy & 7);
      const bit = 7 - (cx & 7);
      const pixel = ((rom.chr[row] >> bit) & 1) | (((rom.chr[row + 8] >> bit) & 1) << 1);
      const shown = (mask & 0x02) !== 0 || x >= 8;
      out.push(PALETTE[shown && pixel ? palette * 4 + pixel : 0]);
    }
  }
  return out;
}

describe('PPU background', () => {
  it('draws a scrolled screen across two nametables, pixel for pixel', () => {
    const rom = cartridge(0x0a);
    expect(differences(frame(rom).pixels, reference(rom, 0x0a))).toEqual([]);
  });

  it('shows the backdrop in the left 8 pixels with PPUMASK bit 1 clear', () => {
    const rom = cartridge(0x08);
    expect(differences(frame(rom).pixels, reference(rom, 0x08))).toEqual([]);
  });
});
