import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

export const INLINE_URL_THRESHOLD = 4000;

export function encodeSourceForUrl(source: string): string {
  return compressToEncodedURIComponent(source);
}

export function decodeSourceFromUrl(encoded: string): string | null {
  try {
    return decompressFromEncodedURIComponent(encoded) || null;
  } catch {
    return null;
  }
}

export function shouldUseShortLink(encoded: string): boolean {
  return encoded.length > INLINE_URL_THRESHOLD;
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
