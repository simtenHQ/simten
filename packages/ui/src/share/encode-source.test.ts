import { compressToEncodedURIComponent } from 'lz-string';
import { describe, expect, it } from 'vitest';
import { decodeSourceFromUrl, hashSource } from './encode-source.js';
import { isShareHash, loadShare, type ShareKV, saveShare, validateShareHash } from './store.js';

describe('encode-source', () => {
  // Links from before #368 inlined the lz-string-compressed source.
  it('decodes a link shared before short links', () => {
    const source = `import { circuit, bit } from "@simten/core";\nexport const HalfAdder = circuit("HalfAdder", { inputs: { a: bit, b: bit }, outputs: { sum: bit, carry: bit } });`;
    expect(decodeSourceFromUrl(compressToEncodedURIComponent(source))).toBe(source);
  });

  it('decodes unicode', () => {
    const source = `// Häuser • 電子\nconst x = "💡 ⚡ 🔌";\nexport default x;`;
    expect(decodeSourceFromUrl(compressToEncodedURIComponent(source))).toBe(source);
  });

  it('returns null on garbage input', () => {
    expect(decodeSourceFromUrl('###not-a-real-payload###')).toBeNull();
  });

  it('returns null on empty input', () => {
    expect(decodeSourceFromUrl('')).toBeNull();
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

describe('share store', () => {
  function fakeKV(): ShareKV & { writes: Array<[string, string, unknown[]]> } {
    const entries = new Map<string, string>();
    const writes: Array<[string, string, unknown[]]> = [];
    return {
      writes,
      async put(key: string, value: string, ...rest: unknown[]) {
        writes.push([key, value, rest]);
        entries.set(key, value);
      },
      async get(key: string) {
        return entries.get(key) ?? null;
      },
    };
  }

  it('stores without an expiry and reads back without writing', async () => {
    const kv = fakeKV();
    const hash = await hashSource('src');
    await saveShare(kv, hash, 'src');
    expect(kv.writes).toEqual([[hash, 'src', []]]);
    expect(await loadShare(kv, hash)).toBe('src');
    expect(await loadShare(kv, '0123456789abcdef0123')).toBeNull();
    expect(kv.writes).toHaveLength(1);
  });

  it('accepts exactly what hashSource produces', async () => {
    const hash = await hashSource('const x = 1;');
    expect(isShareHash(hash)).toBe(true);
    expect(validateShareHash(hash)).toBe(hash);
  });

  it.each([
    [''],
    ['0123456789abcdef012'],
    ['0123456789abcdef01234'],
    ['0123456789ABCDEF0123'],
    ['0123456789abcdef012g'],
    ['../../0123456789abcd'],
  ])('rejects %j', (hash) => {
    expect(isShareHash(hash)).toBe(false);
    expect(() => validateShareHash(hash)).toThrow('invalid hash');
  });

  it('rejects a non-string', () => {
    expect(isShareHash(7)).toBe(false);
    expect(() => validateShareHash(7 as unknown as string)).toThrow('invalid hash');
  });
});
