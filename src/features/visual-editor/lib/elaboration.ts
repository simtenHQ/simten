/**
 * Circuit Elaboration Engine
 *
 * This module provides backwards-compatible exports for the elaboration engine.
 * The actual implementation has been moved to src/core/simulator for
 * environment-agnostic execution.
 *
 * UI code should continue to import from this file. The exports here
 * automatically adapt the core elaborator to work with Zustand stores.
 */

// Re-export types from core simulator
export type {
  FlatCircuit,
  FlatNode,
  FlatConnection,
  HierarchyNode,
  InputSource,
} from '@/core/simulator';

export { TOP_LEVEL_NODE, isFlatCircuit } from '@/core/simulator';

// Import for adaptation
import type { Circuit } from '../types/ir-v0.1';
import type { ComponentLibraryStore } from '../stores/component-library-store';
import type { FlatCircuit, FlatNode, FlatConnection, ComponentLibrary } from '@/core/simulator';
import {
  elaborate as coreElaborate,
  topologicalSortFlat as coreTopoSort,
} from '@/core/simulator';

/**
 * Adapt a ComponentLibraryStore to the pure ComponentLibrary interface.
 */
function adaptStore(store: ComponentLibraryStore): ComponentLibrary {
  return {
    resolveComponent: (name: string) => store.resolveComponent(name),
    getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
  };
}

/**
 * Elaborate a circuit: recursively flatten all composites into primitives.
 *
 * This is the main entry point for circuit elaboration.
 * It transforms a hierarchical circuit into a flat netlist of primitives.
 *
 * @param circuit - The circuit to elaborate
 * @param library - Component library for resolving component definitions
 * @param debug - Enable debug logging
 * @returns Flattened circuit with only primitives
 */
export function elaborate(
  circuit: Circuit,
  library: ComponentLibraryStore,
  debug: boolean = false
): FlatCircuit {
  const adapter = adaptStore(library);
  return coreElaborate(circuit, adapter, debug);
}

/**
 * Topological sort for flat circuits.
 * Only considers combinational edges (excludes edges TO sequential elements).
 *
 * @param nodes - Flat node list (all primitives)
 * @param connections - Flat connection list
 * @param library - Component library for checking metadata
 * @returns Node IDs in evaluation order, or null if cycle detected
 */
export function topologicalSortFlat(
  nodes: FlatNode[],
  connections: FlatConnection[],
  library: ComponentLibraryStore
): string[] | null {
  const adapter = adaptStore(library);
  return coreTopoSort(nodes, connections, adapter);
}
