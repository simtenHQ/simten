/**
 * The storage layer, driven through a fake `window`.
 *
 * The suite runs in the node environment — see `vitest.config.ts` — so there is
 * no `localStorage` and, more usefully, no `window` at all. That is exactly the
 * condition the module's SSR guard exists for, so the absent case is tested by
 * simply not installing the stub.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  clearDraft,
  DRAFTS_KEY,
  PROGRESS_KEY,
  readDrafts,
  readProgress,
  readStored,
  writeDraft,
  writeProgress,
  writeStored,
} from '../storage';

function installStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  return store;
}

afterEach(() => {
  (globalThis as { window?: unknown }).window = undefined;
});

describe('readStored / writeStored', () => {
  it('returns the fallback with no window at all', () => {
    expect(readDrafts()).toEqual({});
    expect(readProgress()).toEqual({});
  });

  it('writing without a window is a no-op rather than a throw', () => {
    expect(() => writeDraft('first-wire', 'x')).not.toThrow();
  });

  it('round-trips through the envelope', () => {
    const store = installStorage();
    writeStored('k', { a: 1 });
    expect(JSON.parse(store.get('k') as string)).toEqual({ version: 1, data: { a: 1 } });
    expect(readStored('k', null)).toEqual({ a: 1 });
  });

  it('reads unparseable, unenveloped and stale records as absent', () => {
    installStorage({
      broken: '{{{',
      bare: '{"gates":2}',
      stale: JSON.stringify({ version: 99, data: { gates: 2 } }),
    });
    expect(readStored('broken', 'fallback')).toBe('fallback');
    expect(readStored('bare', 'fallback')).toBe('fallback');
    expect(readStored('stale', 'fallback')).toBe('fallback');
  });
});

describe('drafts', () => {
  it('stores per level and leaves the others alone', () => {
    installStorage();
    writeDraft('first-wire', 'one');
    writeDraft('not', 'two');
    expect(readDrafts()).toEqual({ 'first-wire': 'one', 'not': 'two' });

    writeDraft('first-wire', 'edited');
    expect(readDrafts()).toEqual({ 'first-wire': 'edited', 'not': 'two' });
  });

  it('clears one level without disturbing the rest', () => {
    installStorage();
    writeDraft('first-wire', 'one');
    writeDraft('not', 'two');
    clearDraft('first-wire');
    expect(readDrafts()).toEqual({ 'not': 'two' });
  });

  it('clearing a level that was never drafted is harmless', () => {
    installStorage();
    clearDraft('first-wire');
    expect(readDrafts()).toEqual({});
  });

  it('uses the documented key', () => {
    const store = installStorage();
    writeDraft('first-wire', 'one');
    expect(store.has(DRAFTS_KEY)).toBe(true);
    expect(DRAFTS_KEY).toBe('simten:game:drafts');
  });
});

describe('progress', () => {
  it('records a gate count per level, latest pass winning', () => {
    installStorage();
    writeProgress('first-wire', { gates: 1 });
    writeProgress('and', { gates: 3 });
    expect(readProgress()).toEqual({ 'first-wire': { gates: 1 }, 'and': { gates: 3 } });

    writeProgress('and', { gates: 2 });
    expect(readProgress()['and']).toEqual({ gates: 2 });
  });

  it('is a separate record from drafts', () => {
    const store = installStorage();
    writeDraft('first-wire', 'source');
    writeProgress('first-wire', { gates: 1 });
    expect(store.get(PROGRESS_KEY)).not.toContain('source');
    expect(PROGRESS_KEY).toBe('simten:game:progress');
  });

  it('carries no source — the map needs a flag and a score, nothing more', () => {
    installStorage();
    writeProgress('first-wire', { gates: 1 });
    expect(Object.keys(readProgress()['first-wire'])).toEqual(['gates']);
  });

  // What the map page does with it.
  it('yields the solved set the map reads', () => {
    installStorage();
    writeProgress('first-wire', { gates: 1 });
    writeProgress('not', { gates: 1 });
    expect(new Set(Object.keys(readProgress()))).toEqual(new Set(['first-wire', 'not']));
  });
});
