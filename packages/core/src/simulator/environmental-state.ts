/**
 * Environmental State — captures/restores user input values (Switch, Button, Input)
 * for time-travel debugging.
 *
 * Environmental state = values from outside the circuit (user inputs, sensors).
 * On time-travel, simulation state is restored by the engine, but environmental
 * state (switch positions, input values) must be restored separately via callbacks.
 */

import type { Circuit, Node, ArgumentValue } from '../types/circuit.js';
import { PRIMITIVE_DEFINITIONS } from './primitives.js';

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
 * Uses metadata-driven discovery via primitive def's `environmentalState` field.
 */
export function captureEnvironmentalState(
  circuit: Circuit,
): Map<string, EnvironmentalStateValue> {
  const result = new Map<string, EnvironmentalStateValue>();

  for (const node of circuit.nodes) {
    const def = PRIMITIVE_DEFINITIONS[node.componentRef];
    if (def?.environmentalState) {
      const value = node.arguments[def.environmentalState];
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
): void {
  for (const node of circuit.nodes) {
    const value = environmentalState.get(node.id);
    if (value === undefined) continue;

    const def = PRIMITIVE_DEFINITIONS[node.componentRef];
    if (def?.environmentalState) {
      updateNode(node.id, {
        arguments: {
          ...node.arguments,
          [def.environmentalState]: structuredClone(value) as ArgumentValue,
        },
      });
    }
  }
}
