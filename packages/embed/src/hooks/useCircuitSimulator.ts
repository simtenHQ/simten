"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { compileDSL, type ComponentLibrary as DSLComponentLibrary } from "@turing-incomplete/core/dsl";
import {
  createSimulator,
  elaborate,
  SimulationSession,
  PRIMITIVES,
  type SimulationSessionState,
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
  /** Session state — time-travel, auto-run */
  history: readonly { engineSnapshot: unknown; metadata?: unknown }[];
  historyIndex: number;
  isViewingPast: boolean;
  isRunning: boolean;
}

export interface SimulatorActions {
  setInput: (name: string, value: boolean | number) => void;
  toggleInput: (name: string) => void;
  toggleNode: (nodeId: string) => void;
  setNodeValue: (nodeId: string, value: number) => void;
  tick: () => void;
  reset: () => void;
  stepBack: () => void;
  stepForward: () => void;
  seek: (index: number) => void;
  startAutoRun: (ticksPerSecond: number, options?: { displayRate?: number; onBeforeTick?: () => void }) => void;
  stopAutoRun: () => void;
  /** Run combinational propagation (after setNode, etc.) */
  runCombinational: () => void;
  /** Direct access to the simulator engine for performance-critical loops */
  getSimulator: () => SimulatorEngine | null;
}

export interface UseCircuitSimulatorOptions {
  initialMemory?: Map<string, Map<number, number>>;
}

const EMPTY_SESSION_STATE = {
  portValues: new Map() as ReadonlyMap<string, boolean | number>,
  sequentialState: null as FlatSequentialState | null,
  cycle: 0,
  isSequential: false,
  history: [] as readonly [],
  historyIndex: -1,
  isViewingPast: false,
  isRunning: false,
  speed: 0,
};
const getEmptySessionState = () => EMPTY_SESSION_STATE;

/**
 * Standalone circuit simulator hook.
 *
 * Per-instance component library — each hook call creates its own library
 * to prevent cross-contamination when multiple embeds exist on the same page.
 *
 * Internally uses SimulationSession for tick/reset/time-travel/auto-run.
 */
export function useCircuitSimulator(
  dslCode: string,
  options?: UseCircuitSimulatorOptions,
): SimulatorState & SimulatorActions {
  const flatCircuitRef = useRef<FlatCircuit | null>(null);
  const compiledCircuitRef = useRef<Circuit | null>(null);
  const libraryRef = useRef<ComponentLibrary | null>(null);
  const sessionRef = useRef<SimulationSession | null>(null);
  // Session in state so useSyncExternalStore re-subscribes when session changes
  const [session, setSession] = useState<SimulationSession | null>(null);

  const [outputs, setOutputs] = useState<Record<string, boolean | number>>({});
  const [inputs, setInputs] = useState<Record<string, boolean | number>>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSequentialFlag, setIsSequentialFlag] = useState(false);
  const [circuit, setCircuit] = useState<Circuit | null>(null);

  const initialMemory = options?.initialMemory;

  // Compile DSL when it changes — per-instance library
  useEffect(() => {
    setReady(false);
    setError(null);
    flatCircuitRef.current = null;
    compiledCircuitRef.current = null;

    // Dispose previous session
    if (sessionRef.current) {
      sessionRef.current.dispose();
      sessionRef.current = null;
    }

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
      setIsSequentialFlag(hasClocks);

      // Create simulator + session
      const simulator = createSimulator(elaboratedCircuit, {
        componentLibrary: library,
        initialMemory,
      });
      simulator.runCombinational();

      const session = new SimulationSession(simulator, {
        isSequential: hasClocks,
      });
      sessionRef.current = session;
      setSession(session);
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }

    return () => {
      if (sessionRef.current) {
        sessionRef.current.dispose();
        sessionRef.current = null;
        setSession(null);
      }
    };
  }, [dslCode, initialMemory]);

  // Subscribe to session state
  const [sessionState, setSessionState] = useState<SimulationSessionState>(getEmptySessionState);

  useEffect(() => {
    if (!session) {
      setSessionState(getEmptySessionState());
      return;
    }
    setSessionState(session.getState());
    return session.subscribe(() => {
      setSessionState(session.getState());
    });
  }, [session]);

  // Extract outputs from portValues
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
  }, []);

  // Sync outputs when session state changes
  useEffect(() => {
    if (ready && sessionState.portValues.size > 0) {
      extractOutputs(sessionState.portValues);
    }
  }, [ready, sessionState.portValues, extractOutputs]);

  // Sync inputs to engine and run combinational when inputs change
  useEffect(() => {
    const session = sessionRef.current;
    if (!ready || !session) return;

    for (const [inputName, value] of Object.entries(inputs)) {
      session.setInput(inputName, value);
    }

    if (!isSequentialFlag) {
      session.runCombinational();
    }
  }, [ready, inputs, isSequentialFlag]);

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
    const session = sessionRef.current;
    const flatCircuit = flatCircuitRef.current;
    if (!session || !flatCircuit) return;

    const node = flatCircuit.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const currentValue = node.arguments?.value;
    const newValue = typeof currentValue === 'boolean' ? !currentValue : (currentValue === 1 ? 0 : 1);

    session.setInput(nodeId, newValue);
    session.runCombinational();
  }, []);

  const setNodeValue = useCallback((nodeId: string, value: number) => {
    const session = sessionRef.current;
    if (!session) return;

    session.setInput(nodeId, value);
    session.runCombinational();
  }, []);

  const tick = useCallback(() => {
    const session = sessionRef.current;
    if (!ready || !session) return;

    // Sync inputs before ticking
    for (const [inputName, value] of Object.entries(inputs)) {
      session.setInput(inputName, value);
    }

    session.tick();
  }, [ready, inputs]);

  const reset = useCallback(() => {
    const session = sessionRef.current;
    if (!session || !compiledCircuitRef.current) return;

    session.reset();

    const initialInputs: Record<string, boolean | number> = {};
    for (const input of compiledCircuitRef.current.inputs) {
      initialInputs[input.name] = input.portType.kind === 'bit' ? false : 0;
    }
    setInputs(initialInputs);
  }, []);

  return {
    outputs,
    inputs,
    cycleCount: sessionState.cycle,
    ready,
    error,
    isSequential: isSequentialFlag,
    circuit,
    portValues: (sessionState.portValues.size > 0 ? sessionState.portValues : null) as FlatPortValueMap | null,
    sequentialState: sessionState.sequentialState,
    componentLibrary: libraryRef.current,
    // Session state
    history: sessionState.history,
    historyIndex: sessionState.historyIndex,
    isViewingPast: sessionState.isViewingPast,
    isRunning: sessionState.isRunning,
    // Actions
    setInput,
    toggleInput,
    toggleNode,
    setNodeValue,
    tick,
    reset,
    stepBack: useCallback(() => { sessionRef.current?.stepBack(); }, []),
    stepForward: useCallback(() => { sessionRef.current?.stepForward(); }, []),
    seek: useCallback((index: number) => { sessionRef.current?.seek(index); }, []),
    startAutoRun: useCallback((tps: number, opts?: { displayRate?: number; onBeforeTick?: () => void }) => {
      sessionRef.current?.startAutoRun(tps, opts);
    }, []),
    stopAutoRun: useCallback(() => { sessionRef.current?.stopAutoRun(); }, []),
    runCombinational: useCallback(() => { sessionRef.current?.runCombinational(); }, []),
    getSimulator: useCallback(() => sessionRef.current?.getEngine() ?? null, []),
  };
}
