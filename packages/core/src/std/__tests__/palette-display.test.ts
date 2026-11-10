import { describe, expect, it } from 'vitest';
import { bit, bus, circuit, reg } from '../../circuit/index.js';
import { internalsOf } from '../../circuit/internals.js';
import { simulate } from '../../simulator/simulate.js';
import { nodesOf, type Simulation } from '../../simulator/simulation.js';
import { exportVerilog } from '../../verilog/index.js';
import { Constant, PALETTE_2C02, PaletteDisplay } from '../index.js';
import { paletteFrame } from '../palette.js';

/** A display driven straight from the circuit's inputs. */
const Small = circuit('SmallPaletteScreen', {
  inputs: { x: bus(2), y: bus(2), color: bus(6), we: bit },
  nodes: { tv: PaletteDisplay({ width: 4, height: 3 }) },
  connect: ({ inputs, nodes: { tv } }) => [
    inputs.x.to(tv.x),
    inputs.y.to(tv.y),
    inputs.color.to(tv.color),
    inputs.we.to(tv.we),
  ],
});

function frameOf(sim: Simulation, path: string, width: number, height: number): number[] {
  const pixels = nodesOf(sim).peripherals().get(path);
  return Array.from(paletteFrame(typeof pixels === 'string' ? pixels : '', width, height));
}

function write(sim: Simulation, x: number, y: number, color: number): void {
  sim.set({ x, y, color, we: 1 });
  sim.tick();
}

describe('PaletteDisplay', () => {
  it('has x and y wide enough for its size, a 6-bit colour and a write enable', () => {
    const ports = (c: ReturnType<typeof PaletteDisplay>) =>
      Object.fromEntries(
        internalsOf(c).ir.inputs.map(({ name, portType }) => [
          name,
          portType.kind === 'bus' ? portType.width : 1,
        ]),
      );
    expect(ports(PaletteDisplay())).toEqual({ x: 8, y: 8, color: 6, we: 1 });
    expect(ports(PaletteDisplay({ width: 320, height: 200 }))).toEqual({
      x: 9,
      y: 8,
      color: 6,
      we: 1,
    });
  });

  it('starts black and writes one pixel per clock while we is high', () => {
    const sim = simulate(Small);
    expect(frameOf(sim, 'tv', 4, 3)).toEqual(new Array(12).fill(0));
    write(sim, 1, 0, 0x21);
    write(sim, 3, 2, 0x3f);
    expect(frameOf(sim, 'tv', 4, 3)).toEqual([0, 0x21, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x3f]);
  });

  it('ignores clocks with we low', () => {
    const sim = simulate(Small);
    sim.set({ x: 0, y: 0, color: 5, we: 0 });
    sim.tick(3);
    expect(frameOf(sim, 'tv', 4, 3)).toEqual(new Array(12).fill(0));
  });

  it('ignores writes past the bottom edge', () => {
    const sim = simulate(Small);
    write(sim, 0, 3, 9);
    expect(frameOf(sim, 'tv', 4, 3)).toEqual(new Array(12).fill(0));
  });

  it('keeps a frame drawn in raster order, over and over, without growing', () => {
    const sim = simulate(Small);
    for (let frame = 0; frame < 3; frame++) {
      for (let i = 0; i < 12; i++) write(sim, i % 4, Math.floor(i / 4), (i + frame) & 0x3f);
      expect(frameOf(sim, 'tv', 4, 3)).toEqual(Array.from({ length: 12 }, (_, i) => i + frame));
      const pixels = nodesOf(sim).peripherals().get('tv');
      expect(typeof pixels === 'string' && pixels.length).toBe(12);
    }
    // Half a frame: the new top half over the old bottom half.
    for (let i = 0; i < 6; i++) write(sim, i % 4, Math.floor(i / 4), 40);
    expect(frameOf(sim, 'tv', 4, 3)).toEqual([40, 40, 40, 40, 40, 40, 8, 9, 10, 11, 12, 13]);
  });

  it('takes writes in any order', () => {
    const sim = simulate(Small);
    write(sim, 0, 0, 1);
    write(sim, 1, 0, 2);
    write(sim, 2, 2, 3); // out of order, mid-frame
    write(sim, 0, 1, 4); // out of order again
    write(sim, 0, 0, 5); // back to the start of the frame
    expect(frameOf(sim, 'tv', 4, 3)).toEqual([5, 2, 0, 0, 4, 0, 0, 0, 0, 0, 3, 0]);
  });

  it('steps back to the frame it showed', () => {
    const sim = simulate(Small, { history: 10 });
    write(sim, 0, 0, 7);
    write(sim, 1, 0, 8);
    expect(sim.stepBack()).toBe(true);
    expect(frameOf(sim, 'tv', 4, 3).slice(0, 2)).toEqual([7, 0]);
  });

  it('exports to Verilog without the display, like the other sim-only displays', () => {
    const { verilog } = exportVerilog(Bars);
    expect(verilog).not.toContain('PaletteDisplay');
    expect(verilog).toContain('module');
  });

  it('defaults to the 64-colour 2C02 palette', () => {
    expect(PALETTE_2C02).toHaveLength(64);
    expect(PALETTE_2C02.every((c) => Number.isInteger(c) && c >= 0 && c <= 0xffffff)).toBe(true);
    expect(PALETTE_2C02[0x30]).toBe(0xffffff);
    expect(PALETTE_2C02[0x0f]).toBe(0x000000);
  });
});

// A test pattern: 64 colour bars, four pixels wide, drawn one pixel per clock.

/** Raster position: x then y, wrapping at the end of the frame. */
const Beam = circuit('PaletteBeam', {
  outputs: { x: bus(8), y: bus(8) },
  state: { at: reg(16) },
  eval: ({ at }) => ({ x: at & 0xff, y: at >> 8 }),
  onTick: ({ at }) => ({ at: at + 1 >= 256 * 240 ? 0 : at + 1 }),
});

const BarColor = circuit('PaletteBarColor', {
  inputs: { x: bus(8) },
  outputs: { color: bus(6) },
  eval: ({ x }) => ({ color: x >> 2 }),
});

const Bars = circuit('PaletteBars', {
  nodes: { beam: Beam, bar: BarColor, tv: PaletteDisplay(), on: Constant({ value: 1 }) },
  connect: ({ nodes: { beam, bar, tv, on } }) => [
    beam.x.to(bar.x, tv.x),
    beam.y.to(tv.y),
    bar.color.to(tv.color),
    on.out.to(tv.we),
  ],
});

describe('PaletteDisplay test pattern', () => {
  it('draws a full 256x240 frame of colour bars, one pixel per clock', () => {
    const sim = simulate(Bars);
    const started = performance.now();
    sim.tick(256 * 240);
    const elapsed = performance.now() - started;
    const frame = frameOf(sim, 'tv', 256, 240);
    expect(frame).toHaveLength(256 * 240);
    for (const [x, y] of [
      [0, 0],
      [5, 0],
      [255, 0],
      [130, 119],
      [255, 239],
    ]) {
      expect(frame[y * 256 + x]).toBe(x >> 2);
    }
    // Linear in pixels: a frame-copy per write would take tens of seconds.
    expect(elapsed).toBeLessThan(10_000);
  });
});
