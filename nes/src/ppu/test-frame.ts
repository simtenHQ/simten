/** Test helpers: run a cartridge on the board and take a frame off the video pins. */

import { createNes } from '../board.js';
import type { INesRom } from '../ines.js';

export type TestRom = INesRom & { end: number };

/** A cartridge from 6502 code at $8000 that ends in a jump to itself. */
export function cartridge(
  code: number[],
  data: { at: number; bytes: number[] | Uint8Array }[],
  chr: Uint8Array,
): TestRom {
  const end = 0x8000 + code.length;
  const prg = new Uint8Array(0x4000);
  prg.set([...code, 0x4c, end & 0xff, end >> 8]);
  for (const { at, bytes } of data) prg.set(bytes, at);
  prg.set([0x00, 0x80], 0x3ffc);
  return { prg, chr, mapper: 0, mirroring: 'vertical', battery: false, end };
}

/** 8 KB of CHR from a fixed pseudo-random sequence, so every pattern bit matters. */
export function randomChr(seed = 0x1234) {
  const chr = new Uint8Array(0x2000);
  let s = seed;
  for (let i = 0; i < chr.length; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    chr[i] = s >>> 24;
  }
  return chr;
}

/**
 * Runs the program to its final jump, skips the partial frame rendering was
 * turned on in, then takes the next whole frame. `watch` sees every tick of
 * that frame before it runs.
 */
export function frame(rom: TestRom, watch?: (sim: ReturnType<typeof createNes>) => void) {
  const sim = createNes(rom, { debug: true });
  const until = (done: () => boolean, ticks: number, step = 1) => {
    for (let n = 0; !done(); n += step) {
      if (n > ticks) throw new Error(`gave up after ${ticks} ticks`);
      sim.tick(step);
    }
  };
  until(() => sim.get('sync') === 1 && sim.get('pc') === rom.end, 3 * 341 * 262, 3);
  until(() => sim.get('video_y') === 239, 341 * 262);
  until(
    () => sim.get('video_we') === 1 && sim.get('video_x') === 0 && sim.get('video_y') === 0,
    341 * 262,
  );
  const out: number[] = new Array(256 * 240).fill(-1);
  for (let n = 0; n < 341 * 262; n++) {
    watch?.(sim);
    if (sim.get('video_we')) out[sim.get('video_y') * 256 + sim.get('video_x')] = sim.get('color');
    sim.tick();
  }
  return { sim, pixels: out };
}

/** The first few mismatches, readable. */
export function differences(got: number[], want: number[]) {
  const out: string[] = [];
  for (let i = 0; i < want.length && out.length < 5; i++) {
    if (got[i] !== want[i]) out.push(`(${i % 256}, ${i >> 8}): got ${got[i]}, want ${want[i]}`);
  }
  return out;
}
