import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findRepoRoot } from './repo-root.js';
import { slugify } from './test-name.js';

describe('slugify', () => {
  it('passes alphanumerics, underscore, and hyphen through unchanged', () => {
    expect(slugify('R-Type_ADD_basic')).toBe('R-Type_ADD_basic');
    expect(slugify('hello123')).toBe('hello123');
  });

  it('collapses runs of disallowed punctuation into a single underscore', () => {
    expect(slugify('R-Type ADD basic')).toBe('R-Type_ADD_basic');
    expect(slugify('a   b...c')).toBe('a_b_c');
    expect(slugify('foo!!!@@@bar')).toBe('foo_bar');
  });

  it('trims leading and trailing underscores', () => {
    expect(slugify('   leading')).toBe('leading');
    expect(slugify('trailing   ')).toBe('trailing');
    expect(slugify('!!both!!')).toBe('both');
  });

  it('returns "unnamed" for empty input', () => {
    expect(slugify('')).toBe('unnamed');
  });

  it('returns "unnamed" when input collapses to only underscores', () => {
    expect(slugify('   ')).toBe('unnamed');
    expect(slugify('!!!')).toBe('unnamed');
    expect(slugify('___')).toBe('unnamed');
  });
});

describe('slugify matches the writer in hardware/ulx3s', () => {
  // verify.ts writes VCDs under its slug and read_waveform looks them up under
  // ours, so any drift breaks test_name lookups.
  it('agrees on every sample', async () => {
    const writerPath = resolve(findRepoRoot(), 'hardware/ulx3s/projects/cpu/test-name.ts');
    const writer = (await import(pathToFileURL(writerPath).href)) as {
      slugify: (name: string) => string;
    };
    const samples = [
      'R-Type ADD basic',
      'R-Type_ADD_basic',
      'a   b...c',
      '!!both!!',
      '',
      '___',
      'LUI / AUIPC (upper imm)',
      'SB+LB sign-extend',
    ];
    for (const s of samples) expect(writer.slugify(s), s).toBe(slugify(s));
  });
});
