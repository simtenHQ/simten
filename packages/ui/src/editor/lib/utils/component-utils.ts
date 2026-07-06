/**
 * Circuit Utility Functions
 *
 * Helper functions for analyzing circuit structure and properties.
 */

import type { Component } from '../../types';
import { isSequentialComponent } from '../../types';
import type { Circuit } from '../../types/circuit';

/**
 * Check if a circuit type is sequential.
 * Delegates entirely to isSequentialComponent (data-driven via clock ports).
 */
function isSequentialPrimitive(componentType: string): boolean {
  return isSequentialComponent(componentType);
}

/**
 * Recursively checks if a circuit or any of its nested circuits
 * contains sequential primitives (D_FLIP_FLOP, REGISTER, RAM).
 *
 * @param componentType - The type/name of the circuit to check
 * @param components - The current circuit's component instances
 * @param resolveCircuit - Function to resolve circuit definitions from the library
 * @param visited - Set of already-visited circuit types to prevent infinite recursion
 * @returns true if the circuit or any nested circuit is sequential
 */
export function containsSequentialCircuit(
  componentType: string,
  components: Record<string, Component>,
  resolveCircuit: (name: string) => Circuit | undefined,
  visited: Set<string> = new Set(),
): boolean {
  // Prevent infinite recursion for circular references
  if (visited.has(componentType)) {
    return false;
  }
  visited.add(componentType);

  // Check if this is a sequential primitive (handles both old and new naming)
  if (isSequentialPrimitive(componentType)) {
    return true;
  }

  // Resolve the circuit definition from the library
  const circuit = resolveCircuit(componentType);
  if (!circuit) {
    // Circuit not found in library, assume non-sequential
    return false;
  }

  // If this is a primitive implementation, it's not sequential (we already checked above)
  if (circuit.implementation.kind === 'primitive') {
    return false;
  }

  // For composite circuits, recursively check all internal nodes
  if (circuit.implementation.kind === 'composite') {
    for (const node of circuit.nodes) {
      // Recursively check if this node's circuit is sequential
      if (containsSequentialCircuit(node.componentRef, components, resolveCircuit, visited)) {
        return true;
      }
    }
  }

  // No sequential circuits found
  return false;
}

/**
 * Checks if the current circuit has any sequential circuits,
 * including those nested inside composite circuits.
 *
 * @param components - The current circuit's component instances
 * @param resolveCircuit - Function to resolve circuit definitions from the library
 * @returns true if any circuit in the hierarchy is or contains sequential primitives
 */
export function hasSequentialCircuits(
  components: Record<string, Component>,
  resolveCircuit: (name: string) => Circuit | undefined,
): boolean {
  for (const component of Object.values(components)) {
    if (containsSequentialCircuit(component.type, components, resolveCircuit)) {
      return true;
    }
  }
  return false;
}
