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
 * - Apply selected circuit to canvas with auto-layout
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Circuit } from '../types/ir-v0.1';
import { useCircuitStore } from './circuit-store';
import { useMetadataStore } from './metadata-store';
import { performHierarchicalLayout, centerLayout } from '../utils/auto-layout';
import { loadCircuitMetadata, saveCircuitMetadata } from '../utils/metadata-persistence';

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

  // Metadata persistence
  saveCurrentPositions: () => void;
}

interface DSLPreviewState {
  compiledCircuits: Circuit[];
  selectedCircuitIndex: number; // -1 if none, defaults to last circuit
  autoCompileEnabled: boolean;

  // Version tracking for conflict detection
  dslVersion: string; // Hash of current DSL code
  lastSyncedVersion: string; // Hash when canvas last synced from DSL
}

export interface DSLPreviewStore extends DSLPreviewState, DSLPreviewActions {}

const initialState: DSLPreviewState = {
  compiledCircuits: [],
  selectedCircuitIndex: -1,
  autoCompileEnabled: true,
  dslVersion: '',
  lastSyncedVersion: '',
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
        useMetadataStore.getState().clearAll();
        return;
      }

      const selectedCircuit = compiledCircuits[selectedCircuitIndex];
      console.log('[DSLPreviewStore] Applying circuit:', selectedCircuit.name, selectedCircuit.nodes.length, 'nodes');

      // Clean up old circuit metadata from localStorage (keep only current circuit)
      if (typeof window !== 'undefined') {
        const currentKey = `dsl-metadata-${selectedCircuit.name}`;
        Object.keys(localStorage)
          .filter(key => key.startsWith('dsl-metadata-') && key !== currentKey)
          .forEach(key => {
            localStorage.removeItem(key);
            console.log('[DSLPreviewStore] Cleaned up old metadata:', key);
          });
      }

      // CRITICAL: Calculate and populate metadata BEFORE setting circuit
      // This prevents race condition where Canvas renders before metadata is ready

      // Try to load saved metadata first, otherwise use auto-layout
      const savedMetadata = loadCircuitMetadata(selectedCircuit.name);
      let positions: Record<string, { x: number; y: number }>;

      // IMPORTANT: Saved positions are keyed by node LABEL (e.g., "xor1"), not ID
      // Node IDs change on every compilation (they include timestamps), but labels stay the same
      const savedPositionsByLabel: Record<string, { x: number; y: number }> = {};
      if (savedMetadata && savedMetadata.positions) {
        // Convert saved positions to be keyed by label
        // Old format might have been ID-based, so we need to extract labels
        Object.entries(savedMetadata.positions).forEach(([key, pos]) => {
          // If key contains underscore and timestamp, it's an old ID format - skip it
          // If key is simple like "xor1", it's already a label
          if (!key.includes('_') || !key.match(/_\d{13}_/)) {
            savedPositionsByLabel[key] = pos;
          }
        });
      }

      // Build positions keyed by node ID (for MetadataStore)
      // Check if ALL nodes have saved positions (not just if count matches)
      const allNodesHaveSavedPositions = selectedCircuit.nodes.every(node => {
        const label = node.label || node.id;
        return savedPositionsByLabel[label] !== undefined;
      });

      if (allNodesHaveSavedPositions && Object.keys(savedPositionsByLabel).length > 0) {
        // Use saved positions, map labels to current node IDs
        console.log('[DSLPreviewStore] Using saved positions (mapped to current IDs)');
        positions = {};
        selectedCircuit.nodes.forEach(node => {
          const label = node.label || node.id;
          if (savedPositionsByLabel[label]) {
            positions[node.id] = savedPositionsByLabel[label];
            console.log(`  Mapped ${label} -> ${node.id}:`, savedPositionsByLabel[label]);
          }
        });
      } else {
        // Perform auto-layout
        console.log('[DSLPreviewStore] Performing auto-layout for', selectedCircuit.nodes.length, 'nodes');
        selectedCircuit.nodes.forEach(n => console.log('  Node:', n.id, '(' + n.label + ')', n.componentRef));

        const layoutPositions = performHierarchicalLayout(selectedCircuit);
        console.log('[DSLPreviewStore] Layout generated', Object.keys(layoutPositions).length, 'positions');
        Object.entries(layoutPositions).forEach(([id, pos]) => console.log('  Position:', id, pos));

        positions = centerLayout(layoutPositions);
        console.log('[DSLPreviewStore] After centering:', Object.keys(positions).length, 'positions');

        // Save the auto-generated positions (keyed by LABEL, not ID)
        const positionsByLabel: Record<string, { x: number; y: number }> = {};
        selectedCircuit.nodes.forEach(node => {
          const label = node.label || node.id;
          if (positions[node.id]) {
            positionsByLabel[label] = positions[node.id];
          }
        });
        saveCircuitMetadata(selectedCircuit.name, positionsByLabel);
      }

      // Populate MetadataStore with positions FIRST
      const metadataStore = useMetadataStore.getState();
      metadataStore.clearAll();

      console.log('[DSLPreviewStore] Populating MetadataStore with', Object.keys(positions).length, 'positions');
      Object.entries(positions).forEach(([nodeId, position]) => {
        console.log('  Setting metadata for node:', nodeId, position);
        metadataStore.setComponentMetadata(nodeId, {
          id: nodeId,
          position,
          selected: false,
        });
      });

      // Clear connection waypoints for clean routing
      selectedCircuit.connections.forEach((conn) => {
        metadataStore.setConnectionMetadata(conn.id, {
          id: conn.id,
          selected: false,
        });
      });

      // NOW apply circuit to CircuitStore (after metadata is populated)
      useCircuitStore.getState().setCircuit(selectedCircuit);

      console.log('[DSLPreviewStore] Circuit and metadata applied successfully');
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

    saveCurrentPositions: () => {
      const { compiledCircuits, selectedCircuitIndex } = get();

      if (selectedCircuitIndex < 0 || selectedCircuitIndex >= compiledCircuits.length) {
        return; // No circuit selected
      }

      const selectedCircuit = compiledCircuits[selectedCircuitIndex];
      const metadataStore = useMetadataStore.getState();

      // Convert node IDs to labels and collect positions
      const positionsByLabel: Record<string, { x: number; y: number }> = {};

      selectedCircuit.nodes.forEach(node => {
        const label = node.label || node.id;
        const metadata = metadataStore.components[node.id];

        if (metadata && metadata.position) {
          positionsByLabel[label] = metadata.position;
        }
      });

      // Save to localStorage
      saveCircuitMetadata(selectedCircuit.name, positionsByLabel);
      console.log('[DSLPreviewStore] Saved positions for', selectedCircuit.name, ':', Object.keys(positionsByLabel).length, 'nodes');
    },
  }))
);
