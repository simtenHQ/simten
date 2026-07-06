import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCycleMap, detectClock } from './vcd-cycles.js';
import { parseVcd } from './vcd-parser.js';

const FIX = (name: string) => resolve(__dirname, '../__fixtures__/vcd', name);

describe('detectClock', () => {
  it('auto-detects tb.clk on the synthetic fixture', async () => {
    const r = await parseVcd(FIX('synthetic-clock.vcd'));
    const det = detectClock(r);
    expect('clock' in det).toBe(true);
    if ('clock' in det) {
      expect(det.clock.fullPath).toBe('tb.clk');
    }
  });

  it('auto-detects tb.clk on the real CPU fixture (multiple clk aliases)', async () => {
    const r = await parseVcd(FIX('R-Type_ADD_basic.vcd'));
    const det = detectClock(r);
    expect('clock' in det).toBe(true);
    if ('clock' in det) {
      // Shallowest scope (tb.clk, depth 2) wins over tb.cpu.clk (depth 3).
      expect(det.clock.fullPath).toBe('tb.clk');
    }
  });

  it('honors explicit clock_signal override', async () => {
    const r = await parseVcd(FIX('R-Type_ADD_basic.vcd'));
    const det = detectClock(r, { clockSignal: 'tb.cpu.clk' });
    expect('clock' in det).toBe(true);
    if ('clock' in det) {
      expect(det.clock.fullPath).toBe('tb.cpu.clk');
    }
  });

  it('returns no_clock error with candidates when no clk/clock leaf exists', async () => {
    // Build a fake ParsedVcd with no clock-named signals.
    const r = await parseVcd(FIX('synthetic-bus.vcd'));
    // Filter out the clk signal to simulate "no clock."
    const noClock = {
      ...r,
      signals: r.signals.filter((s) => s.leaf !== 'clk'),
      byFullPath: new Map([...r.byFullPath].filter(([k]) => k !== 'tb.clk')),
      byLeaf: new Map([...r.byLeaf].filter(([k]) => k !== 'clk')),
    };
    const det = detectClock(noClock);
    expect('error' in det).toBe(true);
    if ('error' in det) {
      expect(det.error.type).toBe('no_clock');
      // bus4 and bus8 are multi-bit; only no 1-bit signals remain after we
      // dropped clk, so candidates should be empty.
      expect(det.error.candidates).toEqual([]);
    }
  });
});

describe('buildCycleMap', () => {
  it('cycle 0 is the first rising edge; subsequent cycles every clock period', async () => {
    const r = await parseVcd(FIX('synthetic-clock.vcd'));
    const det = detectClock(r);
    if (!('clock' in det)) throw new Error('clock detection failed');
    const cm = buildCycleMap(r, det.clock);
    // Synthetic clock: rising edges at 5000, 15000, 25000, 35000, 45000.
    expect(cm.cycleTimes).toEqual([5000, 15000, 25000, 35000, 45000]);
    expect(cm.timeAtCycle(0)).toBe(5000);
    expect(cm.timeAtCycle(1)).toBe(15000);
    expect(cm.timeAtCycle(4)).toBe(45000);
  });

  it('cycleAtTime is the largest n with cycleTimes[n] <= t', async () => {
    const r = await parseVcd(FIX('synthetic-clock.vcd'));
    const det = detectClock(r);
    if (!('clock' in det)) throw new Error('clock detection failed');
    const cm = buildCycleMap(r, det.clock);
    expect(cm.cycleAtTime(4999)).toBe(-1); // before cycle 0
    expect(cm.cycleAtTime(5000)).toBe(0);
    expect(cm.cycleAtTime(14999)).toBe(0); // still within cycle 0
    expect(cm.cycleAtTime(15000)).toBe(1);
    expect(cm.cycleAtTime(99999)).toBe(4); // past last edge → still last cycle
  });

  it('windowToTimeRange maps inclusive cycle range to inclusive time range', async () => {
    const r = await parseVcd(FIX('synthetic-clock.vcd'));
    const det = detectClock(r);
    if (!('clock' in det)) throw new Error('clock detection failed');
    const cm = buildCycleMap(r, det.clock);
    expect(cm.windowToTimeRange([1, 3])).toEqual([15000, 35000]);
  });

  it('throws when timeAtCycle is called out of range', async () => {
    const r = await parseVcd(FIX('synthetic-clock.vcd'));
    const det = detectClock(r);
    if (!('clock' in det)) throw new Error('clock detection failed');
    const cm = buildCycleMap(r, det.clock);
    expect(() => cm.timeAtCycle(99)).toThrow(RangeError);
    expect(() => cm.timeAtCycle(-1)).toThrow(RangeError);
  });
});
