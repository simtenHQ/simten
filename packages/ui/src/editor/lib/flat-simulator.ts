/**
 * Flat Circuit Simulator
 *
 * This module provides backwards-compatible exports for the flat simulator.
 * The actual implementation uses the fast numeric simulator from src/core/simulator.
 *
 * UI code should continue to import from this file. The exports here
 * automatically adapt the core simulator to work with Zustand stores.
 */

// Re-export types from core simulator
export type {
  FlatPortValueMap,
  FlatSequentialState,
  FlatSimulationResult,
} from '../../simulator';

// Import adapters and stores
import { useComponentLibraryStore } from '../stores/component-library-store';
import { useMemoryDataStore } from '../stores/memory-data-store';
import type { FlatCircuit } from './elaboration';
import type { FlatPortValueMap, FlatSequentialState, FlatSimulationResult, ComponentLibrary } from '../../simulator';
import {
  initializeFlatSequentialState as coreInitState,
  createSimulator,
} from '../../simulator';

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
 * Cache simulators per circuit to avoid recreating on every tick.
 * WeakMap ensures simulators are garbage collected when circuits are.
 */
const simulatorCache = new WeakMap<FlatCircuit, ReturnType<typeof createSimulator>>();

function getOrCreateSimulator(flatCircuit: FlatCircuit): ReturnType<typeof createSimulator> {
  let sim = simulatorCache.get(flatCircuit);
  if (!sim) {
    sim = createSimulator(flatCircuit, {
      componentLibrary: adaptStore(),
      initialMemory: getMemoryData(),
    });
    simulatorCache.set(flatCircuit, sim);
  }
  return sim;
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
 * Run flat combinational simulation using the fast simulator.
 *
 * @param flatCircuit - The flattened circuit to simulate
 * @param seqState - Optional sequential state for stateful components
 */
export function runFlatCombinationalSimulation(
  flatCircuit: FlatCircuit,
  seqState?: FlatSequentialState
): FlatSimulationResult {
  const sim = createSimulator(flatCircuit, {
    componentLibrary: adaptStore(),
    initialMemory: getMemoryData(),
  });

  const result = sim.runCombinational();
  return {
    portValues: result.portValues as FlatPortValueMap,
    sequentialState: seqState,
    error: result.error,
  };
}

/**
 * Run full flat simulation tick using the fast simulator.
 *
 * @param flatCircuit - The flattened circuit to simulate
 * @param seqState - Sequential state (registers, etc.) - MUTATED in place for backwards compatibility
 * @param previousPortValues - Previous tick's port values (unused, kept for API compat)
 */
export function runFlatSimulationTick(
  flatCircuit: FlatCircuit,
  seqState: FlatSequentialState,
  previousPortValues?: FlatPortValueMap
): FlatSimulationResult {
  // Use cached simulator - don't create a new one every tick!
  const sim = getOrCreateSimulator(flatCircuit);

  const result = sim.tick();

  // Update the passed-in seqState in place for backwards compatibility
  // (old API expected seqState to be mutated)
  // NOTE: result.sequentialState maps might be the same reference as seqState maps
  // (due to how createNumericSequentialState and toFlatSequentialState work),
  // so we need to copy values first before clearing to avoid clearing the source.
  const newCurrentState = new Map(result.sequentialState.currentState);
  const newNextState = new Map(result.sequentialState.nextState);
  const newClocks = new Map(result.sequentialState.clocks);

  seqState.currentState.clear();
  for (const [k, v] of newCurrentState) {
    seqState.currentState.set(k, v);
  }
  seqState.nextState.clear();
  for (const [k, v] of newNextState) {
    seqState.nextState.set(k, v);
  }
  seqState.clocks.clear();
  for (const [k, v] of newClocks) {
    seqState.clocks.set(k, v);
  }
  seqState.cycleCount = result.sequentialState.cycleCount;

  return {
    portValues: result.portValues as FlatPortValueMap,
    sequentialState: seqState,
    error: undefined,
  };
}
