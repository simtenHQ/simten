/**
 * IR Store - Logic/Circuit State Management
 *
 * Manages the intermediate representation (IR) of the circuit.
 * Uses Zustand with Immer for immutable state updates.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type { Component, Connection, IRState, ComponentType } from '../types';
import { useComponentLibraryStore } from './component-library-store';
import { createPrimitiveComponent } from '../lib/primitives';

interface IRActions {
  // Component operations
  addComponent: (type: ComponentType, initialValue?: boolean) => string;
  removeComponent: (id: string) => void;
  updateComponent: (id: string, updates: Partial<Component>) => void;

  // Connection operations
  addConnection: (
    sourceComponentId: string,
    sourcePortIndex: number,
    targetComponentId: string,
    targetPortIndex: number
  ) => string | null;
  removeConnection: (id: string) => void;

  // Utility operations
  getComponent: (id: string) => Component | undefined;
  getConnection: (id: string) => Connection | undefined;
  getComponentConnections: (componentId: string) => Connection[];
  clearAll: () => void;
}

export interface IRStore extends IRState, IRActions {}

const initialState: IRState = {
  components: {},
  connections: {},
};

export const useIRStore = create<IRStore>()(
  immer((set, get) => ({
    ...initialState,

    addComponent: (type, initialValue = false) => {
      const id = nanoid();
      set((state) => {
        const component: Component = (() => {
          // Strategy: Try multiple resolution strategies in order:
          // 1. User-defined components from library
          // 2. Primitives from primitives.ts (handles all 31+ primitive types)
          // 3. Error if not found

          // 1. Check if this is a user-defined component in the library
          const componentLibrary = useComponentLibraryStore.getState();
          const userComponent = componentLibrary.resolveComponent(type);
          if (userComponent) {
            return { id, type };
          }

          // 2. Try to create a primitive component using dynamic lookup
          //    This handles ALL primitives defined in primitives.ts including:
          //    - Logic gates (And, Or, Not, etc.)
          //    - I/O (Switch, Led, Button, Input)
          //    - Display (HexDisplay, SevenSegment)
          //    - Arithmetic (Adder, Multiplier, Comparator)
          //    - Sequential (DFlipFlop, Register, RAM, ROM)
          //    - Utility (Splitter, Splitter8to8, Constant, Probe, etc.)
          const primitiveComponent = createPrimitiveComponent(id, type, initialValue);
          if (primitiveComponent) {
            return primitiveComponent as Component;
          }

          // 3. Component not found in either library or primitives
          throw new Error(
            `Unknown component type: ${type}. Component not found in library or primitives.`
          );
        })();
        state.components[id] = component;
      });
      return id;
    },

    removeComponent: (id) => {
      set((state) => {
        // Remove component
        delete state.components[id];

        // Remove all connections involving this component
        Object.keys(state.connections).forEach((connId) => {
          const conn = state.connections[connId];
          if (conn.sourceComponentId === id || conn.targetComponentId === id) {
            delete state.connections[connId];
          }
        });
      });
    },

    updateComponent: (id, updates) => {
      set((state) => {
        const component = state.components[id];
        if (component) {
          Object.assign(component, updates);
        }
      });
    },

    addConnection: (sourceComponentId, sourcePortIndex, targetComponentId, targetPortIndex) => {
      // Validation: check if components exist
      const sourceComponent = get().components[sourceComponentId];
      const targetComponent = get().components[targetComponentId];

      if (!sourceComponent || !targetComponent) {
        console.warn('Invalid connection: component not found');
        return null;
      }

      // Validation: check if connection already exists
      const existingConnection = Object.values(get().connections).find(
        (conn) =>
          conn.sourceComponentId === sourceComponentId &&
          conn.sourcePortIndex === sourcePortIndex &&
          conn.targetComponentId === targetComponentId &&
          conn.targetPortIndex === targetPortIndex
      );

      if (existingConnection) {
        console.warn('Connection already exists');
        return existingConnection.id;
      }

      // Validation: check if target port is already connected
      const targetPortConnected = Object.values(get().connections).some(
        (conn) => conn.targetComponentId === targetComponentId && conn.targetPortIndex === targetPortIndex
      );

      if (targetPortConnected) {
        console.warn('Target port already connected');
        return null;
      }

      const id = nanoid();
      set((state) => {
        state.connections[id] = {
          id,
          sourceComponentId,
          sourcePortIndex,
          targetComponentId,
          targetPortIndex,
        };
      });
      return id;
    },

    removeConnection: (id) => {
      set((state) => {
        delete state.connections[id];
      });
    },

    getComponent: (id) => {
      return get().components[id];
    },

    getConnection: (id) => {
      return get().connections[id];
    },

    getComponentConnections: (componentId) => {
      return Object.values(get().connections).filter(
        (conn) => conn.sourceComponentId === componentId || conn.targetComponentId === componentId
      );
    },

    clearAll: () => {
      set(initialState);
    },
  }))
);
