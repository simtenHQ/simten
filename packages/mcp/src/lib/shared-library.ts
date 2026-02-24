/**
 * Shared Component Library
 *
 * Builds a reusable ComponentLibrary from primitives.
 * Shared across all MCP tool handlers.
 */

import {
  getPrimitives,
  createComponentLibrary,
} from '@turing-incomplete/core/simulator';
import type { Circuit, ComponentLibrary } from '@turing-incomplete/core';
import type { DSLComponentLibrary } from '@turing-incomplete/core/dsl';

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
 * Used by simulate and test tools that need to compile user circuits
 * into the same namespace as primitives.
 *
 * Returns the compiler-compatible library interface and the backing array.
 */
export function createMutableLibrary(): {
  library: DSLComponentLibrary;
  circuits: Circuit[];
} {
  const circuits: Circuit[] = [...getPrimitives()];

  const library: DSLComponentLibrary = {
    resolveComponent: (name: string) => circuits.find((c) => c.name === name),
    getAllPrimitiveNames: () => getPrimitives().map((c) => c.name),
    getCircuit: (name: string) => circuits.find((c) => c.name === name),
    hasCircuit: (name: string) => circuits.some((c) => c.name === name),
    addCircuit: (circuit: Circuit) => { circuits.push(circuit); },
  };

  return { library, circuits };
}
