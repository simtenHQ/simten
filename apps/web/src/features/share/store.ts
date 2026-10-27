/**
 * Share-link storage: circuit source in KV, keyed by content hash.
 *
 * Kept apart from the server functions in `server.ts` so it can be tested with
 * fake bindings.
 */

import { hashSource } from '@simten/ui/share';
import { type ApiEnv, checkLimits } from '../../api/limits';

/** A link lives this long after it is created or last refreshed. */
export const SHARE_TTL_SECONDS = 60 * 60 * 24 * 365 * 2;

/**
 * A read refreshes the TTL only once less than this much is left, so an
 * active link costs one KV write a year instead of one per view.
 */
export const REFRESH_BELOW_SECONDS = 60 * 60 * 24 * 365;

/** Largest source accepted, in UTF-8 bytes. */
export const MAX_SOURCE_BYTES = 100_000;

const HASH_FORMAT = /^[0-9a-f]{20}$/;

/** Stored with each entry so a read can tell how long the entry has left. */
export interface ShareMetadata {
  /** Epoch milliseconds when KV will drop the entry. */
  expiresAt: number;
}

/** The slice of a KV namespace the share store uses. */
export interface ShareKV {
  put(
    key: string,
    value: string,
    options: { expirationTtl: number; metadata: ShareMetadata },
  ): Promise<void>;
  getWithMetadata<M>(key: string): Promise<{ value: string | null; metadata: M | null }>;
}

export function sourceBytes(source: string): number {
  return new TextEncoder().encode(source).byteLength;
}

/**
 * Validates a create request's input; throws with a short message if it is
 * unusable. Typed for the caller, but checked as if it could be anything,
 * since it arrives over the network.
 */
export function validateShareInput(data: { source: string }): { source: string } {
  const source: unknown = data?.source;
  if (typeof source !== 'string') throw new Error('invalid source');
  if (sourceBytes(source) > MAX_SOURCE_BYTES) throw new Error('source too large');
  return { source };
}

/** Validates a link's hash; throws if it is not one `hashSource` could produce. */
export function validateShareHash(hash: string): string {
  if (typeof hash !== 'string' || !HASH_FORMAT.test(hash)) throw new Error('invalid hash');
  return hash;
}

/**
 * Store `source` and return its hash. Counts against the share rate limit and
 * daily budget; throws with the rejection's message when over either.
 */
export async function createShare(
  env: ApiEnv & { CIRCUIT_SHARES: ShareKV },
  clientIp: string | null | undefined,
  source: string,
): Promise<string> {
  const rejected = await checkLimits('share', clientIp, env);
  if (rejected) throw new Error(rejected.error);
  const hash = await hashSource(source);
  await saveShare(env.CIRCUIT_SHARES, hash, source);
  return hash;
}

export async function saveShare(
  kv: ShareKV,
  hash: string,
  source: string,
  now = Date.now(),
): Promise<void> {
  await kv.put(hash, source, {
    expirationTtl: SHARE_TTL_SECONDS,
    metadata: { expiresAt: now + SHARE_TTL_SECONDS * 1000 },
  });
}

/**
 * The source behind a link, or null if there is none. Refreshes the TTL when
 * the entry is in its last `REFRESH_BELOW_SECONDS`, or when it predates the
 * expiry metadata.
 */
export async function loadShare(
  kv: ShareKV,
  hash: string,
  now = Date.now(),
): Promise<string | null> {
  const { value, metadata } = await kv.getWithMetadata<ShareMetadata>(hash);
  if (value === null) return null;
  const expiresAt = metadata?.expiresAt;
  if (typeof expiresAt !== 'number' || expiresAt - now < REFRESH_BELOW_SECONDS * 1000) {
    // Best effort: reads at other edge locations can race this one to the same
    // refresh, and KV turns down a second write to a key within a second. The
    // entry is still there either way.
    await saveShare(kv, hash, value, now).catch(() => undefined);
  }
  return value;
}
