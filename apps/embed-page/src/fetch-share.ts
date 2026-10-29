/**
 * Loads a share's source for the page, retrying while it may still be
 * publishing.
 *
 * KV is eventually consistent across regions: someone who creates a share and
 * pastes the snippet straight away can load the page before the share has
 * reached the region serving it. A 404 is retried for about a minute before
 * the page calls the share missing.
 */

import { isShareHash } from '@simten/shared/share';

type ShareResult =
  | { kind: 'found'; source: string }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string };

/** Waits between attempts: about a minute in all, the bound on KV propagation. */
export const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000];

interface FetchShareDeps {
  fetch?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Called before each retry, with the retry's number (1-based). */
  onRetry?: (retry: number) => void;
}

const sleepFor = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Attempt = ShareResult | { kind: 'retry'; reason: 'not-found' | 'error'; message?: string };

async function attempt(fetchFn: typeof globalThis.fetch, id: string): Promise<Attempt> {
  let res: Response;
  try {
    res = await fetchFn(`/api/share/${id}`);
  } catch {
    return { kind: 'retry', reason: 'error', message: "Couldn't reach Simten" };
  }
  if (res.status === 200) {
    const body = (await res.json()) as { source?: unknown };
    if (typeof body.source === 'string') return { kind: 'found', source: body.source };
    return { kind: 'error', message: 'Unexpected response' };
  }
  if (res.status === 400) return { kind: 'not-found' };
  if (res.status === 404) return { kind: 'retry', reason: 'not-found' };
  return { kind: 'retry', reason: 'error', message: `Simten answered ${res.status}` };
}

export async function fetchShare(id: string, deps: FetchShareDeps = {}): Promise<ShareResult> {
  const { fetch: fetchFn = globalThis.fetch, sleep = sleepFor, onRetry } = deps;
  if (!isShareHash(id)) return { kind: 'not-found' };

  let last: Attempt = { kind: 'retry', reason: 'not-found' };
  for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
    if (i > 0) {
      onRetry?.(i);
      await sleep(RETRY_DELAYS_MS[i - 1]);
    }
    last = await attempt(fetchFn, id);
    if (last.kind !== 'retry') return last;
  }
  if (last.kind === 'retry' && last.reason === 'error') {
    return { kind: 'error', message: last.message ?? "Couldn't load this circuit" };
  }
  return { kind: 'not-found' };
}
