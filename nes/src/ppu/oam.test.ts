/**
 * OAM through $2003/$2004, and sprite evaluation's overflow flag, on a bare
 * PPU with no CPU: registers are written directly, one tick per access.
 */

import { simulate } from '@simten/core';
import { nodesOf } from '@simten/core/internal';
import { describe, expect, it } from 'vitest';
import { Ppu } from './ppu.js';

function ppu() {
  const sim = simulate(Ppu);
  const access = (reg: number, rw: number, value = 0) => {
    sim.set({ cs: 1, rw, addr: reg, data_in: value });
    const out = sim.get('data_out');
    sim.tick();
    sim.set({ cs: 0 });
    return out;
  };
  return {
    sim,
    write: (r: number, value: number) => void access(r, 0, value),
    read: (r: number) => access(r, 1),
  };
}

describe('OAM port', () => {
  it('writes at OAMADDR and steps it; reads do not step', () => {
    const p = ppu();
    p.write(3, 0x10);
    for (const b of [0x11, 0x22, 0xff, 0x44]) p.write(4, b);
    p.write(3, 0x10);
    expect([p.read(4), p.read(4)]).toEqual([0x11, 0x11]);
    p.write(3, 0x13);
    expect(p.read(4)).toBe(0x44);
  });

  it('drops attribute bits 4-2', () => {
    const p = ppu();
    p.write(3, 0x02);
    p.write(4, 0xff);
    p.write(3, 0x02);
    expect(p.read(4)).toBe(0xe3);
  });
});

/**
 * Whether sprite overflow goes up during the visible lines, with OAM as
 * given and the rest of the sprites off screen at Y = $F0.
 */
function overflow(sprites: Record<number, number[]>) {
  const p = ppu();
  const oam = new Array(256).fill(0xf0);
  for (const [i, bytes] of Object.entries(sprites)) oam.splice(Number(i) * 4, 4, ...bytes);
  p.write(3, 0);
  for (const b of oam) p.write(4, b);
  p.write(1, 0x18);
  let seen = 0;
  const flag = () => nodesOf(p.sim).ports().get('sprites.oam.overflow.q') as number;
  while (p.sim.get('line') !== 240) {
    p.sim.tick();
    seen |= flag();
  }
  return seen;
}

describe('sprite overflow', () => {
  const eight = Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i, [50, 0, 0, i * 8]]));

  it('stays down with 8 sprites on a line', () => {
    expect(overflow(eight)).toBe(0);
  });

  it('goes up with a 9th', () => {
    expect(overflow({ ...eight, 8: [52, 0, 0, 100] })).toBe(1);
  });

  // After 8, a sprite out of range also moves the check one byte along: the
  // 10th sprite's tile number is read as a Y.
  it('goes up falsely when a tile number looks like a Y in range', () => {
    expect(overflow({ ...eight, 8: [0xf0, 0, 0, 0], 9: [0xf0, 52, 0, 0] })).toBe(1);
  });

  it('misses a real 9th sprite when the check has slid off its Y', () => {
    expect(overflow({ ...eight, 8: [0xf0, 0, 0, 0], 9: [52, 0xf0, 0, 0] })).toBe(0);
  });
});
