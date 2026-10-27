import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type ApiEnv,
  type BudgetStorage,
  budgetName,
  checkLimits,
  clientKey,
  SERVICES,
  takeFromBudget,
} from '../limits';
import { callService } from '../service';
import { fakeBudget, fakeRateLimiter } from './fakes';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const deployed = () => vi.stubEnv('DEV', false);

describe('clientKey', () => {
  it('uses an IPv4 address as it is', () => {
    expect(clientKey('203.0.113.7')).toBe('203.0.113.7');
  });

  it('cuts IPv6 addresses to their /64', () => {
    expect(clientKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1:2::/64');
    expect(clientKey('2001:db8:1:2::1')).toBe('2001:db8:1:2::/64');
    expect(clientKey('2001:DB8:0001:0002:0:0:0:9')).toBe('2001:db8:1:2::/64');
  });

  it('gives every address in one /64 the same key', () => {
    expect(clientKey('2001:db8::1')).toBe(clientKey('2001:db8:0:0:ffff::2'));
    expect(clientKey('2001:db8::1')).not.toBe(clientKey('2001:db8:0:1::1'));
  });

  it('expands :: anywhere in the address', () => {
    expect(clientKey('::1')).toBe('0:0:0:0::/64');
    expect(clientKey('fe80::')).toBe('fe80:0:0:0::/64');
  });

  it('treats an IPv4-mapped address as the IPv4 client', () => {
    expect(clientKey('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('returns null for a missing or malformed address', () => {
    expect(clientKey(null)).toBeNull();
    expect(clientKey(undefined)).toBeNull();
    expect(clientKey('  ')).toBeNull();
    expect(clientKey('1::2::3')).toBeNull();
    expect(clientKey('1:2:3:4:5:6:7:8:9')).toBeNull();
    expect(clientKey('12345::1')).toBeNull();
    expect(clientKey('1:2:3')).toBeNull();
  });
});

describe('checkLimits', () => {
  it('lets a request through and counts it on both limits', async () => {
    deployed();
    const limiter = fakeRateLimiter();
    const budget = fakeBudget();
    const env: ApiEnv = { COMPILE_RL: limiter, DAILY_BUDGET: budget };

    expect(await checkLimits('compile', '203.0.113.7', env)).toBeNull();
    expect(limiter.keys).toEqual(['203.0.113.7']);
    expect(budget.taken).toEqual([{ name: budgetName('compile'), limit: 5000 }]);
  });

  it('keys the rate limit on the /64 for IPv6 clients', async () => {
    deployed();
    const limiter = fakeRateLimiter();
    await checkLimits('verify', '2001:db8:1:2::99', {
      VERIFY_RL: limiter,
      DAILY_BUDGET: fakeBudget(),
    });
    expect(limiter.keys).toEqual(['2001:db8:1:2::/64']);
  });

  it('rejects with 429 when the rate limit is spent', async () => {
    deployed();
    const budget = fakeBudget();
    const rejected = await checkLimits('synth', '203.0.113.7', {
      SYNTH_RL: fakeRateLimiter(0),
      DAILY_BUDGET: budget,
    });
    expect(rejected?.status).toBe(429);
    expect(rejected?.error).toMatch(/in a minute/);
    // A request turned away per-client doesn't use up the global budget.
    expect(budget.taken).toEqual([]);
  });

  it('rejects with 429 when the daily budget is spent', async () => {
    deployed();
    const rejected = await checkLimits('share', '203.0.113.7', {
      SHARE_RL: fakeRateLimiter(),
      DAILY_BUDGET: fakeBudget(0),
    });
    expect(rejected?.status).toBe(429);
    expect(rejected?.error).toMatch(/Daily limit/);
  });

  it('gives each service its own daily budget', async () => {
    deployed();
    const budget = fakeBudget();
    for (const service of Object.keys(SERVICES) as Array<keyof typeof SERVICES>) {
      const limiter = fakeRateLimiter();
      await checkLimits(service, '203.0.113.7', {
        [SERVICES[service].rateLimit]: limiter,
        DAILY_BUDGET: budget,
      });
    }
    expect(new Set(budget.taken.map((t) => t.name)).size).toBe(4);
  });

  it('fails closed in a deployed build when a binding is missing', async () => {
    deployed();
    expect(
      await checkLimits('compile', '203.0.113.7', { DAILY_BUDGET: fakeBudget() }),
    ).toMatchObject({ status: 503 });
    expect(
      await checkLimits('compile', '203.0.113.7', { COMPILE_RL: fakeRateLimiter() }),
    ).toMatchObject({ status: 503 });
  });

  it('rejects a request with no client address in a deployed build', async () => {
    deployed();
    const limiter = fakeRateLimiter();
    const rejected = await checkLimits('compile', null, {
      COMPILE_RL: limiter,
      DAILY_BUDGET: fakeBudget(),
    });
    expect(rejected?.status).toBe(400);
    expect(limiter.keys).toEqual([]);
  });

  it('skips missing bindings and a missing address on the dev server', async () => {
    vi.stubEnv('DEV', true);
    expect(await checkLimits('compile', null, {})).toBeNull();
    const limiter = fakeRateLimiter();
    expect(await checkLimits('compile', undefined, { COMPILE_RL: limiter })).toBeNull();
    expect(limiter.keys).toEqual(['dev']);
  });
});

describe('budgetName', () => {
  it('is one counter per service per UTC day', () => {
    expect(budgetName('verify', new Date('2026-10-27T23:59:59Z'))).toBe('verify:2026-10-27');
    expect(budgetName('verify', new Date('2026-10-28T00:00:00Z'))).toBe('verify:2026-10-28');
  });
});

describe('takeFromBudget', () => {
  function memoryStorage(): BudgetStorage & { alarms: number[]; data: Map<string, unknown> } {
    const data = new Map<string, unknown>();
    const alarms: number[] = [];
    return {
      data,
      alarms,
      get: async <T>(key: string) => data.get(key) as T | undefined,
      put: async <T>(key: string, value: T) => {
        data.set(key, value);
      },
      setAlarm: async (time: number) => {
        alarms.push(time);
      },
    };
  }

  it('counts up to the limit and then refuses', async () => {
    const storage = memoryStorage();
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await takeFromBudget(storage, 3, 0));
    expect(results).toEqual([true, true, true, false]);
    expect(storage.data.get('used')).toBe(3);
  });

  it('schedules its own cleanup once, after the day is over', async () => {
    const storage = memoryStorage();
    await takeFromBudget(storage, 10, 1000);
    await takeFromBudget(storage, 10, 2000);
    expect(storage.alarms).toEqual([1000 + 2 * 24 * 60 * 60 * 1000]);
  });
});

describe('callService', () => {
  const init: RequestInit = { method: 'POST', body: '{}' };

  it('uses the binding when there is one', async () => {
    const fetchSpy = vi.fn(async () => new Response('local'));
    vi.stubGlobal('fetch', fetchSpy);
    const binding = { fetch: vi.fn(async () => new Response('bound')) };
    deployed();
    const res = await callService(binding, 'https://svc/x', 'http://localhost:1/x', init);
    expect(await res.text()).toBe('bound');
    expect(binding.fetch).toHaveBeenCalledWith('https://svc/x', init);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to localhost only on the dev server', async () => {
    const fetchSpy = vi.fn(async () => new Response('local'));
    vi.stubGlobal('fetch', fetchSpy);

    vi.stubEnv('DEV', true);
    const res = await callService(undefined, 'https://svc/x', 'http://localhost:1/x', init);
    expect(await res.text()).toBe('local');

    deployed();
    await expect(
      callService(undefined, 'https://svc/x', 'http://localhost:1/x', init),
    ).rejects.toThrow(/not configured/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
