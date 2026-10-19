import { describe, expect, it } from 'vitest';
import { LEVELS, LEVELS_BY_ID } from '../levels';
import { givenParts } from '../parts';

function parts(id: string): string[] {
  const level = LEVELS_BY_ID.get(id);
  if (!level) throw new Error(`missing level ${id}`);
  return givenParts(level);
}

describe('givenParts', () => {
  it('lists the parts a stub hands over, in order', () => {
    expect(parts('full-adder')).toEqual(['HalfAdder']);
    expect(parts('arithmetic-logic-unit')).toEqual([
      'Mux2',
      'Mux4',
      'HalfAdder',
      'FullAdder',
      'Invert4',
      'Adder4',
      'Subtract4',
    ]);
  });

  it('leaves out a part the player is meant to finish', () => {
    expect(parts('load')).not.toContain('Control');
    expect(parts('load')).toContain('Instruction');
    // Carried over from the last level, so not empty, but still theirs.
    expect(parts('jump')).not.toContain('Control');
  });

  it('lists nothing when the stub only holds the circuit to write', () => {
    expect(parts('nand')).toEqual([]);
    // The counter's stub defines its target with `const` rather than
    // `export default`; that is the player's circuit, not a part.
    expect(parts('counter')).toEqual([]);
  });

  it('never lists a level its own target', () => {
    for (const level of LEVELS) expect(givenParts(level)).not.toContain(level.target);
  });
});
