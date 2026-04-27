import { describe, expect, it } from 'vitest';
import { slugify } from '../test-name.js';

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
