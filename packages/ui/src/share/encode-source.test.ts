import { describe, expect, it } from 'vitest';
import {
  decodeSourceFromUrl,
  encodeSourceForUrl,
  hashSource,
  INLINE_URL_THRESHOLD,
  shouldUseShortLink,
} from './encode-source.js';

describe('encode-source', () => {
  it('round-trips a small circuit source', () => {
    const source = `import { circuit, bit } from "@simten/core";\nexport const HalfAdder = circuit("HalfAdder", { inputs: { a: bit, b: bit }, outputs: { sum: bit, carry: bit } });`;
    const encoded = encodeSourceForUrl(source);
    expect(decodeSourceFromUrl(encoded)).toBe(source);
  });

  it('round-trips a multi-circuit file with unicode', () => {
    const source = `// Häuser • 電子\nconst x = "💡 ⚡ 🔌";\nexport default x;`;
    expect(decodeSourceFromUrl(encodeSourceForUrl(source))).toBe(source);
  });

  it('returns null on garbage input', () => {
    expect(decodeSourceFromUrl('###not-a-real-payload###')).toBeNull();
  });

  it('returns null on empty input', () => {
    expect(decodeSourceFromUrl('')).toBeNull();
  });

  it('shouldUseShortLink fires above the threshold', () => {
    // Test the predicate directly (lz-string compresses too well to easily
    // produce an over-threshold encoded blob from synthetic input).
    expect(shouldUseShortLink('a'.repeat(INLINE_URL_THRESHOLD - 1))).toBe(false);
    expect(shouldUseShortLink('a'.repeat(INLINE_URL_THRESHOLD))).toBe(false);
    expect(shouldUseShortLink('a'.repeat(INLINE_URL_THRESHOLD + 1))).toBe(true);
  });

  it('typical small circuit source stays inline', () => {
    const source = `import { circuit, bit } from "@simten/core";\nexport const HalfAdder = circuit("HalfAdder", { inputs: { a: bit, b: bit }, outputs: { sum: bit, carry: bit } });`;
    expect(shouldUseShortLink(encodeSourceForUrl(source))).toBe(false);
  });

  it('hashSource is deterministic and 20 hex chars', async () => {
    const a = await hashSource('hello');
    const b = await hashSource('hello');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{20}$/);
  });

  it('hashSource diverges for different inputs', async () => {
    const a = await hashSource('hello');
    const b = await hashSource('hello!');
    expect(a).not.toBe(b);
  });
});
