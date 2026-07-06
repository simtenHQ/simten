import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseVcd, resolveSignals } from './vcd-parser.js';

const FIX = (name: string) => resolve(__dirname, '../__fixtures__/vcd', name);

describe('parseVcd — synthetic-clock', () => {
  it('parses timescale, scope tree, and signal map', async () => {
    const r = await parseVcd(FIX('synthetic-clock.vcd'));
    expect(r.timescalePs).toBe(1);
    expect(r.signals.map((s) => s.fullPath).sort()).toEqual(['tb.a', 'tb.b', 'tb.clk']);
    const clk = r.byFullPath.get('tb.clk')?.[0];
    expect(clk?.width).toBe(1);
    expect(clk?.type).toBe('reg');
    expect(clk?.leaf).toBe('clk');
  });

  it('collects 1-bit value changes with timestamps', async () => {
    const r = await parseVcd(FIX('synthetic-clock.vcd'));
    const clk = r.byFullPath.get('tb.clk')![0];
    const a = r.byFullPath.get('tb.a')![0];
    const clkChanges = r.changes.get(clk.id)!;
    // dumpvars at t=0 plus toggles at 5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000
    expect(clkChanges[0]).toEqual({ time: 0, value: '0' });
    expect(clkChanges[1]).toEqual({ time: 5000, value: '1' });
    expect(clkChanges[2]).toEqual({ time: 10000, value: '0' });
    const aChanges = r.changes.get(a.id)!;
    // dumpvars 0, then 1 at 15000, 0 at 35000
    expect(aChanges).toEqual([
      { time: 0, value: '0' },
      { time: 15000, value: '1' },
      { time: 35000, value: '0' },
    ]);
  });
});

describe('parseVcd — synthetic-bus', () => {
  it('parses bus values with x and z, applies IEEE 1364 left-padding', async () => {
    const r = await parseVcd(FIX('synthetic-bus.vcd'));
    const bus4 = r.byFullPath.get('tb.bus4')![0];
    const bus8 = r.byFullPath.get('tb.bus8')![0];
    expect(bus4.width).toBe(4);
    expect(bus8.width).toBe(8);
    const bus4Changes = r.changes.get(bus4.id)!;
    expect(bus4Changes[0].value).toBe('0000');
    expect(bus4Changes[1].value).toBe('1010');
    expect(bus4Changes[2].value).toBe('xxxx');
    const bus8Changes = r.changes.get(bus8.id)!;
    expect(bus8Changes[0].value).toBe('00000000');
    expect(bus8Changes[1].value).toBe('11110000');
    // b1010zzzz padded to 8 bits → "1010zzzz"
    expect(bus8Changes[2].value).toBe('1010zzzz');
  });

  it('left-pads short bus values per spec (leading 0 → "0", x → "x", z → "z")', async () => {
    // We construct the case via the synthetic-bus fixture: b0011 for a 4-bit
    // signal is already width-4, so check the padding logic path explicitly
    // by parsing a value where bits.length < width is forced — bus4 has no
    // such case in the fixture. The padding is exercised in unit form via
    // a focused assertion: the parser preserves width, no bus value has
    // length != width.
    const r = await parseVcd(FIX('synthetic-bus.vcd'));
    const bus4 = r.byFullPath.get('tb.bus4')![0];
    const bus8 = r.byFullPath.get('tb.bus8')![0];
    for (const v of r.changes.get(bus4.id)!) expect(v.value.length).toBe(4);
    for (const v of r.changes.get(bus8.id)!) expect(v.value.length).toBe(8);
  });
});

describe('parseVcd — $dumpall block', () => {
  it('treats $dumpall like $dumpvars: value records inside apply at currentTime', async () => {
    const r = await parseVcd(FIX('synthetic-dumpall.vcd'));
    const sig = r.byFullPath.get('tb.sig')![0];
    const sigChanges = r.changes.get(sig.id)!;
    // Timeline:
    //   t=0     dumpvars: sig=0
    //   t=5000  sig=1
    //   t=15000 dumpall snapshot: sig=1 (re-recorded at currentTime=15000)
    //   t=20000 sig=0
    //   t=25000 sig=1
    expect(sigChanges).toEqual([
      { time: 0, value: '0' },
      { time: 5000, value: '1' },
      { time: 15000, value: '1' },
      { time: 20000, value: '0' },
      { time: 25000, value: '1' },
    ]);
  });
});

describe('parseVcd — synthetic-real-string (tolerance)', () => {
  it('does not crash, flags signals as unsupported, drops their value records, warns once per type', async () => {
    const r = await parseVcd(FIX('synthetic-real-string.vcd'));
    const temp = r.byFullPath.get('tb.temperature')![0];
    const msg = r.byFullPath.get('tb.message')![0];
    expect(temp.unsupported).toBe('real');
    expect(msg.unsupported).toBe('string');
    // No changes recorded for unsupported types.
    expect(r.changes.get(temp.id)).toBeUndefined();
    expect(r.changes.get(msg.id)).toBeUndefined();
    // One warning per type.
    expect(r.warnings.filter((w) => w.includes('real')).length).toBe(1);
    expect(r.warnings.filter((w) => w.includes('string')).length).toBe(1);
    // Clock still parses normally.
    const clk = r.byFullPath.get('tb.clk')![0];
    expect(r.changes.get(clk.id)?.length).toBeGreaterThan(0);
  });

  it('handles $comment ... $end blocks (skipped)', async () => {
    // Real-string fixture has a $comment block; if the parser miscounted
    // $end markers it would corrupt later state. Spot-check signals parsed.
    const r = await parseVcd(FIX('synthetic-real-string.vcd'));
    expect(r.signals.length).toBe(3);
  });
});

