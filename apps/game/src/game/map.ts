/**
 * The campaign as a map.
 *
 * Two structures, deliberately separate. `MAP_ROWS` is layout: which rank and
 * column a level is drawn at, bottom to top. `MAP_REQUIRES` is the graph: what
 * actually gates what. Rows carried both until the campaign branched, at which
 * point they could not, because two branches of different lengths put unrelated
 * levels on the same rank.
 *
 * The campaign runs as a trunk of gate levels and forks three ways once every
 * gate is earned: logic, arithmetic and memory. Arithmetic and memory rejoin at
 * a counter, and logic and arithmetic at the ALU.
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
  ['nand'],
  ['not'],
  ['and'],
  ['or'],
  ['nor'],
  ['xor'],
  ['xnor'],
  ['making-a-component'],
  ['buses'],
  // The fork. Rows past here are ranks only; `MAP_COLUMNS` says which column
  // each level sits in.
  ['multiplexer', 'half-adder', 'latch'],
  ['majority', 'full-adder', 'd-latch'],
  ['wide-gates', 'adder-4', 'toggle'],
  ['decoder', 'negate', 'counter'],
  ['mux-4', 'subtract', 'register'],
  ['equal', 'less-than', 'register-file'],
  ['parity', 'program-counter'],
  ['alu-4'],
  ['cpu-load'],
  ['cpu-alu'],
  ['cpu-jumps'],
];

/**
 * Fixed columns for the fork, in node widths from the centre line.
 *
 * Centring each row works while every branch is the same length. Once they are
 * not, a row of two re-centres and its levels drift half a column off the
 * branch they belong to. So the fork pins its columns instead:
 *
 *   logic | new arithmetic | half adder, full adder | memory
 *
 * The full adder feeds both the 4-bit adder and the counter. Stacking the
 * 4-bit adder directly above it would run the counter's wire through it, which
 * reads as a dependency that is not there. Branching the new arithmetic off to
 * the left leaves the column above the full adder empty, so the counter's wire
 * climbs it and turns in under the counter, which sits with the rest of memory.
 *
 * Rows without an entry here are centred, which is the whole trunk.
 */
export const MAP_COLUMNS: Record<string, number> = {
  multiplexer: -1.5,
  majority: -1.5,
  'wide-gates': -1.5,
  decoder: -1.5,
  'mux-4': -1.5,
  equal: -1.5,
  parity: -1.5,

  'adder-4': -0.5,
  negate: -0.5,
  subtract: -0.5,
  'less-than': -0.5,

  'half-adder': 0.5,
  'full-adder': 0.5,

  latch: 1.5,
  'd-latch': 1.5,
  toggle: 1.5,
  counter: 1.5,
  register: 1.5,
  'register-file': 1.5,
  'program-counter': 1.5,

  // Over the tops of the two columns it needs.
  'alu-4': -1,
  'cpu-load': 0,
  'cpu-alu': 0,
  'cpu-jumps': 0,
};

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
  not: ['nand'],
  and: ['not'],
  or: ['and'],
  nor: ['or'],
  xor: ['nor'],
  xnor: ['xor'],
  'making-a-component': ['xnor'],

  // The fork. Every branch needs every gate, so it splits after the last one:
  // nothing downstream can reach for a gate the player skipped.
  // Numbers on wires come before the fork: every branch has 4-bit levels.
  buses: ['making-a-component'],

  multiplexer: ['buses'],
  'half-adder': ['buses'],
  latch: ['buses'],

  majority: ['multiplexer'],
  'wide-gates': ['majority'],
  // Single switches first, then numbers on buses. The decoder and the
  // four-way multiplexer sit together: both pick one of four with two bits.
  decoder: ['wide-gates'],
  'mux-4': ['decoder'],
  // Equality is XNORs and the four-input AND from wider gates, no
  // arithmetic, so it belongs here rather than with the adders.
  equal: ['mux-4'],
  parity: ['equal'],

  'full-adder': ['half-adder'],
  'adder-4': ['full-adder'],
  negate: ['adder-4'],
  subtract: ['negate'],
  'less-than': ['subtract'],

  'd-latch': ['latch'],
  toggle: ['d-latch'],

  // Where the branches rejoin. The AND is honest: a counter is memory holding
  // the number and logic working out the next one, so it needs both halves.
  counter: ['full-adder', 'toggle'],
  register: ['counter'],
  'register-file': ['register'],
  'program-counter': ['register-file'],

  // Where logic and arithmetic meet. It needs both columns finished: by then
  // the player has every part an ALU is made of.
  'alu-4': ['parity', 'less-than'],

  // Where everything meets: the ALU, and the program counter at the top of
  // memory. The CPU is then built in three steps, one kind of instruction
  // each, the way a real one is brought up.
  'cpu-load': ['alu-4', 'program-counter'],
  'cpu-alu': ['cpu-load'],
  'cpu-jumps': ['cpu-alu'],
};

