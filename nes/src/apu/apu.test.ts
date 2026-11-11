/**
 * The APU circuit. Known answers from the NESdev description first (tables,
 * frequencies, duty, frame counter timing, envelope, $4015, mixer), then
 * random register writes compared cycle by cycle with the behavioural model
 * in reference.ts. The APU is driven on its own, one CPU cycle per tick.
 */

import { simulate } from '@simten/core';
import { checkSynthesizable } from '@simten/core/verilog';
import { describe, expect, it } from 'vitest';
import { Apu } from './apu.js';
import { ApuFrame } from './frame.js';
import { mixerTables } from './mixer.js';
import { ApuNoisePeriod } from './noise.js';
import { ApuSweep } from './pulse.js';
import { type Access, ApuModel } from './reference.js';
import { ApuTriangleCore } from './triangle.js';
import { ApuEnvelope, ApuLength, ApuLengthTable } from './units.js';

type ApuSim = ReturnType<typeof apu>;

function apu() {
  const sim = simulate(Apu);
  sim.set({ ce: 1, cs: 0, rw: 1, addr: 0, data: 0 });
  return sim;
}

/** One CPU cycle with `access` on the bus, then the clock edge. */
function cycle(sim: ApuSim, access?: Access) {
  if (access) {
    sim.set({
      cs: 1,
      rw: access.data === undefined ? 1 : 0,
      addr: access.addr & 0x1f,
      data: access.data ?? 0,
    });
  }
  sim.tick();
  if (access) sim.set({ cs: 0, rw: 1 });
}

function writes(sim: ApuSim, list: [number, number][]) {
  for (const [addr, data] of list) cycle(sim, { addr, data });
}

/** `port` over the next `n` cycles. */
function trace(sim: ApuSim, port: 'p1' | 'p2' | 't' | 'n' | 'irq' | 'data_out', n: number) {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(sim.get(port));
    cycle(sim);
  }
  return out;
}

/** Lengths of the runs of equal values, without the first and last (partial) runs. */
function runs(values: number[]) {
  const lengths: number[] = [];
  let n = 1;
  for (let i = 1; i < values.length; i++) {
    if (values[i] === values[i - 1]) n++;
    else {
      lengths.push(n);
      n = 1;
    }
  }
  return lengths.slice(1);
}

