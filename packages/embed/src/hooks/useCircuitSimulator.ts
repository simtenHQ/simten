"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  SimulationSession,
  type SimulationSessionState,
  type SimulatorEngine,
  type ComponentLibrary,
  type FlatCircuit,
  type FlatPortValueMap,
  type FlatSequentialState,
} from "@turing-incomplete/core/simulator";
import type { Circuit } from "@turing-incomplete/core";
import { useCompileCode } from "./useCompileCode";
import { useCircuitSession } from "@turing-incomplete/ui/canvas";

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
  componentLibrary: ComponentLibrary | null;
  history: readonly { engineSnapshot: unknown; metadata?: unknown }[];
  historyIndex: number;
  isViewingPast: boolean;
  isRunning: boolean;
}

export interface SimulatorActions {
  setInput: (name: string, value: boolean | number) => void;
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

export interface UseCircuitSimulatorOptions {}

/**
 * Standalone circuit simulator hook.
 *
 * Compiles DSL → creates SimulationSession → exposes reactive state + actions.
 * Internally delegates to useCompileCode (compilation) + useCircuitSession (simulation).
 */
export function useCircuitSimulator(
  dslCode: string,
  options?: UseCircuitSimulatorOptions,
): SimulatorState & SimulatorActions {
  // ── Compilation (auto-detects TypeScript vs DSL) ──
  const compiled = useCompileCode(dslCode);

  // ── Simulation (via the same hook the editor uses) ──
  const sim = useCircuitSession(compiled.circuit, compiled.componentLibrary);

  // ── Higher-level state (outputs, inputs, toggles) ──
  const [outputs, setOutputs] = useState<Record<string, boolean | number>>({});
  const [inputs, setInputs] = useState<Record<string, boolean | number>>(compiled.inputs);
  const compiledCircuitRef = useRef<Circuit | null>(null);
  compiledCircuitRef.current = compiled.circuit;

  // Sync inputs when compilation changes
  useEffect(() => {
    setInputs(compiled.inputs);
  }, [compiled.inputs]);

  // Extract outputs from portValues
  useEffect(() => {
    if (!compiled.ready || !sim.portValues || sim.portValues.size === 0) return;
    const circ = compiledCircuitRef.current;
    if (!circ) return;

    const newOutputs: Record<string, boolean | number> = {};
    for (const output of circ.outputs) {
      const key = `${TOP_LEVEL_NODE}.${output.name}`;
      const value = sim.portValues.get(key);
      if (value !== undefined) {
        newOutputs[output.name] = typeof value === 'number' ? value : Boolean(value);
      }
    }
    setOutputs(newOutputs);
  }, [compiled.ready, sim.portValues]);

  // Sync inputs to engine when inputs change
  useEffect(() => {

    if (!sim.session || !compiled.ready) return;
    const engine = sim.session.getEngine();
    if (!engine) return;

    for (const [inputName, value] of Object.entries(inputs)) {
      engine.setInput(inputName, value);
    }

    if (!compiled.isSequential) {
      sim.session.runCombinational();
    }
  }, [inputs, compiled.ready, compiled.isSequential, sim.session]);

  // ── Actions ──

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
    if (!sim.session || !compiled.ready) return;
    const engine = sim.session.getEngine();
    if (engine) {
      for (const [inputName, value] of Object.entries(inputs)) {
        engine.setInput(inputName, value);
      }
    }
    sim.tick();
  }, [compiled.ready, inputs, sim.session, sim.tick]);

  const reset = useCallback(() => {
    sim.reset();
    if (compiledCircuitRef.current) {
      const initialInputs: Record<string, boolean | number> = {};
      for (const input of compiledCircuitRef.current.inputs) {
        initialInputs[input.name] = input.portType.kind === 'bit' ? false : 0;
      }
      setInputs(initialInputs);
    }
  }, [sim.reset]);

  return {
    // State
    outputs,
    inputs,
    cycleCount: sim.cycle,
    ready: compiled.ready && sim.session !== null,
    error: compiled.error,
    isSequential: compiled.isSequential,
    circuit: compiled.circuit,
    portValues: (sim.portValues.size > 0 ? sim.portValues : null) as FlatPortValueMap | null,
    sequentialState: sim.sequentialState,
    componentLibrary: compiled.componentLibrary,
    history: sim.history,
    historyIndex: sim.historyIndex,
    isViewingPast: sim.isViewingPast,
    isRunning: sim.isRunning,

    // Actions
    setInput,
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