export interface MapSection {
  label: string;
  /** Index into `MAP_ROWS` where this band begins, counting from the bottom. */
  startRow: number;
  /**
   * For a lane, the `MAP_COLUMNS` it covers, leftmost and rightmost. Absent
   * means a band across the whole map.
   */
  columns?: [number, number];
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
 * to the middle of a band does not require renumbering the one above it. A band
 * runs up to the next band that starts higher, so lanes that open on the same
 * row sit side by side.
 */
export const MAP_SECTIONS: MapSection[] = [
  // One band from the first wire to the last gate. It was two: a short
  // "First circuits" and then "Every gate from one", which split a single
  // idea in half and put a rule across the map two levels in, before the
  // player had done anything worth dividing.
  { label: 'Logic gates', startRow: 0 },
  { label: 'Components', startRow: 7 },
  // The fork's branches run side by side, so they get a lane each rather than
  // one band across all three. It was one band, and seventeen levels under a
  // single label read as one undivided slab.
  { label: 'Logic', startRow: 9, columns: [-1.5, -1.5] },
  { label: 'Arithmetic', startRow: 9, columns: [-0.5, 0.5] },
  { label: 'Memory', startRow: 9, columns: [1.5, 1.5] },
  // Where the lanes come back together. The ALU now; registers and a CPU later.
  { label: 'Processor', startRow: 16 },
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
  /**
   * Where along the edge its horizontal run sits, 0 at the source and 1 at the
   * target, for React Flow's smoothstep path. Absent means halfway.
   */
  stepPosition?: number;
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
  width: number;
  height: number;
}

/** Width of a full band. Wide enough to read as an area, not a caption. */
export const SECTION_WIDTH = 1010;

/** How far a lane reaches past the cards in its columns, either side. */
const LANE_PAD = 12;

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
 * A wire that changes column turns just under the card it feeds, not halfway.
 *
 * Halfway is fine between neighbouring rows, but a wire that climbs two rows
 * turned level with whatever sat in between, and ran through it: the full
 * adder's wire to the counter cut straight across the toggle. Turning late
 * keeps the climb in the wire's own column.
 */
const TURN_DROP = 14;

/**
 * Extra room under a band whose first row takes a turning wire from below.
 *
 * Those wires turn inside the band's bottom padding, which is where its label
 * sits. The band sits higher by this much so the turn has room above the label.
 */
const TURN_ROOM = 36;

/** A level's column, in node widths from the centre line. */
function columnOf(levelId: string): number {
  const row = MAP_ROWS.find((r) => r.includes(levelId)) ?? [levelId];
  return MAP_COLUMNS[levelId] ?? row.indexOf(levelId) - (row.length - 1) / 2;
}

const columnX = (column: number) => column * (NODE_WIDTH + COLUMN_GAP);

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
  const rowOf = new Map(MAP_ROWS.flatMap((row, r) => row.map((id) => [id, r] as const)));
  const turns = (source: string, target: string) => columnOf(source) !== columnOf(target);

