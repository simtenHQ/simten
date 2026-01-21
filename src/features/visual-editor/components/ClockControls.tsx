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
import { initializeSequentialState, runSimulationTick, type SequentialState } from '../lib/simulator-v0.1';
import type { Circuit } from '../types/ir-v0.1';

/**
 * Check if circuit has sequential components at the top level
 * (Simplified version - doesn't check nested composites)
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
  }
  return false;
}

export function ClockControls() {
  const circuit = useCircuitStore((state) => state.circuit);
  const simulationStatus = useUIStore((state) => state.simulation.status);
  const setSimulationStatus = useUIStore((state) => state.setSimulationStatus);
  const resolveComponent = useComponentLibraryStore((state) => state.resolveComponent);

  // Sequential state (persisted in component state)
  const [seqState, setSeqState] = useState<SequentialState | null>(null);
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
        console.log('[ClockControls] Circuit structure changed, re-initializing seqState');
        setSeqState(initializeSequentialState(circuit));
        prevCircuitStructureRef.current = circuitStructure;
      } else {
        console.log('[ClockControls] Only node values changed, preserving seqState');
      }
    } else {
      setSeqState(null);
      prevCircuitStructureRef.current = '';
    }
  }, [circuit, resolveComponent, seqState]);

  // Handle single clock step
  const handleStep = useCallback(() => {
    if (!seqState || !circuit) return;

    console.log('========== STEP BUTTON PRESSED ==========');
    console.log('[STEP] circuit.nodes:', circuit.nodes.map(n => n.id));
    console.log('[STEP] seqState.currentState:', Array.from(seqState.currentState.entries()));

    setSimulationStatus('running');

    // Execute one clock tick
    const result = runSimulationTick(circuit, seqState);

    console.log('[STEP] After simulation - portValues:', Array.from(result.portValues.entries()));

    if (result.error) {
      console.error('Simulation error:', result.error);
      setSimulationStatus('error');
      return;
    }

    // Update the sequential state from simulation result
    if (result.sequentialState) {
      setSeqState(result.sequentialState);
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
