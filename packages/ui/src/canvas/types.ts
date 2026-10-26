/**
 * Types for the embed package.
 * Defines the inspector and layout metadata types.
 */

// --- Inspector types (used by the canvas-level drill-down inspector) ---

import type {
  CircuitLibrary as CircuitLibraryType,
  CircuitIR as CircuitType,
} from '@simten/core/internal';

export interface InspectorFrame {
  componentName: string;
  componentDef: CircuitType;
  nodeLabel: string;
  /**
   * Library to resolve this frame's nodes against, when the page's own library
   * is not enough. A gate-level reference build pulls in circuits the page
   * never depended on; without them `projection.ts` drops every internal node
   * and the dialog renders an empty canvas.
   */
  library?: CircuitLibraryType;
}

/** Screen rect of the node that triggered the dialog (for animate-from-origin) */
export interface OriginRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// --- Layout metadata types (extracted from packages/ui/src/editor/types/visual.ts) ---

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
