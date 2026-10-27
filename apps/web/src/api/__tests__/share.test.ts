import { hashSource, type ShareKV } from '@simten/ui/share';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiEnv } from '../limits';
import { handleApiRoute } from '../routes';
import { fakeBudget, fakeRateLimiter } from './fakes';

afterEach(() => vi.unstubAllEnvs());

function fakeKV(): ShareKV & { entries: Map<string, string> } {
  const entries = new Map<string, string>();
  return {
    entries,
    async put(key, value) {
      entries.set(key, value);
    },
    async get(key) {
      return entries.get(key) ?? null;
    },
  };
}

function share(body: unknown, origin = 'https://someones-course.example') {
  return new Request('https://simten.dev/api/share', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.7',
      Origin: origin,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function env(overrides: Partial<ApiEnv> = {}): ApiEnv & { CIRCUIT_SHARES: ShareKV } {
  return {
    CIRCUIT_SHARES: fakeKV(),
    SHARE_RL: fakeRateLimiter(),
    DAILY_BUDGET: fakeBudget(),
    ...overrides,
  } as ApiEnv & { CIRCUIT_SHARES: ShareKV };
}

describe('/api/share', () => {
  it('answers a CORS preflight from any origin', async () => {
    const res = await handleApiRoute(
      new Request('https://simten.dev/api/share', { method: 'OPTIONS' }),
      {},
    );
    expect(res?.status).toBe(204);
    expect(res?.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res?.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
  });

  it('creates a link and returns its hash, readable cross-origin', async () => {
    vi.stubEnv('DEV', false);
    const e = env();
    const res = await handleApiRoute(share({ source: 'const x = 1;' }), e);
    expect(res?.status).toBe(200);
    expect(res?.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const { hash } = (await res?.json()) as { hash: string };
    expect(hash).toBe(await hashSource('const x = 1;'));
    expect(await e.CIRCUIT_SHARES.get(hash)).toBe('const x = 1;');
  });

  it('applies the share limits, with CORS headers on the refusal', async () => {
    vi.stubEnv('DEV', false);
    const res = await handleApiRoute(share({ source: 'a' }), env({ SHARE_RL: fakeRateLimiter(0) }));
    expect(res?.status).toBe(429);
    expect(res?.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('rejects bad input with 400', async () => {
    vi.stubEnv('DEV', false);
    for (const body of ['{not json', { source: 42 }, { source: 'a'.repeat(100_001) }]) {
      const res = await handleApiRoute(share(body), env());
      expect(res?.status).toBe(400);
    }
  });

  it('is unavailable without the KV binding', async () => {
    vi.stubEnv('DEV', false);
    const res = await handleApiRoute(share({ source: 'a' }), {
      SHARE_RL: fakeRateLimiter(),
      DAILY_BUDGET: fakeBudget(),
    });
    expect(res?.status).toBe(503);
  });
});
