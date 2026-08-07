/**
 * Which stubs open with a component the player did not write.
 *
 * The rule is structural rather than a per-level flag, so it needs pinning
 * against the real stubs: a comment block is instructions and must stay
 * visible, a circuit above the target is scenery and should be scrolled past.
 */

import { describe, expect, it } from 'vitest';
import { givenPreambleEnd } from '../../routes/play.$levelId';
import { LEVELS } from '../levels';

describe('given-preamble detection', () => {
  it('skips only the levels that hand over a component', () => {
    const skipped = LEVELS.filter((l) => givenPreambleEnd(l.stub.split('\n')) !== null).map(
      (l) => l.id,
    );
    expect(skipped).toEqual(['full-adder']);
  });

  it('leaves instruction comments visible', () => {
    // Every other stub opens with the hint; scrolling past it would hide it.
    const orLevel = LEVELS.find((l) => l.id === 'or-from-nand');
    if (!orLevel) throw new Error('missing level');
    expect(givenPreambleEnd(orLevel.stub.split('\n'))).toBeNull();
  });

  it('points at the line after the target circuit opens', () => {
    const full = LEVELS.find((l) => l.id === 'full-adder');
    if (!full) throw new Error('missing level');
    const lines = full.stub.split('\n');
    const at = givenPreambleEnd(lines);
    if (at === null) throw new Error('expected a preamble');
    expect(lines[at - 1]).toContain("export default circuit('FullAdder'");
  });
});
