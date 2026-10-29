/**
 * Types for the embed package.
 * Defines the inspector and layout metadata types.
 */

// --- Inspector types (used by the canvas-level drill-down inspector) ---

import type { CircuitDefinitions, CircuitIR as CircuitType } from '@simten/core/internal';

export interface InspectorFrame {
  componentName: string;
  componentDef: CircuitType;
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
   * such as `dut.ha1`. Empty for a session's top level: a reference build's
   * root, or a circuit with no harness around it.
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

// --- Layout metadata types ---

interface Position {
  x: number;
  y: number;
}

interface Dimensions {
  width: number;
  height: number;
}

interface ComponentMetadata {
  id: string;
  position: Position;
  dimensions?: Dimensions;
}

interface ConnectionMetadata {
  id: string;
}

export interface MetadataState {
  components: Record<string, ComponentMetadata>;
  connections: Record<string, ConnectionMetadata>;
}

/**
 * Public layout prop type. Maps a node's label (or id, as fallback) to its
 * position on the canvas. Pass to CircuitCanvas / CircuitEmbed via the
 * `layout` prop to bypass the runtime layout engine entirely.
 *
 * When parameterised by a `Circuit`, the keys are constrained at compile
 * time to the union of input names, output names, and node labels.
 */
import type { Circuit } from '@simten/core';

export type CircuitLayout<C extends Circuit | undefined = undefined> =
  C extends Circuit<infer Ins, infer Outs, infer Ns>
    ? Record<keyof Ins | keyof Outs | keyof Ns, { x: number; y: number }>
    : Record<string, { x: number; y: number }>;
