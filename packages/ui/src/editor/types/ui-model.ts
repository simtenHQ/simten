/**
 * UI Model Types
 *
 * Visual editor component model for ReactFlow rendering.
 * These types are specific to the visual editor UI layer.
 *
 * For circuit/simulation types (the actual IR), use @/core/simulator.
 */

import type { Circuit } from '@simten/core';
import { STDLIB_CIRCUITS } from '@simten/core/std';

// Build lookup structures from stdlib exports. `STDLIB_CIRCUITS` materializes
// parameterized factories (Register, Switch, etc.) with their default options
// so they appear here as concrete `BuiltCircuit` instances alongside the
// singleton primitives.
const STD_CIRCUIT_MAP: Map<string, Circuit> = new Map(STDLIB_CIRCUITS.map((b) => [b.circuit.name, b.circuit]));
const PRIMITIVE_NAMES: Set<string> = new Set(
  STDLIB_CIRCUITS
    .filter((b) => b.circuit.implementation.kind === 'primitive')
    .map((b) => b.circuit.name),
);
const isPrimitive = (name: string) => PRIMITIVE_NAMES.has(name);

// ===========================
// Component Type Definitions
// ===========================

/**
 * Generic component interface.
 * This flexible interface supports all component types through dynamic properties.
 * Specific component behavior is determined by primitives.ts metadata.
 */
export interface Component {
  id: string;
  type: string;
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
  type: string;
  inputCount: number;
  outputCount: number;
  evaluate?: (inputs: (boolean | number)[]) => (boolean | number)[]; // Legacy logic function
}

/**
 * Get component specification for any component type.
 *
 * Uses primitives.ts as the source of truth for primitive components.
 */
export function getComponentSpec(type: string): ComponentSpec | undefined {
  const primitive = STD_CIRCUIT_MAP.get(type);
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
export function isPrimitiveComponentType(type: string): boolean {
  return isPrimitive(type);
}

// ===========================
// Sequential Component Detection
// ===========================

/**
 * Helper function to check if a component is sequential (has state).
 * Data-driven: checks if the primitive has clock ports.
 */
export function isSequentialComponent(type: string): boolean {
  const primitive = STD_CIRCUIT_MAP.get(type);
  return !!(primitive && primitive.clocks && primitive.clocks.length > 0);
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
