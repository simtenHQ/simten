
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  type SimulatorEngine,
  type CircuitLibrary,
  type FlatPortValueMap,
  type FlatSequentialState,
} from "@simten/core/simulator";
import type { Circuit } from "@simten/core";
import type { BuiltCircuit } from "@simten/core/circuit";
import { Switch, Button, Led, Input, Output, HexDisplay } from "@simten/core/std";
import { useCircuitSession } from "@simten/ui/canvas";
import { autoHarness } from "@simten/core/circuit";

const TOP_LEVEL_NODE = "__top__";

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
  componentLibrary: CircuitLibrary | null;
  history: readonly { engineSnapshot: unknown; metadata?: unknown }[];
  historyIndex: number;
  isViewingPast: boolean;
  isRunning: boolean;
}

export interface SimulatorActions {
  setNode: (name: string, value: boolean | number) => void;
  toggleInput: (name: string) => void;
  toggleNode: (nodeId: string) => void;
  setNodeValue: (nodeId: string, value: number | boolean | Map<number, number>) => void;
  tick: () => void;
  reset: () => void;
  stepBack: () => void;
  stepForward: () => void;
  seek: (index: number) => void;
  startAutoRun: (ticksPerSecond: number, options?: { displayRate?: number; onBeforeTick?: () => void }) => void;
  stopAutoRun: () => void;
  runCombinational: () => void;
  getSimulator: () => SimulatorEngine | null;
}

export interface UseCircuitSimulatorOptions {
  /** Wrap the circuit with auto-generated Switch/Led nodes */
  autoHarness?: boolean;
  /** Initial values for input ports (only used when autoHarness is true) */
  initialInputs?: Record<string, number | boolean>;
}

/**
 * Circuit simulator hook.
 *
 * Takes a BuiltCircuit and returns reactive simulation state + actions.
 * For dynamic code compilation, use sandbox.compile() + buildFromIR() from core/circuit.
 */
