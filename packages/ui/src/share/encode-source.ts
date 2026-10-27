import { decompressFromEncodedURIComponent } from 'lz-string';

/**
 * Decodes the source from a `/circuit/<encoded>` link. Share links have been
 * short (`/circuit/s/<hash>`) since #368; this stays so links shared before
 * then keep opening.
 */
export function decodeSourceFromUrl(encoded: string): string | null {
  try {
    return decompressFromEncodedURIComponent(encoded) || null;
  } catch {
    return null;
  }
}

/**
 * 10 bytes (80 bits) of SHA-256, hex-encoded → 20-char key.
 *
 * Content-addressed: identical sources collapse to one key, so re-sharing
 * the same circuit is idempotent and `put` is a safe overwrite-with-same-value.
 * Birthday collisions are actuarially impossible at any plausible scale.
 */
export async function hashSource(source: string): Promise<string> {
  const buf = new TextEncoder().encode(source);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest).slice(0, 10))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