describe('APU units', () => {
  it('has the length table', () => {
    const sim = simulate(ApuLengthTable);
    const table = Array.from({ length: 32 }, (_, i) => {
      sim.set({ data: i << 3 });
      return sim.get('value');
    });
    expect(table).toEqual([
      10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14, 12, 16, 24, 18, 48, 20, 96, 22,
      192, 24, 72, 26, 16, 28, 32, 30,
    ]);
  });

  it('has the NTSC noise periods', () => {
    const sim = simulate(ApuNoisePeriod);
    const periods = Array.from({ length: 16 }, (_, index) => {
      sim.set({ index });
      return sim.get('period');
    });
    expect(periods).toEqual([
      4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068,
    ]);
  });

  it('steps the 4-step and 5-step frame sequences at the right cycles', () => {
    const sim = simulate(ApuFrame);
    sim.set({ ce: 1, cs: 0, rw: 1, addr: 0, data: 0 });
    const seen = { quarter: [] as number[], half: [] as number[], irq: -1 };
    for (let c = 0; c < 29830 * 2; c++) {
      if (sim.get('quarter')) seen.quarter.push(c);
      if (sim.get('half')) seen.half.push(c);
      if (seen.irq < 0 && sim.get('irq')) seen.irq = c;
      sim.tick();
    }
    expect(seen.quarter).toEqual([7457, 14913, 22371, 29829, 37287, 44743, 52201, 59659]);
    expect(seen.half).toEqual([14913, 29829, 44743, 59659]);
    // The flag sets at the end of cycle 29828, so it shows from 29829.
    expect(seen.irq).toBe(29829);

    // $4017 = $80: 5-step, and the restart clocks a quarter and half frame.
    sim.set({ cs: 1, rw: 0, addr: 0x17, data: 0x80 });
    sim.tick();
    sim.set({ cs: 0, rw: 1 });
    const five = { quarter: [] as number[], half: [] as number[] };
    for (let c = 1; c < 37282 + 10; c++) {
      if (sim.get('quarter')) five.quarter.push(c);
      if (sim.get('half')) five.half.push(c);
      sim.tick();
    }
    // Written on a non-APU cycle, so the restart is 4 cycles on; its forced
    // clock shows on the cycle after.
    const start = five.quarter[0];
    expect(start).toBe(5);
    expect(five.quarter.map((c) => c - start)).toEqual([0, 7457, 14913, 22371, 37281]);
    expect(five.half.map((c) => c - start)).toEqual([0, 14913, 37281]);
  });

  it('decays the envelope one step every period + 1 quarter frames, looping if asked', () => {
    const sim = simulate(ApuEnvelope);
    sim.set({ ce: 1, quarter: 0, restart: 1, loop: 0, constant: 0, period: 3 });
    sim.tick();
    sim.set({ restart: 0, quarter: 1 });
    const volumes: number[] = [];
    for (let q = 0; q < 1 + 16 * 4; q++) {
      sim.tick();
      volumes.push(sim.get('volume'));
    }
    expect(volumes[0]).toBe(15);
    expect(runs(volumes)).toEqual(Array(14).fill(4));
    expect(volumes.at(-1)).toBe(0);
    sim.set({ loop: 1 });
    for (let q = 0; q < 4; q++) sim.tick();
    expect(sim.get('volume')).toBe(15);
    sim.set({ constant: 1 });
    expect(sim.get('volume')).toBe(3);
  });
  it('counts the length down on half frames, unless halted', () => {
    const sim = simulate(ApuLength);
    sim.set({ ce: 1, half: 0, halt: 1, load: 1, value: 6, enabled: 1 });
    sim.tick();
    sim.set({ load: 0, half: 1 });
    for (let i = 0; i < 10; i++) sim.tick();
    expect(sim.get('active')).toBe(1);
    sim.set({ halt: 0 });
    for (let i = 0; i < 5; i++) sim.tick();
    expect(sim.get('active')).toBe(1);
    sim.tick();
    expect(sim.get('active')).toBe(0);
  });

  it("sweeps down by the ones' complement on pulse 1, two's on pulse 2", () => {
    const swept = (me: number) => {
      const sim = simulate(ApuSweep);
      const write = (addr: number, data: number) => {
        sim.set({ ce: 1, me, half: 0, cs: 1, rw: 0, addr: addr | (me << 2), data });
        sim.tick();
      };
      write(2, 0x00);
      write(3, 0x01); // period $100
      write(1, 0x89); // enabled, P 0, negate, shift 1
      sim.set({ cs: 0, half: 1 });
      sim.tick();
      return sim.get('period');
    };
    expect(swept(0)).toBe(0x100 - 0x80 - 1);
    expect(swept(1)).toBe(0x100 - 0x80);
  });

  it('silences the triangle when the linear counter runs out', () => {
    const sim = simulate(ApuTriangleCore);
    const write = (addr: number, data: number) => {
      sim.set({ ce: 1, quarter: 0, active: 1, cs: 1, rw: 0, addr, data });
      sim.tick();
    };
    write(0x08, 0x41); // linear reload 65, control off
    write(0x0a, 0x01); // period 1: a step every 2 cycles
    write(0x0b, 0x00);
    sim.set({ cs: 0 });
    // A quarter frame every 20 cycles; count the quarters the sequence runs for.
    let quarters = 0;
    for (let q = 0; q < 80; q++) {
      const before = sim.get('out');
      sim.set({ quarter: 1 });
      sim.tick();
      sim.set({ quarter: 0 });
      for (let i = 0; i < 19; i++) sim.tick();
      if (sim.get('out') !== before) quarters = q + 1;
    }
    expect(quarters).toBe(65);
  });
});

