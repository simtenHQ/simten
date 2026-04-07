/**
 * Shared Component Library
 *
 * Builds a reusable mutable CircuitLibrary.
 * Circuits + their dependencies are added by callers.
 */

import type { Circuit, CircuitLibrary, MutableCircuitLibrary } from '../types/circuit.js';

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
