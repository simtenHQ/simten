/**
 * UI Model Types
 *
 * Visual editor component model for ReactFlow rendering.
 * These types are specific to the visual editor UI layer.
 *
 * For circuit/simulation types (the actual IR), use @/core/simulator.
 */

import { isPrimitive, PRIMITIVES } from '../lib/primitives';

// ===========================
// Component Type Definitions
// ===========================

/**
 * Component type identifier.
 * Can be any string - primitive names (e.g., 'And', 'DFlipFlop') or user-defined.
 */
export type ComponentType = string;

/**
 * Generic component interface.
 * This flexible interface supports all component types through dynamic properties.
 * Specific component behavior is determined by primitives.ts metadata.
 */
export interface Component {
  id: string;
  type: ComponentType;
  label?: string;
  // Dynamic properties for component-specific state
  [key: string]: unknown;
}

/**
 * UI-layer connection interface.
 * Represents a wire between two component ports in the visual editor.
 */
export interface Connection {
  id: string;
  sourceComponentId: string;
  sourcePortIndex: number;
  targetComponentId: string;
  targetPortIndex: number;
}

// ===========================
// Component Specifications
// ===========================

/**
 * Defines the port configuration for each component type.
 */
export interface ComponentSpec {
  type: ComponentType;
  inputCount: number;
  outputCount: number;
  evaluate?: (inputs: (boolean | number)[]) => (boolean | number)[]; // Legacy logic function
}

/**
 * Get component specification for any component type.
 *
 * Uses primitives.ts as the source of truth for primitive components.
 */
export function getComponentSpec(type: ComponentType): ComponentSpec | undefined {
  const primitive = PRIMITIVES.find((p) => p.name === type);
  if (primitive) {
    return {
      type,
      inputCount: primitive.inputs.length,
      outputCount: primitive.outputs.length,
    };
  }
  return undefined;
}

/**
 * Check if a component type is a primitive.
 *
 * Uses primitives.ts as the source of truth.
 */
export function isPrimitiveComponentType(type: ComponentType): boolean {
  return isPrimitive(type);
}

// ===========================
// Sequential Component Detection
// ===========================

/**
 * Helper function to check if a component is sequential (has state).
 * Handles both legacy naming (D_FLIP_FLOP) and new naming (DFlipFlop).
 */
export function isSequentialComponent(type: ComponentType): boolean {
  // Legacy names
  if (type === 'D_FLIP_FLOP' || type === 'REGISTER' || type === 'RAM') {
    return true;
  }
  // New names - check via primitives.ts metadata
  const primitive = PRIMITIVES.find((p) => p.name === type);
  if (primitive && primitive.clocks && primitive.clocks.length > 0) {
    return true;
  }
  return false;
}

// ===========================
// Clock Edge Detection
// ===========================

/**
 * Clock signal state
 */
export interface ClockSignal {
  previousValue: boolean;
  currentValue: boolean;
}

/**
 * Helper function to detect clock edge
 */
export function detectClockEdge(clock: ClockSignal): 'rising' | 'falling' | 'none' {
  if (!clock.previousValue && clock.currentValue) {
    return 'rising';
  } else if (clock.previousValue && !clock.currentValue) {
    return 'falling';
  }
  return 'none';
}
