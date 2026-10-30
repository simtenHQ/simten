/**
 * What a node on the canvas is: built from the circuit once, not from its
 * values. A node reads its value from the canvas's store by `valueKey`, and
 * clicks go to the canvas's actions by `path` (`canvas/values.ts`).
 */
export interface NodeData extends Record<string, unknown> {
  nodeId: string;
  /** Where the node is in the session: what `set` and loading a program take, and its peripheral's key. */
  path: string;
  componentRef: string;
  label?: string;
  inputCount: number;
  outputCount: number;
  inputNames: string[];
  outputNames: string[];
  isComposite?: boolean;
  /**
   * Primitive with a gate-level reference build in `MADE_OF` — drillable, but
   * what opens is an explanation rather than its actual implementation.
   * Deliberately separate from `isComposite`, which selects the node type.
   */
  hasReference?: boolean;
  arguments?: Record<string, unknown>;
  showPortLabels?: boolean;
  /** The session key a switch, lamp, number input or display shows. */
  valueKey?: string;
  /**
   * Where a Screen reads its pixels: the memory wired to it, or through a
   * multiplexer, the memory its select line picks.
   */
  pixelSource?: PixelSource;
}

export type PixelSource = { memory: string } | { select: string; memories: [string?, string?] };
