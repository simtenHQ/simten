/**
 * What kind of change a new drawing is, which decides what the canvas keeps.
 *
 * - `first`: there was nothing drawn before. Draw it.
 * - `replaced`: a different circuit (a new name, or fewer than half the nodes
 *   survive). Start React Flow over, so nothing of the old one lingers.
 * - `edited`: the same circuit, edited. Keep dragged positions, unless nodes
 *   were only added or only removed (`relayout`), and re-measure the nodes
 *   whose pins changed (`handlesChanged`).
 */

/** What the change is decided on: the circuit's name, and each node's pins by id. */
export interface Shape {
  name: string | null;
  /** Node id to its pins, `in1|in2>out1`. */
  pins: ReadonlyMap<string, string>;
}

export type Change =
  | { kind: 'first' }
  | { kind: 'replaced' }
  | { kind: 'edited'; relayout: boolean; handlesChanged: string[] };

export function classifyChange(prev: Shape, next: Shape, autoLayout = false): Change {
  if (prev.pins.size === 0) return { kind: 'first' };

  let survived = 0;
  for (const id of next.pins.keys()) if (prev.pins.has(id)) survived++;
  const added = next.pins.size - survived;
  const removed = prev.pins.size - survived;

  // Fewer than half the ids survive on the larger side. Using the larger side
  // makes it symmetric: a small to big swap (undo restoring a larger circuit)
  // scores the same as big to small, so a few survivors don't keep stale
  // positions while the new nodes land in a fresh layout, which overlapped
  // switches on undo. A rename or two stays above the line, so positions are
  // kept (#111).
  const replaced = survived / Math.max(prev.pins.size, next.pins.size) < 0.5;
  if (prev.name !== next.name || replaced) return { kind: 'replaced' };

  // Nodes only added or only removed: the kept positions belong to a layout
  // for a different node count, and a new node landed exactly on a surviving
  // one (adding an input hid the previous input's switch). Lay it all out
  // again. A rename removes an id and adds one, so it keeps positions.
  const onlyAdded = added > 0 && removed === 0;
  const onlyRemoved = removed > 0 && added === 0;
  const relayout = autoLayout || onlyAdded || onlyRemoved;

  const handlesChanged: string[] = [];
  for (const [id, pins] of next.pins) {
    const before = prev.pins.get(id);
    if (before !== undefined && before !== pins) handlesChanged.push(id);
  }
  return { kind: 'edited', relayout, handlesChanged };
}
