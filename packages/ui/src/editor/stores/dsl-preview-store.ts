/**
 * DSL Preview Store - DSL-to-Canvas Integration State Management
 *
 * Manages DSL compilation results, circuit selection, and bidirectional sync
 * between DSL code and canvas visualization.
 *
 * Key responsibilities:
 * - Store compiled circuits from DSL
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

/**
 * Hash function for DSL version tracking
 * Simple but effective for detecting changes
 */
function hashDSLCode(code: string): string {
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

interface DSLPreviewActions {
  // Circuit management
  setCompiledCircuits: (circuits: Circuit[], dslCode: string) => void;
  selectCircuit: (index: number) => void;
  applyToCanvas: () => void;

  // Version tracking
  updateDSLVersion: (dslCode: string) => void;
  hasConflict: () => boolean;
  resolveConflict: (keepDSL: boolean) => void;

  // Auto-compile toggle
  toggleAutoCompile: () => void;
  setAutoCompileEnabled: (enabled: boolean) => void;

  // Canvas → DSL sync
  updateDSLFromCanvas: (circuit: Circuit, dslCode: string) => void;

  // Drill-down navigation
  drillInto: (nodeId: string) => void;
  drillUp: () => void;
  navigateTo: (depth: number) => void;
  isDrilledIn: () => boolean;
  getPortValuePrefix: () => string;
}

interface DSLPreviewState {
  compiledCircuits: Circuit[];
  selectedCircuitIndex: number; // -1 if none, defaults to last circuit
  autoCompileEnabled: boolean;

  // Version tracking for conflict detection
  dslVersion: string; // Hash of current DSL code
  lastSyncedVersion: string; // Hash when canvas last synced from DSL

  // Drill-down navigation stack (empty = top-level view)
  drillDownStack: DrillDownFrame[];
}

export interface DSLPreviewStore extends DSLPreviewState, DSLPreviewActions {}

const initialState: DSLPreviewState = {
  compiledCircuits: [],
  selectedCircuitIndex: -1,
  autoCompileEnabled: true,
  dslVersion: '',
  lastSyncedVersion: '',
  drillDownStack: [],
};

export const useDSLPreviewStore = create<DSLPreviewStore>()(
  immer((set, get) => ({
    ...initialState,

    setCompiledCircuits: (circuits, dslCode) => {
      const hash = hashDSLCode(dslCode);

      console.log('[DSLPreviewStore] setCompiledCircuits:', circuits.length, 'circuits');
      circuits.forEach((c, i) => console.log(`  [${i}] ${c.name} - ${c.nodes.length} nodes, ${c.connections.length} connections`));

      set((state) => {
        state.compiledCircuits = circuits;
        state.dslVersion = hash;
        state.lastSyncedVersion = hash; // DSL is source of truth at compile time
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

      console.log('[DSLPreviewStore] applyToCanvas - selectedIndex:', selectedCircuitIndex, 'total:', compiledCircuits.length);

      if (selectedCircuitIndex < 0 || selectedCircuitIndex >= compiledCircuits.length) {
        // No valid circuit selected, clear canvas
        console.log('[DSLPreviewStore] No valid circuit, clearing canvas');
        useCircuitStore.getState().clearCircuit();
        return;
      }

      const selectedCircuit = compiledCircuits[selectedCircuitIndex];
      console.log('[DSLPreviewStore] Applying circuit:', selectedCircuit.name, selectedCircuit.nodes.length, 'nodes');

      // Apply circuit to CircuitStore (auto-layout handled by CircuitCanvas)
      useCircuitStore.getState().setCircuit(selectedCircuit);

      console.log('[DSLPreviewStore] Circuit applied successfully');
    },

    updateDSLVersion: (dslCode) => {
      const hash = hashDSLCode(dslCode);
      set((state) => {
        state.dslVersion = hash;
      });
    },

    hasConflict: () => {
      const { dslVersion, lastSyncedVersion } = get();
      return dslVersion !== lastSyncedVersion && lastSyncedVersion !== '';
    },

    resolveConflict: (keepDSL) => {
      if (keepDSL) {
        // User chose to keep DSL changes
        // Re-apply DSL to canvas (discard canvas changes)
        get().applyToCanvas();
      } else {
        // User chose to keep canvas changes
        // Update lastSyncedVersion to current DSL version
        set((state) => {
          state.lastSyncedVersion = state.dslVersion;
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

    updateDSLFromCanvas: (circuit, dslCode) => {
      const hash = hashDSLCode(dslCode);

      set((state) => {
        // Update the selected circuit in compiledCircuits
        if (
          state.selectedCircuitIndex >= 0 &&
          state.selectedCircuitIndex < state.compiledCircuits.length
        ) {
          state.compiledCircuits[state.selectedCircuitIndex] = circuit;
        }

        // Update version tracking
        state.dslVersion = hash;
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
        console.warn('[DSLPreviewStore] drillInto: no active circuit');
        return;
      }

      // Find the node
      const node = activeCircuit.nodes.find(n => n.id === nodeId);
      if (!node) {
        console.warn('[DSLPreviewStore] drillInto: node not found:', nodeId);
        return;
      }

      // Resolve the component definition
      const componentDef = useCircuitLibraryStore.getState().resolveCircuit(node.componentRef);
      if (!componentDef || componentDef.implementation.kind !== 'composite') {
        console.warn('[DSLPreviewStore] drillInto: not a composite component:', node.componentRef);
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
      console.log('[DSLPreviewStore] Drilled into', node.componentRef, 'via node', nodeId);
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
