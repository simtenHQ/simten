"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { compileDSL, type ComponentLibrary as DSLComponentLibrary } from "@turing-incomplete/core/dsl";
import {
  createSimulator,
  elaborate,
  PRIMITIVES,
  type SimulatorEngine,
  type ComponentLibrary,
  type FlatCircuit,
  type FlatPortValueMap,
  type FlatSequentialState,
} from "@turing-incomplete/core/simulator";
import type { Circuit } from "@turing-incomplete/core/dsl";

const TOP_LEVEL_NODE = "__top__";

/**
 * Create a mutable component library that wraps core's immutable one.
 * Supports addCircuit for sub-circuit registration during compilation.
 */
function createMutableLibrary(primitives: Circuit[]): ComponentLibrary & DSLComponentLibrary {
  const circuitMap = new Map<string, Circuit>();
  for (const c of primitives) circuitMap.set(c.name, c);

  return {
    resolveComponent: (name: string) => circuitMap.get(name),
    getAllPrimitiveNames: () => {
      return Array.from(circuitMap.entries())
        .filter(([, c]) => c.implementation.kind === 'primitive')
        .map(([name]) => name);
    },
    getCircuit: (name: string) => circuitMap.get(name),
    hasCircuit: (name: string) => circuitMap.has(name),
    addCircuit: (circuit: Circuit) => { circuitMap.set(circuit.name, circuit); },
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
  /** The component library used by this simulator instance (includes user-defined circuits) */
  componentLibrary: ComponentLibrary | null;
}

export interface SimulatorActions {
  setInput: (name: string, value: boolean | number) => void;
  toggleInput: (name: string) => void;
  toggleNode: (nodeId: string) => void;
  setNodeValue: (nodeId: string, value: number) => void;
  tick: () => void;
  reset: () => void;
  /** Direct access to the simulator engine for performance-critical loops */
  getSimulator: () => SimulatorEngine | null;
}

export interface UseCircuitSimulatorOptions {
  initialMemory?: Map<string, Map<number, number>>;
}

/**
 * Standalone circuit simulator hook.
 *
 * Per-instance component library — each hook call creates its own library
 * to prevent cross-contamination when multiple embeds exist on the same page.
 *
 * Data flow: create library → compile DSL → elaborate → create simulator
 */
export function useCircuitSimulator(
  dslCode: string,
  options?: UseCircuitSimulatorOptions,
): SimulatorState & SimulatorActions {
  const flatCircuitRef = useRef<FlatCircuit | null>(null);
  const compiledCircuitRef = useRef<Circuit | null>(null);
  const simulatorRef = useRef<SimulatorEngine | null>(null);
  const libraryRef = useRef<ComponentLibrary | null>(null);

  const [outputs, setOutputs] = useState<Record<string, boolean | number>>({});
  const [inputs, setInputs] = useState<Record<string, boolean | number>>({});
  const [cycleCount, setCycleCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSequential, setIsSequential] = useState(false);
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [portValues, setPortValues] = useState<FlatPortValueMap | null>(null);
  const [sequentialState, setSequentialState] = useState<FlatSequentialState | null>(null);

  const initialMemory = options?.initialMemory;

  // Compile DSL when it changes — per-instance library
  useEffect(() => {
    setReady(false);
    setError(null);
    setCycleCount(0);
    flatCircuitRef.current = null;
    simulatorRef.current = null;
    compiledCircuitRef.current = null;

    if (!dslCode) return;

    // Per-instance library — fresh for each DSL string
    const library = createMutableLibrary([...PRIMITIVES]);
    libraryRef.current = library;

    const result = compileDSL(dslCode, library, "embed-demo.dsl");

    if (result.errors.length > 0) {
      setError(result.errors.map(e => e.message).join("; "));
      return;
    }

    if (result.circuits.length === 0) {
      setError("No circuits found in DSL");
      return;
    }

    const mainCircuit = result.circuits[result.circuits.length - 1];
    compiledCircuitRef.current = mainCircuit;

    // Initialize inputs
    const initialInputs: Record<string, boolean | number> = {};
    for (const input of mainCircuit.inputs) {
      initialInputs[input.name] = input.portType.kind === 'bit' ? false : 0;
    }
    setInputs(initialInputs);

    try {
      const elaboratedCircuit = elaborate(mainCircuit, library);
      flatCircuitRef.current = elaboratedCircuit;
      setCircuit(mainCircuit);

      // Detect sequential
      let hasClocks = mainCircuit.clocks && mainCircuit.clocks.length > 0;
      if (!hasClocks) {
        for (const node of elaboratedCircuit.nodes) {
          if (node.primitiveType) {
            const def = library.resolveComponent(node.primitiveType);
            if (def && def.clocks && def.clocks.length > 0) {
              hasClocks = true;
              break;
            }
          }
        }
      }
      setIsSequential(hasClocks);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [dslCode]);

  // Create simulator when compiled circuit or initialMemory changes
  useEffect(() => {
    const flatCircuit = flatCircuitRef.current;
    const library = libraryRef.current;
    if (!flatCircuit || !library) return;

    simulatorRef.current = null;
    setReady(false);
    setCycleCount(0);

    try {
      const simulator = createSimulator(flatCircuit, {
        componentLibrary: library,
        initialMemory,
      });
      simulatorRef.current = simulator;
      setSequentialState(simulator.getState());
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [dslCode, initialMemory]);

  const extractOutputs = useCallback((simPortValues: ReadonlyMap<string, boolean | number>) => {
    const newOutputs: Record<string, boolean | number> = {};
    const circ = compiledCircuitRef.current;

    if (circ && simPortValues) {
      for (const output of circ.outputs) {
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
    if (!simulator || !flatCircuitRef.current) return;

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
    if (ready) syncInputsAndRun(inputs);
  }, [ready, inputs, syncInputsAndRun]);

  const setInput = useCallback((name: string, value: boolean | number) => {
    setInputs(prev => ({ ...prev, [name]: value }));
  }, []);

  const toggleInput = useCallback((name: string) => {
    setInputs(prev => {
      const current = prev[name];
      if (typeof current === 'boolean') return { ...prev, [name]: !current };
      return { ...prev, [name]: current === 0 ? 1 : 0 };
    });
  }, []);

  const toggleNode = useCallback((nodeId: string) => {
    const simulator = simulatorRef.current;
    if (!simulator || !flatCircuitRef.current) return;

    const node = flatCircuitRef.current.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const currentValue = node.arguments?.value;
    const newValue = typeof currentValue === 'boolean' ? !currentValue : (currentValue === 1 ? 0 : 1);

    simulator.setInput(nodeId, newValue);
    const result = simulator.runCombinational();
    if (result.error) { setError(result.error); return; }

    setPortValues(simulator.getPortValues() as FlatPortValueMap);
  }, []);

  const setNodeValue = useCallback((nodeId: string, value: number) => {
    const simulator = simulatorRef.current;
    if (!simulator || !flatCircuitRef.current) return;

    simulator.setInput(nodeId, value);
    const result = simulator.runCombinational();
    if (result.error) { setError(result.error); return; }

    setPortValues(simulator.getPortValues() as FlatPortValueMap);
  }, []);

  const tick = useCallback(() => {
    const simulator = simulatorRef.current;
    if (!ready || !simulator || !flatCircuitRef.current) return;

    for (const [inputName, value] of Object.entries(inputs)) {
      simulator.setInput(inputName, value);
    }

    simulator.tick();

    const seqState = simulator.getState();
    if (seqState) {
      setCycleCount(seqState.cycleCount);
      setSequentialState(seqState);
    }

    extractOutputs(simulator.getPortValues());
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
    componentLibrary: libraryRef.current,
    setInput,
    toggleInput,
    toggleNode,
    setNodeValue,
    tick,
    reset,
    getSimulator: useCallback(() => simulatorRef.current, []),
  };
}
