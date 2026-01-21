/**
 * ClockControls Component (IR v0.1)
 *
 * Provides UI controls for sequential circuit simulation:
 * - Step: Execute one clock tick
 * - Run: Continuously execute clock ticks
 * - Pause: Pause continuous execution
 * - Reset: Reset all sequential state
 *
 * Updated for IR v0.1:
 * - Uses CircuitStore instead of useIRStore
 * - Uses simulator-v0.1.ts functions
 * - Works with Circuit.nodes instead of components
 * - Simplified to support top-level sequential components only (no composites for now)
 */

'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { SkipForward, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCircuitStore } from '../stores/circuit-store';
import { useUIStore, useComponentLibraryStore } from '../stores';
import { useSequentialStateStore } from '../stores/sequential-state-store';
import { initializeSequentialState, runSimulationTick, type SequentialState } from '../lib/simulator-v0.1';
import type { Circuit } from '../types/ir-v0.1';

/**
 * Check if circuit has sequential components (recursive - checks nested composites too)
 */
function hasSequentialComponents(circuit: Circuit | null, resolveComponent: (name: string) => Circuit | undefined): boolean {
  if (!circuit) return false;

  for (const node of circuit.nodes) {
    const componentDef = resolveComponent(node.componentRef);
    if (!componentDef) continue;

    // Check if component has clocks or state (sequential indicators)
    if (componentDef.clocks.length > 0 || componentDef.state.length > 0) {
      return true;
    }

    // If this is a composite, recursively check inside it
    if (componentDef.implementation.kind === 'composite') {
      if (hasSequentialComponents(componentDef, resolveComponent)) {
        return true;
      }
    }
  }
  return false;
}

export function ClockControls() {
  const circuit = useCircuitStore((state) => state.circuit);
  const simulationStatus = useUIStore((state) => state.simulation.status);
  const setSimulationStatus = useUIStore((state) => state.setSimulationStatus);
  const resolveComponent = useComponentLibraryStore((state) => state.resolveComponent);

  // Sequential state (shared via store so Canvas can access it)
  const seqState = useSequentialStateStore((state) => state.seqState);
  const setSeqState = useSequentialStateStore((state) => state.setSeqState);
  const [isRunning, setIsRunning] = useState(false);
  const runIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track circuit structure (IDs and types) to detect structural changes
  const prevCircuitStructureRef = useRef<string>('');

  // Initialize sequential state when STRUCTURE changes
  // (not when node VALUES change, like switch toggles)
  useEffect(() => {
    if (!circuit) {
      setSeqState(null);
      prevCircuitStructureRef.current = '';
      return;
    }

    const hasSequential = hasSequentialComponents(circuit, resolveComponent);

    // Create a stable signature of the circuit structure (node IDs + types + connections)
    // This changes only when nodes are added/removed/reconnected, NOT when values change
    const circuitStructure = JSON.stringify({
      nodeIds: circuit.nodes.map(n => n.id).sort(),
      nodeTypes: circuit.nodes.map(n => ({ id: n.id, type: n.componentRef })).sort((a, b) => a.id.localeCompare(b.id)),
      connections: circuit.connections.map(conn => ({
        from: `${conn.source.nodeId}.${conn.source.portName}`,
        to: `${conn.target.nodeId}.${conn.target.portName}`
      })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    });

    // Only re-initialize if structure actually changed
    const structureChanged = circuitStructure !== prevCircuitStructureRef.current;

    if (hasSequential) {
      // Only re-initialize sequential state if structure changed
      if (structureChanged || !seqState) {
        setSeqState(initializeSequentialState(circuit));
        prevCircuitStructureRef.current = circuitStructure;
      }
    } else {
      setSeqState(null);
      prevCircuitStructureRef.current = '';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuit, resolveComponent]);

  // Handle single clock step
  const handleStep = useCallback(() => {
    if (!seqState || !circuit) return;

    setSimulationStatus('running');

    // Execute one clock tick
    const result = runSimulationTick(circuit, seqState);

    if (result.error) {
      console.error('Simulation error:', result.error);
      setSimulationStatus('error');
      return;
    }

    // Update the sequential state from simulation result
    // IMPORTANT: Create a NEW object so Zustand detects the change (reference equality)
    if (result.sequentialState) {
      // Clone the sequential state to create a new reference
      const newSeqState: SequentialState = {
        currentState: new Map(result.sequentialState.currentState),
        nextState: new Map(result.sequentialState.nextState),
        clocks: new Map(result.sequentialState.clocks),
        cycleCount: result.sequentialState.cycleCount,
      };

      setSeqState(newSeqState);
    }

    // Note: We don't need to manually update node values for LEDs/outputs here
    // because the Canvas component will automatically re-run combinational simulation
    // which will pick up the new sequential state and update all port values

    setTimeout(() => {
      setSimulationStatus('idle');
    }, 50);
  }, [seqState, circuit, setSimulationStatus]);

  // Handle run (continuous ticking)
  const handleRun = useCallback(() => {
    if (isRunning) return;

    setIsRunning(true);
    runIntervalRef.current = setInterval(() => {
      handleStep();
    }, 100); // 10 Hz clock
  }, [isRunning, handleStep]);

  // Handle pause
  const handlePause = useCallback(() => {
    if (runIntervalRef.current) {
      clearInterval(runIntervalRef.current);
      runIntervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  // Handle reset
  const handleReset = useCallback(() => {
    handlePause();

    if (!circuit) return;

    // Reinitialize sequential state
    const newSeqState = initializeSequentialState(circuit);
    setSeqState(newSeqState);

    // Note: We don't need to manually reset node arguments here
    // because the sequential state reset will be picked up by the
    // next simulation run automatically
  }, [circuit, handlePause]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (runIntervalRef.current) {
        clearInterval(runIntervalRef.current);
      }
    };
  }, []);

  if (!hasSequentialComponents(circuit, resolveComponent)) {
    return null; // Don't show clock controls for purely combinational circuits
  }

  return (
    <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
      <span className="text-sm text-gray-600 font-medium">Clock:</span>

      {/* Step Button */}
      <Button
        onClick={handleStep}
        disabled={isRunning || simulationStatus === 'running'}
        variant="outline"
        size="sm"
        className="gap-2"
        title="Execute one clock cycle"
      >
        <SkipForward className="h-4 w-4" />
        Step
      </Button>

      {/* Run/Pause Button */}
      {!isRunning ? (
        <Button
          onClick={handleRun}
          disabled={simulationStatus === 'running'}
          variant="outline"
          size="sm"
          className="gap-2"
          title="Run continuous clock ticks"
        >
          <Play className="h-4 w-4" />
          Run
        </Button>
      ) : (
        <Button
          onClick={handlePause}
          variant="outline"
          size="sm"
          className="gap-2"
          title="Pause clock"
        >
          <Pause className="h-4 w-4" />
          Pause
        </Button>
      )}

      {/* Reset Button */}
      <Button
        onClick={handleReset}
        variant="outline"
        size="sm"
        className="gap-2"
        title="Reset all sequential state"
      >
        <RotateCcw className="h-4 w-4" />
        Reset
      </Button>

      {/* Cycle Counter */}
      {seqState && (
        <span className="text-sm text-gray-600 ml-2">
          Cycle: <strong>{seqState.cycleCount}</strong>
        </span>
      )}
    </div>
  );
}
