import { simulate } from '@simten/core';
import { checkSynthesizable } from '@simten/core/verilog';
import { describe, expect, it } from 'vitest';
import { Ppu } from './ppu.js';

const FRAME = 341 * 262;

function ppu() {
  const sim = simulate(Ppu);
  const at = () => ({ line: sim.get('line'), dot: sim.get('dot') });
  return {
    sim,
    at,
    /** Ticks until the beam is at (line, dot); returns the dots taken. */
    runTo(line: number, dot: number) {
      for (let n = 0; n <= FRAME; n++) {
        if (sim.get('line') === line && sim.get('dot') === dot) return n;
        sim.tick();
      }
      throw new Error(`never reached (${line}, ${dot})`);
    },
    /** One CPU write: `cs` high for this dot. */
    write(reg: number, value: number) {
      sim.set({ cs: 1, rw: 0, addr: reg, data_in: value });
      sim.tick();
      sim.set({ cs: 0 });
    },
    /** One CPU read: `cs` high for this dot. */
    read(reg: number) {
      sim.set({ cs: 1, rw: 1, addr: reg });
      const value = sim.get('data_out');
      sim.tick();
      sim.set({ cs: 0 });
      return value;
    },
  };
}

describe('PPU timing', () => {
  it('runs 341 dots × 262 lines with rendering off', () => {
    const p = ppu();
    p.runTo(0, 0);
    p.sim.tick();
    expect(p.runTo(0, 0)).toBe(FRAME - 1);
  });

  it('skips the last pre-render dot on odd frames with rendering on', () => {
    const p = ppu();
    p.write(1, 0x08);
    p.runTo(0, 0); // start of frame 1, the odd one
    const frames: number[] = [];
    for (let f = 0; f < 3; f++) {
      p.sim.tick();
      frames.push(p.runTo(0, 0) + 1);
    }
    expect(frames).toEqual([FRAME - 1, FRAME, FRAME - 1]);
  });
});

describe('PPU vblank and NMI', () => {
  it('raises vblank at (241, 1) and clears it at (261, 1)', () => {
    const p = ppu();
    p.write(0, 0x80);
    p.runTo(241, 0);
    expect(p.sim.get('nmi')).toBe(0);
    p.sim.tick();
    expect(p.sim.get('nmi')).toBe(1);
    p.runTo(261, 0);
    expect(p.sim.get('nmi')).toBe(1);
    p.sim.tick();
    expect(p.sim.get('nmi')).toBe(0);
  });

  it('reads vblank from $2002 once: the read clears it', () => {
    const p = ppu();
    p.write(0, 0x80);
    p.runTo(245, 0);
    expect(p.read(2) & 0x80).toBe(0x80);
    expect(p.sim.get('nmi')).toBe(0);
    expect(p.read(2) & 0x80).toBe(0);
  });

  it('suppresses the flag for the frame when $2002 is read on (241, 0)', () => {
    const p = ppu();
    p.write(0, 0x80);
    p.runTo(241, 0);
    expect(p.read(2) & 0x80).toBe(0);
    let raised = false;
    while (p.sim.get('line') !== 261) {
      raised ||= p.sim.get('nmi') === 1;
      p.sim.tick();
    }
    expect(raised).toBe(false);
  });

  it('raises NMI at once when PPUCTRL bit 7 is set during vblank', () => {
    const p = ppu();
    p.runTo(250, 0);
    expect(p.sim.get('nmi')).toBe(0);
    p.write(0, 0x80);
    expect(p.sim.get('nmi')).toBe(1);
  });

  it('returns the I/O latch from write-only registers and in $2002 bits 4-0', () => {
    const p = ppu();
    p.write(3, 0x5a);
    expect(p.read(0)).toBe(0x5a);
    expect(p.read(2)).toBe(0x1a);
  });
});

describe('PPU export', () => {
  it('stays synthesizable', () => {
    expect(checkSynthesizable(Ppu).errors).toEqual([]);
  });
});
