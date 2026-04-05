/**
 * Shared Component Library
 *
 * Builds a reusable ComponentLibrary from primitives.
 * Shared across all API handlers.
 */

import {
  getPrimitives,
  createComponentLibrary,
} from '../simulator/index.js';
import type { Circuit, ComponentLibrary, MutableComponentLibrary } from '../types/circuit.js';

let _library: ComponentLibrary | undefined;

/**
 * Get the shared component library (lazy-initialized singleton).
 */
export function getLibrary(): ComponentLibrary {
  if (!_library) {
    _library = createComponentLibrary(getPrimitives());
  }
  return _library;
}

/**
 * Create a mutable library that can accumulate compiled circuits.
 * Used by simulate and test handlers that need to compile user circuits
 * into the same namespace as primitives.
 */
export function createMutableLibrary(): {
  library: MutableComponentLibrary;
  circuits: Circuit[];
} {
  const circuits: Circuit[] = [...getPrimitives()];

  const library: MutableComponentLibrary = {
    resolveComponent: (name: string) => circuits.find((c) => c.name === name),
    getAllPrimitiveNames: () => getPrimitives().map((c) => c.name),
    addCircuit: (circuit: Circuit) => { circuits.push(circuit); },
    getAllComponentNames: () => circuits.map((c) => c.name),
  };

  return { library, circuits };
}
