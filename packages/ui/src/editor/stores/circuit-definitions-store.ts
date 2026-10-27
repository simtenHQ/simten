/**
 * Circuit Definitions Store
 *
 * Holds all circuit definitions available for simulation and canvas rendering.
 * Populated from the compiled result of executeCircuitCode() via setDefinitions().
 *
 * All circuits are equal — no primitives/standard/user split.
 */

import type { CircuitDefinitions } from '@simten/core/internal';
import { create } from 'zustand';
import type { CircuitIR } from '../types/circuit';

interface CircuitDefinitionsStore {
  // Stable CircuitDefinitions reference — changes identity only when circuits change.
  // null until first compile succeeds (or addCircuit is called).
  definitions: CircuitDefinitions | null;

  // Set all circuits from a compiled result (production path)
  setDefinitions: (defs: {
    resolveCircuit(name: string): CircuitIR | undefined;
    getAllCircuitNames(): string[];
  }) => void;

  // Add circuits directly (used by tests)
  addCircuit: (circuit: CircuitIR) => void;
  addCircuits: (circuits: CircuitIR[]) => void;

  // Clear all circuits
  clear: () => void;

  // Consumer interface — delegates to definitions
  resolveCircuit: (name: string) => CircuitIR | undefined;
  getAllPrimitiveNames: () => string[];
}

export type { CircuitDefinitionsStore };

function buildDefinitions(circuits: Map<string, CircuitIR>): CircuitDefinitions {
  // Snapshot the map so the definitions are immutable after creation
  const snapshot = new Map(circuits);
  return {
    resolveCircuit: (name) => snapshot.get(name),
    getAllPrimitiveNames: () =>
      [...snapshot.entries()]
        .filter(([, c]) => c.implementation.kind === 'primitive')
        .map(([n]) => n),
  };
}

export const useCircuitDefinitionsStore = create<CircuitDefinitionsStore>()((set, get) => {
  // Mutable backing map — not in Zustand state to avoid serialization overhead
  const _circuits = new Map<string, CircuitIR>();

  return {
    definitions: null,

    setDefinitions: (defs) => {
      _circuits.clear();
      for (const name of defs.getAllCircuitNames()) {
        const c = defs.resolveCircuit(name);
        if (c) _circuits.set(name, c as CircuitIR);
      }
      set({ definitions: buildDefinitions(_circuits) });
    },

    addCircuit: (circuit) => {
      _circuits.set(circuit.name, circuit);
      set({ definitions: buildDefinitions(_circuits) });
    },

    addCircuits: (circuits) => {
      for (const c of circuits) _circuits.set(c.name, c);
      set({ definitions: buildDefinitions(_circuits) });
    },

    clear: () => {
      _circuits.clear();
      set({ definitions: null });
    },

    resolveCircuit: (name) => get().definitions?.resolveCircuit(name) as CircuitIR | undefined,

    getAllPrimitiveNames: () => get().definitions?.getAllPrimitiveNames() ?? [],
  };
});
