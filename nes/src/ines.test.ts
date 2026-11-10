import { describe, expect, it } from 'vitest';
import { parseINes } from './ines.js';

/** A .nes file: header bytes 4-15 from `header`, then trainer, PRG and CHR filled with markers. */
function nesFile(header: number[], { trainer = false, extra = 0 } = {}): Uint8Array {
  const prg = header[0] * 0x4000;
  const chr = header[1] * 0x2000;
  const start = 16 + (trainer ? 512 : 0);
  const bytes = new Uint8Array(start + prg + chr + extra);
  bytes.set([0x4e, 0x45, 0x53, 0x1a, ...header]);
  if (trainer) bytes.fill(0x77, 16, start);
  bytes.fill(0xaa, start, start + prg);
  bytes.fill(0xcc, start + prg, start + prg + chr);
  return bytes;
}

describe('parseINes', () => {
  it('reads an NROM-128 header', () => {
    const rom = parseINes(nesFile([1, 1, 0x01, 0]));
    expect(rom.prg.length).toBe(0x4000);
    expect(rom.chr.length).toBe(0x2000);
    expect(rom.prg.every((b) => b === 0xaa)).toBe(true);
    expect(rom.chr.every((b) => b === 0xcc)).toBe(true);
    expect(rom).toMatchObject({ mapper: 0, mirroring: 'vertical', battery: false });
    expect(rom.trainer).toBeUndefined();
  });

  it('reads mirroring, battery, trainer and both mapper nibbles', () => {
    const rom = parseINes(nesFile([2, 0, 0x16, 0x40], { trainer: true }));
    expect(rom.mapper).toBe(0x41);
    expect(rom.mirroring).toBe('horizontal');
    expect(rom.battery).toBe(true);
    expect(rom.trainer?.length).toBe(512);
    expect(rom.trainer?.every((b) => b === 0x77)).toBe(true);
    expect(rom.prg.length).toBe(0x8000);
    expect(rom.prg.every((b) => b === 0xaa)).toBe(true);
    expect(rom.chr.length).toBe(0);
  });

  it('ignores byte 7 when an old dumper left text in the header', () => {
    const file = nesFile([1, 1, 0x10, 0x44]);
    file.set([0x44, 0x69, 0x73, 0x6b], 12);
    expect(parseINes(file).mapper).toBe(1);
  });

  it('reads an NES 2.0 header through its iNES fields', () => {
    const rom = parseINes(nesFile([1, 1, 0x00, 0x08, 0x01]));
    expect(rom.mapper).toBe(0x100);
    expect(rom.prg.length).toBe(0x4000);
  });

  it('allows trailing data after CHR', () => {
    expect(parseINes(nesFile([1, 1, 0, 0], { extra: 100 })).chr.length).toBe(0x2000);
  });

  it('rejects bad files with a reason', () => {
    expect(() => parseINes(new Uint8Array(8))).toThrow(/shorter than the 16-byte header/);
    const bad = nesFile([1, 1, 0, 0]);
    bad[3] = 0;
    expect(() => parseINes(bad)).toThrow(/magic/);
    expect(() => parseINes(nesFile([1, 1, 0, 0]).slice(0, 0x4000))).toThrow(/header says 24592/);
    expect(() => parseINes(nesFile([0, 1, 0, 0]))).toThrow(/PRG ROM size is 0/);
    expect(() => parseINes(nesFile([1, 1, 0x08, 0]))).toThrow(/four-screen/);
    expect(() => parseINes(nesFile([1, 1, 0, 0x08, 0, 1]))).toThrow(/NES 2.0/);
  });
});
