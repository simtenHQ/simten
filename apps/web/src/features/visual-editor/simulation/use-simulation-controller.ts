/**
 * React Hook for Simulation Controller
 *
 * Simple wrapper that subscribes to controller and triggers re-renders.
 */

import { useEffect, useState } from 'react';
import { simulationController } from './simulation-controller';
import { useCircuitStore } from '../stores/circuit-store';
import { useComponentLibraryStore } from '../stores/component-library-store';
import { restoreEnvironmentalState } from '../lib/time-travel';

export function useSimulationController() {
  const circuit = useCircuitStore((state) => state.circuit);
  const updateNode = useCircuitStore((state) => state.updateNode);
  const library = useComponentLibraryStore();

  // Track circuit structure (not environmental values)
  const [prevStructure, setPrevStructure] = useState('');

  // Force re-render when controller state changes
  const [, forceUpdate] = useState(0);

  // Initialize controller when circuit structure changes
  useEffect(() => {
    if (!circuit || circuit.nodes.length === 0) return;

    // Detect structure changes (ignore environmental value changes like Input.value)
    const circuitStructure = JSON.stringify({
      nodes: circuit.nodes.map((n) => ({ id: n.id, componentRef: n.componentRef })),
      connections: circuit.connections,
    });

    if (circuitStructure !== prevStructure) {
      // Structure changed - reinitialize
      simulationController.initialize(circuit, library);
      setPrevStructure(circuitStructure);
    } else {
      // Structure same, but values might have changed (keyboard input, etc.)
      simulationController.updateCircuit(circuit);
    }
  }, [circuit, library, prevStructure]);

  // Re-simulate combinational circuits when inputs change
  useEffect(() => {
    if (!circuit) return;

    // Only auto-simulate for combinational circuits
    // Sequential circuits are driven by explicit step() calls,
    // which sync environmental values automatically
    if (!simulationController.getIsSequential()) {
      simulationController.simulate();
    }
  }, [circuit]);

  // Subscribe to controller changes
  useEffect(() => {
    return simulationController.subscribe(() => {
      forceUpdate((n) => n + 1);
    });
  }, []);

  return {
    // Command API
    step: () => simulationController.step(),
    reset: () => simulationController.reset(),
    stepBack: () => {
      const snapshot = simulationController.stepBack();
      if (snapshot && circuit) {
        restoreEnvironmentalState(circuit, snapshot.environmentalState, updateNode);
      }
    },
    stepForward: () => {
      const snapshot = simulationController.stepForward();
      if (snapshot && circuit) {
        restoreEnvironmentalState(circuit, snapshot.environmentalState, updateNode);
      }
    },
    seek: (cycle: number) => {
      const snapshot = simulationController.seek(cycle);
      if (snapshot && circuit) {
        restoreEnvironmentalState(circuit, snapshot.environmentalState, updateNode);
      }
    },
    setInput: (nodeId: string, value: number) => simulationController.setInput(nodeId, value),

    // Query API
    portValues: simulationController.getPortValues(),
    seqState: simulationController.getSeqState(),
    cycle: simulationController.getCycle(),
    history: simulationController.getHistory(),
    currentHistoryIndex: simulationController.getCurrentHistoryIndex(),
    isViewingPast: simulationController.isViewingPast(),
    isSequential: simulationController.getIsSequential(),
  };
}
