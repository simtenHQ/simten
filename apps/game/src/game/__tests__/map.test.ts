/**
 * The map's drift guard.
 *
 * `MAP_ROWS` names levels by id in a separate file from `LEVELS`, which buys
 * layout freedom and costs the possibility of the two disagreeing. A level
 * added to the campaign but not the map would simply never appear on the map,
 * and nothing at runtime would say so; `buildMapGraph` skips unknown ids
 * rather than crashing the page, which is right for a player and useless for
 * an author. This is where that gets caught instead.
 */

import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { buildMapGraph, MAP_COLUMNS, MAP_ROWS, NODE_WIDTH } from '../map';

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

  it('reads bottom to top, and the first level sits lowest', () => {
    const { nodes } = buildMapGraph();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const first = byId.get(MAP_ROWS[0][0]);
    const last = byId.get(MAP_ROWS[MAP_ROWS.length - 1][0]);
    if (!first || !last) throw new Error('missing node');
    // React Flow's Y grows downward, so "lower on screen" means larger Y.
    expect(first.position.y).toBeGreaterThan(last.position.y);
  });

  it('centres every row on x = 0, measuring from node middles', () => {
    // Positions are top-left corners, so a row is centred when the midpoint of
    // its outermost nodes' centres is zero. Getting this wrong shifts the whole
    // map half a card to the right, which reads as "the camera is off".
    const { nodes } = buildMapGraph();
    const byId = new Map(nodes.map((n) => [n.id, n]));

    const centreOf = (id: string) => {
      const node = byId.get(id);
      return node === undefined ? undefined : node.position.x + NODE_WIDTH / 2;
    };
    const balanced = (ids: string[]) => {
      const centres = ids.map(centreOf).filter((x) => x !== undefined);
      return (Math.min(...centres) + Math.max(...centres)) / 2;
    };

    for (const row of MAP_ROWS.filter((r) => r.every((id) => !(id in MAP_COLUMNS)))) {
      expect(balanced(row)).toBeCloseTo(0);
    }
    // Pinned columns leave some rows lopsided on purpose; the fork as a whole
    // still has to sit on the centre line.
    expect(balanced(Object.keys(MAP_COLUMNS))).toBeCloseTo(0);
  });

  it('keeps every pinned column clear of its neighbours', () => {
    // Two levels on the same row closer than a card's width would overlap.
    const { nodes } = buildMapGraph();
    const byY = new Map<number, number[]>();
    for (const n of nodes) byY.set(n.position.y, [...(byY.get(n.position.y) ?? []), n.position.x]);
    for (const row of byY.values()) {
      const xs = row.sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) {
        expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(NODE_WIDTH);
      }
    }
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
