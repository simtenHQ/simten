/**
 * SimulationControls Component (IR v0.1)
 *
 * Top toolbar for the visual editor, displaying circuit statistics and controls.
 *
 * Components:
 * - Title and component/connection counts
 * - ClockControls for sequential circuit simulation
 * - Layout tools (Clean, Auto Layout, Clear)
 */

'use client';

import React, { useCallback } from 'react';
import { Trash2, Sparkles, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCircuitStore } from '../stores/circuit-store';
import { useMetadataStore, useUIStore } from '../stores';
import { performHierarchicalLayout, centerLayout } from '../utils/auto-layout';

export function SimulationControls() {
  const circuit = useCircuitStore((state) => state.circuit);
  const clearCircuit = useCircuitStore((state) => state.clearCircuit);
  const clearAllMetadata = useMetadataStore((state) => state.clearAll);
  const resetSimulation = useUIStore((state) => state.resetSimulation);

  // Get component counts for button disabled state only
  const componentCount = circuit?.nodes.length ?? 0;

  const handleClear = useCallback(() => {
    if (confirm('Clear all components and connections?')) {
      clearCircuit();
      clearAllMetadata();
      resetSimulation();
    }
  }, [clearCircuit, clearAllMetadata, resetSimulation]);

  const handleCleanup = useCallback(() => {
    if (!circuit) return;

    // Get all connection metadata
    const metadataState = useMetadataStore.getState();

    // Clear all waypoints from all connections for clean orthogonal routing
    circuit.connections.forEach((connection) => {
      const metadata = metadataState.connections[connection.id];
      if (metadata?.waypoints && metadata.waypoints.length > 0) {
        // Clear waypoints to get default orthogonal routing
        metadataState.updateConnectionWaypoints(connection.id, []);
      }
    });

    // Snap all components to grid for cleaner alignment
    const GRID_SIZE = 20; // Grid spacing in pixels
    Object.entries(metadataState.components).forEach(([nodeId, metadata]) => {
      if (metadata.position) {
        const snappedX = Math.round(metadata.position.x / GRID_SIZE) * GRID_SIZE;
        const snappedY = Math.round(metadata.position.y / GRID_SIZE) * GRID_SIZE;

        // Only update if position changed
        if (snappedX !== metadata.position.x || snappedY !== metadata.position.y) {
          metadataState.updateComponentPosition(nodeId, {
            x: snappedX,
            y: snappedY,
          });
        }
      }
    });
  }, [circuit]);

  const handleAutoLayout = useCallback(() => {
    if (!circuit) return;

    const metadataState = useMetadataStore.getState();

    // Clear all waypoints first
    circuit.connections.forEach((connection) => {
      metadataState.updateConnectionWaypoints(connection.id, []);
    });

    // Perform hierarchical layout directly on Circuit
    const newPositions = performHierarchicalLayout(circuit);

    // Center the layout
    const centeredPositions = centerLayout(newPositions);

    // Apply new positions
    Object.entries(centeredPositions).forEach(([nodeId, position]) => {
      metadataState.updateComponentPosition(nodeId, position);
    });
  }, [circuit]);

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleCleanup}
        variant="outline"
        size="sm"
        disabled={componentCount === 0}
        className="gap-2"
        title="Clear waypoints and snap to grid"
      >
        <Sparkles className="h-4 w-4" />
        Clean
      </Button>

      <Button
        onClick={handleAutoLayout}
        variant="outline"
        size="sm"
        disabled={componentCount === 0}
        className="gap-2"
        title="Auto-organize components"
      >
        <LayoutGrid className="h-4 w-4" />
        Layout
      </Button>

      <Button
        onClick={handleClear}
        variant="outline"
        size="sm"
        disabled={componentCount === 0}
        className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
        title="Clear all components"
      >
        <Trash2 className="h-4 w-4" />
        Clear
      </Button>
    </div>
  );
}
