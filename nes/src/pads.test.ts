/** The controller ports on the full board, read by a 6502 program. */

import { describe, expect, it } from 'vitest';
import { createNes } from './board.js';
import { BUTTON } from './pads.js';
import { cartridge, randomChr } from './ppu/test-frame.js';

/**
 * Strobe, then 10 reads of each port into $0300 (pad 1) and $0310 (pad 2);
 * then strobe high and 3 more reads of $4016 into $0320.
 */
const PROGRAM = [
  [0xa9, 0x01, 0x8d, 0x16, 0x40], // $4016 = 1: strobe
  [0xa9, 0x00, 0x8d, 0x16, 0x40], // $4016 = 0: hold
  [0xa2, 0x00], // LDX #0
  [0xad, 0x16, 0x40, 0x9d, 0x00, 0x03], // loop: LDA $4016 / STA $0300,X
  [0xad, 0x17, 0x40, 0x9d, 0x10, 0x03], // LDA $4017 / STA $0310,X
  [0xe8, 0xe0, 0x0a, 0xd0, 0xef], // INX / CPX #10 / BNE loop
  [0xa9, 0x01, 0x8d, 0x16, 0x40], // $4016 = 1, and leave it high
  [0xad, 0x16, 0x40, 0x8d, 0x20, 0x03], // LDA $4016 / STA $0320
  [0xad, 0x16, 0x40, 0x8d, 0x21, 0x03],
  [0xad, 0x16, 0x40, 0x8d, 0x22, 0x03],
].flat();

function run(pad1: number, pad2: number) {
  const rom = cartridge(PROGRAM, [], randomChr());
  const sim = createNes(rom, { debug: true });
  sim.set({ pad1, pad2 });
  for (let n = 0; !(sim.get('sync') === 1 && sim.get('pc') === rom.end); n++) {
    if (n > 20_000) throw new Error('program did not finish');
    sim.tick(3);
  }
  const ram = (
    sim.snapshot() as unknown as { sequentialState: { currentState: Map<string, unknown> } }
  ).sequentialState.currentState.get('console.ram') as Map<number, number>;
  const bytes = (at: number, n: number) =>
    Array.from({ length: n }, (_, i) => ram.get(at + i) ?? 0);
  return { pad1: bytes(0x300, 10), pad2: bytes(0x310, 10), strobed: bytes(0x320, 3) };
}

/** What 10 reads return: bit 0 is each button in turn, then 1s; $40 is open bus. */
const reads = (pad: number) =>
  Array.from({ length: 10 }, (_, i) => 0x40 | (i < 8 ? (pad >> i) & 1 : 1));

describe('controller ports', () => {
  it('shift out A, B, Select, Start, Up, Down, Left, Right, then 1s', () => {
    const pad1 = BUTTON.A | BUTTON.START | BUTTON.LEFT;
    const pad2 = BUTTON.B | BUTTON.SELECT | BUTTON.RIGHT;
    const got = run(pad1, pad2);
    expect(got.pad1).toEqual(reads(pad1));
    expect(got.pad2).toEqual(reads(pad2));
  });

  it('return A on every read while the strobe is high', () => {
    expect(run(BUTTON.A | BUTTON.B, 0).strobed).toEqual([0x41, 0x41, 0x41]);
    expect(run(BUTTON.B, 0).strobed).toEqual([0x40, 0x40, 0x40]);
  });
});
