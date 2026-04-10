/**
 * Circuit Library Store
 *
 * Holds all circuit definitions available for simulation and canvas rendering.
 * Populated from the compiled result of executeCircuitCode() via setLibrary().
 *
 * All circuits are equal — no primitives/standard/user split.
 */

import { create } from 'zustand';
import type { Circuit } from '../types/circuit';
import type { CircuitLibrary } from '@simten/core/simulator';

interface CircuitLibraryStore {
  // Stable CircuitLibrary reference — changes identity only when circuits change.
  // null until first compile succeeds (or addCircuit is called).
  library: CircuitLibrary | null;

  // Set all circuits from a compiled result (production path)
  setLibrary: (lib: { resolveCircuit(name: string): Circuit | undefined; getAllCircuitNames(): string[] }) => void;

  // Add circuits directly (used by tests)
  addCircuit: (circuit: Circuit) => void;
  addCircuits: (circuits: Circuit[]) => void;

  // Clear all circuits
  clear: () => void;

  // Consumer interface — delegates to library
  resolveCircuit: (name: string) => Circuit | undefined;
  getAllPrimitiveNames: () => string[];
}

export type { CircuitLibraryStore };

function buildLibrary(circuits: Map<string, Circuit>): CircuitLibrary {
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
  const _circuits = new Map<string, Circuit>();

  return {
    library: null,

    setLibrary: (lib) => {
      _circuits.clear();
      for (const name of lib.getAllCircuitNames()) {
        const c = lib.resolveCircuit(name);
        if (c) _circuits.set(name, c as Circuit);
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

    resolveCircuit: (name) => get().library?.resolveCircuit(name) as Circuit | undefined,

    getAllPrimitiveNames: () => get().library?.getAllPrimitiveNames() ?? [],
  };
});
