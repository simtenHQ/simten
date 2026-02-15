"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { compileDSL, type ComponentLibrary } from "@/features/dsl";
import { elaborate, type FlatCircuit } from "@/features/visual-editor/lib/elaboration";
import type { FlatSequentialState, FlatPortValueMap } from "@/features/visual-editor/lib/flat-simulator";
import { useComponentLibraryStore } from "@/features/visual-editor/stores/component-library-store";
import { getPrimitives } from "@/features/visual-editor/lib/primitives";
import type { Circuit } from "@/features/dsl";

// Fast simulator from core (decoupled, 2.7x faster)
import {
  createSimulator,
  type SimulatorEngine,
  type ComponentLibrary as CoreComponentLibrary,
} from "@/core/simulator";

// Top-level node ID used by the simulator for circuit inputs/outputs
const TOP_LEVEL_NODE = "__top__";

/**
 * Adapter to use the component library store as a ComponentLibrary for the compiler
 */
class ComponentLibraryAdapter implements ComponentLibrary {
  constructor(private store: ReturnType<typeof useComponentLibraryStore.getState>) {}

  getCircuit(name: string): Circuit | undefined {
    return this.store.resolveComponent(name);
  }

  hasCircuit(name: string): boolean {
    return this.store.resolveComponent(name) !== undefined;
  }

  addCircuit(circuit: Circuit): void {
    this.store.registerUser(circuit);
  }
}

/**
 * Adapt store to pure ComponentLibrary interface for core simulator
 */
function adaptComponentLibrary(store: ReturnType<typeof useComponentLibraryStore.getState>): CoreComponentLibrary {
  return {
    resolveComponent: (name: string) => store.resolveComponent(name),
    getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
  };
}

export interface SimulatorState {
  // Port values from the simulation (e.g., "out" -> true)
  outputs: Record<string, boolean | number>;
  // Current input values
  inputs: Record<string, boolean | number>;
  // Cycle count
  cycleCount: number;
  // Is the circuit compiled and ready?
  ready: boolean;
  // Any compilation errors
  error: string | null;
  // Is this a sequential circuit (has clocks)?
  isSequential: boolean;
  // The compiled circuit (for visualization)
  circuit: Circuit | null;
  // Port values map (for visualization)
  portValues: FlatPortValueMap | null;
  // Sequential state (for visualization)
  sequentialState: FlatSequentialState | null;
}

export interface SimulatorActions {
  // Set an input value
  setInput: (name: string, value: boolean | number) => void;
  // Toggle an input value (for boolean inputs)
  toggleInput: (name: string) => void;
  // Run one clock tick (for sequential circuits)
  tick: () => void;
  // Reset to initial state
  reset: () => void;
}

/**
 * Hook to simulate a circuit from DSL code using the fast simulator.
 *
 * Simply provide the DSL code - inputs and outputs are detected automatically
 * from the circuit definition. No Switch nodes needed!
 *
 * Uses the fast numeric simulator for 2.7x better performance.
 */
