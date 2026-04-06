/**
 * Shared Component Library
 *
 * Builds a reusable CircuitLibrary from primitives.
 * Shared across all API handlers.
 */

import {
  getPrimitives,
  createCircuitLibrary,
} from '../simulator/index.js';
import type { Circuit, CircuitLibrary, MutableCircuitLibrary } from '../types/circuit.js';

let _library: CircuitLibrary | undefined;

/**
 * Get the shared circuit library (lazy-initialized singleton).
 */
export function getLibrary(): CircuitLibrary {
  if (!_library) {
    _library = createCircuitLibrary(getPrimitives());
  }
  return _library;
}

/**
 * Create a mutable library that can accumulate compiled circuits.
 * Used by simulate and test handlers that need to compile user circuits
 * into the same namespace as primitives.
 */
export function createMutableLibrary(): {
  library: MutableCircuitLibrary;
  circuits: Circuit[];
} {
  const circuits: Circuit[] = [...getPrimitives()];

  const library: MutableCircuitLibrary = {
    resolveCircuit: (name: string) => circuits.find((c) => c.name === name),
    getAllPrimitiveNames: () => getPrimitives().map((c) => c.name),
    addCircuit: (circuit: Circuit) => { circuits.push(circuit); },
    getAllCircuitNames: () => circuits.map((c) => c.name),
  };

  return { library, circuits };
}
