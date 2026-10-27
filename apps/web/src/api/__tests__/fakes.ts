/** In-memory stand-ins for the Cloudflare bindings the API routes use. */

import type { BudgetNamespace, RateLimiter } from '../limits';

/** A rate limiter that allows `allowed` requests in total and records each key. */
export function fakeRateLimiter(allowed = Number.POSITIVE_INFINITY): RateLimiter & {
  keys: string[];
} {
  const keys: string[] = [];
  return {
    keys,
    async limit({ key }) {
      keys.push(key);
      return { success: keys.length <= allowed };
    },
  };
}

/**
 * A DAILY_BUDGET namespace whose counters allow `allowed` uses each, on top of
 * whatever limit the caller passes. Records every successful take.
 */
export function fakeBudget(allowed = Number.POSITIVE_INFINITY): BudgetNamespace & {
  taken: Array<{ name: string; limit: number }>;
} {
  const taken: Array<{ name: string; limit: number }> = [];
  const used = new Map<string, number>();
  return {
    taken,
    getByName(name) {
      return {
        async take(limit) {
          const count = used.get(name) ?? 0;
          if (count >= Math.min(limit, allowed)) return false;
          used.set(name, count + 1);
          taken.push({ name, limit });
          return true;
        },
      };
    },
  };
}