export function useCircuitSimulator(
  circuit: BuiltCircuit,
  options?: UseCircuitSimulatorOptions,
): SimulatorState & SimulatorActions {
  // ── Build library + resolve circuit IR ──
  const { rawCircuit, componentLibrary } = useMemo(() => {
    const circuitMap = new Map<string, Circuit>();
    const lib: CircuitLibrary & { addCircuit(c: Circuit): void } = {
      resolveCircuit: (name) => circuitMap.get(name),
      getAllPrimitiveNames: () => [...circuitMap.entries()].filter(([, c]) => c.implementation.kind === 'primitive').map(([n]) => n),
      addCircuit: (c) => { circuitMap.set(c.name, c); },
    };
    // Always include harness components (Switch, Led, etc.) since autoHarness may inject them
    for (const c of [Switch, Button, Led, Input, Output, HexDisplay]) {
      lib.addCircuit(c.circuit);
    }
    lib.addCircuit(circuit.circuit);
    for (const [, dep] of circuit._dependencies) {
      if (dep?.circuit) lib.addCircuit(dep.circuit);
    }
    return { rawCircuit: circuit.circuit, componentLibrary: lib };
  }, [circuit]);

  // ── Auto-harness (wrap with Switches/LEDs if enabled) ──
  const harnessedCircuit = useMemo(() => {
    if (!options?.autoHarness) return rawCircuit;
    return autoHarness(rawCircuit, componentLibrary, options.initialInputs);
  }, [rawCircuit, componentLibrary, options?.autoHarness, options?.initialInputs]);

  // ── Simulation (via the same hook the editor uses) ──
  const sim = useCircuitSession(harnessedCircuit, componentLibrary);

  // ── Default inputs from the top-level simulated circuit ──
  // Use the harnessed circuit (what the engine actually runs) so that when
  // the auto-harness wraps the circuit with Switch nodes, those become internal
  // nodes (not top-level inputs) and aren't overwritten on every tick.
  const defaultInputs = useMemo(() => {
    const result: Record<string, boolean | number> = {};
    for (const input of harnessedCircuit.inputs) {
      result[input.name] = input.portType.kind === 'bit' ? false : 0;
    }
    return result;
  }, [harnessedCircuit]);

  const [outputs, setOutputs] = useState<Record<string, boolean | number>>({});
  const [inputs, setInputs] = useState<Record<string, boolean | number>>(defaultInputs);
  const topCircuitRef = useRef<Circuit>(harnessedCircuit);
  topCircuitRef.current = harnessedCircuit;

  const ready = sim.session !== null;
  const isSequential = sim.isSequential;

  // Sync inputs when the underlying circuit changes
  useEffect(() => {
    setInputs(defaultInputs);
  }, [defaultInputs]);

  // Extract outputs from portValues
  useEffect(() => {
    if (!ready || !sim.portValues || sim.portValues.size === 0) return;
    const circ = topCircuitRef.current;

    const newOutputs: Record<string, boolean | number> = {};
    for (const output of circ.outputs) {
      const key = `${TOP_LEVEL_NODE}.${output.name}`;
      const value = sim.portValues.get(key);
      if (value !== undefined) {
        newOutputs[output.name] = typeof value === 'number' ? value : Boolean(value);
      }
    }
    setOutputs(newOutputs);
  }, [ready, sim.portValues]);

  // Sync inputs to engine when inputs change
  useEffect(() => {
    if (!sim.session || !ready) return;
    const engine = sim.session.getEngine();
    if (!engine) return;

    for (const [inputName, value] of Object.entries(inputs)) {
      engine.setNode(inputName, value);
    }

    if (!isSequential) {
      sim.session.runCombinational();
    }
  }, [inputs, ready, isSequential, sim.session]);

  // ── Actions ──

  const setNode = useCallback((name: string, value: boolean | number) => {
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
    if (!sim.session) return;
    const engine = sim.session.getEngine();
    if (!engine) return;
    const pv = engine.getPortValues();
    const outKey = `${nodeId}.out`;
    const current = pv.get(outKey);
    const newValue = typeof current === 'boolean' ? !current : (current === 1 ? 0 : 1);
    engine.setNode(nodeId, newValue);
    sim.session.runCombinational();
  }, [sim.session]);

  const setNodeValue = useCallback((nodeId: string, value: number | boolean | Map<number, number>) => {
    if (!sim.session) return;
    sim.session.getEngine()?.setNode(nodeId, value);
    sim.session.runCombinational();
  }, [sim.session]);

  const tick = useCallback(() => {
    if (!sim.session || !ready) return;
    const engine = sim.session.getEngine();
    if (engine) {
      for (const [inputName, value] of Object.entries(inputs)) {
        engine.setNode(inputName, value);
      }
    }
    sim.tick();
  }, [ready, inputs, sim.session, sim.tick]);

  const reset = useCallback(() => {
    sim.reset();
    setInputs(defaultInputs);
  }, [sim.reset, defaultInputs]);

  return {
    // State
    outputs,
    inputs,
    cycleCount: sim.cycle,
    ready,
    error: null,
    isSequential,
    circuit: harnessedCircuit,
    portValues: (sim.portValues.size > 0 ? sim.portValues : null) as FlatPortValueMap | null,
    sequentialState: sim.sequentialState,
    componentLibrary,
    history: sim.history,
    historyIndex: sim.historyIndex,
    isViewingPast: sim.isViewingPast,
    isRunning: sim.isRunning,

    // Actions
    setNode,
    toggleInput,
    toggleNode,
    setNodeValue,
    tick,
    reset,
    stepBack: useCallback(() => { sim.session?.stepBack(); }, [sim.session]),
    stepForward: useCallback(() => { sim.session?.stepForward(); }, [sim.session]),
    seek: useCallback((index: number) => { sim.session?.seek(index); }, [sim.session]),
    startAutoRun: useCallback((tps: number, opts?: { displayRate?: number; onBeforeTick?: () => void }) => {
      sim.session?.startAutoRun(tps, opts);
    }, [sim.session]),
    stopAutoRun: useCallback(() => { sim.session?.stopAutoRun(); }, [sim.session]),
    runCombinational: useCallback(() => { sim.session?.runCombinational(); }, [sim.session]),
    getSimulator: useCallback(() => sim.session?.getEngine() ?? null, [sim.session]),
  };
}
