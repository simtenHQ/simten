/**
 * Unit tests for segmentBits — the bit-vector reconstruction core.
 * Exercises each classification path over hand-built bit arrays, independent
 * of any real netlist (fake driverOf).
 */

import { describe, expect, it } from 'vitest';
import { type BitDriver, segmentBits, type YosysBit } from '../net-map.js';

// Fake driver map: nets 100..107 are port 'x' bits 0..7; 200..203 are port 'y' bits 0..3.
const driverOf = (net: number): BitDriver => {
  if (net >= 100 && net <= 107) return { nodeId: 'n', portName: 'x', index: net - 100 };
  if (net >= 200 && net <= 203) return { nodeId: 'm', portName: 'y', index: net - 200 };
  throw new Error(`no driver for ${net}`);
};

describe('segmentBits', () => {
  it('contiguous ascending run → one net segment', () => {
    expect(segmentBits([100, 101, 102, 103], driverOf)).toEqual([
      { kind: 'net', nodeId: 'n', portName: 'x', offset: 0, width: 4 },
    ]);
  });

  it('sub-range run → net segment with offset', () => {
    expect(segmentBits([102, 103], driverOf)).toEqual([
      { kind: 'net', nodeId: 'n', portName: 'x', offset: 2, width: 2 },
    ]);
  });

  it('reversed order → separate 1-wide segments (no descending run)', () => {
    expect(segmentBits([103, 102], driverOf)).toEqual([
      { kind: 'net', nodeId: 'n', portName: 'x', offset: 3, width: 1 },
      { kind: 'net', nodeId: 'n', portName: 'x', offset: 2, width: 1 },
    ]);
  });

  it('split across two drivers → two segments', () => {
    expect(segmentBits([200, 201, 202, 203, 100, 101, 102, 103], driverOf)).toEqual([
      { kind: 'net', nodeId: 'm', portName: 'y', offset: 0, width: 4 },
      { kind: 'net', nodeId: 'n', portName: 'x', offset: 0, width: 4 },
    ]);
  });

  it('constant-mixed → const segment + net segment', () => {
    // LSB-first: two const bits (value 0b01 = 1), then x[0..1]
    expect(segmentBits(['1', '0', 100, 101], driverOf)).toEqual([
      { kind: 'const', value: 1, width: 2 },
      { kind: 'net', nodeId: 'n', portName: 'x', offset: 0, width: 2 },
    ]);
  });

  it('sign extension (run + replicated MSB) → run then N one-wide MSB slices', () => {
    // [x0,x1,x2,x3, x3,x3,x3,x3] — a signed 4→8 widening
    expect(segmentBits([100, 101, 102, 103, 103, 103, 103, 103], driverOf)).toEqual([
      { kind: 'net', nodeId: 'n', portName: 'x', offset: 0, width: 4 },
      { kind: 'net', nodeId: 'n', portName: 'x', offset: 3, width: 1 },
      { kind: 'net', nodeId: 'n', portName: 'x', offset: 3, width: 1 },
      { kind: 'net', nodeId: 'n', portName: 'x', offset: 3, width: 1 },
      { kind: 'net', nodeId: 'n', portName: 'x', offset: 3, width: 1 },
    ]);
  });

  it('throws on x/z bits', () => {
    expect(() => segmentBits([100, 'x'] as YosysBit[], driverOf)).toThrow(/2-state/);
  });
});
