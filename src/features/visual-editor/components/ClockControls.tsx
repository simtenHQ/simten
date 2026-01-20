/**
 * ClockControls Component
 *
 * Provides UI controls for sequential circuit simulation:
 * - Step: Execute one clock tick
 * - Run: Continuously execute clock ticks
 * - Pause: Pause continuous execution
 * - Reset: Reset all sequential state
 */

'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { SkipForward, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIRStore, useUIStore, useComponentLibraryStore } from '../stores';
import { initializeSequentialState, runSimulationTick, getLEDUpdates } from '../lib/simulator';
import { hasSequentialComponents } from '../lib/component-utils';
import { flattenIR, type FlattenedIR } from '../lib/ir-flattener';
import type { SequentialState } from '../types';

export function ClockControls() {
  const components = useIRStore((state) => state.components);
  const connections = useIRStore((state) => state.connections);
  const updateComponent = useIRStore((state) => state.updateComponent);
  const simulationStatus = useUIStore((state) => state.simulation.status);
  const setSimulationStatus = useUIStore((state) => state.setSimulationStatus);
  const resolveComponent = useComponentLibraryStore((state) => state.resolveComponent);

  // Sequential state (persisted in component state)
  const [seqState, setSeqState] = useState<SequentialState | null>(null);
  const [flatIR, setFlatIR] = useState<FlattenedIR | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const runIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track component structure (IDs and types) to detect structural changes
  const prevComponentStructureRef = useRef<string>('');

  // Flatten IR and initialize sequential state when STRUCTURE changes
  // (not when component VALUES change, like switch toggles)
  useEffect(() => {
    const hasSequential = hasSequentialComponents(components, resolveComponent);

    // Create a stable signature of the component structure (IDs + types + connections)
    // This changes only when components are added/removed/reconnected, NOT when values change
    const componentStructure = JSON.stringify({
      componentIds: Object.keys(components).sort(),
      componentTypes: Object.fromEntries(
        Object.entries(components).map(([id, comp]) => [id, comp.type])
      ),
      connections: Object.values(connections).map((conn) => ({
        from: `${conn.sourceComponentId}.${conn.sourcePortIndex}`,
        to: `${conn.targetComponentId}.${conn.targetPortIndex}`
      })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    });

    // Only re-initialize if structure actually changed
    const structureChanged = componentStructure !== prevComponentStructureRef.current;

    if (hasSequential) {
      // Always re-flatten IR (needed for simulation)
      const flattened = flattenIR(components, connections, resolveComponent);
      setFlatIR(flattened);

      // Only re-initialize sequential state if structure changed
      if (structureChanged || !seqState) {
        console.log('[ClockControls] Component structure changed, re-initializing seqState');
        console.log('[ClockControls] Old structure:', prevComponentStructureRef.current);
        console.log('[ClockControls] New structure:', componentStructure);
        setSeqState(initializeSequentialState(flattened.components));
        prevComponentStructureRef.current = componentStructure;
      } else {
        console.log('[ClockControls] Only component values changed, preserving seqState');
      }
    } else {
      setFlatIR(null);
      setSeqState(null);
      prevComponentStructureRef.current = '';
    }
  }, [components, connections, resolveComponent, seqState]);

  // Handle single clock step
  const handleStep = useCallback(() => {
    if (!seqState || !flatIR) return;

    console.log('========== STEP BUTTON PRESSED ==========');
    console.log('[STEP] flatIR.components:', Object.keys(flatIR.components));
    console.log('[STEP] seqState.currentState:', Array.from(seqState.currentState.entries()));

    setSimulationStatus('running');

    // Execute one clock tick using flattened IR
    const result = runSimulationTick(flatIR.components, flatIR.connections, seqState);

    console.log('[STEP] After simulation - portValues:', Array.from(result.portValues.entries()));
    console.log('[STEP] After simulation - componentOutputs:', Array.from(result.componentOutputs.entries()));

    if (result.error) {
      console.error('Simulation error:', result.error);
      setSimulationStatus('error');
      return;
    }

    // Get LED value updates based on simulation results
    const ledUpdates = getLEDUpdates(flatIR.components, flatIR.connections, result.portValues);
    console.log('[STEP] LED updates:', Array.from(ledUpdates.entries()));

    // Update component states in the IR store
    // IMPORTANT: We need to update based on the FLATTENED IR, not the top-level components
    // because sequential components might be inside composite components

    // First, update all LED components (these exist in both top-level and flattened IR)
    for (const [flatCompId, flatComponent] of Object.entries(flatIR.components)) {
      if (flatComponent.type === 'LED') {
        // Find the corresponding top-level LED (might be the same ID if it's a top-level LED)
        // For LEDs inside composite components, we need to trace back through the mapping
        // For now, if the LED exists in the top-level components, update it
        if (components[flatCompId]) {
          const newValue = ledUpdates.get(flatCompId);
          if (newValue !== undefined) {
            console.log(`[STEP] Updating LED ${flatCompId} value to ${newValue}`);
            updateComponent(flatCompId, { value: newValue });
          }
        }
      }
    }

    // Second, update all sequential components from the flattened IR
    // For top-level primitive sequential components, the ID is the same
    // For sequential components inside composites, we don't need to update the top-level IR
    // (the internal state is managed by seqState)
    for (const [flatCompId, flatComponent] of Object.entries(flatIR.components)) {
      if (flatComponent.type === 'D_FLIP_FLOP') {
        // Check if this is a top-level component (exists in components with same ID)
        if (components[flatCompId] && components[flatCompId].type === 'D_FLIP_FLOP') {
          const newState = seqState.currentState.get(flatCompId) as boolean;
          console.log(`[STEP] Updating top-level D_FLIP_FLOP ${flatCompId} state to ${newState}`);
          updateComponent(flatCompId, { state: newState });
        } else {
          console.log(`[STEP] Skipping internal D_FLIP_FLOP ${flatCompId} (inside composite)`);
        }
      } else if (flatComponent.type === 'REGISTER') {
        if (components[flatCompId] && components[flatCompId].type === 'REGISTER') {
          const newState = seqState.currentState.get(flatCompId) as number;
          updateComponent(flatCompId, { state: newState });
        }
      } else if (flatComponent.type === 'RAM') {
        if (components[flatCompId] && components[flatCompId].type === 'RAM') {
          const newMemory = seqState.currentState.get(flatCompId) as Map<number, number>;
          updateComponent(flatCompId, { memory: newMemory });
        }
      }
    }

    // Force a re-render by updating the state object
    setSeqState({ ...seqState });

    setTimeout(() => {
      setSimulationStatus('idle');
    }, 50);
  }, [seqState, flatIR, components, updateComponent, setSimulationStatus]);

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

    if (!flatIR) return;

    // Reinitialize sequential state using flattened IR
    const newSeqState = initializeSequentialState(flatIR.components);
    setSeqState(newSeqState);

    // Reset component states in IR store
    for (const [compId, component] of Object.entries(components)) {
      if (component.type === 'D_FLIP_FLOP') {
        updateComponent(compId, { state: false });
      } else if (component.type === 'REGISTER') {
        updateComponent(compId, { state: 0 });
      } else if (component.type === 'RAM') {
        updateComponent(compId, { memory: new Map() });
      }
    }
  }, [flatIR, components, updateComponent, handlePause]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (runIntervalRef.current) {
        clearInterval(runIntervalRef.current);
      }
    };
  }, []);

  const hasSequential = hasSequentialComponents(components, resolveComponent);

  if (!hasSequential) {
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
