/**
 * Component Utility Functions
 *
 * Helper functions for analyzing component structure and properties.
 */

import type { Component } from '../../types';
import type { Circuit } from '../../types/ir-v0.1';
import { isSequentialComponent } from '../../types';

/**
 * Check if a component type is sequential, handling both old and new naming conventions.
 * Old IR: D_FLIP_FLOP, REGISTER, RAM
 * New IR v0.1: DFlipFlop, Register, RAM
 */
function isSequentialPrimitive(componentType: string): boolean {
  // Check old IR naming convention (D_FLIP_FLOP, REGISTER, RAM)
  if (isSequentialComponent(componentType)) {
    return true;
  }

  // Check new IR v0.1 naming convention (DFlipFlop, Register, RAM)
  const sequentialPrimitives = ['DFlipFlop', 'Register', 'RAM'];
  return sequentialPrimitives.includes(componentType);
}

/**
 * Recursively checks if a component or any of its nested components
 * contains sequential primitives (D_FLIP_FLOP, REGISTER, RAM).
 *
 * @param componentType - The type/name of the component to check
 * @param components - The current circuit's component instances
 * @param resolveComponent - Function to resolve component definitions from the library
 * @param visited - Set of already-visited component types to prevent infinite recursion
 * @returns true if the component or any nested component is sequential
 */
export function containsSequentialComponent(
  componentType: string,
  components: Record<string, Component>,
  resolveComponent: (name: string) => Circuit | undefined,
  visited: Set<string> = new Set()
): boolean {
  // Prevent infinite recursion for circular component references
  if (visited.has(componentType)) {
    return false;
  }
  visited.add(componentType);

  // Check if this is a sequential primitive (handles both old and new naming)
  if (isSequentialPrimitive(componentType)) {
    return true;
  }

  // Resolve the component definition from the library
  const circuit = resolveComponent(componentType);
  if (!circuit) {
    // Component not found in library, assume non-sequential
    return false;
  }

  // If this is a primitive implementation, it's not sequential (we already checked above)
  if (circuit.implementation.kind === 'primitive') {
    return false;
  }

  // For composite components, recursively check all internal nodes
  if (circuit.implementation.kind === 'composite') {
    for (const node of circuit.nodes) {
      // Recursively check if this node's component is sequential
      if (containsSequentialComponent(node.componentRef, components, resolveComponent, visited)) {
        return true;
      }
    }
  }

  // No sequential components found
  return false;
}

/**
 * Checks if the current circuit has any sequential components,
 * including those nested inside composite components.
 *
 * @param components - The current circuit's component instances
 * @param resolveComponent - Function to resolve component definitions from the library
 * @returns true if any component in the circuit is or contains sequential primitives
 */
export function hasSequentialComponents(
  components: Record<string, Component>,
  resolveComponent: (name: string) => Circuit | undefined
): boolean {
  for (const component of Object.values(components)) {
    if (containsSequentialComponent(component.type, components, resolveComponent)) {
      return true;
    }
  }
  return false;
}
