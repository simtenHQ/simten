/**
 * Types for the embed package.
 * Defines layout metadata types and re-exports simulator types from core.
 */

// Re-export simulator types from core so embed consumers don't need to install core separately
export type {
  FlatCircuit,
  FlatPortValueMap,
  FlatSequentialState,
} from "@turing-incomplete/core/simulator";

export type { Circuit } from "@turing-incomplete/core/dsl";

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
  selected?: boolean;
  zIndex?: number;
}

export interface ConnectionMetadata {
  id: string;
  selected?: boolean;
}

export interface MetadataState {
  components: Record<string, ComponentMetadata>;
  connections: Record<string, ConnectionMetadata>;
}
