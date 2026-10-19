import { describe, expect, it } from 'vitest';
import { LEVELS, LEVELS_BY_ID } from '../levels';
import { readNumbers } from '../numbers';
import type { Level } from '../types';

function level(id: string): Level {
  const found = LEVELS_BY_ID.get(id);
  if (!found) throw new Error(`missing level ${id}`);
  return found;
}

describe('readNumbers', () => {
  it('reads each group most significant bit first', () => {
    const adder = level('adder-4');
    // Third in the list: 5 + 3.
    const fivePlusThree = adder.vectors[2];
    expect(readNumbers(adder, fivePlusThree)).toBe('a = 5, b = 3, s = 8');
  });

  it('adds the negative reading for a signed group', () => {
    const negate = level('negate');
    const three = negate.vectors[3];
    expect(readNumbers(negate, three)).toBe('a = 3, n = 13 (-3)');
  });

  it('says nothing for a level without numbers', () => {
    const mux = level('multiplexer');
    expect(readNumbers(mux, mux.vectors[0])).toBeNull();
  });

  it('only names groups that exist on the level', () => {
    for (const l of LEVELS) {
      for (const prefix of Object.keys(l.numbers ?? {})) {
        expect(
          [...l.inputs, ...l.outputs].some((name) => new RegExp(`^${prefix}\\d+$`).test(name)),
        ).toBe(true);
      }
    }
  });
});
