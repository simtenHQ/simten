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
    const mux4 = level('four-way-multiplexer');
    // The select is s1 s0; the fourth vector picks input 2.
    const pick2 = mux4.vectors.find((v) => v.inputs.s1 === 1 && v.inputs.s0 === 0);
    if (!pick2) throw new Error('expected a vector selecting input 2');
    expect(readNumbers(mux4, pick2)).toBe('s = 2');
  });

  it('adds the negative reading for a signed group', () => {
    const signed: Level = {
      ...level('decoder'),
      inputs: ['n3', 'n2', 'n1', 'n0'],
      outputs: [],
      numbers: { n: 'signed' },
    };
    const vector = { inputs: { n3: 1, n2: 1, n1: 0, n0: 1 }, expect: {} };
    expect(readNumbers(signed, vector)).toBe('n = 13 (-3)');
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
