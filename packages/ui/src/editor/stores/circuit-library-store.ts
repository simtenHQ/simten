/**
 * Circuit Library Store
 *
 * Manages the library of available circuit definitions.
 * Includes primitives, standard library, and user-defined circuits.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import type { Circuit } from '../types/circuit';
import { clearReferenceCircuitCache } from '../utils/reference-circuit-cache';
import type { BuiltCircuit } from '@turing-incomplete/core/circuit';
import * as std from '@turing-incomplete/core/std';

// Extract Circuit IR objects from all stdlib BuiltCircuit exports
const STD_CIRCUITS: Circuit[] = Object.values(std)
  .filter((v): v is BuiltCircuit => !!v && typeof v === 'object' && 'name' in v && 'circuit' in v)
  .map((v) => v.circuit);

// Enable Immer's MapSet plugin for Map/Set support
enableMapSet();

/**
 * Circuit library data structure (UI-layer; distinct from core CircuitLibrary)
 */
export interface CircuitLibraryData {
  // Primitive circuits (implemented by simulator kernel)
  primitives: Map<string, Circuit>;

  // Standard library circuits (composite circuits)
  standard: Map<string, Circuit>;

  // User-defined circuits
  user: Map<string, Circuit>;
}

interface CircuitLibraryState {
  library: CircuitLibraryData;
}

interface CircuitLibraryActions {
  // Primitive operations
  registerPrimitive: (circuit: Circuit) => void;
  getPrimitive: (name: string) => Circuit | undefined;

  // Standard library operations
  registerStandard: (circuit: Circuit) => void;
  getStandard: (name: string) => Circuit | undefined;

  // User circuit operations
  registerUser: (circuit: Circuit) => void;
  removeUser: (name: string) => void;
  getUser: (name: string) => Circuit | undefined;

  // Unified resolution
  resolveCircuit: (name: string) => Circuit | undefined;

  // Bulk operations
  registerPrimitives: (circuits: Circuit[]) => void;
  registerStandardLibrary: (circuits: Circuit[]) => void;

  // Query operations
  getAllPrimitiveNames: () => string[];
  getAllStandardNames: () => string[];
  getAllUserNames: () => string[];
  getAllCircuitNames: () => string[];

  // Initialization
  initializeLibrary: () => void;

  // Clear operations
  clearUserCircuits: () => void;
  clearAll: () => void;
}

export interface CircuitLibraryStore extends CircuitLibraryState, CircuitLibraryActions {}

const initialState: CircuitLibraryState = {
  library: {
    primitives: new Map(),
    standard: new Map(),
    user: new Map(),
  },
};

export const useCircuitLibraryStore = create<CircuitLibraryStore>()(
  immer((set, get) => ({
    ...initialState,

    // Primitive operations
    registerPrimitive: (circuit) => {
      set((state) => {
        state.library.primitives.set(circuit.name, circuit);
      });
    },

    getPrimitive: (name) => {
      return get().library.primitives.get(name);
    },

    // Standard library operations
    registerStandard: (circuit) => {
      set((state) => {
        state.library.standard.set(circuit.name, circuit);
      });
    },

    getStandard: (name) => {
      return get().library.standard.get(name);
    },

    // User circuit operations
    registerUser: (circuit) => {
      set((state) => {
        state.library.user.set(circuit.name, circuit);
      });
      clearReferenceCircuitCache();
    },

    removeUser: (name) => {
      set((state) => {
        state.library.user.delete(name);
      });
    },

    getUser: (name) => {
      return get().library.user.get(name);
    },

    // Unified resolution
    // Resolution order: primitives -> standard -> user
    resolveCircuit: (name) => {
      const { primitives, standard, user } = get().library;

      return (
        primitives.get(name) ||
        standard.get(name) ||
        user.get(name)
      );
    },

    // Bulk operations
    registerPrimitives: (circuits) => {
      set((state) => {
        for (const circuit of circuits) {
          state.library.primitives.set(circuit.name, circuit);
        }
      });
    },

    registerStandardLibrary: (circuits) => {
      set((state) => {
        for (const circuit of circuits) {
          state.library.standard.set(circuit.name, circuit);
        }
      });
    },

    // Query operations
    getAllPrimitiveNames: () => {
      return Array.from(get().library.primitives.keys()).sort();
    },

    getAllStandardNames: () => {
      return Array.from(get().library.standard.keys()).sort();
    },

    getAllUserNames: () => {
      return Array.from(get().library.user.keys()).sort();
    },

    getAllCircuitNames: () => {
      const { primitives, standard, user } = get().library;
      return [
        ...primitives.keys(),
        ...standard.keys(),
        ...user.keys(),
      ].sort();
    },

    // Clear operations
    clearUserCircuits: () => {
      set((state) => {
        state.library.user.clear();
      });
      clearReferenceCircuitCache();
    },

    initializeLibrary: () => {
      if (get().library.primitives.size > 0) return; // already initialized
      set((state) => {
        for (const circuit of STD_CIRCUITS) {
          state.library.primitives.set(circuit.name, circuit);
        }
      });
    },

    clearAll: () => {
      set((state) => {
        state.library.primitives.clear();
        state.library.standard.clear();
        state.library.user.clear();
      });
    },
  }))
);
