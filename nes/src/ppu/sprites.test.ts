/**
 * Sprites on the full board, against a reference drawn from OAM as the
 * NESdev wiki describes it: the first 8 sprites in OAM order on each line,
 * the lowest-numbered opaque one in front, then its priority bit against the
 * background. The program fills the nametable and both palettes, copies OAM
 * from PRG with DMA, and turns rendering on.
 */

import { nodesOf } from '@simten/core/internal';
import { describe, expect, it } from 'vitest';
import { cartridge, differences, frame, randomChr, type TestRom } from './test-frame.js';

const PALETTE = [
  0x0f, 0x16, 0x27, 0x18, 0x0f, 0x1a, 0x30, 0x27, 0x0f, 0x12, 0x2c, 0x30, 0x0f, 0x14, 0x24, 0x34,
  0x0f, 0x05, 0x15, 0x25, 0x0f, 0x09, 0x19, 0x29, 0x0f, 0x01, 0x11, 0x21, 0x0f, 0x07, 0x17, 0x37,
];

/** Byte `i` of nametable 0 as the program fills it. */
const fill = (i: number) => (i & 0xff) ^ (((i >> 8) * 0x35) & 0xff);

/** Palette, nametables, OAM by DMA from $8200, then PPUCTRL and PPUMASK. */
function program(oam: number[], ctrl: number, mask: number): TestRom {
  const code = [
    [0xa2, 0x00], // LDX #0
    [0x8e, 0x01, 0x20], // STX $2001        rendering off
    [0xa9, 0x3f, 0x8d, 0x06, 0x20, 0x8e, 0x06, 0x20], // $2006 = $3F, $00
    [0xbd, 0x00, 0x81], // pal: LDA $8100,X
    [0x8d, 0x07, 0x20], // STA $2007
    [0xe8, 0xe0, 0x20, 0xd0, 0xf5], // INX / CPX #32 / BNE pal
    [0xa9, 0x20, 0x8d, 0x06, 0x20, 0xa9, 0x00, 0x8d, 0x06, 0x20], // $2006 = $20, $00
    [0x85, 0x00, 0xa0, 0x08], // STA $00 / LDY #8
    [0xa2, 0x00], // page: LDX #0
    [0x8a, 0x45, 0x00, 0x8d, 0x07, 0x20, 0xe8, 0xd0, 0xf7], // byte: TXA / EOR $00 / STA $2007 / INX / BNE byte
    [0xa5, 0x00, 0x18, 0x69, 0x35, 0x85, 0x00, 0x88, 0xd0, 0xeb], // $00 += $35 / DEY / BNE page
    [0xa9, 0x00, 0x8d, 0x03, 0x20], // $2003 = 0
    [0xa9, 0x82, 0x8d, 0x14, 0x40], // $4014 = $82: OAM from $8200
    [0xa9, 0x00, 0x8d, 0x05, 0x20, 0x8d, 0x05, 0x20], // $2005 = 0, 0
    [0xa9, ctrl, 0x8d, 0x00, 0x20], // $2000 = ctrl
    [0xa9, mask, 0x8d, 0x01, 0x20], // $2001 = mask
  ].flat();
  return cartridge(
    code,
    [
      { at: 0x100, bytes: PALETTE },
      { at: 0x200, bytes: oam },
    ],
    randomChr(),
  );
}

/** 64 sprites from a fixed seed, a third bunched on lines 100-115 so some lines have more than 8. */
function randomOam(seed: number) {
  let s = seed;
  const next = () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return s >>> 24;
  };
  const oam: number[] = [];
  for (let i = 0; i < 64; i++) {
    const y = i % 3 === 0 ? 100 + (next() & 15) : next() % 240;
    oam.push(y, next(), next() & 0xe3, next());
  }
  return oam;
}

/** The background pixel (0-15) at (x, y): nametable 0, no scroll, pattern table $0000. */
function background(rom: TestRom, mask: number, x: number, y: number) {
  if ((mask & 0x08) === 0 || (x < 8 && (mask & 0x02) === 0)) return 0;
  const tile = fill((y >> 3) * 32 + (x >> 3));
  const attr = fill(0x3c0 + (y >> 5) * 8 + (x >> 5));
  const palette = (attr >> ((((y >> 4) & 1) << 2) | (((x >> 4) & 1) << 1))) & 3;
  const bit = 7 - (x & 7);
  const row = tile * 16 + (y & 7);
  const pixel = ((rom.chr[row] >> bit) & 1) | (((rom.chr[row + 8] >> bit) & 1) << 1);
  return pixel ? palette * 4 + pixel : 0;
}

