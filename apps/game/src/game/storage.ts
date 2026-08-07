/**
 * Local persistence.
 *
 * A narrow read/write pair over `localStorage`, deliberately small so the
 * storage layer can be swapped for D1 later without every caller learning
 * about it. Three things every caller would otherwise get wrong:
 *
 *   SSR      — this app server-renders, so `window` is not always there.
 *              Reads return the fallback rather than throwing.
 *   parsing  — stored JSON is user-editable and survives deploys, so a parse
 *              failure is expected input, not an exception. Bad data reads as
 *              absent.
 *   version  — every record carries one, so a future format change can be
 *              detected instead of silently misread as the current shape.
 *
 * Keys are namespaced `simten:game:*` because this origin is shared with the
 * theme preference, which is written by an inline script in `__root.tsx`.
 */

const VERSION = 1;

interface Envelope<T> {
  version: number;
  data: T;
}

function isEnvelope<T>(value: unknown): value is Envelope<T> {
  return typeof value === 'object' && value !== null && 'version' in value && 'data' in value;
}

/** Read a stored value. Returns `fallback` when absent, unreadable, or stale. */
export function readStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;

    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope<T>(parsed)) return fallback;
    // A record from a future or older format is not this shape. Ignoring it is
    // safer than coercing it, and the next write replaces it.
    if (parsed.version !== VERSION) return fallback;

    return parsed.data;
  } catch {
    return fallback;
  }
}

/** Write a value. Silently does nothing when storage is unavailable. */
export function writeStored<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const envelope: Envelope<T> = { version: VERSION, data };
    window.localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Private browsing and full quotas both throw here. Losing a preference is
    // not worth breaking the page over.
  }
}

/** Whether the player has already been shown what this is. */
export const INTRO_SEEN_KEY = 'simten:game:intro-seen';