export function useCircuitSimulator(dslCode: string): SimulatorState & SimulatorActions {
  // Refs for simulation state (to avoid re-renders during tick)
  const flatCircuitRef = useRef<FlatCircuit | null>(null);
  const compiledCircuitRef = useRef<Circuit | null>(null);
  const simulatorRef = useRef<SimulatorEngine | null>(null);
  const storeRef = useRef<ReturnType<typeof useComponentLibraryStore.getState> | null>(null);

  // React state for UI
  const [outputs, setOutputs] = useState<Record<string, boolean | number>>({});
  const [inputs, setInputs] = useState<Record<string, boolean | number>>({});
  const [cycleCount, setCycleCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSequential, setIsSequential] = useState(false);
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [portValues, setPortValues] = useState<FlatPortValueMap | null>(null);
  const [sequentialState, setSequentialState] = useState<FlatSequentialState | null>(null);

  // Initialize primitives and compile on mount or when DSL changes
  useEffect(() => {
    // Reset state
    setReady(false);
    setError(null);
    setCycleCount(0);
    flatCircuitRef.current = null;
    simulatorRef.current = null;

    // Get store state directly (stable reference)
    const store = useComponentLibraryStore.getState();
    storeRef.current = store;

    // Initialize primitives if needed
    if (store.getAllPrimitiveNames().length === 0) {
      store.registerPrimitives(getPrimitives());
    }

    // Create library adapter
    const library = new ComponentLibraryAdapter(store);

    // Compile the DSL
    const result = compileDSL(dslCode, library, "splash-demo.dsl");

    if (result.errors.length > 0) {
      setError(result.errors.map(e => e.message).join("; "));
      return;
    }

    if (result.circuits.length === 0) {
      setError("No circuits found in DSL");
      return;
    }

    // Register compiled circuits
    for (const circuit of result.circuits) {
      store.registerUser(circuit);
    }

    // Get the last circuit (main one)
    const mainCircuit = result.circuits[result.circuits.length - 1];
    compiledCircuitRef.current = mainCircuit;

    // Check if sequential (has clocks)
    const hasClocks = mainCircuit.clocks && mainCircuit.clocks.length > 0;
    setIsSequential(hasClocks);

    // Initialize inputs from circuit definition
    const initialInputs: Record<string, boolean | number> = {};
    for (const input of mainCircuit.inputs) {
      initialInputs[input.name] = input.portType.kind === 'bit' ? false : 0;
    }
    setInputs(initialInputs);

    try {
      // Elaborate the circuit
      const flatCircuit = elaborate(mainCircuit, store);
      flatCircuitRef.current = flatCircuit;

      // Create fast simulator
      const componentLibrary = adaptComponentLibrary(store);
      const simulator = createSimulator(flatCircuit, { componentLibrary });
      simulatorRef.current = simulator;

      // Expose circuit for visualization
      setCircuit(mainCircuit);
      setSequentialState(simulator.getState());

      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [dslCode]); // Only re-run when DSL code changes

  // Extract outputs from simulation result
  const extractOutputs = useCallback((simPortValues: ReadonlyMap<string, boolean | number>) => {
    const newOutputs: Record<string, boolean | number> = {};
    const circuit = compiledCircuitRef.current;

    if (circuit && simPortValues) {
      for (const output of circuit.outputs) {
        const key = `${TOP_LEVEL_NODE}.${output.name}`;
        const value = simPortValues.get(key);
        if (value !== undefined) {
          newOutputs[output.name] = typeof value === 'number' ? value : Boolean(value);
        }
      }
    }

    setOutputs(newOutputs);
    setPortValues(simPortValues as FlatPortValueMap);
  }, []);

  // Sync inputs to simulator and run combinational
  const syncInputsAndRun = useCallback((currentInputs: Record<string, boolean | number>) => {
    const simulator = simulatorRef.current;
    const flatCircuit = flatCircuitRef.current;
    if (!simulator || !flatCircuit) return;

    // Sync input values to simulator
    for (const node of flatCircuit.nodes) {
      if (node.primitiveType === 'Input' || node.primitiveType === 'Switch' || node.primitiveType === 'Button') {
        // Find which top-level input this node corresponds to
        for (const [inputName, value] of Object.entries(currentInputs)) {
          if (node.id.includes(inputName)) {
            node.arguments = { ...node.arguments, value };
            if (typeof value === 'number' || typeof value === 'boolean') {
              simulator.setInput(node.id, 'out', value);
            }
          }
        }
      }
    }

    // Run combinational simulation
    const result = simulator.runCombinational();
    if (result.error) {
      setError(result.error);
      return;
    }

    extractOutputs(simulator.getPortValues());
  }, [extractOutputs]);

  // Run combinational simulation when inputs change
  useEffect(() => {
    if (ready) {
      syncInputsAndRun(inputs);
    }
  }, [ready, inputs, syncInputsAndRun]);

  const setInput = useCallback((name: string, value: boolean | number) => {
    setInputs(prev => ({ ...prev, [name]: value }));
  }, []);

  const toggleInput = useCallback((name: string) => {
    setInputs(prev => {
      const current = prev[name];
      if (typeof current === 'boolean') {
        return { ...prev, [name]: !current };
      }
      // For numeric inputs, toggle between 0 and 1
      return { ...prev, [name]: current === 0 ? 1 : 0 };
    });
  }, []);

  const tick = useCallback(() => {
    const simulator = simulatorRef.current;
    const flatCircuit = flatCircuitRef.current;
    if (!ready || !simulator || !flatCircuit) return;

    // Sync inputs before tick
    for (const node of flatCircuit.nodes) {
      if (node.primitiveType === 'Input' || node.primitiveType === 'Switch' || node.primitiveType === 'Button') {
        for (const [inputName, value] of Object.entries(inputs)) {
          if (node.id.includes(inputName)) {
            node.arguments = { ...node.arguments, value };
            if (typeof value === 'number' || typeof value === 'boolean') {
              simulator.setInput(node.id, 'out', value);
            }
          }
        }
      }
    }

    // Run tick
    const result = simulator.tick();

    // Update state
    const seqState = simulator.getState();
    if (seqState) {
      setCycleCount(seqState.cycleCount);
      setSequentialState(seqState);
    }

    extractOutputs(result.portValues);
  }, [ready, inputs, extractOutputs]);

  const reset = useCallback(() => {
    const simulator = simulatorRef.current;
    if (!simulator || !compiledCircuitRef.current) return;

    // Reset simulator
    simulator.reset();
    setCycleCount(0);
    setSequentialState(simulator.getState());

    // Reset inputs to defaults
    const initialInputs: Record<string, boolean | number> = {};
    for (const input of compiledCircuitRef.current.inputs) {
      initialInputs[input.name] = input.portType.kind === 'bit' ? false : 0;
    }
    setInputs(initialInputs);
  }, []);

  return {
    outputs,
    inputs,
    cycleCount,
    ready,
    error,
    isSequential,
    circuit,
    portValues,
    sequentialState,
    setInput,
    toggleInput,
    tick,
    reset,
  };
}
