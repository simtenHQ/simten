/**
 * Environmental State — captures/restores user input values (Switch, Button, Input)
 * for time-travel debugging.
 *
 * Environmental state = values from outside the circuit (user inputs, sensors).
 * On time-travel, simulation state is restored by the engine, but environmental
 * state (switch positions, input values) must be restored separately via callbacks.
 */

import type { ArgumentValue, Circuit, CircuitLibrary, Node } from '../types/circuit.js';

/**
 * Allowed environmental state value types.
 * Must be structuredClone-safe (no functions, no DOM refs).
 */
export type EnvironmentalStateValue =
  | number
  | string
  | boolean
  | null
  | { [key: string]: EnvironmentalStateValue }
  | EnvironmentalStateValue[];

/**
 * Capture environmental state from all nodes that have it.
 * Uses circuit metadata's `interactiveArg` field to discover which nodes have
 * user-interactive arguments (Switch value, Input value, etc.).
 */
export function captureEnvironmentalState(
  circuit: Circuit,
  library?: CircuitLibrary,
): Map<string, EnvironmentalStateValue> {
  const result = new Map<string, EnvironmentalStateValue>();

  for (const node of circuit.nodes) {
    const def = library?.resolveCircuit(node.componentRef);
    const interactiveArg = def?.metadata?.interactiveArg;
    if (interactiveArg) {
      const value = node.arguments[interactiveArg];
      result.set(node.id, structuredClone(value) as EnvironmentalStateValue);
    }
  }

  return result;
}

/**
 * Restore environmental state to circuit nodes.
 * The updateNode callback should update the node in whatever store owns it.
 */
export function restoreEnvironmentalState(
  circuit: Circuit,
  environmentalState: Map<string, EnvironmentalStateValue>,
  updateNode: (nodeId: string, updates: Partial<Node>) => void,
  library?: CircuitLibrary,
): void {
  for (const node of circuit.nodes) {
    const value = environmentalState.get(node.id);
    if (value === undefined) continue;

    const def = library?.resolveCircuit(node.componentRef);
    const interactiveArg = def?.metadata?.interactiveArg;
    if (interactiveArg) {
      updateNode(node.id, {
        arguments: {
          ...node.arguments,
          [interactiveArg]: structuredClone(value) as ArgumentValue,
        },
      });
    }
  }
}
