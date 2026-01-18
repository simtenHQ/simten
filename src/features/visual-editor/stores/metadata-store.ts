/**
 * Metadata Store - Visual Layout State Management
 *
 * Manages visual properties (positions, dimensions) for components and connections.
 * This store is separate from the IR to maintain clean separation of concerns.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ComponentMetadata, ConnectionMetadata, MetadataState, Position } from '../types';

interface MetadataActions {
  // Component metadata operations
  setComponentMetadata: (id: string, metadata: ComponentMetadata) => void;
  updateComponentPosition: (id: string, position: Position) => void;
  setComponentSelected: (id: string, selected: boolean) => void;
  removeComponentMetadata: (id: string) => void;

  // Connection metadata operations
  setConnectionMetadata: (id: string, metadata: ConnectionMetadata) => void;
  updateConnectionColor: (id: string, color: string) => void;
  updateConnectionWaypoints: (id: string, waypoints: Position[]) => void;
  addConnectionWaypoint: (id: string, waypoint: Position) => void;
  removeConnectionWaypoint: (id: string, waypointIndex: number) => void;
  removeConnectionMetadata: (id: string) => void;

  // Utility operations
  getComponentMetadata: (id: string) => ComponentMetadata | undefined;
  getConnectionMetadata: (id: string) => ConnectionMetadata | undefined;
  clearAll: () => void;
}

export interface MetadataStore extends MetadataState, MetadataActions {}

const initialState: MetadataState = {
  components: {},
  connections: {},
};

export const useMetadataStore = create<MetadataStore>()(
  immer((set, get) => ({
    ...initialState,

    setComponentMetadata: (id, metadata) => {
      set((state) => {
        state.components[id] = metadata;
      });
    },

    updateComponentPosition: (id, position) => {
      set((state) => {
        if (state.components[id]) {
          state.components[id].position = position;
        }
      });
    },

    setComponentSelected: (id, selected) => {
      set((state) => {
        if (state.components[id]) {
          state.components[id].selected = selected;
        }
      });
    },

    removeComponentMetadata: (id) => {
      set((state) => {
        delete state.components[id];
      });
    },

    setConnectionMetadata: (id, metadata) => {
      set((state) => {
        state.connections[id] = metadata;
      });
    },

    updateConnectionColor: (id, color) => {
      set((state) => {
        if (state.connections[id]) {
          state.connections[id].color = color;
        }
      });
    },

    updateConnectionWaypoints: (id, waypoints) => {
      set((state) => {
        if (state.connections[id]) {
          state.connections[id].waypoints = waypoints;
        } else {
          // Create connection metadata if it doesn't exist
          state.connections[id] = { id, waypoints };
        }
      });
    },

    addConnectionWaypoint: (id, waypoint) => {
      set((state) => {
        if (state.connections[id]) {
          if (!state.connections[id].waypoints) {
            state.connections[id].waypoints = [];
          }
          state.connections[id].waypoints!.push(waypoint);
        } else {
          // Create connection metadata with waypoint
          state.connections[id] = { id, waypoints: [waypoint] };
        }
      });
    },

    removeConnectionWaypoint: (id, waypointIndex) => {
      set((state) => {
        if (state.connections[id]?.waypoints) {
          state.connections[id].waypoints = state.connections[id].waypoints!.filter(
            (_, index) => index !== waypointIndex
          );
        }
      });
    },

    removeConnectionMetadata: (id) => {
      set((state) => {
        delete state.connections[id];
      });
    },

    getComponentMetadata: (id) => {
      return get().components[id];
    },

    getConnectionMetadata: (id) => {
      return get().connections[id];
    },

    clearAll: () => {
      set(initialState);
    },
  }))
);
