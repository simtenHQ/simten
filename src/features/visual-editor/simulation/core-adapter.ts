/**
 * Core Simulator Adapter
 *
 * This adapter bridges the pure core simulator engine with the UI layer.
 * It provides integration with Zustand stores and UI-specific functionality.
 *
 * The core simulator (src/core/simulator) is pure and environment-agnostic.
 * This adapter adds:
 * - Zustand store integration (ComponentLibraryStore, MemoryDataStore)
 * - Circuit IR transformation
 * - Environmental state management (Switches, Buttons, Inputs)
 */

import type { Circuit } from '../types/ir-v0.1';
import type { ComponentLibraryStore } from '../stores/component-library-store';
import type { ComponentLibrary } from '@/core/simulator/types';
import {
  elaborate as coreElaborate,
  initializeFlatSequentialState as coreInitState,
  runFlatCombinationalSimulation as coreCombSim,
  runFlatSimulationTick as coreTick,
  type FlatCircuit,
  type FlatSequentialState,
  type FlatPortValueMap,
} from '@/core/simulator';
import { useMemoryDataStore } from '../stores/memory-data-store';

/**
 * Adapt a ComponentLibraryStore to the pure ComponentLibrary interface.
 *
 * This allows the core simulator to use the Zustand store without
 * directly depending on Zustand.
 */
export function adaptComponentLibraryStore(store: ComponentLibraryStore): ComponentLibrary {
  return {
    resolveComponent: (name: string) => store.resolveComponent(name),
    getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
  };
}

/**
 * Get memory data from the Zustand store as a pure Map.
 *
 * @returns Map of pattern -> memory data
 */
export function getMemoryDataFromStore(): Map<string, Map<number, number>> {
  const storeState = useMemoryDataStore.getState();
  const result = new Map<string, Map<number, number>>();

  for (const [pattern, entry] of storeState.loadedData) {
    result.set(pattern, entry.data);
  }

  return result;
}

/**
 * Elaborate a circuit using the core elaborator with store adaptation.
 */
export function elaborate(
  circuit: Circuit,
  library: ComponentLibraryStore,
  debug: boolean = false
): FlatCircuit {
  const adapter = adaptComponentLibraryStore(library);
  return coreElaborate(circuit, adapter, debug);
}

/**
 * Initialize sequential state using the core function with store data.
 */
export function initializeFlatSequentialState(
  flatCircuit: FlatCircuit,
  library: ComponentLibraryStore
): FlatSequentialState {
  const adapter = adaptComponentLibraryStore(library);
  const memoryData = getMemoryDataFromStore();
  return coreInitState(flatCircuit, adapter, memoryData);
}

/**
 * Run combinational simulation using the core function.
 */
export function runFlatCombinationalSimulation(
  flatCircuit: FlatCircuit,
  library: ComponentLibraryStore,
  seqState?: FlatSequentialState,
  initialPortValues?: FlatPortValueMap,
  changedNodeIds?: string[]
) {
  const adapter = adaptComponentLibraryStore(library);
  return coreCombSim(flatCircuit, adapter, seqState, initialPortValues, changedNodeIds);
}

/**
 * Run simulation tick using the core function.
 */
export function runFlatSimulationTick(
  flatCircuit: FlatCircuit,
  seqState: FlatSequentialState,
  library: ComponentLibraryStore,
  previousPortValues?: FlatPortValueMap,
  inputValues?: FlatPortValueMap
) {
  const adapter = adaptComponentLibraryStore(library);
  return coreTick(flatCircuit, seqState, adapter, previousPortValues, inputValues);
}

// Re-export types that UI code needs
export type { FlatCircuit, FlatSequentialState, FlatPortValueMap } from '@/core/simulator';
export { TOP_LEVEL_NODE, isFlatCircuit, topologicalSortFlat } from '@/core/simulator';
