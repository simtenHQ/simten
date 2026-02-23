/**
 * Visual Metadata Types
 *
 * These types define the visual representation layer that sits on top of the IR.
 * Metadata stores positions, sizes, and other visual properties separate from logic.
 */

// ===========================
// Position & Layout
// ===========================

export interface Position {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

// ===========================
// Component Metadata
// ===========================

export interface ComponentMetadata {
  id: string; // Matches the component ID in IR
  position: Position;
  dimensions?: Dimensions; // Optional, can use defaults based on type
  selected?: boolean;
  zIndex?: number;
}

// ===========================
// Port Metadata
// ===========================

export interface PortMetadata {
  id: string; // Matches port ID from IR (e.g., "comp1.in0")
  position: Position; // Relative to component
}

// ===========================
// Connection Metadata
// ===========================

export interface ConnectionMetadata {
  id: string; // Matches connection ID in IR
  animated?: boolean; // For visual effects
  color?: string; // Wire color based on signal state
  waypoints?: Position[]; // Custom routing waypoints for orthogonal edges
  selected?: boolean; // Selection state for deletion and visual feedback
}

// ===========================
// Metadata State
// ===========================

export interface MetadataState {
  components: Record<string, ComponentMetadata>;
  connections: Record<string, ConnectionMetadata>;
}

// ===========================
// Default Visual Properties
// ===========================

export const DEFAULT_NODE_DIMENSIONS: Record<string, Dimensions> = {
  SWITCH: { width: 80, height: 60 },
  LED: { width: 80, height: 60 },
  AND_GATE: { width: 100, height: 80 },
};

export const PORT_SIZE = 12; // Port handle size in pixels
export const PORT_OFFSET = 16; // Offset from top/bottom for ports

// Wire colors based on signal state
export const WIRE_COLORS = {
  TRUE: '#22c55e', // green-500
  FALSE: '#94a3b8', // slate-400
  UNDEFINED: '#cbd5e1', // slate-300
};
