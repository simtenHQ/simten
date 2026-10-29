import { hashSource, loadShare, type ShareKV } from '@simten/react/share';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBudget, fakeRateLimiter } from '../../../api/__tests__/fakes';
import { createShare, MAX_SOURCE_BYTES, sourceBytes, validateShareInput } from '../store';

afterEach(() => vi.unstubAllEnvs());

/** In-memory CIRCUIT_SHARES that records every write and its options. */
function fakeKV(): ShareKV & {
  entries: Map<string, string>;
  puts: Array<{ key: string; options: unknown }>;
} {
  const entries = new Map<string, string>();
  const kv = {
    entries,
    puts: [] as Array<{ key: string; options: unknown }>,
    async put(key: string, value: string, options?: unknown) {
      kv.puts.push({ key, options });
      entries.set(key, value);
    },
    async get(key: string) {
      return entries.get(key) ?? null;
    },
  };
  return kv;
}

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
    expect(kv.entries.get(hash)).toBe('const x = 1;');
  });

  it('stores links with no expiry, and reading one never writes', async () => {
    vi.stubEnv('DEV', false);
    const kv = fakeKV();
    const env = { CIRCUIT_SHARES: kv, SHARE_RL: fakeRateLimiter(), DAILY_BUDGET: fakeBudget() };
    const hash = await createShare(env, '203.0.113.7', 'src');
    expect(kv.puts).toEqual([{ key: hash, options: undefined }]);
    for (let i = 0; i < 3; i++) expect(await loadShare(kv, hash)).toBe('src');
    expect(kv.puts).toHaveLength(1);
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
