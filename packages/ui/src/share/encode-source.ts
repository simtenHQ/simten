import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

/** For `<circuit-embed>`'s Fork on other sites, which opens `/circuit/<encoded>` rather than create a share. */
export function encodeSourceForUrl(source: string): string {
  return compressToEncodedURIComponent(source);
}

/**
 * Decodes the source from a `/circuit/<encoded>` link: links shared before
 * short links (#368), and Fork from `<circuit-embed>` on other sites.
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
