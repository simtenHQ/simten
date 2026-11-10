import { describe, expect, it } from 'vitest';
import { createNes } from './board.js';
import type { INesRom } from './ines.js';

/**
 * Fills $0200-$02FF with n ^ $A5, then writes $02 to `target`. `pad` adds a
 * 3-cycle STA $00 before the write, which moves the copy to the other cycle
 * parity.
 */
function program(target: number, pad: boolean): INesRom {
  const code = [
    [0xa2, 0x00], // LDX #$00
    [0x8a], // loop: TXA
    [0x49, 0xa5], // EOR #$A5
    [0x9d, 0x00, 0x02], // STA $0200,X
    [0xe8], // INX
    [0xd0, 0xf7], // BNE loop
    pad ? [0x85, 0x00] : [], // STA $00
    [0xa9, 0x02], // LDA #$02
    [0x8d, target & 0xff, target >> 8], // STA target
    [0xea], // NOP
  ].flat();
  const end = 0x8000 + code.length;
  code.push(0x4c, end & 0xff, end >> 8); // end: JMP end
  const prg = new Uint8Array(0x4000);
  prg.set(code);
  prg[0x3ffc] = 0x00;
  prg[0x3ffd] = 0x80;
  return { prg, chr: new Uint8Array(0x2000), mapper: 0, mirroring: 'horizontal', battery: false };
}

/** Runs to the final JMP: the cycles taken and every bus cycle on the way. */
function run(rom: INesRom) {
  const sim = createNes(rom);
  const end = rom.prg.indexOf(0x4c, 8) + 0x8000;
  const bus: { addr: number; rw: number; data: number }[] = [];
  for (let cycle = 0; cycle < 20000; cycle++) {
    if (sim.get('sync') && sim.get('addr') === end) return { cycles: cycle, bus };
    bus.push({ addr: sim.get('addr'), rw: sim.get('rw'), data: sim.get('data') });
    sim.tick();
  }
  throw new Error('never reached the end');
}

describe('OAM DMA', () => {
  it('copies the page to $2004, reading it in order', () => {
    const { bus } = run(program(0x4014, false));
    const puts = bus.filter((c) => c.addr === 0x2004);
    expect(puts.every((c) => c.rw === 0)).toBe(true);
    expect(puts.map((c) => c.data)).toEqual(Array.from({ length: 256 }, (_, n) => n ^ 0xa5));
    const start = bus.findIndex((c) => c.addr === 0x2004) - 1;
    const gets = bus.slice(start, start + 512).filter((_, i) => i % 2 === 0);
    expect(gets.map((c) => c.addr)).toEqual(Array.from({ length: 256 }, (_, n) => 0x0200 + n));
  });

  it('holds the CPU for 513 cycles, or 514 when it starts on a put cycle', () => {
    const stall = (pad: boolean) =>
      run(program(0x4014, pad)).cycles - run(program(0x4015, pad)).cycles;
    expect([stall(false), stall(true)].sort()).toEqual([513, 514]);
  });
});
