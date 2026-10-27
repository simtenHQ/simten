import { hashSource } from '@simten/ui/share';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBudget, fakeRateLimiter } from '../../../api/__tests__/fakes';
import {
  createShare,
  loadShare,
  MAX_SOURCE_BYTES,
  REFRESH_BELOW_SECONDS,
  SHARE_TTL_SECONDS,
  type ShareKV,
  type ShareMetadata,
  saveShare,
  sourceBytes,
  validateShareHash,
  validateShareInput,
} from '../store';

afterEach(() => vi.unstubAllEnvs());

interface Entry {
  value: string;
  metadata: ShareMetadata | null;
  ttl: number;
}

/** In-memory CIRCUIT_SHARES that records every write. */
function fakeKV(): ShareKV & { entries: Map<string, Entry>; puts: string[]; failPuts: boolean } {
  const entries = new Map<string, Entry>();
  const kv = {
    entries,
    puts: [] as string[],
    failPuts: false,
    async put(
      key: string,
      value: string,
      options: { expirationTtl: number; metadata: ShareMetadata },
    ) {
      if (kv.failPuts) throw new Error('KV PUT failed: 429 Too Many Requests');
      kv.puts.push(key);
      entries.set(key, { value, metadata: options.metadata, ttl: options.expirationTtl });
    },
    async getWithMetadata<M>(key: string) {
      const entry = entries.get(key);
      return {
        value: entry?.value ?? null,
        metadata: (entry?.metadata ?? null) as M | null,
      };
    },
  };
  return kv;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HASH = '0123456789abcdef0123';

describe('validateShareInput', () => {
  it('measures size in UTF-8 bytes, not characters', () => {
    const ascii = 'a'.repeat(MAX_SOURCE_BYTES);
    expect(validateShareInput({ source: ascii }).source).toBe(ascii);
    expect(() => validateShareInput({ source: `${ascii}a` })).toThrow('source too large');

    // 'é' is two bytes: half as many characters already fill the limit.
    const accented = 'é'.repeat(MAX_SOURCE_BYTES / 2);
    expect(sourceBytes(accented)).toBe(MAX_SOURCE_BYTES);
    expect(() => validateShareInput({ source: accented })).not.toThrow();
    expect(() => validateShareInput({ source: `${accented}é` })).toThrow('source too large');
    expect(accented.length).toBeLessThan(MAX_SOURCE_BYTES);
  });

  it('rejects anything but a string source', () => {
    for (const bad of [null, undefined, {}, { source: 42 }, { source: ['x'] }]) {
      expect(() => validateShareInput(bad as unknown as { source: string })).toThrow(
        'invalid source',
      );
    }
  });
});

describe('validateShareHash', () => {
  it('accepts exactly what hashSource produces', async () => {
    const hash = await hashSource('const x = 1;');
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
    expect(() => validateShareHash(hash)).toThrow('invalid hash');
  });

  it('rejects a non-string', () => {
    expect(() => validateShareHash(7 as unknown as string)).toThrow('invalid hash');
  });
});

describe('saveShare / loadShare', () => {
  it('stores the expiry in metadata alongside the TTL', async () => {
    const kv = fakeKV();
    await saveShare(kv, HASH, 'src', 1000);
    expect(kv.entries.get(HASH)).toEqual({
      value: 'src',
      ttl: SHARE_TTL_SECONDS,
      metadata: { expiresAt: 1000 + SHARE_TTL_SECONDS * 1000 },
    });
  });

  it('returns null for a missing entry, without writing', async () => {
    const kv = fakeKV();
    expect(await loadShare(kv, HASH)).toBeNull();
    expect(kv.puts).toEqual([]);
  });

  it('does not write on a read while plenty of TTL is left', async () => {
    const kv = fakeKV();
    await saveShare(kv, HASH, 'src', 0);
    kv.puts.length = 0;
    for (const day of [0, 1, 100, 364]) {
      expect(await loadShare(kv, HASH, day * DAY_MS)).toBe('src');
    }
    expect(kv.puts).toEqual([]);
  });

  it('refreshes the TTL once the entry is close to expiry', async () => {
    const kv = fakeKV();
    await saveShare(kv, HASH, 'src', 0);
    kv.puts.length = 0;
    const late = SHARE_TTL_SECONDS * 1000 - REFRESH_BELOW_SECONDS * 1000 + DAY_MS;
    expect(await loadShare(kv, HASH, late)).toBe('src');
    expect(kv.puts).toEqual([HASH]);
    expect(kv.entries.get(HASH)?.metadata?.expiresAt).toBe(late + SHARE_TTL_SECONDS * 1000);

    // Refreshed, so the next read doesn't write again.
    await loadShare(kv, HASH, late + DAY_MS);
    expect(kv.puts).toEqual([HASH]);
  });

  it('refreshes an entry stored before expiry metadata existed', async () => {
    const kv = fakeKV();
    kv.entries.set(HASH, { value: 'old', metadata: null, ttl: SHARE_TTL_SECONDS });
    expect(await loadShare(kv, HASH, 5)).toBe('old');
    expect(kv.entries.get(HASH)?.metadata).toEqual({ expiresAt: 5 + SHARE_TTL_SECONDS * 1000 });
  });

  it('still returns the source when the refresh write fails', async () => {
    const kv = fakeKV();
    kv.entries.set(HASH, { value: 'src', metadata: null, ttl: SHARE_TTL_SECONDS });
    kv.failPuts = true;
    expect(await loadShare(kv, HASH)).toBe('src');
  });
});

describe('createShare', () => {
  it('stores the source under its hash', async () => {
    vi.stubEnv('DEV', false);
    const kv = fakeKV();
    const hash = await createShare(
      { CIRCUIT_SHARES: kv, SHARE_RL: fakeRateLimiter(), DAILY_BUDGET: fakeBudget() },
      '203.0.113.7',
      'const x = 1;',
    );
    expect(hash).toBe(await hashSource('const x = 1;'));
    expect(kv.entries.get(hash)?.value).toBe('const x = 1;');
  });

  it('stops creating links once the daily cap is reached', async () => {
    vi.stubEnv('DEV', false);
    const kv = fakeKV();
    const env = { CIRCUIT_SHARES: kv, SHARE_RL: fakeRateLimiter(), DAILY_BUDGET: fakeBudget(2) };
    await createShare(env, '203.0.113.7', 'a');
    await createShare(env, '198.51.100.1', 'b');
    await expect(createShare(env, '192.0.2.5', 'c')).rejects.toThrow(/Daily limit/);
    expect(kv.entries.size).toBe(2);
  });

  it('is rate-limited per client', async () => {
    vi.stubEnv('DEV', false);
    const kv = fakeKV();
    const env = { CIRCUIT_SHARES: kv, SHARE_RL: fakeRateLimiter(0), DAILY_BUDGET: fakeBudget() };
    await expect(createShare(env, '203.0.113.7', 'a')).rejects.toThrow(/Rate limit/);
    expect(kv.puts).toEqual([]);
  });

  it('fails closed in a deployed build without its limit bindings', async () => {
    vi.stubEnv('DEV', false);
    const kv = fakeKV();
    await expect(createShare({ CIRCUIT_SHARES: kv }, '203.0.113.7', 'a')).rejects.toThrow(
      'Service unavailable',
    );
    await expect(
      createShare(
        { CIRCUIT_SHARES: kv, SHARE_RL: fakeRateLimiter(), DAILY_BUDGET: fakeBudget() },
        null,
        'a',
      ),
    ).rejects.toThrow(/client address/);
    expect(kv.puts).toEqual([]);
  });
});
