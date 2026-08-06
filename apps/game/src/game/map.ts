/**
 * The campaign as a map.
 *
 * `MAP_ROWS` is the campaign's shape, listed bottom to top — row 0 is where a
 * player starts and the last row is the end of the act. A row holds more than
 * one level when those levels are siblings rather than a sequence: Turing
 * Complete puts AND, NOR and OR side by side precisely so three levels read as
 * one beat instead of a vertical grind. Nothing today branches, but the shape
 * is here so that adding a cluster is an edit to this list rather than a
 * rewrite of the layout.
 *
 * Order lives here rather than in `levels.ts` because it is presentation: a
 * level stays pure data that could be fetched as JSON, and the map decides how
 * that data is arranged. The cost of the split is drift, which is what
 * `__tests__/map.test.ts` exists to catch — every level appears exactly once,
 * and no row names a level that does not exist.
 */

import { LEVELS_BY_ID, levelIndex } from './levels';

/** Bottom to top. Each inner array is one row of siblings. */
export const MAP_ROWS: string[][] = [
  ['first-wire'],
  ['not-from-nand'],
  ['and-from-nand'],
  ['or-from-nand'],
  ['nor-from-nand'],
  ['xor-from-nand'],
  ['xnor-from-nand'],
  ['half-adder'],
];

/**
 * Layout constants. Node width is fixed so a row can be centred without
 * measuring the DOM, which keeps the graph identical on the server and the
 * client — React Flow renders during SSR here, and a layout that depended on
 * measurement would jump on hydration.
 */
export const NODE_WIDTH = 210;
export const NODE_HEIGHT = 72;
const COLUMN_GAP = 44;
const ROW_GAP = 132;

/** How a node is drawn. `locked` is unused until progress is persisted. */
export type LevelNodeState = 'solved' | 'available' | 'locked';

export interface LevelNodeData extends Record<string, unknown> {
  levelId: string;
  title: string;
  /** 1-based position in the campaign, matching the list page's numbering. */
  position: number;
  state: LevelNodeState;
}

export interface MapNode {
  id: string;
  position: { x: number; y: number };
  data: LevelNodeData;
}

export interface MapEdge {
  id: string;
  source: string;
  target: string;
}

/**
 * Build the graph.
 *
 * Y is inverted because React Flow's axis grows downward and the map reads
 * upward: the first row gets the largest Y so it sits at the bottom. Edges run
 * from a row to the one above it, which is the direction of progress.
 *
 * `solved` is the set of completed level ids. There is no persistence yet, so
 * today it is always empty and every level renders as available — which is
 * honest, since any level is reachable by URL regardless. Locking becomes
 * meaningful the moment progress is stored, and only this function changes.
 */
export function buildMapGraph(solved: ReadonlySet<string> = new Set()): {
  nodes: MapNode[];
  edges: MapEdge[];
} {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const lastRow = MAP_ROWS.length - 1;

  MAP_ROWS.forEach((row, rowIndex) => {
    const y = (lastRow - rowIndex) * ROW_GAP;

    row.forEach((levelId, columnIndex) => {
      const level = LEVELS_BY_ID.get(levelId);
      if (!level) return; // Guarded by the drift test; ignore rather than crash a page.

      const offset = columnIndex - (row.length - 1) / 2;
      nodes.push({
        id: levelId,
        position: { x: offset * (NODE_WIDTH + COLUMN_GAP), y },
        data: {
          levelId,
          title: level.title,
          position: levelIndex(levelId) + 1,
          state: solved.has(levelId) ? 'solved' : 'available',
        },
      });
    });

    // Join every level in this row to every level in the row above. With one
    // level per row that is a plain chain; with a cluster it fans out.
    const above = MAP_ROWS[rowIndex + 1];
    if (!above) return;
    for (const source of row) {
      for (const target of above) {
        edges.push({ id: `${source}->${target}`, source, target });
      }
    }
  });

  return { nodes, edges };
}
