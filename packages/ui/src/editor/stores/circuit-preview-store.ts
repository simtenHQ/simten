/**
 * Circuit Preview Store - Compiled Circuit / Canvas Integration State Management
 *
 * Manages compiled TypeScript circuit results, circuit selection, and bidirectional sync
 * between circuit code and canvas visualization.
 *
 * Key responsibilities:
 * - Store compiled circuits from TypeScript builder code
 * - Track which circuit to visualize (default: last in file)
 * - Version tracking for conflict detection
 * - Apply selected circuit to canvas
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Circuit } from '../types/circuit';
import { useCircuitStore } from './circuit-store';
import { useCircuitLibraryStore } from './circuit-library-store';
import { createDrillDownViewCircuit } from '../../canvas/drill-down-view';
import { autoHarness } from '@simten/core/circuit';
import { Switch, Button, Led, Input, Output, HexDisplay } from '@simten/core/std';

/**
 * Hash function for circuit code version tracking
 * Simple but effective for detecting changes
 */
function hashCode(code: string): string {
  // Use btoa (base64 encode) with substring for fast comparison
  // This is sufficient for change detection (not cryptographic security)
  try {
    return btoa(code).substring(0, 16);
  } catch {
    // Fallback for invalid characters
    return code.length.toString(16);
  }
}

/**
 * A single frame on the drill-down navigation stack.
 * Each frame represents one level of composite hierarchy.
 */
export interface DrillDownFrame {
  nodeId: string;        // Instance node ID in the parent circuit (e.g., "ha1_abc")
  nodeLabel: string;     // Human-readable label (e.g., "ha1")
  componentName: string; // Component type name (e.g., "HalfAdder")
  circuit: Circuit;      // The view circuit (with boundary nodes) for this level
}

interface CircuitPreviewActions {
  // Circuit management
  setCompiledCircuits: (circuits: Circuit[], code: string) => void;
  selectCircuit: (index: number) => void;
  applyToCanvas: () => void;

  // Version tracking
  updateVersion: (code: string) => void;
  hasConflict: () => boolean;
  resolveConflict: (keepCode: boolean) => void;

  // Auto-compile toggle
  toggleAutoCompile: () => void;
  setAutoCompileEnabled: (enabled: boolean) => void;

  // Canvas → code sync
  updateFromCanvas: (circuit: Circuit, code: string) => void;

  // Drill-down navigation
  drillInto: (nodeId: string) => void;
  drillUp: () => void;
  navigateTo: (depth: number) => void;
  isDrilledIn: () => boolean;
  getPortValuePrefix: () => string;
}

interface CircuitPreviewState {
  compiledCircuits: Circuit[];
  selectedCircuitIndex: number; // -1 if none, defaults to last circuit
  autoCompileEnabled: boolean;

  // Version tracking for conflict detection
  version: string; // Hash of current circuit code
  lastSyncedVersion: string; // Hash when canvas last synced from code

  // Drill-down navigation stack (empty = top-level view)
  drillDownStack: DrillDownFrame[];
}

export interface CircuitPreviewStore extends CircuitPreviewState, CircuitPreviewActions {}

const initialState: CircuitPreviewState = {
  compiledCircuits: [],
  selectedCircuitIndex: -1,
  autoCompileEnabled: true,
  version: '',
  lastSyncedVersion: '',
  drillDownStack: [],
};

