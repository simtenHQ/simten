/**
 * Creating share links: the limits around the write. The storage format, and
 * the read that embed.simten.dev shares with this app, are in `@simten/ui/share`.
 *
 * Kept apart from the server functions in `server.ts` so it can be tested with
 * fake bindings.
 */

import { hashSource, type ShareKV, saveShare } from '@simten/ui/share';
import { type ApiEnv, checkLimits } from '../../api/limits';

/** Largest source accepted, in UTF-8 bytes. */
export const MAX_SOURCE_BYTES = 100_000;

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

/**
 * Store `source` and return its hash. Counts against the share rate limit and
 * daily budget; throws with the rejection's message when over either. The
 * link never expires.
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
