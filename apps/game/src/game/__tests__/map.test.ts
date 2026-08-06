/**
 * The map's drift guard.
 *
 * `MAP_ROWS` names levels by id in a separate file from `LEVELS`, which buys
 * layout freedom and costs the possibility of the two disagreeing. A level
 * added to the campaign but not the map would simply never appear on the map,
 * and nothing at runtime would say so — `buildMapGraph` skips unknown ids
 * rather than crashing the page, which is right for a player and useless for
 * an author. This is where that gets caught instead.
 */

import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { buildMapGraph, MAP_ROWS } from '../map';

const mapped = MAP_ROWS.flat();

describe('the map covers the campaign', () => {
  it('names each level exactly once, with no orphans', () => {
    expect([...mapped].sort()).toEqual(LEVELS.map((l) => l.id).sort());
  });

  it('has no duplicates across rows', () => {
    expect(new Set(mapped).size).toBe(mapped.length);
  });
});

describe('the graph it builds', () => {
  it('gives every level a node', () => {
    const { nodes } = buildMapGraph();
    expect(nodes.map((n) => n.id).sort()).toEqual(LEVELS.map((l) => l.id).sort());
  });

  it('reads bottom to top — the first level sits lowest', () => {
    const { nodes } = buildMapGraph();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const first = byId.get(MAP_ROWS[0][0]);
    const last = byId.get(MAP_ROWS[MAP_ROWS.length - 1][0]);
    if (!first || !last) throw new Error('missing node');
    // React Flow's Y grows downward, so "lower on screen" means larger Y.
    expect(first.position.y).toBeGreaterThan(last.position.y);
  });

  it('connects each row to the one above it', () => {
    const { edges } = buildMapGraph();
    // A linear campaign is a plain chain; clusters fan out, so this is a floor.
    expect(edges.length).toBeGreaterThanOrEqual(MAP_ROWS.length - 1);
    for (const edge of edges) {
      expect(mapped).toContain(edge.source);
      expect(mapped).toContain(edge.target);
    }
  });

  it('marks solved levels and leaves the rest available', () => {
    const { nodes } = buildMapGraph(new Set([LEVELS[0].id]));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(byId.get(LEVELS[0].id)?.data.state).toBe('solved');
    expect(byId.get(LEVELS[1].id)?.data.state).toBe('available');
  });
});
