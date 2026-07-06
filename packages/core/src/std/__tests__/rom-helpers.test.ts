import { describe, expect, it } from 'vitest';
import { romFromBytes, romFromEntries, romFromWords } from '../memory.js';

describe('romFromBytes', () => {
  it('omits zero entries (sparse)', () => {
    expect(romFromBytes([0, 5, 0, 7])).toEqual({ 1: 5, 3: 7 });
  });

  it('masks values to 8 bits', () => {
    expect(romFromBytes([0x1ff, 0x100])).toEqual({ 0: 0xff });
  });

  it('accepts Uint8Array', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(romFromBytes(bytes)).toEqual({ 0: 1, 1: 2, 2: 3 });
  });

  it('returns empty object for empty input', () => {
    expect(romFromBytes([])).toEqual({});
    expect(romFromBytes([0, 0, 0])).toEqual({});
  });
});

describe('romFromWords', () => {
  it('masks values to the given width', () => {
    expect(romFromWords([0xffff, 0x100], 8)).toEqual({ 0: 0xff });
  });

  it('handles 32-bit words including the high bit', () => {
    expect(romFromWords([0x80000000, 0xffffffff], 32)).toEqual({
      0: 0x80000000,
      1: 0xffffffff,
    });
  });

  it('omits zeros', () => {
    expect(romFromWords([0, 42, 0], 16)).toEqual({ 1: 42 });
  });

  it('rejects invalid widths', () => {
    expect(() => romFromWords([1], 0)).toThrow();
    expect(() => romFromWords([1], 33)).toThrow();
    expect(() => romFromWords([1], 1.5)).toThrow();
  });
});

describe('romFromEntries', () => {
  it('builds sparse data from address/value pairs', () => {
    expect(
      romFromEntries([
        [0, 1],
        [100, 2],
        [0xffff, 3],
      ]),
    ).toEqual({
      0: 1,
      100: 2,
      [0xffff]: 3,
    });
  });

  it('omits zero values', () => {
    expect(
      romFromEntries([
        [0, 1],
        [1, 0],
        [2, 3],
      ]),
    ).toEqual({ 0: 1, 2: 3 });
  });

  it('rejects negative or non-integer addresses', () => {
    expect(() => romFromEntries([[-1, 1]])).toThrow();
    expect(() => romFromEntries([[1.5, 1]])).toThrow();
  });

  it('accepts a Map', () => {
    const m = new Map<number, number>([
      [0, 1],
      [5, 2],
    ]);
    expect(romFromEntries(m)).toEqual({ 0: 1, 5: 2 });
  });
});