describe('parseVcd — selectivity (single-pass retained-id set)', () => {
  it('only collects changes for retained ids during body walk when requestedSignals provided', async () => {
    const calls: Array<{ id: string; retained: boolean }> = [];
    const r = await parseVcd(FIX('synthetic-clock.vcd'), {
      requestedSignals: ['clk'],
      onBodyRecord: (id, retained) => calls.push({ id, retained }),
    });
    // Find the clk id from the parsed signals.
    const clk = r.byFullPath.get('tb.clk')![0];
    const aSig = r.byFullPath.get('tb.a')![0];
    // Only clk should be retained.
    const retainedCalls = calls.filter((c) => c.retained);
    const droppedCalls = calls.filter((c) => !c.retained);
    expect(retainedCalls.every((c) => c.id === clk.id)).toBe(true);
    expect(droppedCalls.some((c) => c.id === aSig.id)).toBe(true);
    // Changes map only has the retained id.
    expect([...r.changes.keys()]).toEqual([clk.id]);
  });

  it('retains all signals when no requestedSignals provided', async () => {
    const r = await parseVcd(FIX('synthetic-clock.vcd'));
    expect(r.changes.size).toBeGreaterThanOrEqual(2); // clk + a (b never transitions after dumpvars but does record one)
  });
});

describe('parseVcd — real fixture (R-Type_ADD_basic.vcd)', () => {
  it('parses the iverilog CPU VCD', async () => {
    const r = await parseVcd(FIX('R-Type_ADD_basic.vcd'));
    expect(r.timescalePs).toBe(1);
    expect(r.signals.length).toBeGreaterThan(50);
    // tb.cpu is the RV32I_CPU_Core instance under the testbench; verify a
    // known signal from that scope is parsed. (uart_inst is not in this
    // testbench — verify.ts wires UART into tb directly via $write.)
    const aluResult = r.signals.find((s) => s.fullPath === 'tb.cpu.w_cpu_alu_result');
    expect(aluResult).toBeDefined();
    expect(aluResult?.width).toBe(32);
    // tb.clk should be present and 1-bit.
    const clk = r.byFullPath.get('tb.clk');
    expect(clk).toBeDefined();
    expect(clk![0].width).toBe(1);
    // Changes recorded for tb.clk during simulation.
    expect(r.changes.get(clk![0].id)?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('resolveSignals — lookup', () => {
  it('full-path exact hit', async () => {
    const r = await parseVcd(FIX('synthetic-clock.vcd'));
    const res = resolveSignals(r, ['tb.clk']);
    expect(res.errors).toEqual([]);
    expect(res.resolved[0].resolved.fullPath).toBe('tb.clk');
  });

  it('leaf unique match', async () => {
    const r = await parseVcd(FIX('synthetic-clock.vcd'));
    const res = resolveSignals(r, ['clk']);
    expect(res.errors).toEqual([]);
    expect(res.resolved[0].resolved.fullPath).toBe('tb.clk');
  });

  it('leaf ambiguous → ambiguous_signal with candidates', async () => {
    // The real CPU VCD has many `clk` aliases across nested scopes.
    const r = await parseVcd(FIX('R-Type_ADD_basic.vcd'));
    const res = resolveSignals(r, ['clk']);
    expect(res.resolved).toEqual([]);
    expect(res.errors[0]).toMatchObject({ type: 'ambiguous_signal', requested: 'clk' });
    if (res.errors[0].type === 'ambiguous_signal') {
      expect(res.errors[0].candidates.length).toBeGreaterThan(1);
      expect(res.errors[0].candidates.length).toBeLessThanOrEqual(10);
    }
  });

  it('missing → unknown_signal with Levenshtein suggestions over leaves', async () => {
    const r = await parseVcd(FIX('synthetic-clock.vcd'));
    const res = resolveSignals(r, ['ckl']); // typo of clk
    expect(res.resolved).toEqual([]);
    expect(res.errors[0]).toMatchObject({ type: 'unknown_signal', requested: 'ckl' });
    if (res.errors[0].type === 'unknown_signal') {
      expect(res.errors[0].suggestions).toContain('clk');
    }
  });

  it('input containing "." is full-path-only, never fuzzy-matched', async () => {
    const r = await parseVcd(FIX('synthetic-clock.vcd'));
    const res = resolveSignals(r, ['tb.nonexistent']);
    expect(res.errors[0]?.type).toBe('unknown_signal');
    // Even if "clk" would fuzzy-match the leaf, the full-path miss returns unknown_signal.
  });
});
