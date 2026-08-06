/**
 * Best-effort extraction of the first `circuit('Name', ...)` in a source
 * string, for SSR `<title>` / og:title.
 *
 * Brittle on template literals, escaped quotes and multi-line declarations —
 * that is intentional, and callers MUST have a generic fallback for the misses.
 * The scan itself lives in `@simten/core/circuit` so the editor, the game and
 * this share the one implementation.
 */

import { firstCircuitName } from '@simten/core/circuit';

export function extractCircuitName(source: string): string | null {
  try {
    return firstCircuitName(source);
  } catch {
    return null;
  }
}
