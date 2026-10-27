/**
 * Request limits for the container-backed API routes and share links.
 *
 * Each service has a per-client rate limit (a Cloudflare rate-limit binding,
 * per minute) and a global daily budget (the `DailyBudget` Durable Object,
 * one counter per service per UTC day). In a deployed build both bindings are
 * required: if either is missing the request is refused rather than let
 * through. The dev server skips whichever is missing. See `deploy-mode.ts`.
 */

import { isDevServer } from './deploy-mode';

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** The RPC surface of one `DailyBudget` Durable Object. */
export interface BudgetCounter {
  take(limit: number): Promise<boolean>;
}

export interface BudgetNamespace {
  getByName(name: string): BudgetCounter;
}

export interface ServiceFetcher {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}

/** The bindings the API routes use. All optional: see the module comment. */
export interface ApiEnv {
  COMPILE_RL?: RateLimiter;
  VERIFY_RL?: RateLimiter;
  SYNTH_RL?: RateLimiter;
  SHARE_RL?: RateLimiter;
  DAILY_BUDGET?: BudgetNamespace;
  COMPILER?: ServiceFetcher;
  VERIFIER?: ServiceFetcher;
  SYNTH?: ServiceFetcher;
}

type RateLimitBinding = 'COMPILE_RL' | 'VERIFY_RL' | 'SYNTH_RL' | 'SHARE_RL';

/**
 * Per-service limits. The per-minute numbers live on the rate-limit bindings
 * in wrangler.jsonc; the daily budgets are here. `share` counts link creates
 * only; reads are not limited.
 */
export const SERVICES = {
  compile: { rateLimit: 'COMPILE_RL', dailyBudget: 5000 },
  verify: { rateLimit: 'VERIFY_RL', dailyBudget: 2000 },
  synth: { rateLimit: 'SYNTH_RL', dailyBudget: 500 },
  share: { rateLimit: 'SHARE_RL', dailyBudget: 5000 },
} as const satisfies Record<string, { rateLimit: RateLimitBinding; dailyBudget: number }>;

type Service = keyof typeof SERVICES;

interface LimitRejection {
  status: number;
  error: string;
}

const NO_CLIENT: LimitRejection = { status: 400, error: 'Could not determine the client address' };
const NOT_CONFIGURED: LimitRejection = { status: 503, error: 'Service unavailable' };
const RATE_LIMITED: LimitRejection = {
  status: 429,
  error: 'Rate limit exceeded, try again in a minute',
};
const BUDGET_SPENT: LimitRejection = {
  status: 429,
  error: 'Daily limit reached for this service, try again tomorrow',
};

/** Key used for every request on the dev server when no client address is known. */
const DEV_CLIENT_KEY = 'dev';

/**
 * Check and count one request against `service`'s limits. Returns null if the
 * request may go ahead, or the response to send instead.
 *
 * `clientIp` is the `CF-Connecting-IP` header.
 */
export async function checkLimits(
  service: Service,
  clientIp: string | null | undefined,
  env: ApiEnv,
): Promise<LimitRejection | null> {
  const dev = isDevServer();
  const key = clientKey(clientIp) ?? (dev ? DEV_CLIENT_KEY : null);
  if (key === null) return NO_CLIENT;

  const { rateLimit, dailyBudget } = SERVICES[service];
  const limiter = env[rateLimit];
  const budget = env.DAILY_BUDGET;
  if (!dev && (!limiter || !budget)) return NOT_CONFIGURED;

  if (limiter && !(await limiter.limit({ key })).success) return RATE_LIMITED;
  if (budget && !(await budget.getByName(budgetName(service)).take(dailyBudget))) {
    return BUDGET_SPENT;
  }
  return null;
}

/** One counter per service per UTC day, e.g. `compile:2026-10-27`. */
export function budgetName(service: Service, now = new Date()): string {
  return `${service}:${now.toISOString().slice(0, 10)}`;
}

/**
 * Rate-limit key for a client address. IPv4 addresses are used as they are.
 * IPv6 addresses are cut to their /64 prefix, since one client usually holds a
 * whole /64. Returns null for an empty or malformed address.
 */
export function clientKey(ip: string | null | undefined): string | null {
  const raw = ip?.trim().toLowerCase();
  if (!raw) return null;
  if (!raw.includes(':')) return raw;
  const hextets = expandIPv6(raw);
  if (!hextets) return null;
  // An IPv4 client written in IPv6 form (::ffff:a.b.c.d) is still that IPv4 client.
  const mapped = raw.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];
  return `${hextets.slice(0, 4).join(':')}::/64`;
}

/** The eight hextets of an IPv6 address, without leading zeros, or null if malformed. */
function expandIPv6(ip: string): string[] | null {
  const halves = ip.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string) => (part === '' ? [] : part.split(':').flatMap(hextetsOf));
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  const missing = 8 - head.length - tail.length;
  if (head.includes('') || tail.includes('')) return null;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  return [...head, ...Array<string>(missing).fill('0'), ...tail];
}

/** A group is one hextet, or two for a trailing dotted IPv4 part. '' marks a bad group. */
function hextetsOf(group: string): string[] {
  if (group.includes('.')) return ['0', '0'];
  if (!/^[0-9a-f]{1,4}$/.test(group)) return [''];
  return [Number.parseInt(group, 16).toString(16)];
}

// ============================================================================
// Daily budget counter (the body of the DailyBudget Durable Object)
// ============================================================================

/** The slice of Durable Object storage the budget counter uses. */
export interface BudgetStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  setAlarm(scheduledTime: number): Promise<void>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Count one use against a day's budget. Returns false, without counting, once
 * `limit` uses have been counted. The first use schedules an alarm two days
 * out, by which time the day is over and the object's storage can be deleted.
 */
export async function takeFromBudget(
  storage: BudgetStorage,
  limit: number,
  now: number,
): Promise<boolean> {
  const used = (await storage.get<number>('used')) ?? 0;
  if (used >= limit) return false;
  if (used === 0) await storage.setAlarm(now + 2 * DAY_MS);
  await storage.put('used', used + 1);
  return true;
}
