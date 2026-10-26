/**
 * Circuit Library Store
 *
 * Holds all circuit definitions available for simulation and canvas rendering.
 * Populated from the compiled result of executeCircuitCode() via setLibrary().
 *
 * All circuits are equal — no primitives/standard/user split.
 */

import type { CircuitDefinitions } from '@simten/core/internal';
import { create } from 'zustand';
import type { CircuitIR } from '../types/circuit';

interface CircuitLibraryStore {
  // Stable CircuitDefinitions reference — changes identity only when circuits change.
  // null until first compile succeeds (or addCircuit is called).
  library: CircuitDefinitions | null;

  // Set all circuits from a compiled result (production path)
  setLibrary: (lib: {
    resolveCircuit(name: string): CircuitIR | undefined;
    getAllCircuitNames(): string[];
  }) => void;

  // Add circuits directly (used by tests)
  addCircuit: (circuit: CircuitIR) => void;
  addCircuits: (circuits: CircuitIR[]) => void;

  // Clear all circuits
  clear: () => void;

  // Consumer interface — delegates to library
  resolveCircuit: (name: string) => CircuitIR | undefined;
  getAllPrimitiveNames: () => string[];
}

export type { CircuitLibraryStore };

function buildLibrary(circuits: Map<string, CircuitIR>): CircuitDefinitions {
  // Snapshot the map so the library is immutable after creation
  const snapshot = new Map(circuits);
  return {
    resolveCircuit: (name) => snapshot.get(name),
    getAllPrimitiveNames: () =>
      [...snapshot.entries()]
        .filter(([, c]) => c.implementation.kind === 'primitive')
        .map(([n]) => n),
  };
}

export const useCircuitLibraryStore = create<CircuitLibraryStore>()((set, get) => {
  // Mutable backing map — not in Zustand state to avoid serialization overhead
  const _circuits = new Map<string, CircuitIR>();

  return {
    library: null,

    setLibrary: (lib) => {
      _circuits.clear();
      for (const name of lib.getAllCircuitNames()) {
        const c = lib.resolveCircuit(name);
        if (c) _circuits.set(name, c as CircuitIR);
      }
      set({ library: buildLibrary(_circuits) });
    },

    addCircuit: (circuit) => {
      _circuits.set(circuit.name, circuit);
      set({ library: buildLibrary(_circuits) });
    },

    addCircuits: (circuits) => {
      for (const c of circuits) _circuits.set(c.name, c);
      set({ library: buildLibrary(_circuits) });
    },

    clear: () => {
      _circuits.clear();
      set({ library: null });
    },

    resolveCircuit: (name) => get().library?.resolveCircuit(name) as CircuitIR | undefined,

    getAllPrimitiveNames: () => get().library?.getAllPrimitiveNames() ?? [],
  };
});
