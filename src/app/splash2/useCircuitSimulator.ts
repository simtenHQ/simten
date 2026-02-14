"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { compileDSL, type ComponentLibrary } from "@/features/dsl";
import { elaborate, type FlatCircuit } from "@/features/visual-editor/lib/elaboration";
import {
  initializeFlatSequentialState,
  runFlatSimulationTick,
  runFlatCombinationalSimulation,
  type FlatSequentialState,
  type FlatPortValueMap,
} from "@/features/visual-editor/lib/flat-simulator";
import { useComponentLibraryStore } from "@/features/visual-editor/stores/component-library-store";
import { getPrimitives } from "@/features/visual-editor/lib/primitives";
import type { Circuit } from "@/features/dsl";

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
 * Hook to simulate a circuit from DSL code using the real simulator.
 *
 * Simply provide the DSL code - inputs and outputs are detected automatically
 * from the circuit definition. No Switch nodes needed!
 *
 * @example
 * const sim = useCircuitSimulator(`
 *   circuit And {
 *     input a: Bit
 *     input b: Bit
 *     output out: Bit
 *     impl { ... }
 *   }
 * `);
 *
 * sim.toggleInput("a");  // Toggle input 'a'
 * console.log(sim.outputs.out);  // Read output
 */
export function useCircuitSimulator(dslCode: string): SimulatorState & SimulatorActions {
  // Refs for simulation state (to avoid re-renders during tick)
  const flatCircuitRef = useRef<FlatCircuit | null>(null);
  const seqStateRef = useRef<FlatSequentialState | null>(null);
  const compiledCircuitRef = useRef<Circuit | null>(null);
  const portValuesRef = useRef<FlatPortValueMap | null>(null);

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
    seqStateRef.current = null;

    // Get store state directly (stable reference)
    const store = useComponentLibraryStore.getState();

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

      // Initialize sequential state
      const seqState = initializeFlatSequentialState(flatCircuit);
      seqStateRef.current = seqState;

      // Expose circuit for visualization
      setCircuit(mainCircuit);
      setSequentialState(seqState);

      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [dslCode]); // Only re-run when DSL code changes

  // Build input values map for the simulator
  const buildInputValues = useCallback((currentInputs: Record<string, boolean | number>): FlatPortValueMap => {
    const inputValues: FlatPortValueMap = new Map();
    for (const [name, value] of Object.entries(currentInputs)) {
      inputValues.set(`${TOP_LEVEL_NODE}.${name}`, value);
    }
    return inputValues;
  }, []);

  // Extract outputs from simulation result
  const extractOutputs = useCallback((simResult: { portValues: FlatPortValueMap }) => {
    const newOutputs: Record<string, boolean | number> = {};
    const circuit = compiledCircuitRef.current;

    if (circuit && simResult.portValues) {
      for (const output of circuit.outputs) {
        const key = `${TOP_LEVEL_NODE}.${output.name}`;
        const value = simResult.portValues.get(key);
        if (value !== undefined) {
          newOutputs[output.name] = typeof value === 'number' ? value : Boolean(value);
        }
      }
    }

    setOutputs(newOutputs);
    setPortValues(simResult.portValues);
    portValuesRef.current = simResult.portValues;
  }, []);

  // Run combinational-only simulation (for input changes - no state update)
  const runCombinational = useCallback((currentInputs: Record<string, boolean | number>) => {
    if (!flatCircuitRef.current || !seqStateRef.current) return;

    const inputValues = buildInputValues(currentInputs);

    // Only run combinational logic - don't update sequential state
    const simResult = runFlatCombinationalSimulation(
      flatCircuitRef.current,
      seqStateRef.current,
      inputValues
    );

    if (simResult.error) {
      setError(simResult.error);
      return;
    }

    extractOutputs(simResult);
  }, [buildInputValues, extractOutputs]);

  // Run full simulation tick (for clock tick button - updates state)
  const runFullTick = useCallback((currentInputs: Record<string, boolean | number>) => {
    if (!flatCircuitRef.current || !seqStateRef.current) return;

    const inputValues = buildInputValues(currentInputs);

    // Run full tick including sequential state update
    // Pass previous port values for O(K) change detection
    const simResult = runFlatSimulationTick(
      flatCircuitRef.current,
      seqStateRef.current,
      portValuesRef.current ?? undefined,
      inputValues
    );

    if (simResult.error) {
      setError(simResult.error);
      return;
    }

    // Update sequential state for next tick
    if (simResult.sequentialState) {
      seqStateRef.current = simResult.sequentialState;
      setCycleCount(simResult.sequentialState.cycleCount);
      setSequentialState(simResult.sequentialState);
    }

    extractOutputs(simResult);
  }, [buildInputValues, extractOutputs]);

  // Run combinational simulation when inputs change (no state update)
  useEffect(() => {
    if (ready) {
      runCombinational(inputs);
    }
  }, [ready, inputs, runCombinational]);

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
    if (!ready) return;
    runFullTick(inputs);
  }, [ready, inputs, runFullTick]);

  const reset = useCallback(() => {
    if (!flatCircuitRef.current || !compiledCircuitRef.current) return;

    // Re-initialize sequential state
    const seqState = initializeFlatSequentialState(flatCircuitRef.current);
    seqStateRef.current = seqState;
    setCycleCount(0);

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
