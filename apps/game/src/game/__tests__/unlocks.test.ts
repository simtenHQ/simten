import { describe, expect, it } from 'vitest';
import { gatesGainedAfter, LEVELS_BY_ID, nextLevel } from '../levels';
import type { Level } from '../types';

function level(id: string): Level {
  const found = LEVELS_BY_ID.get(id);
  if (!found) throw new Error(`missing level ${id}`);
  return found;
}

const gainedAfter = (id: string) => gatesGainedAfter(level(id), nextLevel(id));

describe('gatesGainedAfter', () => {
  it('announces a gate the first time the campaign allows it', () => {
    expect(gainedAfter('nand')).toEqual(['Nand']);
    expect(gainedAfter('xor')).toEqual(['Xor']);
    expect(gainedAfter('d-latch')).toEqual(['DFlipFlop']);
  });

  it('announces nothing when the next level only hands back gates already earned', () => {
    // The counter is followed by the multiplexer, which allows every logic
    // gate. The player has held those since the gate levels.
    expect(gainedAfter('counter')).toEqual([]);
  });
});
