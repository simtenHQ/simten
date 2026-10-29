/**
 * Share-link storage format: circuit source in a KV namespace, keyed by
 * `hashSource(source)`, with no expiry.
 *
 * Shared by every worker that touches `CIRCUIT_SHARES`: simten.dev creates and
 * reads links, embed.simten.dev only reads them. Keeping the key format and
 * the read here means the two can't drift apart.
 */

const HASH_FORMAT = /^[0-9a-f]{20}$/;

/** The slice of a KV namespace the share store uses. */
export interface ShareKV {
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
}

/** Whether `hash` is one `hashSource` could produce. */
export function isShareHash(hash: unknown): hash is string {
  return typeof hash === 'string' && HASH_FORMAT.test(hash);
}

/** Validates a link's hash; throws if it is not one `hashSource` could produce. */
export function validateShareHash(hash: string): string {
  if (!isShareHash(hash)) throw new Error('invalid hash');
  return hash;
}

/**
 * Stores `source` under `hash` for good. Links are content-addressed, small
 * and capped per day, and an embed on someone's course page must not stop
 * working, so there is no TTL.
 */
export async function saveShare(kv: ShareKV, hash: string, source: string): Promise<void> {
  await kv.put(hash, source);
}

/**
 * The source behind a link, or null if there is none. A read never writes.
 *
 * KV is eventually consistent: a link created a moment ago in another region
 * can read as null here for up to about a minute.
 */
export async function loadShare(kv: ShareKV, hash: string): Promise<string | null> {
  return kv.get(hash);
}