describe('APU channels', () => {
  it('plays a pulse at CPU / (16 × (period + 1)) with the duty cycle asked for', () => {
    const sim = apu();
    // Enable pulse 1; duty 2 (50%), halted, constant volume 15; period $040.
    writes(sim, [
      [0x4015, 0x01],
      [0x4000, 0xbf],
      [0x4002, 0x40],
      [0x4003, 0x00],
    ]);
    const half = runs(trace(sim, 'p1', 5000));
    expect(new Set(half)).toEqual(new Set([8 * 65]));
    // Duty 0, 12.5%: high 1 step of 8, low 7.
    writes(sim, [[0x4000, 0x3f]]);
    const duty = runs(trace(sim, 'p1', 5000));
    expect(new Set(duty)).toEqual(new Set([2 * 65, 14 * 65]));
  });

  it('mutes a pulse below period 8, and leaves pulse 2 alone', () => {
    const sim = apu();
    writes(sim, [
      [0x4015, 0x03],
      [0x4000, 0xbf],
      [0x4002, 0x07],
      [0x4003, 0x00],
      [0x4004, 0xbf],
      [0x4006, 0x40],
      [0x4007, 0x00],
    ]);
    expect(new Set(trace(sim, 'p1', 2000))).toEqual(new Set([0]));
    expect(new Set(trace(sim, 'p2', 2000))).toEqual(new Set([0, 15]));
  });

  it('plays the triangle at CPU / (32 × (period + 1)) once the linear counter loads', () => {
    const sim = apu();
    writes(sim, [
      [0x4015, 0x04],
      [0x4008, 0xff],
      [0x400a, 0x20],
      [0x400b, 0x00],
    ]);
    // Frozen until the first quarter frame loads the linear counter.
    expect(new Set(trace(sim, 't', 7000))).toEqual(new Set([15]));
    trace(sim, 't', 1000);
    const wave = trace(sim, 't', 33 * 64);
    expect(new Set(runs(wave))).toEqual(new Set([33, 66]));
    const levels = wave.filter((v, i) => i === 0 || v !== wave[i - 1]);
    const from = levels.indexOf(0);
    expect(levels.slice(from, from + 31)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
      2, 1, 0,
    ]);
  });

  it('reads length counters and the frame IRQ from $4015, which clears the IRQ', () => {
    const sim = apu();
    writes(sim, [
      [0x4015, 0x0f],
      [0x4003, 0x08],
      [0x400f, 0x08],
    ]);
    expect(sim.get('data_out')).toBe(0b1001);
    writes(sim, [[0x4015, 0x08]]);
    expect(sim.get('data_out')).toBe(0b1000);
    trace(sim, 'irq', 29830);
    expect(sim.get('irq')).toBe(1);
    expect(sim.get('data_out') & 0x40).toBe(0x40);
    cycle(sim, { addr: 0x4015 });
    expect(sim.get('irq')).toBe(0);
    // Inhibited, it stays clear.
    writes(sim, [[0x4017, 0x40]]);
    expect(trace(sim, 'irq', 30000).includes(1)).toBe(false);
  });

  it('mixes through the nonlinear tables', () => {
    const tnd = (i: number) => Math.round((163.67 / (24329 / i + 100)) * 65000);
    const sim = apu();
    // The triangle idles at step 0, level 15: a DC offset, as on the console.
    expect(sim.get('audio')).toBe(tnd(3 * 15));
    writes(sim, [
      [0x4015, 0x01],
      [0x4000, 0xbf],
      [0x4002, 0x40],
      [0x4003, 0x00],
      [0x4011, 0x40],
    ]);
    const levels = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      levels.add(sim.get('audio'));
      cycle(sim);
    }
    const pulse15 = Math.round((95.52 / (8128 / 15 + 100)) * 65000);
    expect(levels).toEqual(new Set([tnd(45 + 64), pulse15 + tnd(45 + 64)]));
    expect(mixerTables().tnd[202] + mixerTables().pulse[30]).toBeLessThan(65536);
  });

  it('exports to Verilog', () => {
    expect(checkSynthesizable(Apu).errors).toEqual([]);
  });
});

