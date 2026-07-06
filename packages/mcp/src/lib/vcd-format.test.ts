import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { parseVcd, resolveSignals, type ResolvedSignal } from './vcd-parser.js';
import { detectClock, buildCycleMap } from './vcd-cycles.js';
import { formatSignals } from './vcd-format.js';

const FIX = (name: string) => resolve(__dirname, '../__fixtures__/vcd', name);

async function setup(fixture: string, requested: string[]) {
  const parsed = await parseVcd(FIX(fixture));
  const det = detectClock(parsed);
  if (!('clock' in det)) throw new Error('clock detection failed');
  const cycleMap = buildCycleMap(parsed, det.clock);
  const res = resolveSignals(parsed, requested);
  return { parsed, cycleMap, resolved: res.resolved, errors: res.errors, clockId: det.clock.id };
}

describe('formatSignals — changes', () => {
  it('initial.cycle === cycle_range[0] (window-start framing)', async () => {
    const ctx = await setup('synthetic-clock.vcd', ['a']);
    // signal a: dumpvars 0 at t=0, 1 at t=15000 (cycle 1), 0 at t=35000 (cycle 3)
    // Window [2, 4]: start cycle 2 (t=25000). At t=25000 a is 1 (last txn at t=15000).
    const out = formatSignals(ctx.parsed, ctx.cycleMap, ctx.resolved, {
      format: 'changes',
      cycleRange: [2, 4],
    });
    const a = out.signals[0];
    expect(a.initial.cycle).toBe(2);
    expect(a.initial.value).toBe('1');
    expect(a.initial.stable_since).toBe(1); // last txn at cycle 1
    // Trace within window: 0 at cycle 3
    expect(a.trace).toEqual([[3, '0']]);
  });

  it('initial.stable_since === 0 when carry-in came from $dumpvars (pre-cycle-0)', async () => {
    const ctx = await setup('synthetic-clock.vcd', ['b']);
    // signal b: dumpvars 0 at t=0, never transitions.
    const out = formatSignals(ctx.parsed, ctx.cycleMap, ctx.resolved, {
      format: 'changes',
      cycleRange: [0, 4],
    });
    const b = out.signals[0];
    expect(b.initial.value).toBe('0');
    expect(b.initial.stable_since).toBe(0);
    expect(b.trace).toEqual([]);
  });
});

describe('formatSignals — uninitialized signal carry-in', () => {
  it('1-bit signal with no prior transition → initial.value === "x", stable_since === 0', async () => {
    // Build a synthetic ParsedVcd with a signal that has zero changes.
    const parsed = await parseVcd(FIX('synthetic-clock.vcd'));
    const det = detectClock(parsed);
    if (!('clock' in det)) throw new Error('clock detection failed');
    const cycleMap = buildCycleMap(parsed, det.clock);
    // Pretend signal `a` had no changes by clearing its array.
    const a = parsed.byFullPath.get('tb.a')![0];
    parsed.changes.set(a.id, []);
    const out = formatSignals(parsed, cycleMap, [{ requested: 'a', resolved: a }], {
      format: 'changes',
      cycleRange: [0, 4],
    });
    expect(out.signals[0].initial.value).toBe('x');
    expect(out.signals[0].initial.stable_since).toBe(0);
  });

  it('4-bit bus with no prior transition → initial.value === "xxxx" (no "b" prefix)', async () => {
    const parsed = await parseVcd(FIX('synthetic-bus.vcd'));
    const det = detectClock(parsed);
    if (!('clock' in det)) throw new Error('clock detection failed');
    const cycleMap = buildCycleMap(parsed, det.clock);
    const bus4 = parsed.byFullPath.get('tb.bus4')![0];
    parsed.changes.set(bus4.id, []);
    const out = formatSignals(parsed, cycleMap, [{ requested: 'bus4', resolved: bus4 }], {
      format: 'changes',
      cycleRange: [0, 2],
    });
    expect(out.signals[0].initial.value).toBe('xxxx');
    expect(out.signals[0].initial.value).not.toMatch(/^b/);
    expect(out.signals[0].initial.stable_since).toBe(0);
  });
});

