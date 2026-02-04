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
import { SkipForward, Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCircuitStore } from '../stores/circuit-store';
import { useUIStore, useComponentLibraryStore } from '../stores';
import { useSequentialStateStore } from '../stores/sequential-state-store';
import { useTestbenchStore } from '../stores/testbench-store';
import { initializeSequentialState, runSimulationTick, type SequentialState } from '../lib/simulator-v0.1';
import type { Circuit } from '../types/ir-v0.1';
import { createSnapshot, restoreEnvironmentalState } from '../lib/time-travel';

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
  const updateNode = useCircuitStore((state) => state.updateNode);
  const simulationStatus = useUIStore((state) => state.simulation.status);
  const setSimulationStatus = useUIStore((state) => state.setSimulationStatus);
  const resolveComponent = useComponentLibraryStore((state) => state.resolveComponent);

  // Testbench integration
  const testbench = useTestbenchStore((state) => state.testbench);
  const getCurrentStimulus = useTestbenchStore((state) => state.getCurrentStimulus);
  const advanceCycle = useTestbenchStore((state) => state.advanceCycle);
  const executionState = useTestbenchStore((state) => state.executionState);
  const setCaptureData = useTestbenchStore((state) => state.setCaptureData);

  // Sequential state (shared via store so Canvas can access it)
  const seqState = useSequentialStateStore((state) => state.seqState);
  const setSeqState = useSequentialStateStore((state) => state.setSeqState);
  const history = useSequentialStateStore((state) => state.history);
  const currentHistoryIndex = useSequentialStateStore((state) => state.currentHistoryIndex);
  const isViewingPast = useSequentialStateStore((state) => state.isViewingPast);
  const saveSnapshot = useSequentialStateStore((state) => state.saveSnapshot);
  const stepBack = useSequentialStateStore((state) => state.stepBack);
  const stepForward = useSequentialStateStore((state) => state.stepForward);
  const jumpToCycle = useSequentialStateStore((state) => state.jumpToCycle);
  const clearHistory = useSequentialStateStore((state) => state.clearHistory);
  const [isRunning, setIsRunning] = useState(false);
  const [clockSpeed, setClockSpeed] = useState(10); // Hz
  const runIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track circuit structure (IDs and types) to detect structural changes
  const prevCircuitStructureRef = useRef<string>('');

  // Keep a ref to the latest circuit so the interval can access it
  const circuitRef = useRef<Circuit | null>(circuit);
  const seqStateRef = useRef<SequentialState | null>(seqState);

  useEffect(() => {
    circuitRef.current = circuit;
    seqStateRef.current = seqState;
  }, [circuit, seqState]);

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
        const initialState = initializeSequentialState(circuit);
        setSeqState(initialState);
        prevCircuitStructureRef.current = circuitStructure;

        // Save initial snapshot (t=0, before any ticks)
        // This ensures history always starts with a known initial state
        const initialSnapshot = createSnapshot(initialState, circuit);
        saveSnapshot(initialSnapshot);
      }
    } else {
      setSeqState(null);
      prevCircuitStructureRef.current = '';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuit, resolveComponent]);

  // Capture waveform data after simulation tick
  // Takes simulation result portValues for accurate value reading
  const captureWaveform = useCallback((simPortValues?: Map<string, number | boolean>) => {
    if (!testbench || !circuit || !testbench.capture || !executionState) return;

    const currentCycle = executionState.cycle;

    // Get or initialize capture data
    let captureData = executionState.captureData;

    if (!captureData) {
      // Initialize new capture data
      captureData = {
        config: testbench.capture,
        traces: new Map(),
      };

      // Initialize traces for each signal
      for (const signal of testbench.capture.signals) {
        const traceKey = signal.nodeId === '' ? signal.portName : `${signal.nodeId}.${signal.portName}`;
        captureData.traces.set(traceKey, {
          signal,
          values: [],
          changes: [],
        });
      }
    }

    // Create a new capture data object to avoid mutation issues
    const newCaptureData = {
      config: captureData.config,
      traces: new Map(captureData.traces),
    };

    // Capture current values for each signal
    for (const signal of testbench.capture.signals) {
      const traceKey = signal.nodeId === '' ? signal.portName : `${signal.nodeId}.${signal.portName}`;
      const existingTrace = newCaptureData.traces.get(traceKey);

      if (!existingTrace) {
        console.warn(`Trace not found for signal: ${traceKey}`);
        continue;
      }

      // Find the port value - prefer simulation result portValues for accuracy
      let value: number | boolean | undefined;

      if (simPortValues) {
        // Try to get value from simulation result portValues
        // Format: "nodeId.portName" or ".portName" for circuit-level
        if (signal.nodeId === '') {
          // For circuit-level ports, look up by label (Input/Output node names)
          // The testbench creates nodes with labels matching port names
          const node = circuit.nodes.find(n => n.label === signal.portName);
          if (node) {
            // Check componentRef directly (more reliable than resolveComponent)
            if (node.componentRef === 'Input') {
              // For Input, read from arguments (stimulus value)
              value = node.arguments.value as number | boolean;
              // Also check portValues
              const pvKey = `${node.id}.out`;
              if (simPortValues.has(pvKey)) {
                value = simPortValues.get(pvKey);
              }
            } else if (node.componentRef === 'Output') {
              // For Output, read its input from portValues
              const pvKey = `${node.id}.in`;
              value = simPortValues.get(pvKey);
            }
          }
        } else {
          // Node port - direct lookup
          const pvKey = `${signal.nodeId}.${signal.portName}`;
          value = simPortValues.get(pvKey);
        }
      }

      // Fallback to reading from circuit if not found in portValues
      if (value === undefined) {
        if (signal.nodeId === '') {
          const node = circuit.nodes.find(n => n.label === signal.portName);
          if (node) {
            const comp = resolveComponent(node.componentRef);
            if (comp?.name === 'Input') {
              value = node.arguments.value as number | boolean;
            } else if (comp?.name === 'Output') {
              value = node.inputs[0]?.value;
            }
          }
        } else {
          const node = circuit.nodes.find(n => n.id === signal.nodeId);
          const output = node?.outputs.find(o => o.name === signal.portName);
          value = output?.value;
        }
      }

      // Default to 0 if still undefined
      if (value === undefined) {
        value = 0;
      }

      // Create new trace with updated values
      const newValues = [...existingTrace.values, value];
      const newChanges = [...existingTrace.changes];

      // Track changes for efficient VCD
      if (newValues.length === 1 || newValues[newValues.length - 2] !== value) {
        newChanges.push({ cycle: currentCycle, value });
      }

      newCaptureData.traces.set(traceKey, {
        signal: existingTrace.signal,
        values: newValues,
        changes: newChanges,
      });
    }

    // Update capture data in store
    setCaptureData(newCaptureData);
  }, [testbench, circuit, executionState, setCaptureData, resolveComponent]);

  // Apply testbench stimulus before simulation tick
  // Returns the updated circuit (since store updates are synchronous with immer)
  const applyStimulus = useCallback((): Circuit | null => {
    if (!testbench || !circuit) return circuit;

    const stimulus = getCurrentStimulus();

    // Apply each stimulus action
    for (const action of stimulus) {
      // Find the Input node by label (testbench compiler creates nodes with matching labels)
      const node = circuit.nodes.find(n => n.label === action.portName);

      if (node) {
        updateNode(node.id, {
          arguments: { ...node.arguments, value: action.value }
        });
      }

      // Also set tb_input_* node if it exists (testbench creates these)
      const tbInputNode = circuit.nodes.find(n => n.id === `tb_input_${action.portName}`);
      if (tbInputNode) {
        updateNode(tbInputNode.id, {
          arguments: { ...tbInputNode.arguments, value: action.value }
        });
      }
    }

    // Return the updated circuit from store (immer updates are synchronous)
    return useCircuitStore.getState().circuit;
  }, [testbench, circuit, getCurrentStimulus, updateNode]);

  // Handle single clock step
  const handleStep = useCallback(() => {
    if (!seqState || !circuit) {
      return;
    }

    setSimulationStatus('running');

    // TESTBENCH: Apply stimulus before tick (returns fresh circuit from store)
    const updatedCircuit = applyStimulus() ?? circuit;

    // STEP 1: Run simulation tick with updated circuit
    const result = runSimulationTick(updatedCircuit, seqState);

    if (result.error) {
      console.error('Simulation error:', result.error);
      setSimulationStatus('error');
      return;
    }

    // STEP 2: Update state
    if (result.sequentialState) {
      // Clone the sequential state to create a new reference
      const newSeqState: SequentialState = {
        currentState: new Map(result.sequentialState.currentState),
        nextState: new Map(result.sequentialState.nextState),
        clocks: new Map(result.sequentialState.clocks),
        cycleCount: result.sequentialState.cycleCount,
      };

      setSeqState(newSeqState);

      // STEP 3: Create snapshot AFTER tick
      // Snapshots represent completed clock edges (post-tick states)
      // history[n] = state after n clock ticks
      const snapshot = createSnapshot(newSeqState, circuit);
      saveSnapshot(snapshot);

      // TESTBENCH: Capture waveform and advance cycle counter
      if (testbench) {
        captureWaveform(result.portValues);
        advanceCycle();
      }
    }

    // Note: We don't need to manually update node values for LEDs/outputs here
    // because the Canvas component will automatically re-run combinational simulation
    // which will pick up the new sequential state and update all port values

    setTimeout(() => {
      setSimulationStatus('idle');
    }, 50);
  }, [seqState, circuit, setSimulationStatus, setSeqState, saveSnapshot, testbench, advanceCycle, applyStimulus, captureWaveform]);

  // Handle run (continuous ticking)
  const handleRun = useCallback(() => {
    setIsRunning(true);
  }, []);

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

    // Clear history and save initial snapshot (t=0)
    clearHistory();
    const initialSnapshot = createSnapshot(newSeqState, circuit);
    saveSnapshot(initialSnapshot);

    // Note: We don't need to manually reset node arguments here
    // because the sequential state reset will be picked up by the
    // next simulation run automatically
  }, [circuit, handlePause, setSeqState, clearHistory, saveSnapshot]);

  // Time-travel navigation handlers
  const handleStepBack = useCallback(() => {
    if (!circuit) return;

    const snapshot = stepBack();
    if (snapshot) {
      // Restore environmental state to circuit via updateNode
      restoreEnvironmentalState(circuit, snapshot.environmentalState, updateNode);
      // Sequential state already updated by stepBack()
    }
  }, [circuit, stepBack, updateNode]);

  const handleStepForward = useCallback(() => {
    if (!circuit) return;

    const snapshot = stepForward();
    if (snapshot) {
      // Restore environmental state to circuit via updateNode
      restoreEnvironmentalState(circuit, snapshot.environmentalState, updateNode);
      // Sequential state already updated by stepForward()
    }
  }, [circuit, stepForward, updateNode]);

  const handleJumpToCycle = useCallback(
    (cycleNumber: number) => {
      if (!circuit) return;

      const snapshot = jumpToCycle(cycleNumber);
      if (snapshot) {
        // Restore environmental state to circuit via updateNode
        restoreEnvironmentalState(circuit, snapshot.environmentalState, updateNode);
        // Sequential state already updated by jumpToCycle()
      }
    },
    [circuit, jumpToCycle, updateNode]
  );

  // Manage run interval - updates when isRunning or clockSpeed changes
  useEffect(() => {
    // Clear any existing interval
    if (runIntervalRef.current) {
      clearInterval(runIntervalRef.current);
      runIntervalRef.current = null;
    }

    // Start interval if running
    if (isRunning) {
      runIntervalRef.current = setInterval(() => {
        // Use refs to get the latest circuit and state
        const currentCircuit = circuitRef.current;
        const currentSeqState = seqStateRef.current;

        if (!currentSeqState || !currentCircuit) return;

        setSimulationStatus('running');

        // TESTBENCH: Apply stimulus before tick (returns fresh circuit from store)
        const updatedCircuit = applyStimulus() ?? currentCircuit;

        // STEP 1: Execute one clock tick with updated circuit
        const result = runSimulationTick(updatedCircuit, currentSeqState);

        if (result.error) {
          console.error('Simulation error:', result.error);
          setSimulationStatus('error');
          return;
        }

        // STEP 2: Update the sequential state from simulation result
        if (result.sequentialState) {
          const newSeqState: SequentialState = {
            currentState: new Map(result.sequentialState.currentState),
            nextState: new Map(result.sequentialState.nextState),
            clocks: new Map(result.sequentialState.clocks),
            cycleCount: result.sequentialState.cycleCount,
          };

          setSeqState(newSeqState);

          // STEP 3: Create snapshot AFTER tick
          // Snapshots represent completed clock edges (post-tick states)
          const snapshot = createSnapshot(newSeqState, currentCircuit);
          saveSnapshot(snapshot);

          // TESTBENCH: Capture waveform and advance cycle counter
          if (testbench) {
            captureWaveform(result.portValues);
            advanceCycle();
          }
        }

        setTimeout(() => {
          setSimulationStatus('idle');
        }, 50);
      }, 1000 / clockSpeed); // Clock speed in Hz
    }

    // Cleanup on change or unmount
    return () => {
      if (runIntervalRef.current) {
        clearInterval(runIntervalRef.current);
        runIntervalRef.current = null;
      }
    };
  }, [isRunning, clockSpeed, setSimulationStatus, setSeqState, saveSnapshot, testbench, advanceCycle, applyStimulus, captureWaveform]);

  if (!hasSequentialComponents(circuit, resolveComponent)) {
    return null; // Don't show clock controls for purely combinational circuits
  }

  return (
    <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
      <span className="text-sm text-gray-600 font-medium">Clock:</span>

      {/* Time-travel controls (Back/Forward) */}
      <div className="flex items-center gap-1">
        <Button
          onClick={handleStepBack}
          disabled={currentHistoryIndex <= 0 || isRunning}
          variant="outline"
          size="sm"
          className="gap-1 px-2"
          title="Step backward one cycle"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        <Button
          onClick={handleStepForward}
          disabled={currentHistoryIndex >= history.length - 1 || isRunning}
          variant="outline"
          size="sm"
          className="gap-1 px-2"
          title="Step forward one cycle"
        >
          Forward
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

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
          {isViewingPast && <span className="text-orange-600 ml-1">(viewing past)</span>}
        </span>
      )}

      {/* Timeline scrubber */}
      {history.length > 0 && (
        <div className="flex items-center gap-2 ml-4 border-l border-gray-200 pl-4">
          <span className="text-sm text-gray-600">Timeline:</span>
          <input
            type="range"
            min={0}
            max={history.length - 1}
            value={currentHistoryIndex}
            onChange={(e) => {
              const index = parseInt(e.target.value);
              const targetCycle = history[index]?.cycleNumber;
              if (targetCycle !== undefined) {
                handleJumpToCycle(targetCycle);
              }
            }}
            className="w-32"
            disabled={isRunning}
            title={`Navigate through ${history.length} snapshots`}
          />
          <span className="text-xs text-gray-500">
            {currentHistoryIndex + 1} / {history.length}
          </span>
        </div>
      )}

      {/* Speed Control */}
      <div className="flex items-center gap-2 ml-4 border-l border-gray-200 pl-4">
        <span className="text-sm text-gray-600">Speed:</span>
        <input
          type="range"
          min="1"
          max="100"
          value={clockSpeed}
          onChange={(e) => setClockSpeed(Number(e.target.value))}
          className="w-24"
          title={`Clock speed: ${clockSpeed} Hz`}
        />
        <span className="text-sm text-gray-600 font-medium w-12">
          {clockSpeed} Hz
        </span>
      </div>
    </div>
  );
}