describe('APU against the reference model', () => {
  const REGS = [
    0x4000, 0x4001, 0x4002, 0x4003, 0x4004, 0x4005, 0x4006, 0x4007, 0x4008, 0x400a, 0x400b, 0x400c,
    0x400e, 0x400f, 0x4011, 0x4015, 0x4017,
  ];

  /**
   * Bus accesses that keep the channels playing: mostly whole notes (a
   * channel's four registers at once, with sane periods), plus stray single
   * writes, $4015 reads, and the odd enable or frame counter change.
   */
  function program(seed: number, cycles: number) {
    // mulberry32: an LCG's consecutive draws are too correlated here.
    let s = seed;
    const rand = (n: number) => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) % n;
    };
    const at = new Map<number, Access>();
    const queue: Access[] = [{ addr: 0x4015, data: 0x0f }];
    for (let c = 0; c < cycles; c++) {
      if (!queue.length) {
        const r = rand(1000);
        if (r < 4) {
          const ch = rand(4);
          const base = 0x4000 + ch * 4;
          // Pulses: mid-range periods, and the sweep mostly off, or adding it
          // mutes the channel at once.
          let period = ch === 3 ? rand(256) : 8 + rand(0x3f8);
          if (ch === 2) period = 2 + rand(0x100);
          const sweep = rand(4) ? rand(0x80) : rand(256);
          const linear = ch === 2 ? 0x80 * rand(2) + 1 + rand(0x7f) : rand(256);
          queue.push(
            { addr: base, data: linear },
            { addr: base + 1, data: sweep },
            { addr: base + 2, data: period & 0xff },
            { addr: base + 3, data: (rand(32) << 3) | (period >> 8) },
          );
        } else if (r < 6) queue.push({ addr: REGS[rand(REGS.length)], data: rand(256) });
        else if (r < 7) queue.push({ addr: 0x4015 });
        else if (r === 7 && rand(10) === 0) {
          queue.push({ addr: 0x4015, data: rand(4) ? 0x0f : rand(16) });
        } else if (r === 8 && rand(20) === 0) {
          queue.push({ addr: 0x4017, data: rand(4) << 6 });
        }
      }
      const next = queue.shift();
      if (next) at.set(c, next);
    }
    return at;
  }

  for (const seed of [1, 2, 3]) {
    it(`matches cycle for cycle (seed ${seed})`, () => {
      const cycles = 120000;
      const accesses = program(seed, cycles);
      const sim = apu();
      const model = new ApuModel();
      const sounding = { p1: 0, p2: 0, t: 0, n: 0 };
      let prevT = 15;
      const recent: string[] = [];
      for (let c = 0; c < cycles; c++) {
        const access = accesses.get(c);
        const want = model.outputs();
        const got = {
          p1: sim.get('p1'),
          p2: sim.get('p2'),
          t: sim.get('t'),
          n: sim.get('n'),
          irq: sim.get('irq'),
          status: sim.get('data_out'),
          audio: sim.get('audio'),
        };
        if (JSON.stringify(got) !== JSON.stringify(want)) {
          expect({ cycle: c, recent, got }).toEqual({ cycle: c, recent, got: want });
        }
        if (want.p1) sounding.p1++;
        if (want.p2) sounding.p2++;
        if (want.t !== prevT) sounding.t++;
        prevT = want.t;
        if (want.n) sounding.n++;
        if (access) {
          recent.push(`${c}: ${access.addr.toString(16)}=${access.data?.toString(16) ?? 'read'}`);
          if (recent.length > 8) recent.shift();
        }
        cycle(sim, access);
        model.clock(access);
      }
      // The stimulus has to keep every channel busy for the comparison to mean much.
      expect(sounding.p1).toBeGreaterThan(cycles / 10);
      expect(sounding.p2).toBeGreaterThan(cycles / 10);
      expect(sounding.n).toBeGreaterThan(cycles / 20);
      // The triangle: steps taken, each one many cycles long.
      expect(sounding.t).toBeGreaterThan(cycles / 200);
    });
  }
});
