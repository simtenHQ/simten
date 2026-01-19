/**
 * Component Library Store
 *
 * Manages the library of available component definitions.
 * Includes primitives, standard library, and user-defined components.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import type { Circuit } from '../types/ir-v0.1';

// Enable Immer's MapSet plugin for Map/Set support
enableMapSet();

/**
 * Component library structure
 */
export interface ComponentLibrary {
  // Primitive components (implemented by simulator kernel)
  primitives: Map<string, Circuit>;

  // Standard library components (composite components)
  standard: Map<string, Circuit>;

  // User-defined components
  user: Map<string, Circuit>;
}

interface ComponentLibraryState {
  library: ComponentLibrary;
}

interface ComponentLibraryActions {
  // Primitive operations
  registerPrimitive: (circuit: Circuit) => void;
  getPrimitive: (name: string) => Circuit | undefined;

  // Standard library operations
  registerStandard: (circuit: Circuit) => void;
  getStandard: (name: string) => Circuit | undefined;

  // User component operations
  registerUser: (circuit: Circuit) => void;
  removeUser: (name: string) => void;
  getUser: (name: string) => Circuit | undefined;

  // Unified resolution
  resolveComponent: (name: string) => Circuit | undefined;

  // Bulk operations
  registerPrimitives: (circuits: Circuit[]) => void;
  registerStandardLibrary: (circuits: Circuit[]) => void;

  // Query operations
  getAllPrimitiveNames: () => string[];
  getAllStandardNames: () => string[];
  getAllUserNames: () => string[];
  getAllComponentNames: () => string[];

  // Clear operations
  clearUserComponents: () => void;
  clearAll: () => void;
}

export interface ComponentLibraryStore extends ComponentLibraryState, ComponentLibraryActions {}

const initialState: ComponentLibraryState = {
  library: {
    primitives: new Map(),
    standard: new Map(),
    user: new Map(),
  },
};

export const useComponentLibraryStore = create<ComponentLibraryStore>()(
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

    // User component operations
    registerUser: (circuit) => {
      set((state) => {
        state.library.user.set(circuit.name, circuit);
      });
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
    resolveComponent: (name) => {
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

    getAllComponentNames: () => {
      const { primitives, standard, user } = get().library;
      return [
        ...primitives.keys(),
        ...standard.keys(),
        ...user.keys(),
      ].sort();
    },

    // Clear operations
    clearUserComponents: () => {
      set((state) => {
        state.library.user.clear();
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
