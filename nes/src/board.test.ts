import { describe, expect, it } from 'vitest';
import { createNes } from './board.js';
import type { INesRom } from './ines.js';

/** An NROM cartridge with `program` at $8000 and the reset vector pointing at it. */
function cartridge(program: number[], prgSize = 0x4000): INesRom {
  const prg = new Uint8Array(prgSize);
  prg.set(program);
  prg[prgSize - 4] = 0x00; // reset vector low ($FFFC)
  prg[prgSize - 3] = 0x80; // reset vector high ($FFFD)
  return { prg, chr: new Uint8Array(0x2000), mapper: 0, mirroring: 'horizontal', battery: false };
}

/** Runs until the CPU fetches the opcode at `pc`, then returns the registers. */
function runTo(rom: INesRom, pc: number) {
  const sim = createNes(rom, { debug: true });
  for (let i = 0; i < 1000; i++) {
    if (sim.get('sync') && sim.get('addr') === pc) {
      return { a: sim.get('a'), x: sim.get('x'), y: sim.get('y') };
    }
    sim.tick(3);
  }
  throw new Error(`never reached $${pc.toString(16)}`);
}

describe('NesBoard', () => {
  it('mirrors work RAM, the PPU registers and a 16 KB PRG ROM', () => {
    const program = [
      [0xa9, 0x42], // 8000 LDA #$42
      [0x8d, 0x05, 0x08], // 8002 STA $0805  RAM $0005 through the first mirror
      [0xa9, 0x00], // 8005 LDA #$00
      [0xae, 0x05, 0x18], // 8007 LDX $1805  RAM $0005 through the last mirror
      [0xac, 0x0a, 0x3f], // 800A LDY $3F0A  $2002 (PPUSTATUS) through a mirror: 0 before vblank
      [0xad, 0x00, 0xc0], // 800D LDA $C000  PRG $8000 through the 16 KB mirror
      [0x4c, 0x10, 0x80], // 8010 JMP $8010
    ];
    expect(runTo(cartridge(program.flat()), 0x8010)).toEqual({ a: 0xa9, x: 0x42, y: 0 });
  });

  it('reads 0 from an unwritten PPU register, APU/IO and unmapped space', () => {
    const program = [
      [0xa9, 0xff, 0xaa, 0xa8], // 8000 LDA #$FF / TAX / TAY
      [0xad, 0x00, 0x20], // 8004 LDA $2000
      [0xae, 0x15, 0x40], // 8007 LDX $4015
      [0xac, 0x00, 0x60], // 800A LDY $6000
      [0x4c, 0x0d, 0x80], // 800D JMP $800D
    ];
    expect(runTo(cartridge(program.flat()), 0x800d)).toEqual({ a: 0, x: 0, y: 0 });
  });

  it('maps a 32 KB PRG ROM without mirroring', () => {
    const rom = cartridge([0xad, 0x00, 0xc0, 0x4c, 0x03, 0x80], 0x8000); // LDA $C000 / JMP $8003
    rom.prg[0x4000] = 0x5a;
    expect(runTo(rom, 0x8003).a).toBe(0x5a);
  });

  it('rejects mappers other than NROM', () => {
    expect(() => createNes({ ...cartridge([]), mapper: 1 })).toThrow(/mapper 1/);
    expect(() => createNes(cartridge([], 0x2000))).toThrow(/16 or 32 KB/);
  });
});
