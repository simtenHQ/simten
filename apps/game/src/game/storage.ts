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

/**
 * Levels whose one-time explainer has been shown.
 *
 * Separate from `INTRO_SEEN_KEY`, which is the whole game's front door. This is
 * per level and per concept: a band that introduces something the player has
 * never met — a clock, say — says so once and then stops.
 */
export const LEVEL_INTROS_KEY = 'simten:game:level-intros-seen';

/** Every level's editor contents, whether or not it has ever passed. */
export const DRAFTS_KEY = 'simten:game:drafts';

/** Every level that has passed, and what it cost. */
export const PROGRESS_KEY = 'simten:game:progress';

/** What a solved level records. */
export interface LevelProgress {
  gates: number;
}

export type Drafts = Record<string, string>;
export type Progress = Record<string, LevelProgress>;

/**
 * Two records, not one, because they are different kinds of data.
 *
 * A draft is whatever is in the editor — mid-thought, broken, or finished. It
 * exists so a refresh does not cost you your work. Progress is a flag and a
 * score: it is what the map's green nodes, the lit wires, `ENFORCE_LOCKING`
 * and the completion card read, and none of them need a line of source.
 *
 * Progress deliberately holds no source yet. Nothing would read it — no level
 * imports another level's circuit today, since the full adder's half adder
 * lives in its own stub. When composition lands, `LevelProgress` gains the
 * source that last *passed*, and downstream levels read that rather than the
 * draft: otherwise going back and mangling a solved circuit breaks a later
 * level, with an error pointing at code you are not looking at.
 *
 * Both are stored as one record per key rather than a key per level. The whole
 * map is read on every page anyway, and a single envelope means one version
 * number to migrate rather than one per level.
 */
export function readDrafts(): Drafts {
  return readStored<Drafts>(DRAFTS_KEY, {});
}

/** Store one level's editor contents, leaving every other level alone. */
export function writeDraft(levelId: string, source: string): void {
  writeStored<Drafts>(DRAFTS_KEY, { ...readDrafts(), [levelId]: source });
}

/** Forget one level's draft, so it opens from its stub again. */
export function clearDraft(levelId: string): void {
  const drafts = readDrafts();
  delete drafts[levelId];
  writeStored<Drafts>(DRAFTS_KEY, drafts);
}

/** Level ids whose explainer has already been shown. */
export function readSeenIntros(): string[] {
  const seen = readStored<string[]>(LEVEL_INTROS_KEY, []);
  return Array.isArray(seen) ? seen : [];
}

/** Record that a level's explainer has been shown. Idempotent. */
export function markIntroSeen(levelId: string): void {
  const seen = readSeenIntros();
  if (seen.includes(levelId)) return;
  writeStored(LEVEL_INTROS_KEY, [...seen, levelId]);
}

export function readProgress(): Progress {
  return readStored<Progress>(PROGRESS_KEY, {});
}

/**
 * Record a pass. The latest one wins rather than the cheapest — the score
 * describes the circuit you have, and a player who refactors to something
 * slower should see that rather than a number they can no longer reproduce.
 */
export function writeProgress(levelId: string, entry: LevelProgress): void {
  writeStored<Progress>(PROGRESS_KEY, { ...readProgress(), [levelId]: entry });
}
