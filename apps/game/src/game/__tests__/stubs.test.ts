/**
 * Every level stub compiles as the sandbox runs it.
 *
 * A stub is the first thing a player edits, and their saved draft starts as a
 * copy of it, so it names the same components and ports a draft does. If a
 * rename on the frozen surface (decision 0003) breaks a stub, it breaks every
 * draft built from it. Reference solutions get the same check, and more, in
 * `levels.test.ts`.
 */

import { executeCircuitCode } from '@simten/core';
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';

describe('every level stub compiles', () => {
  it.each(LEVELS.map((l) => [l.id, l] as const))('%s', (_id, level) => {
    const result = executeCircuitCode(level.stub);
    expect(result.error).toBeNull();
    expect(result.circuits.map((c) => c.name)).toContain(level.target);
  });
});