describe('formatSignals — value encoding consistency', () => {
  it('1-bit value is single char, multi-bit is width-N string, no "b" prefix anywhere', async () => {
    const ctx = await setup('synthetic-bus.vcd', ['clk', 'bus4', 'bus8']);
    const out = formatSignals(ctx.parsed, ctx.cycleMap, ctx.resolved, {
      format: 'changes',
      cycleRange: [0, 3],
    });
    const clk = out.signals.find((s) => s.resolved === 'tb.clk')!;
    const bus4 = out.signals.find((s) => s.resolved === 'tb.bus4')!;
    const bus8 = out.signals.find((s) => s.resolved === 'tb.bus8')!;
    expect(clk.initial.value.length).toBe(1);
    expect(bus4.initial.value.length).toBe(4);
    expect(bus8.initial.value.length).toBe(8);
    for (const s of out.signals) {
      expect(s.initial.value).not.toMatch(/^b/);
      const tr = s.trace as Array<[number, string]>;
      for (const [, v] of tr) expect(v).not.toMatch(/^b/);
    }
  });

  it('all-x bus passes through as "xxxx", not "x" and not "bxxxx"', async () => {
    const ctx = await setup('synthetic-bus.vcd', ['bus4']);
    // synthetic-bus has 4 cycles (0..3); bus4 = bxxxx at cycle 1 (t=15000).
    const out = formatSignals(ctx.parsed, ctx.cycleMap, ctx.resolved, {
      format: 'changes',
      cycleRange: [0, 3],
    });
    const tr = out.signals[0].trace as Array<[number, string]>;
    const xxxx = tr.find(([, v]) => v.includes('x'));
    expect(xxxx).toBeDefined();
    expect(xxxx![1]).toBe('xxxx');
  });
});

describe('formatSignals — hex mirror', () => {
  it('width > 4 emits value_hex on initial when all bits definite', async () => {
    const ctx = await setup('synthetic-bus.vcd', ['bus8']);
    // Window starts at cycle 0 (t=5000): bus8 was set to b11110000 at t=5000.
    const out = formatSignals(ctx.parsed, ctx.cycleMap, ctx.resolved, {
      format: 'changes',
      cycleRange: [0, 1],
    });
    const bus8 = out.signals[0];
    expect(bus8.initial.value).toBe('11110000');
    expect(bus8.initial.value_hex).toBe('f0');
  });

  it('width ≤ 4 emits no hex mirror', async () => {
    const ctx = await setup('synthetic-bus.vcd', ['bus4']);
    const out = formatSignals(ctx.parsed, ctx.cycleMap, ctx.resolved, {
      format: 'changes',
      cycleRange: [1, 3],
    });
    expect(out.signals[0].initial.value_hex).toBeUndefined();
  });

  it('hex mirror omitted when any bit is x or z', async () => {
    const ctx = await setup('synthetic-bus.vcd', ['bus8']);
    // Window starts at cycle 1 (t=15000): bus8 set to b1010zzzz at t=15000.
    const out = formatSignals(ctx.parsed, ctx.cycleMap, ctx.resolved, {
      format: 'changes',
      cycleRange: [1, 3],
    });
    expect(out.signals[0].initial.value).toBe('1010zzzz');
    expect(out.signals[0].initial.value_hex).toBeUndefined();
  });
});

describe('formatSignals — changes/edges per-signal cap', () => {
  it('truncates to first N transitions and flags truncated + truncation_hint', async () => {
    const ctx = await setup('synthetic-clock.vcd', ['clk']);
    // Clock has 10 transitions in [0, 4]. Cap at 3.
    const out = formatSignals(ctx.parsed, ctx.cycleMap, ctx.resolved, {
      format: 'changes',
      cycleRange: [0, 4],
      perSignalCap: 3,
    });
    const tr = out.signals[0].trace as Array<[number, string]>;
    expect(tr.length).toBe(3);
    expect(out.signals[0].truncated).toBe(true);
    expect(out.signals[0].truncation_hint).toBe('narrow cycle_range or request fewer signals');
  });
});

