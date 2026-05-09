/**
 * Shared Component Library
 *
 * Builds a reusable mutable CircuitLibrary.
 * Circuits + their dependencies are added by callers.
 */

import type { Circuit, CircuitLibrary, MutableCircuitLibrary } from '../types/circuit.js';
import type { BuiltCircuit } from '../circuit/types.js';
import * as std from '../std/index.js';

let cachedLibrary: CircuitLibrary | null = null;

/**
 * Returns the canonical stdlib CircuitLibrary (cached singleton).
 */
export function getLibrary(): CircuitLibrary {
  if (cachedLibrary) return cachedLibrary;

  const { library } = createMutableLibrary();

  for (const value of Object.values(std)) {
    if (value && typeof value === 'object' && 'circuit' in value) {
      const built = value as BuiltCircuit;
      if (built.circuit) {
        library.addCircuit(built.circuit);
        if (built._dependencies) {
          for (const [, dep] of built._dependencies) {
            library.addCircuit(dep.circuit);
          }
        }
      }
    }
  }

  cachedLibrary = library;
  return library;
}

export function createMutableLibrary(): {
  library: MutableCircuitLibrary;
  circuits: Circuit[];
} {
  const circuits: Circuit[] = [];

  const library: MutableCircuitLibrary = {
    resolveCircuit: (name: string) => circuits.find((c) => c.name === name),
    getAllPrimitiveNames: () => circuits.filter(c => c.implementation.kind === 'primitive').map((c) => c.name),
    addCircuit: (circuit: Circuit) => { circuits.push(circuit); },
    getAllCircuitNames: () => circuits.map((c) => c.name),
  };

  return { library, circuits };
}
