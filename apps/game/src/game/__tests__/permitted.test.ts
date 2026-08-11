/**
 * The editor, the canvas and the grader must permit exactly the same set.
 *
 * They used to compose `allowed ∪ STRUCTURAL` separately — the editor built its
 * ambient globals from one copy, the grader checked the netlist against another.
 * Two copies of a rule is how you get a level that autocompletes a gate and then
 * rejects it on Submit. `permittedFor` is now the only definition; this pins it.
 */

import { describe, expect, it } from 'vitest';
import { forbiddenPrimitives, permittedFor, STRUCTURAL } from '../grade';
import { LEVELS } from '../levels';

describe('permittedFor', () => {
  it('is the level gates plus the structural pieces, for every level', () => {
    for (const level of LEVELS) {
      expect(new Set(permittedFor(level.allowed))).toEqual(
        new Set([...level.allowed, ...STRUCTURAL]),
      );
    }
  });

  it('never omits a gate the level names', () => {
    for (const level of LEVELS) {
      for (const gate of level.allowed) expect(permittedFor(level.allowed)).toContain(gate);
    }
  });

  /**
   * The property that matters: anything the editor puts in scope must survive
   * the grader. If these drift, a player writes something the editor offered
   * and Submit refuses it — with no way to tell which is right.
   */
  it('accepts every primitive the editor puts in scope', () => {
    for (const level of LEVELS) {
      const flat = {
        nodes: permittedFor(level.allowed).map((primitiveType, i) => ({
          id: `n${i}`,
          primitiveType,
        })),
      };
      expect(forbiddenPrimitives(flat as never, level.allowed)).toEqual([]);
    }
  });

  it('rejects a primitive no level named', () => {
    const level = LEVELS[0];
    const flat = { nodes: [{ id: 'n0', primitiveType: 'Not' }] };
    expect(forbiddenPrimitives(flat as never, level.allowed)).toEqual(['Not']);
  });

  it('exempts structural nodes without naming them in allowed', () => {
    const flat = {
      nodes: [...STRUCTURAL].map((primitiveType, i) => ({ id: `n${i}`, primitiveType })),
    };
    expect(forbiddenPrimitives(flat as never, [])).toEqual([]);
  });
});
