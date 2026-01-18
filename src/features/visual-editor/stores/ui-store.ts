/**
 * UI Store - Interaction State Management
 *
 * Manages transient UI state for interactions, selections, and temporary operations.
 * This state is ephemeral and typically not persisted.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { UIState, DragOperation, SimulationStatus } from '../types';

interface UIActions {
  // Drag operations
  startDrag: (operation: DragOperation) => void;
  endDrag: () => void;

  // Selection operations
  selectComponent: (id: string) => void;
  deselectComponent: (id: string) => void;
  clearSelection: () => void;
  toggleComponentSelection: (id: string) => void;

  // Simulation operations
  setSimulationStatus: (status: SimulationStatus) => void;
  setSimulationError: (error: string) => void;
  clearSimulationError: () => void;
  incrementStep: () => void;
  resetSimulation: () => void;

  // Canvas operations
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
}

export interface UIStore extends UIState, UIActions {}

const initialState: UIState = {
  drag: null,
  selection: {
    selectedComponentIds: new Set<string>(),
    selectedConnectionIds: new Set<string>(),
  },
  simulation: {
    status: 'idle',
    currentStep: 0,
  },
  canvas: {
    zoom: 1,
    panX: 0,
    panY: 0,
  },
};

export const useUIStore = create<UIStore>()(
  immer((set) => ({
    ...initialState,

    startDrag: (operation) => {
      set((state) => {
        state.drag = operation;
      });
    },

    endDrag: () => {
      set((state) => {
        state.drag = null;
      });
    },

    selectComponent: (id) => {
      set((state) => {
        state.selection.selectedComponentIds.add(id);
      });
    },

    deselectComponent: (id) => {
      set((state) => {
        state.selection.selectedComponentIds.delete(id);
      });
    },

    clearSelection: () => {
      set((state) => {
        state.selection.selectedComponentIds.clear();
        state.selection.selectedConnectionIds.clear();
      });
    },

    toggleComponentSelection: (id) => {
      set((state) => {
        if (state.selection.selectedComponentIds.has(id)) {
          state.selection.selectedComponentIds.delete(id);
        } else {
          state.selection.selectedComponentIds.add(id);
        }
      });
    },

    setSimulationStatus: (status) => {
      set((state) => {
        state.simulation.status = status;
      });
    },

    setSimulationError: (error) => {
      set((state) => {
        state.simulation.error = error;
        state.simulation.status = 'error';
      });
    },

    clearSimulationError: () => {
      set((state) => {
        state.simulation.error = undefined;
      });
    },

    incrementStep: () => {
      set((state) => {
        state.simulation.currentStep += 1;
      });
    },

    resetSimulation: () => {
      set((state) => {
        state.simulation = initialState.simulation;
      });
    },

    setZoom: (zoom) => {
      set((state) => {
        state.canvas.zoom = zoom;
      });
    },

    setPan: (x, y) => {
      set((state) => {
        state.canvas.panX = x;
        state.canvas.panY = y;
      });
    },
  }))
);