export const useCircuitPreviewStore = create<CircuitPreviewStore>()(
  immer((set, get) => ({
    ...initialState,

    setCompiledCircuits: (circuits, code) => {
      const hash = hashCode(code);

      set((state) => {
        state.compiledCircuits = circuits;
        state.version = hash;
        state.lastSyncedVersion = hash; // Circuit code is source of truth at compile time
        state.drillDownStack = []; // Clear drill-down on recompile

        // Auto-select last circuit (most recently written)
        if (circuits.length > 0) {
          state.selectedCircuitIndex = circuits.length - 1;
        } else {
          state.selectedCircuitIndex = -1;
        }
      });

      // Automatically apply to canvas
      get().applyToCanvas();
    },

    selectCircuit: (index) => {
      const { compiledCircuits } = get();

      if (index < 0 || index >= compiledCircuits.length) {
        console.warn(`Invalid circuit index: ${index}`);
        return;
      }

      set((state) => {
        state.selectedCircuitIndex = index;
        state.drillDownStack = []; // Clear drill-down on circuit switch
      });

      // Apply selected circuit to canvas
      get().applyToCanvas();
    },

    applyToCanvas: () => {
      const { compiledCircuits, selectedCircuitIndex } = get();

      if (selectedCircuitIndex < 0 || selectedCircuitIndex >= compiledCircuits.length) {
        useCircuitStore.getState().clearCircuit();
        return;
      }

      const selectedCircuit = compiledCircuits[selectedCircuitIndex];

      // Ensure harness components (Switch, Led, etc.) are in the library
      const libStore = useCircuitLibraryStore.getState();
      for (const c of [Switch, Button, Led, Input, Output, HexDisplay]) {
        if (!libStore.resolveCircuit(c.circuit.name)) libStore.addCircuit(c.circuit);
      }

      // Wrap with Switch/Led harness so inputs/outputs are interactive on canvas
      const harnessed = autoHarness(selectedCircuit, {
        resolveCircuit: (name) => useCircuitLibraryStore.getState().resolveCircuit(name),
        addCircuit: (c) => useCircuitLibraryStore.getState().addCircuit(c),
      });

      // Apply to CircuitStore (auto-layout handled by CircuitCanvas)
      useCircuitStore.getState().setCircuit(harnessed);

    },

    updateVersion: (code) => {
      const hash = hashCode(code);
      set((state) => {
        state.version = hash;
      });
    },

    hasConflict: () => {
      const { version, lastSyncedVersion } = get();
      return version !== lastSyncedVersion && lastSyncedVersion !== '';
    },

    resolveConflict: (keepCode) => {
      if (keepCode) {
        // User chose to keep circuit code changes
        // Re-apply circuit code to canvas (discard canvas changes)
        get().applyToCanvas();
      } else {
        // User chose to keep canvas changes
        // Update lastSyncedVersion to current circuit code version
        set((state) => {
          state.lastSyncedVersion = state.version;
        });
      }
    },

    toggleAutoCompile: () => {
      set((state) => {
        state.autoCompileEnabled = !state.autoCompileEnabled;
      });
    },

    setAutoCompileEnabled: (enabled) => {
      set((state) => {
        state.autoCompileEnabled = enabled;
      });
    },

    updateFromCanvas: (circuit, code) => {
      const hash = hashCode(code);

      set((state) => {
        // Update the selected circuit in compiledCircuits
        if (
          state.selectedCircuitIndex >= 0 &&
          state.selectedCircuitIndex < state.compiledCircuits.length
        ) {
          state.compiledCircuits[state.selectedCircuitIndex] = circuit;
        }

        // Update version tracking
        state.version = hash;
        state.lastSyncedVersion = hash;
      });
    },

    // ── Drill-down navigation ──

    drillInto: (nodeId: string) => {
      // Determine the currently active circuit (either drilled-in view or top-level)
      const { drillDownStack, compiledCircuits, selectedCircuitIndex } = get();

      let activeCircuit: Circuit | null;
      if (drillDownStack.length > 0) {
        // Currently inside a drill-down; look for the node in the current view
        activeCircuit = drillDownStack[drillDownStack.length - 1].circuit;
      } else {
        activeCircuit = selectedCircuitIndex >= 0 ? compiledCircuits[selectedCircuitIndex] : null;
      }

      if (!activeCircuit) {
        console.warn('[CircuitPreviewStore] drillInto: no active circuit');
        return;
      }

      // Find the node
      const node = activeCircuit.nodes.find(n => n.id === nodeId);
      if (!node) {
        console.warn('[CircuitPreviewStore] drillInto: node not found:', nodeId);
        return;
      }

      // Resolve the component definition
      const componentDef = useCircuitLibraryStore.getState().resolveCircuit(node.componentRef);
      if (!componentDef || componentDef.implementation.kind !== 'composite') {
        console.warn('[CircuitPreviewStore] drillInto: not a composite component:', node.componentRef);
        return;
      }

      // Build the view circuit with boundary nodes
      const viewCircuit = createDrillDownViewCircuit(componentDef);

      // Push frame onto stack
      const frame: DrillDownFrame = {
        nodeId,
        nodeLabel: node.label || node.id,
        componentName: node.componentRef,
        circuit: viewCircuit,
      };

      set((state) => {
        state.drillDownStack.push(frame);
      });

      // Apply the view circuit to canvas
      useCircuitStore.getState().setCircuit(viewCircuit);
    },

    drillUp: () => {
      const { drillDownStack } = get();
      if (drillDownStack.length === 0) return;

      get().navigateTo(drillDownStack.length - 1);
    },

    navigateTo: (depth: number) => {
      const { drillDownStack } = get();

      if (depth === 0) {
        // Return to top-level
        set((state) => {
          state.drillDownStack = [];
        });
        get().applyToCanvas();
        return;
      }

      if (depth >= drillDownStack.length) {
        // Already at or beyond target depth — no-op
        return;
      }

      // Pop stack to target depth and apply that level's circuit
      const targetFrame = drillDownStack[depth - 1];
      set((state) => {
        state.drillDownStack = state.drillDownStack.slice(0, depth);
      });

      // Apply the target frame's circuit
      useCircuitStore.getState().setCircuit(targetFrame.circuit);
    },

    isDrilledIn: () => {
      return get().drillDownStack.length > 0;
    },

    getPortValuePrefix: () => {
      const { drillDownStack } = get();
      if (drillDownStack.length === 0) return '';

      // Build prefix by concatenating all frame node IDs with dots
      return drillDownStack.map(f => f.nodeId).join('.') + '.';
    },
  }))
);