/** A sprite's pattern bits at (x, y) on screen, or 0. */
function spritePixel(rom: TestRom, ctrl: number, oam: number[], i: number, x: number, y: number) {
  const [sy, tile, attr, sx] = oam.slice(i * 4, i * 4 + 4);
  const h = ctrl & 0x20 ? 16 : 8;
  let row = y - 1 - sy;
  let col = x - sx;
  if (row < 0 || row >= h || col < 0 || col >= 8) return 0;
  if (attr & 0x80) row = h - 1 - row;
  if (attr & 0x40) col = 7 - col;
  const base =
    h === 16
      ? (tile & 1) * 0x1000 + ((tile & 0xfe) + (row >> 3)) * 16
      : (ctrl & 0x08 ? 0x1000 : 0) + tile * 16;
  const at = base + (row & 7);
  return ((rom.chr[at] >> (7 - col)) & 1) | (((rom.chr[at + 8] >> (7 - col)) & 1) << 1);
}

/** The whole frame, colour by colour, and where sprite 0 first hits. */
function reference(rom: TestRom, oam: number[], ctrl: number, mask: number) {
  const h = ctrl & 0x20 ? 16 : 8;
  const out: number[] = [];
  let hit: [number, number] | null = null;
  for (let y = 0; y < 240; y++) {
    // Line y shows the sprites evaluated on line y - 1: the first 8 in range.
    const on: number[] = [];
    for (let i = 0; i < 64 && on.length < 8 && y > 0; i++) {
      const r = y - 1 - oam[i * 4];
      if (r >= 0 && r < h) on.push(i);
    }
    for (let x = 0; x < 256; x++) {
      const bg = background(rom, mask, x, y);
      let colour = bg;
      const shown = (mask & 0x10) !== 0 && (x >= 8 || (mask & 0x04) !== 0);
      const front = shown ? on.find((i) => spritePixel(rom, ctrl, oam, i, x, y) !== 0) : undefined;
      if (front !== undefined) {
        const bits = spritePixel(rom, ctrl, oam, front, x, y);
        const behind = (oam[front * 4 + 2] & 0x20) !== 0;
        if (!behind || (bg & 3) === 0) colour = 16 + (oam[front * 4 + 2] & 3) * 4 + bits;
      }
      const zero = shown && on[0] === 0 && spritePixel(rom, ctrl, oam, 0, x, y) !== 0;
      if (!hit && zero && (bg & 3) !== 0 && x !== 255) hit = [x, y];
      out.push(PALETTE[colour]);
    }
  }
  return { pixels: out, hit };
}

/** The frame, and the pixel on which sprite 0 hit went up. */
function run(oam: number[], ctrl: number, mask: number) {
  const rom = program(oam, ctrl, mask);
  let hit: [number, number] | null = null;
  const flag = (sim: ReturnType<typeof frame>['sim']) =>
    nodesOf(sim).ports().get('ppu.sprites.hit.q');
  let x = 0;
  let y = 0;
  const { pixels } = frame(rom, (sim) => {
    // The flag goes up at the end of the hit pixel's dot.
    if (!hit && flag(sim) === 1) hit = [x, y];
    x = sim.get('video_x');
    y = sim.get('video_y');
  });
  return { rom, pixels, hit };
}

describe('PPU sprites', () => {
  const cases = [
    { name: '8x8, pattern table $1000', ctrl: 0x08, mask: 0x1e, seed: 7 },
    { name: '8x8, left 8 pixels hidden', ctrl: 0x08, mask: 0x18, seed: 7 },
    { name: '8x16', ctrl: 0x20, mask: 0x1e, seed: 11 },
  ];
  for (const { name, ctrl, mask, seed } of cases) {
    it(`draws 64 sprites over the background, pixel for pixel: ${name}`, () => {
      const oam = randomOam(seed);
      // Sprite 0 sits where the background is busy, so it hits.
      oam.splice(0, 4, 60, 0x31, 0x00, 4);
      const got = run(oam, ctrl, mask);
      const want = reference(got.rom, oam, ctrl, mask);
      expect(differences(got.pixels, want.pixels)).toEqual([]);
      expect(want.hit).not.toBeNull();
      expect(got.hit).toEqual(want.hit);
    });
  }
});
