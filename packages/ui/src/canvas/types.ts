/**
 * Types for the embed package.
 * Defines layout metadata types and re-exports simulator types from core.
 */

// Re-export simulator types from core so embed consumers don't need to install core separately
export type {
  FlatCircuit,
  FlatPortValueMap,
  FlatSequentialState,
} from "@simten/core/simulator";

export type { Circuit } from "@simten/core";

// --- Inspector types (used by the canvas-level drill-down inspector) ---

import type { Circuit as CircuitType } from "@simten/core";

export interface InspectorFrame {
  componentName: string;
  componentDef: CircuitType;
  nodeLabel: string;
}

/** Screen rect of the node that triggered the dialog (for animate-from-origin) */
export interface OriginRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// --- Layout metadata types (extracted from packages/ui/src/editor/types/visual.ts) ---

export interface Position {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface ComponentMetadata {
  id: string;
  position: Position;
  dimensions?: Dimensions;
}

export interface ConnectionMetadata {
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
 * When parameterised by a `BuiltCircuit`, the keys are constrained at compile
 * time to the union of input names, output names, and node labels.
 */
import type { BuiltCircuit } from "@simten/core";

export type CircuitLayout<
  C extends BuiltCircuit | undefined = undefined,
> = C extends BuiltCircuit<infer Ins, infer Outs, infer Ns>
  ? Record<keyof Ins | keyof Outs | keyof Ns, { x: number; y: number }>
  : Record<string, { x: number; y: number }>;
