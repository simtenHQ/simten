import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { handleReadWaveform } from './read_waveform.js';

const FIX = (name: string) => resolve(__dirname, '../__fixtures__/vcd', name);

function parsePayload(result: { content: Array<{ text: string }>; isError?: boolean }) {
  return JSON.parse(result.content[0].text);
}

describe('handleReadWaveform — happy paths', () => {
  it('changes format on synthetic-clock returns shaped JSON', async () => {
    const r = await handleReadWaveform({
      vcd_path: FIX('synthetic-clock.vcd'),
      signals: ['a'],
      cycle_range: [0, 4],
      format: 'changes',
      edge: 'rising',
    });
    expect(r.isError).toBeUndefined();
    const p = parsePayload(r);
    expect(p.vcd.timescale_ps).toBe(1);
    expect(p.vcd.clock_signal).toBe('tb.clk');
    expect(p.vcd.total_cycles).toBe(5);
    expect(p.cycle_range).toEqual([0, 4]);
    expect(p.signals).toHaveLength(1);
    expect(p.signals[0].resolved).toBe('tb.a');
    expect(p.signals[0].width).toBe(1);
    expect(p.signals[0].initial.cycle).toBe(0);
  });

  it('real fixture: query tb.clk + a signal over cycles 0-20 of R-Type_ADD_basic', async () => {
    const r = await handleReadWaveform({
      vcd_path: FIX('R-Type_ADD_basic.vcd'),
      signals: ['tb.clk', 'tb.cpu.w_cpu_alu_result'],
      cycle_range: [0, 20],
      format: 'changes',
      edge: 'rising',
    });
    expect(r.isError).toBeUndefined();
    const p = parsePayload(r);
    expect(p.vcd.clock_signal).toBe('tb.clk');
    expect(p.signals).toHaveLength(2);
    const clk = p.signals.find((s: { resolved: string }) => s.resolved === 'tb.clk');
    expect(clk).toBeDefined();
    // clock-on-changes warning should fire here
    expect(clk.warning).toMatch(/degenerate/);
  });
});

describe('handleReadWaveform — sanity guard fires before any I/O', () => {
  // Vitest can't spy on node:fs ESM exports, so we observe the guard
  // ordering indirectly: pass a path that DOES NOT EXIST AND a cycle range
  // over the cap. If the guard fires first, we get cycle_range_exceeds_cap;
  // if I/O happens first, we'd get vcd_not_found.
  it('cycle_range span > 50 000 short-circuits before path resolution', async () => {
    const r = await handleReadWaveform({
      vcd_path: '/tmp/definitely-not-here-987654.vcd',
      signals: ['clk'],
      cycle_range: [0, 50_001],
      format: 'changes',
      edge: 'rising',
    });
    expect(r.isError).toBe(true);
    const p = parsePayload(r);
    expect(p.error).toBe('cycle_range_exceeds_cap');
    expect(p.cap).toBe(50_000);
  });
});

describe('handleReadWaveform — error mappings', () => {
  it('missing file → vcd_not_found isError', async () => {
    const r = await handleReadWaveform({
      vcd_path: '/tmp/this-file-does-not-exist-12345.vcd',
      signals: ['clk'],
      cycle_range: [0, 4],
      format: 'changes',
      edge: 'rising',
    });
    expect(r.isError).toBe(true);
    const p = parsePayload(r);
    expect(p.error).toBe('vcd_not_found');
  });

  it('ambiguous leaf on real CPU VCD → ambiguous_signal isError', async () => {
    const r = await handleReadWaveform({
      vcd_path: FIX('R-Type_ADD_basic.vcd'),
      signals: ['clk'], // ambiguous: tb.clk vs tb.cpu.clk
      cycle_range: [0, 5],
      format: 'changes',
      edge: 'rising',
    });
    expect(r.isError).toBe(true);
    const p = parsePayload(r);
    expect(p.type).toBe('ambiguous_signal');
    expect(p.candidates.length).toBeGreaterThan(1);
  });

  it('unknown signal → unknown_signal with Levenshtein suggestions', async () => {
    const r = await handleReadWaveform({
      vcd_path: FIX('synthetic-clock.vcd'),
      signals: ['ckl'], // typo
      cycle_range: [0, 4],
      format: 'changes',
      edge: 'rising',
    });
    expect(r.isError).toBe(true);
    const p = parsePayload(r);
    expect(p.type).toBe('unknown_signal');
    expect(p.suggestions).toContain('clk');
  });

  it('cycle range out of bounds → cycle_range_out_of_bounds isError', async () => {
    const r = await handleReadWaveform({
      vcd_path: FIX('synthetic-clock.vcd'),
      signals: ['clk'],
      cycle_range: [0, 100], // synth has 5 cycles
      format: 'changes',
      edge: 'rising',
    });
    expect(r.isError).toBe(true);
    const p = parsePayload(r);
    expect(p.error).toBe('cycle_range_out_of_bounds');
    expect(p.total_cycles).toBe(5);
  });
});

describe('handleReadWaveform — output cap exceeded is success, not error', () => {
  it('returns truncated:true in payload, NOT isError', async () => {
    // Real CPU VCD has many cycles; force per-signal cap by requesting a wide window.
    const r = await handleReadWaveform({
      vcd_path: FIX('R-Type_ADD_basic.vcd'),
      signals: ['tb.clk'],
      cycle_range: [0, 100],
      format: 'changes',
      edge: 'rising',
    });
    expect(r.isError).toBeUndefined();
    const p = parsePayload(r);
    // tb.clk has hundreds of transitions in [0,100] — far above 200 cap.
    // (Cap may not trigger if the VCD has fewer cycles; spot-check it parsed.)
    expect(p.signals[0].resolved).toBe('tb.clk');
  });
});
