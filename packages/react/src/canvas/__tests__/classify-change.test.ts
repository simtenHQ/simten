/**
 * What the canvas keeps when the circuit changes: everything on an edit,
 * nothing on a different circuit, and a fresh layout when nodes were only
 * added or only removed.
 */

import { describe, expect, it } from 'vitest';
import { classifyChange, type Shape } from '../classify-change';

/** A shape named `name`, with nodes by id and their pins (`a|b>out`). */
const shape = (name: string | null, pins: Record<string, string> = {}): Shape => ({
  name,
  pins: new Map(Object.entries(pins)),
});

const gates = { a: '>out', b: '>out', g: 'a|b>out', y: 'in>' };

describe('classifyChange', () => {
  it('draws the first circuit as it is', () => {
    expect(classifyChange(shape(null), shape('Top', gates))).toEqual({ kind: 'first' });
  });

  it('starts over for a circuit with a different name', () => {
    expect(classifyChange(shape('Top', gates), shape('Other', gates))).toEqual({
      kind: 'replaced',
    });
  });

  it('starts over when fewer than half the nodes survive, either way round', () => {
    const small = shape('Top', { a: '>out' });
    expect(classifyChange(shape('Top', gates), small).kind).toBe('replaced');
    expect(classifyChange(small, shape('Top', gates)).kind).toBe('replaced');
  });

  it('keeps positions through a rename', () => {
    const renamed = shape('Top', { a: '>out', b: '>out', g: 'a|b>out', z: 'in>' });
    expect(classifyChange(shape('Top', gates), renamed)).toEqual({
      kind: 'edited',
      relayout: false,
      handlesChanged: [],
    });
  });

  it('lays out again when nodes are only added, or only removed', () => {
    const more = shape('Top', { ...gates, c: '>out' });
    expect(classifyChange(shape('Top', gates), more)).toMatchObject({ relayout: true });
    expect(classifyChange(more, shape('Top', gates))).toMatchObject({ relayout: true });
  });

  it('lays out again on every edit with autoLayout', () => {
    expect(classifyChange(shape('Top', gates), shape('Top', gates), true)).toMatchObject({
      kind: 'edited',
      relayout: true,
    });
  });

  it('names the nodes whose pins changed, to measure again', () => {
    const wider = shape('Top', { ...gates, g: 'a|b|c>out' });
    expect(classifyChange(shape('Top', gates), wider)).toMatchObject({ handlesChanged: ['g'] });
  });
});
