/**
 * The usual NES boot on the full board: wait for two vblanks on $2002, turn
 * on NMI, then take one NMI per frame. About 6 frames, so ~12 s.
 */

import { describe, expect, it } from 'vitest';
import { createNes } from '../board.js';

const AFTER_WAIT = 0x800d;
const HANDLER = 0x8015;
const code = [
  [0xa2, 0xff], // 8000 LDX #$FF
  [0x9a], // 8002 TXS
  [0x2c, 0x02, 0x20], // 8003 BIT $2002
  [0x10, 0xfb], // 8006 BPL $8003
  [0x2c, 0x02, 0x20], // 8008 BIT $2002
  [0x10, 0xfb], // 800B BPL $8008
  [0xa9, 0x80], // 800D LDA #$80
  [0x8d, 0x00, 0x20], // 800F STA $2000
  [0x4c, 0x12, 0x80], // 8012 JMP $8012
  [0xe6, 0x00], // 8015 INC $00   NMI handler
  [0x40], // 8017 RTI
].flat();

/** Dot (from power-on) where frame `f`'s vblank flag goes up: (241, 1). */
const vblank = (f: number) => f * 341 * 262 + 241 * 341 + 1;

describe('NES boot on the board', () => {
  it('waits out two vblanks, then takes an NMI every frame', { timeout: 60_000 }, () => {
    const prg = new Uint8Array(0x4000);
    prg.set(code);
    prg.set([0x15, 0x80, 0x00, 0x80], 0x3ffa); // NMI $8015, reset $8000
    const sim = createNes({
      prg,
      chr: new Uint8Array(0x2000),
      mapper: 0,
      mirroring: 'horizontal',
      battery: false,
    });

    let waited = -1;
    const nmis: number[] = [];
    for (let cycle = 0; nmis.length < 4; cycle++) {
      if (cycle > 200_000) throw new Error(`only ${nmis.length} NMIs`);
      if (sim.get('sync')) {
        if (sim.get('addr') === AFTER_WAIT && waited < 0) waited = cycle;
        if (sim.get('addr') === HANDLER) nmis.push(cycle);
      }
      sim.tick(3);
    }

    // Leaves the loop within one BIT/BPL pass (7 cycles) of frame 1's vblank.
    expect(waited * 3).toBeGreaterThanOrEqual(vblank(1));
    expect(waited * 3).toBeLessThan(vblank(1) + 3 * 10);
    // NMI k is frame k + 2's vblank. The handler starts 7-11 CPU cycles after
    // it: up to 1 to reach the next cycle edge, up to 3 more when the edge
    // just misses the poll at the end of a JMP, then the 7-cycle sequence.
    for (const [k, cycle] of nmis.entries()) {
      const late = cycle - vblank(k + 2) / 3;
      expect(late).toBeGreaterThanOrEqual(7);
      expect(late).toBeLessThanOrEqual(11);
    }
  });
});
