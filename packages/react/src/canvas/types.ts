/**
 * Types the canvas shares between its files: what it draws, where, and the
 * drill-down's frames.
 */

import type { Circuit } from '@simten/core';
import type { CircuitDefinitions, CircuitIR, Node } from '@simten/core/internal';

/**
 * A node as the canvas draws it: one from the circuit, or one the canvas adds
 * to show a port. Only the canvas has these fields; the session never sees them.
 */
export interface DrawnNode extends Node {
  /**
   * The port this node shows: a switch or lamp the canvas added around a
   * circuit, or a boundary port inside the drill-down. It reads that port's
   * value, and its pins go unlabelled, because a switch named `a` with a pin
   * named `out` would read as `a.out` when `a` is the port itself.
   */
  port?: string;
  /** Where this node is in the session, when that isn't its id: '' for a circuit drawn as one box. */
  path?: string;
}

/** A circuit as the canvas draws it. A `CircuitIR` is one already. */
export interface DrawnCircuit extends Omit<CircuitIR, 'nodes'> {
  nodes: DrawnNode[];
}

export interface InspectorFrame {
  componentName: string;
  componentDef: CircuitIR;
  nodeLabel: string;
  /**
   * Definitions to resolve this frame's nodes against, when the page's own
   * are not enough. A gate-level reference build pulls in circuits the page
   * never depended on; without them `circuit-to-flow.ts` drops every internal node
   * and the dialog renders an empty canvas.
   */
  definitions?: CircuitDefinitions;
  /**
   * Dotted instance path of this component in the session the frame reads,
   * such as `ha1.x`. Empty for a session's top level: a circuit opened from its
   * box, or a reference build's root.
   */
  path: string;
  /**
   * Set on a primitive's gate-level reference build (`circuit`, built on the
   * page to the node's arguments). The build isn't in the running netlist, so
   * it runs as a second session in the same sandbox, fed with the inputs of
   * the primitive at `instance` in the main session. Frames opened inside it
   * read that session too.
   */
  reference?: { instance: string; circuit: Circuit };
}

/** Node positions by node id, from the layout engine or the `layout` prop. */
export type Positions = Record<string, { x: number; y: number }>;

/**
 * Public layout prop type. Maps a node's label (or id, as fallback) to its
 * position on the canvas. Pass to CircuitCanvas via the
 * `layout` prop to bypass the runtime layout engine entirely.
 *
 * When parameterised by a `Circuit`, the keys are constrained at compile
 * time to the union of input names, output names, and node labels.
 */
export type CircuitLayout<C extends Circuit | undefined = undefined> =
  C extends Circuit<infer Ins, infer Outs, infer Ns>
    ? Record<keyof Ins | keyof Outs | keyof Ns, { x: number; y: number }>
    : Record<string, { x: number; y: number }>;