  // Bands that need room under their first row for a turning wire.
  const roomy = new Set(
    MAP_SECTIONS.map((s) => s.startRow).filter((start) =>
      Object.entries(MAP_REQUIRES).some(
        ([target, requires]) =>
          rowOf.get(target) === start &&
          requires.some((source) => (rowOf.get(source) ?? start) < start && turns(source, target)),
      ),
    ),
  );

  // Rows climb by ROW_GAP, plus TURN_ROOM for every roomy band at or below
  // them. The top row stays at y = 0.
  const lift = (rowIndex: number) =>
    [...roomy].filter((start) => start <= rowIndex).length * TURN_ROOM;
  const rowY = (rowIndex: number) =>
    (lastRow - rowIndex) * ROW_GAP + lift(lastRow) - lift(rowIndex);

  MAP_ROWS.forEach((row, rowIndex) => {
    const y = rowY(rowIndex);

    for (const levelId of row) {
      const level = LEVELS_BY_ID.get(levelId);
      if (!level) continue; // Guarded by the drift test; ignore rather than crash a page.

      // React Flow positions a node by its top-left corner, so half a node's
      // width comes off to make x = 0 the row's visual centre rather than its
      // left edge. Without it every row sits `NODE_WIDTH / 2` right of centre.
      nodes.push({
        id: levelId,
        position: { x: columnX(columnOf(levelId)) - NODE_WIDTH / 2, y },
        data: {
          levelId,
          title: level.title,
          position: levelIndex(levelId) + 1,
          state: solved.has(levelId) ? 'solved' : 'available',
        },
      });
    }
  });

  // Edges come from the dependency graph, not from row adjacency, so two
  // branches of different lengths do not acquire a link they never had.
  const yOf = new Map(nodes.map((n) => [n.id, n.position.y]));
  for (const [levelId, requires] of Object.entries(MAP_REQUIRES)) {
    for (const source of requires) {
      const edge: MapEdge = { id: `${source}->${levelId}`, source, target: levelId };
      const from = yOf.get(source);
      const to = yOf.get(levelId);
      if (turns(source, levelId) && from !== undefined && to !== undefined) {
        const span = from - (to + NODE_HEIGHT);
        edge.stepPosition = (span - TURN_DROP) / span;
      }
      edges.push(edge);
    }
  }

  /**
   * Each band spans from the row it opens on up to the row below the next
   * band that starts higher. Y grows downward while rows climb, so the band's
   * *top* comes from its last row and its *bottom* from its first, inverted
   * relative to how it reads.
   */
  const inRange = MAP_SECTIONS.filter((s) => s.startRow >= 0 && s.startRow < MAP_ROWS.length);

  const sections: MapSectionNode[] = inRange.map((section, i) => {
    const later = inRange.map((s) => s.startRow).filter((r) => r > section.startRow);
    const endRow = later.length > 0 ? Math.min(...later) - 1 : lastRow;
    const top = rowY(endRow) - SECTION_PAD_TOP;
    const bottom =
      rowY(section.startRow) +
      NODE_HEIGHT +
      SECTION_PAD_BOTTOM +
      (roomy.has(section.startRow) ? TURN_ROOM : 0);

    const [left, width] = section.columns
      ? [
          columnX(section.columns[0]) - NODE_WIDTH / 2 - LANE_PAD,
          columnX(section.columns[1]) - columnX(section.columns[0]) + NODE_WIDTH + 2 * LANE_PAD,
        ]
      : [-SECTION_WIDTH / 2, SECTION_WIDTH];

    return {
      id: `section-${i}`,
      label: section.label,
      position: { x: left, y: top },
      width,
      height: Math.max(bottom - top, NODE_HEIGHT),
    };
  });

  return { nodes, edges, sections };
}
