/**
 * The scroll registers and the $2007 data port, driven directly with a JS
 * array as PPU memory (pattern tables and nametables, 16 KB, no mirroring).
 */

import { simulate } from '@simten/core';
import { nodesOf } from '@simten/core/internal';
import { describe, expect, it } from 'vitest';
import { Ppu } from './ppu.js';

function ppu() {
  const sim = simulate(Ppu);
  const vram = new Uint8Array(0x4000);
  const access = (reg: number, rw: number, value = 0) => {
    sim.set({ cs: 1, rw, addr: reg, data_in: value });
    sim.set({ vram_rdata: vram[sim.get('vram_addr')] });
    if (sim.get('vram_we')) vram[sim.get('vram_addr')] = sim.get('vram_wdata');
    const out = sim.get('data_out');
    sim.tick();
    sim.set({ cs: 0 });
    return out;
  };
  const reg = (name: string) => nodesOf(sim).ports().get(`scroll.${name}.q`);
  return {
    vram,
    write: (r: number, value: number) => void access(r, 0, value),
    read: (r: number) => access(r, 1),
    scroll: () => ({ v: reg('v'), t: reg('t'), x: reg('x'), w: reg('w') }),
    /** $2006 twice: v = address. */
    seek(address: number) {
      this.write(6, address >> 8);
      this.write(6, address & 0xff);
    },
  };
}

describe('PPU scroll registers', () => {
  // The NESdev wiki's worked example, one write at a time.
  it('follows the wiki example for $2000, $2002, $2005 and $2006', () => {
    const p = ppu();
    p.write(0, 0x00);
    expect(p.scroll()).toMatchObject({ t: 0x0000 });
    p.read(2);
    expect(p.scroll()).toMatchObject({ w: 0 });
    p.write(5, 0x7d); // coarse X 15, fine x 5
    expect(p.scroll()).toEqual({ v: 0, t: 0x000f, x: 5, w: 1 });
    p.write(5, 0x5e); // fine Y 6, coarse Y 11
    expect(p.scroll()).toEqual({ v: 0, t: 0x616f, x: 5, w: 0 });
    p.write(6, 0x3d);
    expect(p.scroll()).toEqual({ v: 0, t: 0x3d6f, x: 5, w: 1 });
    p.write(6, 0xf0);
    expect(p.scroll()).toEqual({ v: 0x3df0, t: 0x3df0, x: 5, w: 0 });
  });

  it('puts PPUCTRL bits 1-0 in t as the nametable', () => {
    const p = ppu();
    p.write(0, 0x03);
    expect(p.scroll().t).toBe(0x0c00);
  });
});

describe('PPU data port', () => {
  it('writes at v and steps v by 1, or by 32 with PPUCTRL bit 2', () => {
    const p = ppu();
    p.seek(0x2000);
    p.write(7, 0x11);
    p.write(7, 0x22);
    expect(p.scroll().v).toBe(0x2002);
    p.write(0, 0x04);
    p.write(7, 0x33);
    p.write(7, 0x44);
    expect(p.scroll().v).toBe(0x2042);
    expect([p.vram[0x2000], p.vram[0x2001], p.vram[0x2002], p.vram[0x2022]]).toEqual([
      0x11, 0x22, 0x33, 0x44,
    ]);
  });

  it('buffers reads below $3F00: each read returns the byte the last one fetched', () => {
    const p = ppu();
    p.vram.set([0xaa, 0xbb, 0xcc], 0x1000);
    p.seek(0x1000);
    p.read(7); // stale buffer
    expect([p.read(7), p.read(7)]).toEqual([0xaa, 0xbb]);
  });

  it('keeps palette RAM inside: writes skip the bus and reads come back at once', () => {
    const p = ppu();
    p.seek(0x3f01);
    p.write(7, 0x2c);
    expect(p.vram[0x3f01]).toBe(0);
    p.seek(0x3f01);
    expect(p.read(7)).toBe(0x2c);
  });

  it('stores 6 bits and mirrors $3F10/$14/$18/$1C onto $3F00/$04/$08/$0C', () => {
    const p = ppu();
    p.seek(0x3f10);
    p.write(7, 0xff);
    p.seek(0x3f00);
    expect(p.read(7)).toBe(0x3f);
    p.seek(0x3f14);
    p.write(7, 0x05);
    p.seek(0x3f04);
    expect(p.read(7)).toBe(0x05);
    p.seek(0x3f11); // not mirrored
    p.write(7, 0x09);
    p.seek(0x3f01);
    expect(p.read(7)).toBe(0x00);
    p.seek(0x3fe0); // $3F20-$3FFF repeat $3F00-$3F1F
    expect(p.read(7)).toBe(0x3f);
  });

  it('fills the buffer from the nametable under the palette on a palette read', () => {
    const p = ppu();
    p.vram[0x2f05] = 0x77;
    p.seek(0x3f05);
    p.read(7);
    p.seek(0x0000);
    expect(p.read(7)).toBe(0x77);
  });
});
