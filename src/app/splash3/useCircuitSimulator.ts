"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { compileDSL, type ComponentLibrary } from "@/features/dsl";
import { elaborate, type FlatCircuit } from "@/features/visual-editor/lib/elaboration";
import type { FlatPortValueMap, FlatSequentialState } from "@/features/visual-editor/lib/flat-simulator";
import { useComponentLibraryStore } from "@/features/visual-editor/stores/component-library-store";
import { getPrimitives } from "@/features/visual-editor/lib/primitives";
import type { Circuit } from "@/features/dsl";

// Fast simulator from core
import {
  createSimulator,
  type SimulatorEngine,
  type ComponentLibrary as CoreComponentLibrary,
} from "@/core/simulator";

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
  outputs: Record<string, boolean | number>;
  inputs: Record<string, boolean | number>;
  cycleCount: number;
  ready: boolean;
  error: string | null;
  isSequential: boolean;
  circuit: Circuit | null;
  portValues: FlatPortValueMap | null;
  sequentialState: FlatSequentialState | null;
}

export interface SimulatorActions {
  setInput: (name: string, value: boolean | number) => void;
  toggleInput: (name: string) => void;
  toggleNode: (nodeId: string) => void;
  tick: () => void;
  reset: () => void;
}

/**
 * Hook to simulate a circuit from DSL code.
 */
export function useCircuitSimulator(dslCode: string): SimulatorState & SimulatorActions {
  const flatCircuitRef = useRef<FlatCircuit | null>(null);
  const compiledCircuitRef = useRef<Circuit | null>(null);
  const simulatorRef = useRef<SimulatorEngine | null>(null);

  const [outputs, setOutputs] = useState<Record<string, boolean | number>>({});
  const [inputs, setInputs] = useState<Record<string, boolean | number>>({});
  const [cycleCount, setCycleCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSequential, setIsSequential] = useState(false);
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [portValues, setPortValues] = useState<FlatPortValueMap | null>(null);
  const [sequentialState, setSequentialState] = useState<FlatSequentialState | null>(null);

  // Initialize and compile on mount or when DSL changes
  useEffect(() => {
    setReady(false);
    setError(null);
    setCycleCount(0);
    flatCircuitRef.current = null;
    simulatorRef.current = null;

    const store = useComponentLibraryStore.getState();

    // Initialize primitives if needed
    if (store.getAllPrimitiveNames().length === 0) {
      store.registerPrimitives(getPrimitives());
    }

    const library = new ComponentLibraryAdapter(store);
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

    const mainCircuit = result.circuits[result.circuits.length - 1];
    compiledCircuitRef.current = mainCircuit;

    const hasClocks = mainCircuit.clocks && mainCircuit.clocks.length > 0;
    setIsSequential(hasClocks);

    // Initialize inputs
    const initialInputs: Record<string, boolean | number> = {};
    for (const input of mainCircuit.inputs) {
      initialInputs[input.name] = input.portType.kind === 'bit' ? false : 0;
    }
    setInputs(initialInputs);

    try {
      const elaboratedCircuit = elaborate(mainCircuit, store);
      flatCircuitRef.current = elaboratedCircuit;

      const componentLibrary = adaptComponentLibrary(store);
      const simulator = createSimulator(elaboratedCircuit, { componentLibrary });
      simulatorRef.current = simulator;

      setCircuit(mainCircuit);
      setSequentialState(simulator.getState());
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [dslCode]);

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

  const syncInputsAndRun = useCallback((currentInputs: Record<string, boolean | number>) => {
    const simulator = simulatorRef.current;
    const flatCircuit = flatCircuitRef.current;
    if (!simulator || !flatCircuit) return;

    for (const [inputName, value] of Object.entries(currentInputs)) {
      simulator.setInput(inputName, value);
    }

    const result = simulator.runCombinational();
    if (result.error) {
      setError(result.error);
      return;
    }

    extractOutputs(simulator.getPortValues());
  }, [extractOutputs]);

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
      return { ...prev, [name]: current === 0 ? 1 : 0 };
    });
  }, []);

  const toggleNode = useCallback((nodeId: string) => {
    const simulator = simulatorRef.current;
    const flatCircuit = flatCircuitRef.current;
    if (!simulator || !flatCircuit) return;

    const node = flatCircuit.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const currentValue = node.arguments?.value;
    const newValue = typeof currentValue === 'boolean' ? !currentValue : (currentValue === 1 ? 0 : 1);

    simulator.setInput(nodeId, newValue);

    const result = simulator.runCombinational();
    if (result.error) {
      setError(result.error);
      return;
    }

    setPortValues(simulator.getPortValues() as FlatPortValueMap);
  }, []);

  const tick = useCallback(() => {
    const simulator = simulatorRef.current;
    const flatCircuit = flatCircuitRef.current;
    if (!ready || !simulator || !flatCircuit) return;

    for (const [inputName, value] of Object.entries(inputs)) {
      simulator.setInput(inputName, value);
    }

    const result = simulator.tick();

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

    simulator.reset();
    setCycleCount(0);
    setSequentialState(simulator.getState());

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
    toggleNode,
    tick,
    reset,
  };
}
