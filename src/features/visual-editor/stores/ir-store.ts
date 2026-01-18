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
          switch (type) {
            case 'SWITCH':
              return { id, type: 'SWITCH', value: initialValue };
            case 'LED':
              return { id, type: 'LED', value: false };
            case 'AND_GATE':
              return { id, type: 'AND_GATE' };
            case 'OR_GATE':
              return { id, type: 'OR_GATE' };
            case 'NOT_GATE':
              return { id, type: 'NOT_GATE' };
            case 'NAND_GATE':
              return { id, type: 'NAND_GATE' };
            case 'NOR_GATE':
              return { id, type: 'NOR_GATE' };
            case 'XOR_GATE':
              return { id, type: 'XOR_GATE' };
            case 'XNOR_GATE':
              return { id, type: 'XNOR_GATE' };
            case 'BUFFER':
              return { id, type: 'BUFFER' };
            default:
              throw new Error(`Unknown component type: ${type}`);
          }
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
