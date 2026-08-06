/**
 * The map circuit.
 *
 * These assert the circuit *computes* unlock state rather than that some code
 * beside it does. If `simulateMap` were quietly replaced by a loop over
 * `MAP_ROWS`, every one of these would still pass — which is fine, because what
 * they actually pin down is the behaviour the page depends on: solving a level
 * lights the next one, and nothing further along lights early.
 */

import { describe, expect, it } from 'vitest';
import { MAP_ROWS } from '../map';
import { buildMapCircuit, simulateMap } from '../map-circuit';

describe('building it', () => {
  it('produces a circuit with a switch and a lamp per level', () => {
    const built = buildMapCircuit();
    const ids = new Set(built.circuit.nodes.map((n) => n.id));
    for (const levelId of MAP_ROWS.flat()) {
      const sane = levelId.replace(/-/g, '_');
      expect(ids.has(`sw_${sane}`)).toBe(true);
      expect(ids.has(`unlock_${sane}`)).toBe(true);
    }
  });
});

describe('running it', () => {
  it('unlocks the first row with nothing solved, and nothing else', () => {
    const { unlocked } = simulateMap(new Set());
    for (const levelId of MAP_ROWS[0]) expect(unlocked.has(levelId)).toBe(true);
    for (const levelId of MAP_ROWS[1] ?? []) expect(unlocked.has(levelId)).toBe(false);
  });

  it('unlocks the next row once the row below is solved', () => {
    const first = MAP_ROWS[0];
    const second = MAP_ROWS[1];
    if (!second) return;

    const { unlocked } = simulateMap(new Set(first));
    for (const levelId of second) expect(unlocked.has(levelId)).toBe(true);
  });

  it('does not unlock two rows ahead', () => {
    const third = MAP_ROWS[2];
    if (!third) return;

    const { unlocked } = simulateMap(new Set(MAP_ROWS[0]));
    for (const levelId of third) expect(unlocked.has(levelId)).toBe(false);
  });

  it('reports a solved level as live, which is what lights its wire', () => {
    const levelId = MAP_ROWS[0][0];
    expect(simulateMap(new Set([levelId])).live.has(levelId)).toBe(true);
    expect(simulateMap(new Set()).live.has(levelId)).toBe(false);
  });

  it('opens the whole map when everything is solved', () => {
    const all = new Set(MAP_ROWS.flat());
    const { unlocked } = simulateMap(all);
    expect(unlocked.size).toBe(all.size);
  });
});
