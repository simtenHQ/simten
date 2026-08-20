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
  ['not'],
  ['and'],
  ['or'],
  ['nor'],
  ['xor'],
  ['xnor'],
  ['making-a-component'],
  ['half-adder'],
  ['full-adder'],
  ['latch'],
];

/**
 * Bands, labelled where they begin.
 *
 * Turing Complete rules its map into `BOOLEAN LOGIC`, `ARITHMETIC`, `CPU
 * ARCHITECTURE` and so on, and the labels do more than decorate: they turn a
 * column of nodes into a structure, and they say that what you can see is a
 * *section* rather than the whole game. That second part matters here, because
 * eight levels presented as the entire campaign reads as thin, while eight
 * presented as its first band reads as a start.
 *
 * Declared by the row a band opens on rather than by a range, so adding a level
 * to the middle of a band does not require renumbering the one above it.
 */
export interface MapSection {
  label: string;
  /** Index into `MAP_ROWS` where this band begins, counting from the bottom. */
  startRow: number;
}

export const MAP_SECTIONS: MapSection[] = [
  { label: 'First circuits', startRow: 0 },
  { label: 'Every gate from one', startRow: 2 },
  { label: 'Components', startRow: 7 },
  { label: 'Arithmetic', startRow: 8 },
  { label: 'Memory', startRow: 10 },
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
const ROW_GAP = 150;

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
 * A band, positioned and sized like a node so React Flow pans it with the map.
 *
 * It covers its rows rather than just captioning them, so a section reads as an
 * *area* you are inside rather than a line you crossed. Every band is tinted
 * identically: the gap between them is what separates one from the next, so
 * alternating shades only added noise.
 */
export interface MapSectionNode {
  id: string;
  label: string;
  position: { x: number; y: number };
  height: number;
}

/** Width of a band. Wide enough to read as an area, not a caption. */
export const SECTION_WIDTH = 760;

/**
 * Vertical budget for a band, spent out of the space between two rows.
 *
 * `ROW_GAP - NODE_HEIGHT` is all there is between one row's card and the next
 * (currently 78px). A band claims `BOTTOM` beneath its lowest card — where the
 * label sits — and `TOP` above its highest, and whatever is left becomes the
 * gap between adjacent bands. Overrun the budget and neighbouring bands
 * overlap instead of separating.
 */
const SECTION_PAD_TOP = 24;
const SECTION_PAD_BOTTOM = 30;

/**
 * Build the graph.
 *
 * Y is inverted because React Flow's axis grows downward and the map reads
 * upward: the first row gets the largest Y so it sits at the bottom. Edges run
 * from a row to the one above it, which is the direction of progress.
 *
 * `solved` is the set of completed level ids, read from stored progress by the
 * map page. It is empty for the first frame after mount, because storage can
 * only be read on the client — so this must be safe to call with nothing
 * solved, which it is: every level renders as available.
 */
export function buildMapGraph(solved: ReadonlySet<string> = new Set()): {
  nodes: MapNode[];
  edges: MapEdge[];
  sections: MapSectionNode[];
} {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const lastRow = MAP_ROWS.length - 1;
  const rowY = (rowIndex: number) => (lastRow - rowIndex) * ROW_GAP;

  MAP_ROWS.forEach((row, rowIndex) => {
    const y = rowY(rowIndex);

    row.forEach((levelId, columnIndex) => {
      const level = LEVELS_BY_ID.get(levelId);
      if (!level) return; // Guarded by the drift test; ignore rather than crash a page.

      // React Flow positions a node by its top-left corner, so half a node's
      // width comes off to make x = 0 the row's visual centre rather than its
      // left edge. Without it every row sits `NODE_WIDTH / 2` right of centre.
      const offset = columnIndex - (row.length - 1) / 2;
      nodes.push({
        id: levelId,
        position: { x: offset * (NODE_WIDTH + COLUMN_GAP) - NODE_WIDTH / 2, y },
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

  /**
   * Each band spans from the row it opens on up to the row below the next
   * band's start. Y grows downward while rows climb, so the band's *top* comes
   * from its last row and its *bottom* from its first — inverted relative to
   * how it reads.
   */
  const inRange = MAP_SECTIONS.filter((s) => s.startRow >= 0 && s.startRow < MAP_ROWS.length);

  const sections: MapSectionNode[] = inRange.map((section, i) => {
    const endRow = i + 1 < inRange.length ? inRange[i + 1].startRow - 1 : lastRow;
    const top = rowY(Math.max(endRow, section.startRow)) - SECTION_PAD_TOP;
    const bottom = rowY(section.startRow) + NODE_HEIGHT + SECTION_PAD_BOTTOM;

    return {
      id: `section-${section.startRow}`,
      label: section.label,
      position: { x: -SECTION_WIDTH / 2, y: top },
      height: Math.max(bottom - top, NODE_HEIGHT),
    };
  });

  return { nodes, edges, sections };
}
