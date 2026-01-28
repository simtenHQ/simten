/**
 * Time-Travel Debugging Utilities
 *
 * Provides functions for capturing and restoring simulation snapshots
 * to enable deterministic time-travel debugging.
 *
 * Key principles:
 * - Sequential state is deterministic given (previous sequential state + environmental state)
 * - Always capture BEFORE tick (snapshot represents state at cycle start)
 * - Always clone state to prevent mutation
 * - Metadata-driven discovery (no hardcoded component lists)
 */

import type { Circuit, Node, ArgumentValue } from '../types/ir-v0.1';
import type { SequentialState } from './simulator-v0.1';
import type { SimulationSnapshot, EnvironmentalStateValue } from '../types/simulation-snapshot';
import { PRIMITIVE_DEFINITIONS } from './primitives';

/**
 * Captures environmental state from all nodes with environmental state
 * Uses metadata-driven discovery (no hardcoded component lists)
 *
 * Environmental state = values from outside the circuit (user inputs, sensors, RNG)
 * Examples: Switch positions, Button states, Input values
 *
 * @param circuit - The circuit to capture environmental state from
 * @returns Map of nodeId -> environmental state value
 */
export function captureEnvironmentalState(circuit: Circuit): Map<string, EnvironmentalStateValue> {
  const environmentalState = new Map<string, EnvironmentalStateValue>();

  for (const node of circuit.nodes) {
    const primitiveDef = PRIMITIVE_DEFINITIONS[node.componentRef];

    if (primitiveDef?.hasEnvironmentalState && primitiveDef.captureEnvironmentalState) {
      const state = primitiveDef.captureEnvironmentalState(node);

      // Clone if mutable (defensive copy)
      const clonedState = structuredClone(state);
      environmentalState.set(node.id, clonedState);
    }
  }

  return environmentalState;
}

/**
 * Restores environmental state to all nodes
 *
 * This updates the circuit nodes via the circuit store to properly restore their environmental state.
 * Must be idempotent (can be called multiple times safely).
 *
 * @param circuit - The circuit to restore environmental state to
 * @param environmentalState - Map of nodeId -> environmental state value
 * @param updateNode - Function to update a node (from circuit store)
 */
export function restoreEnvironmentalState(
  circuit: Circuit,
  environmentalState: Map<string, EnvironmentalStateValue>,
  updateNode: (nodeId: string, updates: Partial<Node>) => void
): void {
  for (const node of circuit.nodes) {
    const state = environmentalState.get(node.id);

    if (state !== undefined) {
      const primitiveDef = PRIMITIVE_DEFINITIONS[node.componentRef];

      if (primitiveDef?.hasEnvironmentalState) {
        // Clone before restoring (prevent snapshot mutation)
        const clonedState = structuredClone(state);

        // Update via circuit store to respect immutability
        // Cast to ArgumentValue since we know environmental state values are compatible
        updateNode(node.id, {
          arguments: {
            ...node.arguments,
            value: clonedState as ArgumentValue,
          },
        });
      }
    }
  }
}

/**
 * Creates a complete simulation snapshot
 *
 * CRITICAL: Call this BEFORE runSimulationTick
 * - Captures state at START of cycle
 * - This state determines the tick result (determinism)
 *
 * The snapshot includes:
 * 1. Sequential state (registers, RAM, counters)
 * 2. Environmental state (user inputs, external sources)
 * 3. Metadata (cycle number, timestamp)
 *
 * @param sequentialState - Current sequential state
 * @param circuit - The circuit to capture environmental state from
 * @returns Complete simulation snapshot
 */
export function createSnapshot(sequentialState: SequentialState, circuit: Circuit): SimulationSnapshot {
  // Clone sequential state (reuse existing pattern from ClockControls)
  const clonedSeqState: SequentialState = {
    currentState: new Map(),
    nextState: new Map(),
    clocks: new Map(sequentialState.clocks),
    cycleCount: sequentialState.cycleCount,
  };

  // Deep copy Maps for memory components (RAM, etc.)
  for (const [nodeId, value] of sequentialState.currentState.entries()) {
    if (value instanceof Map) {
      clonedSeqState.currentState.set(nodeId, new Map(value));
    } else {
      clonedSeqState.currentState.set(nodeId, value);
    }
  }

  for (const [nodeId, value] of sequentialState.nextState.entries()) {
    if (value instanceof Map) {
      clonedSeqState.nextState.set(nodeId, new Map(value));
    } else {
      clonedSeqState.nextState.set(nodeId, value);
    }
  }

  // Capture environmental state
  const environmentalState = captureEnvironmentalState(circuit);

  return {
    sequentialState: clonedSeqState,
    environmentalState,
    cycleNumber: sequentialState.cycleCount,
    timestamp: Date.now(),
  };
}

/**
 * Restores a complete simulation snapshot
 *
 * This function:
 * 1. Restores environmental state to circuit nodes (via updateNode)
 * 2. Returns the sequential state for caller to use (via setSeqState)
 *
 * Note: The caller is responsible for calling setSeqState with the returned sequential state.
 * This allows the store to update and trigger React re-renders.
 *
 * @param snapshot - The snapshot to restore
 * @param circuit - The circuit to restore environmental state to
 * @param updateNode - Function to update a node (from circuit store)
 * @returns The sequential state to set (caller must call setSeqState)
 */
export function restoreSnapshot(
  snapshot: SimulationSnapshot,
  circuit: Circuit,
  updateNode: (nodeId: string, updates: Partial<Node>) => void
): SequentialState {
  // Restore environmental state to circuit nodes
  restoreEnvironmentalState(circuit, snapshot.environmentalState, updateNode);

  // Return sequential state (caller will use setSeqState)
  return snapshot.sequentialState;
}
