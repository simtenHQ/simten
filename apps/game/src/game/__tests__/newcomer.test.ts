/**
 * The newcomer redirect, run as the browser runs it: the inline string,
 * evaluated against fake globals, with `location.replace` recording where it
 * would have gone.
 */

import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { NEWCOMER_REDIRECT_SCRIPT } from '../newcomer';
import { LEGACY_INTRO_SEEN_KEY, ONBOARDED_KEY, PROGRESS_KEY, VERSION } from '../storage';

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

interface Visit {
  path?: string;
  search?: string;
  desktop?: boolean;
  userAgent?: string;
  webdriver?: boolean;
  stored?: Record<string, unknown>;
  raw?: Record<string, string>;
  blocked?: boolean;
}

function envelope(data: unknown) {
  return JSON.stringify({ version: VERSION, data });
}

/** Where the script sends this visit, or `null` when it leaves it on the map. */
function run(visit: Visit = {}): string | null {
  let target: string | null = null;
  const store = new Map<string, string>(Object.entries(visit.raw ?? {}));
  for (const [k, v] of Object.entries(visit.stored ?? {})) store.set(k, envelope(v));

  const location = {
    pathname: visit.path ?? '/',
    search: visit.search ?? '',
    hash: '',
    replace: (to: string) => {
      target = to;
    },
  };
  const navigator = {
    userAgent: visit.userAgent ?? DESKTOP_UA,
    webdriver: visit.webdriver ?? false,
  };
  const matchMedia = () => ({ matches: visit.desktop ?? true });
  const localStorage = {
    getItem: (k: string) => {
      if (visit.blocked) throw new Error('SecurityError');
      return store.get(k) ?? null;
    },
  };

  new Function('location', 'navigator', 'matchMedia', 'localStorage', NEWCOMER_REDIRECT_SCRIPT)(
    location,
    navigator,
    matchMedia,
    localStorage,
  );
  return target;
}

const [first, second] = LEVELS;

describe('newcomer redirect', () => {
  it('sends a first visit on desktop to the first level', () => {
    expect(run()).toBe(`/${first.id}`);
  });

  it('keeps the query string, so campaign links still attribute', () => {
    expect(run({ search: '?ref=reddit' })).toBe(`/${first.id}?ref=reddit`);
  });

  it('skips levels already solved', () => {
    expect(run({ stored: { [PROGRESS_KEY]: { [first.id]: { gates: 1 } } } })).toBe(`/${second.id}`);
  });

  it('leaves onboarded players on the map', () => {
    expect(run({ stored: { [ONBOARDED_KEY]: true } })).toBeNull();
    expect(run({ stored: { [LEGACY_INTRO_SEEN_KEY]: true } })).toBeNull();
  });

  it('leaves phones on the map', () => {
    expect(run({ desktop: false })).toBeNull();
  });

  it('only runs on the map', () => {
    expect(run({ path: `/${second.id}` })).toBeNull();
  });

  it('never redirects crawlers or automation', () => {
    expect(run({ userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)' })).toBeNull();
    expect(run({ userAgent: `${DESKTOP_UA} Chrome-Lighthouse` })).toBeNull();
    expect(run({ webdriver: true })).toBeNull();
  });

  it('reads a corrupt or old-version record as absent, like readStored', () => {
    expect(run({ raw: { [ONBOARDED_KEY]: '{not json' } })).toBe(`/${first.id}`);
    expect(run({ raw: { [ONBOARDED_KEY]: JSON.stringify({ version: 0, data: true }) } })).toBe(
      `/${first.id}`,
    );
  });

  it('stays on the map when storage is blocked', () => {
    expect(run({ blocked: true })).toBeNull();
  });
});
