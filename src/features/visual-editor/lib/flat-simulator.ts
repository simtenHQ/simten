/**
 * Flat Circuit Simulator
 *
 * This module provides backwards-compatible exports for the flat simulator.
 * The actual implementation has been moved to src/core/simulator for
 * environment-agnostic execution.
 *
 * UI code should continue to import from this file. The exports here
 * automatically adapt the core simulator to work with Zustand stores.
 */

// Re-export types from core simulator
export type {
  FlatPortValueMap,
  FlatSequentialState,
  FlatSimulationResult,
} from '@/core/simulator';

// Import adapters and stores
import { useComponentLibraryStore } from '../stores/component-library-store';
import { useMemoryDataStore } from '../stores/memory-data-store';
import type { FlatCircuit } from './elaboration';
import type { FlatPortValueMap, FlatSequentialState, FlatSimulationResult, ComponentLibrary } from '@/core/simulator';
import {
  initializeFlatSequentialState as coreInitState,
  runFlatCombinationalSimulation as coreCombSim,
  runFlatSimulationTick as coreTick,
} from '@/core/simulator';

/**
 * Adapt a ComponentLibraryStore to the pure ComponentLibrary interface.
 */
function adaptStore(): ComponentLibrary {
  const store = useComponentLibraryStore.getState();
  return {
    resolveComponent: (name: string) => store.resolveComponent(name),
    getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
  };
}

/**
 * Get memory data from the Zustand store as a pure Map.
 */
function getMemoryData(): Map<string, Map<number, number>> {
  const storeState = useMemoryDataStore.getState();
  const result = new Map<string, Map<number, number>>();
  for (const [pattern, entry] of storeState.loadedData) {
    result.set(pattern, entry.data);
  }
  return result;
}

/**
 * Initialize sequential state for all stateful primitives in flat circuit.
 *
 * This function adapts the core simulator to use Zustand stores.
 */
export function initializeFlatSequentialState(
  flatCircuit: FlatCircuit
): FlatSequentialState {
  return coreInitState(flatCircuit, adaptStore(), getMemoryData());
}

/**
 * Run flat combinational simulation using event-driven propagation.
 * O(K) where K = nodes that actually change, instead of O(N) for all nodes.
 *
 * @param flatCircuit - The flattened circuit to simulate
 * @param seqState - Optional sequential state for stateful components
 * @param initialPortValues - Optional initial port values (e.g., from previous simulation)
 * @param changedNodeIds - Optional list of nodes that changed (for incremental updates)
 */
export function runFlatCombinationalSimulation(
  flatCircuit: FlatCircuit,
  seqState?: FlatSequentialState,
  initialPortValues?: FlatPortValueMap,
  changedNodeIds?: string[]
): FlatSimulationResult {
  return coreCombSim(flatCircuit, adaptStore(), seqState, initialPortValues, changedNodeIds);
}

/**
 * Run full flat simulation tick (combinational + sequential phases)
 * Uses event-driven propagation for O(K) performance.
 *
 * Tick structure:
 * 1. Seed queue with source nodes and state-output nodes
 * 2. Propagate until stable (reads current register values)
 * 3. Clock HIGH - capture sequential inputs
 * 4. Commit state (nextState -> currentState)
 * 5. Seed queue with state-output nodes only
 * 6. Propagate again (registers output new values)
 *
 * @param flatCircuit - The flattened circuit to simulate
 * @param seqState - Sequential state (registers, etc.)
 * @param previousPortValues - Previous tick's port values (enables O(K) change detection)
 * @param inputValues - Optional map of input values to inject (key: "__top__.inputName")
 */
export function runFlatSimulationTick(
  flatCircuit: FlatCircuit,
  seqState: FlatSequentialState,
  previousPortValues?: FlatPortValueMap,
  inputValues?: FlatPortValueMap
): FlatSimulationResult {
  const result = coreTick(flatCircuit, seqState, adaptStore(), previousPortValues, inputValues);
  // Return without the metrics to maintain backwards compatibility with FlatSimulationResult type
  return {
    portValues: result.portValues,
    sequentialState: result.sequentialState,
    error: result.error
  };
}