describe('formatSignals — raw', () => {
  it('1-bit signal: trace.values is a packed string of length (to-from+1)', async () => {
    const ctx = await setup('synthetic-clock.vcd', ['a']);
    const out = formatSignals(ctx.parsed, ctx.cycleMap, ctx.resolved, {
      format: 'raw',
      cycleRange: [0, 4],
    });
    const trace = out.signals[0].trace as { start_cycle: number; values: string };
    expect(trace.start_cycle).toBe(0);
    expect(typeof trace.values).toBe('string');
    expect(trace.values.length).toBe(5);
    // a: dumpvars 0 carries through cycle 0, then 1 at cycles 1-2, then 0 at cycles 3-4
    expect(trace.values).toBe('01100');
  });

  it('multi-bit signal: trace.values is string[] of width-N elements', async () => {
    const ctx = await setup('synthetic-bus.vcd', ['bus4']);
    const out = formatSignals(ctx.parsed, ctx.cycleMap, ctx.resolved, {
      format: 'raw',
      cycleRange: [0, 3],
    });
    const trace = out.signals[0].trace as { start_cycle: number; values: string[] };
    expect(Array.isArray(trace.values)).toBe(true);
    expect(trace.values.length).toBe(4);
    for (const v of trace.values) expect(v.length).toBe(4);
  });

  it('raw width > 4 emits parallel values_hex (undefined for cells with x/z)', async () => {
    const ctx = await setup('synthetic-bus.vcd', ['bus8']);
    // synthetic-bus has 4 cycles (0..3). cycle 1 = b1010zzzz (z bits).
    const out = formatSignals(ctx.parsed, ctx.cycleMap, ctx.resolved, {
      format: 'raw',
      cycleRange: [0, 3],
    });
    const sig = out.signals[0];
    expect(sig.values_hex).toBeDefined();
    expect(sig.values_hex!.length).toBe(4);
    // Cycle 1: bus8 value is 1010zzzz → hex undefined.
    expect(sig.values_hex![1]).toBeUndefined();
    // Other cells have definite hex (cycle 0 = 11110000 → "f0").
    expect(sig.values_hex![0]).toBe('f0');
  });

  it('raw cell-cap truncates from window end at cell boundary, flags truncated', async () => {
    const ctx = await setup('synthetic-clock.vcd', ['a', 'b']);
    // 2 signals × 5 cycles = 10 cells. Cap = 6 → max 3 cycles per signal.
    const out = formatSignals(ctx.parsed, ctx.cycleMap, ctx.resolved, {
      format: 'raw',
      cycleRange: [0, 4],
      rawCellCap: 6,
    });
    expect(out.effectiveRange).toEqual([0, 2]);
    for (const s of out.signals) {
      const t = s.trace as { values: string };
      expect(t.values.length).toBe(3);
      expect(s.truncated).toBe(true);
    }
  });
});

