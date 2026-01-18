/**
 * SimulationControls Component
 *
 * Control panel for running simulations and managing circuit state.
 */

'use client';

import React, { useCallback } from 'react';
import { Play, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIRStore, useMetadataStore, useUIStore } from '../stores';
import { runSimulationStep } from '../utils/simulator';
import { cn } from '@/lib/utils';

export function SimulationControls() {
  // Select values separately to avoid creating new objects on every render
  const components = useIRStore((state) => state.components);
  const connections = useIRStore((state) => state.connections);
  const simulationStatus = useUIStore((state) => state.simulation.status);
  const setSimulationStatus = useUIStore((state) => state.setSimulationStatus);
  const resetSimulation = useUIStore((state) => state.resetSimulation);
  const clearAllIR = useIRStore((state) => state.clearAll);
  const clearAllMetadata = useMetadataStore((state) => state.clearAll);

  // Get component counts
  const componentCount = Object.keys(components).length;
  const connectionCount = Object.keys(connections).length;

  const handleRun = useCallback(() => {
    setSimulationStatus('running');

    // Run simulation step
    const updatedIR = runSimulationStep({ components, connections });

    // Update IR store with new values
    Object.entries(updatedIR.components).forEach(([id, component]) => {
      if ('value' in component) {
        useIRStore.getState().updateComponent(id, { value: component.value });
      }
    });

    // Reset status after simulation completes
    setTimeout(() => {
      setSimulationStatus('idle');
    }, 100);
  }, [components, connections, setSimulationStatus]);

  const handleStop = useCallback(() => {
    setSimulationStatus('idle');
    resetSimulation();
  }, [setSimulationStatus, resetSimulation]);

  const handleClear = useCallback(() => {
    if (confirm('Clear all components and connections?')) {
      clearAllIR();
      clearAllMetadata();
      resetSimulation();
    }
  }, [clearAllIR, clearAllMetadata, resetSimulation]);

  return (
    <div className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
      {/* Left: Title and Stats */}
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-bold text-gray-900">System Simulator</h1>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>
            <strong>{componentCount}</strong> components
          </span>
          <span>
            <strong>{connectionCount}</strong> connections
          </span>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-3">
        {/* Run Button */}
        <Button
          onClick={handleRun}
          disabled={simulationStatus === 'running' || componentCount === 0}
          className={cn(
            'gap-2',
            simulationStatus === 'running' && 'cursor-not-allowed opacity-50'
          )}
        >
          <Play className="h-4 w-4" />
          {simulationStatus === 'running' ? 'Running...' : 'Run'}
        </Button>

        {/* Stop Button */}
        <Button
          onClick={handleStop}
          variant="outline"
          disabled={simulationStatus !== 'running'}
        >
          <Square className="h-4 w-4" />
        </Button>

        {/* Clear Button */}
        <Button
          onClick={handleClear}
          variant="destructive"
          disabled={componentCount === 0}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  );
}
