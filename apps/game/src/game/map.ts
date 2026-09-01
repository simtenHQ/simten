/**
 * The campaign as a map.
 *
 * Two structures, deliberately separate. `MAP_ROWS` is layout: which rank and
 * column a level is drawn at, bottom to top. `MAP_REQUIRES` is the graph: what
 * actually gates what. Rows carried both until the campaign branched, at which
 * point they could not, because two branches of different lengths put unrelated
 * levels on the same rank.
 *
 * The campaign runs as a trunk of gate levels, forks into arithmetic and memory
 * once every gate is earned, and rejoins at a counter that needs both.
 *
 * Order lives here rather than in `levels.ts` because it is presentation: a
 * level stays pure data that could be fetched as JSON, and the map decides how
 * that data is arranged. The cost of the split is drift, which is what
 * `__tests__/map.test.ts` exists to catch: every level appears exactly once,
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
  // The fork: arithmetic on the left, memory on the right. Rows are ranks, so
  // the shorter branch simply stops and `toggle` sits alone on the last one.
  ['half-adder', 'latch'],
  ['full-adder', 'd-latch'],
  ['toggle'],
  ['counter'],
];

/**
 * What each level needs finished before it opens.
 *
 * Rows used to carry this implicitly: everything on a row fed everything on the
 * row above. That reads a straight campaign correctly and cannot describe a
 * branching one, because two branches of different lengths put unrelated levels
 * on the same rank and the adjacency rule then invents a dependency between
 * them. Arithmetic and memory are genuinely independent — an adder needs no
 * flip-flop and a latch needs no carry — so the line the map drew through them
 * was never real.
 *
 * Rows are now layout only. This is the graph. A level absent from here opens
 * from the start.
 */
export const MAP_REQUIRES: Record<string, string[]> = {
  not: ['first-wire'],
  and: ['not'],
  or: ['and'],
  nor: ['or'],
  xor: ['nor'],
  xnor: ['xor'],
  'making-a-component': ['xnor'],

  // The fork. Both branches need every gate, so it splits after the last one:
  // nothing downstream can reach for a gate the player skipped.
  'half-adder': ['making-a-component'],
  latch: ['making-a-component'],

  'full-adder': ['half-adder'],
  'd-latch': ['latch'],
  toggle: ['d-latch'],

  // Where the branches rejoin. The AND is honest: a counter is memory holding
  // the number and logic working out the next one, so it needs both halves.
  counter: ['full-adder', 'toggle'],
};

export interface MapSection {
  label: string;
  /** Index into `MAP_ROWS` where this band begins, counting from the bottom. */
  startRow: number;
}

/**
 * Bands, labelled where they begin.
 *
 * Turing Complete rules its map into `BOOLEAN LOGIC`, `ARITHMETIC`, `CPU
 * ARCHITECTURE` and so on, and the labels do more than decorate: they turn a
 * column of nodes into a structure, and they say that what you can see is a
 * *section* rather than the whole game.
 *
 * Declared by the row a band opens on rather than by a range, so adding a level
 * to the middle of a band does not require renumbering the one above it.
 */
export const MAP_SECTIONS: MapSection[] = [
  // One band from the first wire to the last gate. It was two: a short
  // "First circuits" and then "Every gate from one", which split a single
  // idea in half and put a rule across the map two levels in, before the
  // player had done anything worth dividing.
  { label: 'Logic gates', startRow: 0 },
  { label: 'Components', startRow: 7 },
  // Arithmetic and memory used to be two bands stacked one above the other.
  // They run side by side now, and a band is a horizontal strip, so two labels
  // would sit on the same rows and fight. One band covers the fork instead.
  { label: 'Arithmetic and memory', startRow: 8 },
];

/**
 * Layout constants. Node width is fixed so a row can be centred without
 * measuring the DOM, which keeps the graph identical on the server and the
 * client, because React Flow renders during SSR here, and a layout that depended on
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
 * (currently 78px). A band claims `BOTTOM` beneath its lowest card (where the
 * label sits) and `TOP` above its highest, and whatever is left becomes the
 * gap between adjacent bands. Overrun the budget and neighbouring bands
 * overlap instead of separating.
 */
const SECTION_PAD_TOP = 24;
const SECTION_PAD_BOTTOM = 30;

/**
 * Build the graph.
 *
 * Y is inverted because React Flow's axis grows downward and the map reads
 * upward: the first row gets the largest Y so it sits at the bottom. Rows place
 * the nodes; `MAP_REQUIRES` draws the edges. Keeping those apart is what lets a
 * branch be shorter than its sibling without acquiring a link to whatever
 * happens to sit on the same rank.
 *
 * `solved` is the set of completed level ids, read from stored progress by the
 * map page. It is empty for the first frame after mount, because storage can
 * only be read on the client, so this must be safe to call with nothing
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
  });

  // Edges come from the dependency graph, not from row adjacency, so two
  // branches of different lengths do not acquire a link they never had.
  for (const [levelId, requires] of Object.entries(MAP_REQUIRES)) {
    for (const source of requires) {
      edges.push({ id: `${source}->${levelId}`, source, target: levelId });
    }
  }

  /**
   * Each band spans from the row it opens on up to the row below the next
   * band's start. Y grows downward while rows climb, so the band's *top* comes
   * from its last row and its *bottom* from its first, inverted relative to
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