describe('formatSignals — edges', () => {
  it('rising filter returns 0→1 / x→1 transitions only', async () => {
    const ctx = await setup('synthetic-clock.vcd', ['clk']);
    const out = formatSignals(ctx.parsed, ctx.cycleMap, ctx.resolved, {
      format: 'edges',
      cycleRange: [0, 4],
      edge: 'rising',
    });
    const tr = out.signals[0].trace as Array<[number, string, string]>;
    // Carry-in covers cycle 0's rising edge (clk=1 entering window). Trace
    // contains rising edges strictly after tStart: cycles 1, 2, 3, 4 → 4 events.
    expect(tr.length).toBe(4);
    for (const [, from, to] of tr) {
      expect(to).toBe('1');
      expect(from).not.toBe('1');
    }
  });

  it('falling filter returns 1→0 transitions only', async () => {
    const ctx = await setup('synthetic-clock.vcd', ['clk']);
    const out = formatSignals(ctx.parsed, ctx.cycleMap, ctx.resolved, {
      format: 'edges',
      cycleRange: [0, 4],
      edge: 'falling',
    });
    const tr = out.signals[0].trace as Array<[number, string, string]>;
    for (const [, from, to] of tr) {
      expect(from).toBe('1');
      expect(to).toBe('0');
    }
  });

  it('any filter returns all transitions', async () => {
    const ctx = await setup('synthetic-clock.vcd', ['clk']);
    const out = formatSignals(ctx.parsed, ctx.cycleMap, ctx.resolved, {
      format: 'edges',
      cycleRange: [0, 4],
      edge: 'any',
    });
    const tr = out.signals[0].trace as Array<[number, string, string]>;
    // 11 transitions total (t=0,5000,...,50000). t=0 and t=5000 fold into
    // carry-in (time <= tStart=5000); t=50000 is past tEnd=45000. Trace =
    // transitions in (5000, 45000] → t=10000..45000 = 8 events.
    expect(tr.length).toBe(8);
  });

  it('multi-bit signal with rising/falling: warns and falls back to any', async () => {
    const ctx = await setup('synthetic-bus.vcd', ['bus4']);
    const out = formatSignals(ctx.parsed, ctx.cycleMap, ctx.resolved, {
      format: 'edges',
      cycleRange: [0, 3],
      edge: 'rising',
    });
    expect(out.signals[0].warning).toMatch(/only meaningful for 1-bit/);
    const tr = out.signals[0].trace as Array<[number, string, string]>;
    expect(tr.length).toBeGreaterThan(0);
  });
});

describe('formatSignals — clock-on-changes warning', () => {
  it('attaches warning when requested signal IS the clock and format=changes (does not error)', async () => {
    const ctx = await setup('synthetic-clock.vcd', ['clk']);
    const out = formatSignals(ctx.parsed, ctx.cycleMap, ctx.resolved, {
      format: 'changes',
      cycleRange: [0, 4],
      clockId: ctx.clockId,
    });
    expect(out.signals[0].warning).toMatch(/degenerate.*format=edges or raw/);
    // Trace still populated (not an error path).
    expect((out.signals[0].trace as Array<[number, string]>).length).toBeGreaterThan(0);
  });

  it('does NOT attach warning for non-clock signals or non-changes formats', async () => {
    const ctx = await setup('synthetic-clock.vcd', ['clk', 'a']);
    const out = formatSignals(ctx.parsed, ctx.cycleMap, ctx.resolved, {
      format: 'edges',
      cycleRange: [0, 4],
      edge: 'any',
      clockId: ctx.clockId,
    });
    for (const s of out.signals) expect(s.warning).toBeUndefined();
  });
});

describe('formatSignals — unsupported types', () => {
  it('real / string signals resolve but return warning + empty trace', async () => {
    const parsed = await parseVcd(FIX('synthetic-real-string.vcd'));
    const det = detectClock(parsed);
    if (!('clock' in det)) throw new Error('clock detection failed');
    const cycleMap = buildCycleMap(parsed, det.clock);
    const temp = parsed.byFullPath.get('tb.temperature')![0];
    const msg = parsed.byFullPath.get('tb.message')![0];
    const resolved: ResolvedSignal[] = [
      { requested: 'temperature', resolved: temp },
      { requested: 'message', resolved: msg },
    ];
    const out = formatSignals(parsed, cycleMap, resolved, {
      format: 'changes',
      cycleRange: [0, 2],
    });
    expect(out.signals[0].warning).toMatch(/"real" not supported/);
    expect(out.signals[1].warning).toMatch(/"string" not supported/);
  });
});
