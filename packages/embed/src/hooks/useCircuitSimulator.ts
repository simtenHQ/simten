
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  type SimulatorEngine,
  type CircuitLibrary,
  type FlatPortValueMap,
  type FlatSequentialState,
} from "@simten/core/simulator";
import type { Circuit, BitValue, BusValue } from "@simten/core";
import type { BuiltCircuit } from "@simten/core/circuit";
import { getCircuitEval, autoHarness, isSequentialCircuit } from "@simten/core/circuit";
import { Switch, Button, Led, Input, Output, HexDisplay } from "@simten/core/std";
import { useSandboxContext, type EvalSource } from "@simten/ui/sandbox";

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
  speed: number;
}

export interface SimulatorActions {
  setNode: (name: string, value: boolean | number) => void;
  toggleInput: (name: string) => void;
  toggleNode: (nodeId: string) => void;
  /**
   * Set a node's value. Returns the resulting port-value Map (so scan-style
   * callers can read debug outputs without waiting for a React re-render),
   * or null if the sandbox isn't ready / errored.
   */
  setNodeValue: (nodeId: string, value: number | boolean | Map<number, number>) => Promise<ReadonlyMap<string, boolean | number> | null>;
  tick: () => void;
  /** Advance N ticks in a single sandbox round-trip; one React update. */
  tickN: (n: number) => Promise<void>;
  /**
   * Combinationally scan a debug-address node across 0..count-1, sampling
   * a value port after each setting. Single round-trip; clock not advanced.
   * Returns the `number[]` of length `count`, or null on error.
   */
  scanPort: (addrNodeId: string, valuePortKey: string, count: number) => Promise<number[] | null>;
  reset: () => void;
  stepBack: () => void;
  stepForward: () => void;
  seek: (index: number) => void;
  startAutoRun: (ticksPerSecond: number, options?: { displayRate?: number; onBeforeTick?: () => void }) => void;
  stopAutoRun: () => void;
  setSpeed: (ticksPerSecond: number) => void;
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
 * Extract eval function sources from a BuiltCircuit and its dependencies.
 * These are serialized and sent to the sandbox, which reconstructs them with new Function().
 * Returns empty object if the circuit's evals aren't registered in this frame
 * (e.g. editor case where evals live only in the sandbox from prior compile).
 */
function extractEvalSources(circuit: BuiltCircuit): Record<string, EvalSource> {
  const sources: Record<string, EvalSource> = {};
  const visited = new Set<string>();

  function collect(c: BuiltCircuit) {
    if (visited.has(c.name)) return;
    visited.add(c.name);

    const entry = getCircuitEval(c.name);
    if (entry) {
      sources[c.name] = {
        evalSource: entry.evalFn.toString(),
        onTickSource: entry.onTickFn?.toString(),
        inputNames: entry.inputNames,
        outputNames: entry.outputNames,
        stateKeys: entry.stateKeys,
      };
    }
    for (const [, dep] of c._dependencies) {
      if (dep) collect(dep);
    }
  }

  collect(circuit);
  return sources;
}

/**
 * Build a minimal BuiltCircuit-like object from a Circuit IR and its dependencies.
 * Used by the editor to adapt sandbox compile results into the shape useCircuitSimulator expects.
 * The resulting object has no live eval functions (empty registry lookups) — the sandbox
 * is expected to already have the evals registered from a prior sandbox.compile(source).
 */
export function builtFromIR(circuit: Circuit, dependencies: Circuit[]): BuiltCircuit {
  const depMap = new Map<string, BuiltCircuit>();
  for (const dep of dependencies) {
    depMap.set(dep.name, {
      name: dep.name,
      circuit: dep,
      _shape: { inputs: {}, outputs: {} } as any,
      _dependencies: new Map(),
    } as BuiltCircuit);
  }
  return {
    name: circuit.name,
    circuit,
    _shape: { inputs: {}, outputs: {} } as any,
    _dependencies: depMap,
  } as BuiltCircuit;
}

/**
 * Circuit simulator hook — runs simulation in the sandbox iframe.
 *
 * Takes a BuiltCircuit and returns reactive simulation state + actions.
 * All simulation happens inside the sandbox for security (CSP-isolated,
 * cross-origin) — no user code runs in the main frame at simulation time.
 */
export function useCircuitSimulator(
  circuit: BuiltCircuit | null,
  options?: UseCircuitSimulatorOptions,
): SimulatorState & SimulatorActions {
  const sandbox = useSandboxContext();
  const slotId = useMemo(() =>
    `embed-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
    [],
  );

  // ── Build library + resolve circuit IR ──
  const { rawCircuit, componentLibrary } = useMemo(() => {
    const circuitMap = new Map<string, Circuit>();
    const lib: CircuitLibrary & { addCircuit(c: Circuit): void } = {
      resolveCircuit: (name) => circuitMap.get(name),
      getAllPrimitiveNames: () => [...circuitMap.entries()].filter(([, c]) => c.implementation.kind === 'primitive').map(([n]) => n),
      addCircuit: (c) => { circuitMap.set(c.name, c); },
    };
    for (const c of [Switch, Button, Led, Input, Output, HexDisplay]) {
      lib.addCircuit(c.circuit);
    }
    if (circuit) {
      lib.addCircuit(circuit.circuit);
      if (circuit._dependencies) {
        for (const [, dep] of circuit._dependencies) {
          if (dep?.circuit) lib.addCircuit(dep.circuit);
        }
      }
    }
    return { rawCircuit: circuit?.circuit ?? null, componentLibrary: lib };
  }, [circuit]);

  // ── Auto-harness (wrap with Switches/LEDs if enabled) ──
  const harnessedCircuit = useMemo(() => {
    if (!rawCircuit) return null;
    if (!options?.autoHarness) return rawCircuit;
    return autoHarness(rawCircuit, componentLibrary, options.initialInputs);
  }, [rawCircuit, componentLibrary, options?.autoHarness, options?.initialInputs]);

  // ── Detect sequential (recursively) using shared core util ──
  const isSequential = useMemo(
    () => isSequentialCircuit(harnessedCircuit, componentLibrary.resolveCircuit),
    [harnessedCircuit, componentLibrary],
  );

  // ── Sandbox simulation state ──
  const [portValues, setPortValues] = useState<FlatPortValueMap>(new Map());
  // Peripheral-bus state exposed by the sandbox — only includes nodes on a
  // peripheral's bus (displays, consoles, etc.). Consumers read it through
  // the `sequentialState` shape below so rendering code doesn't need to know
  // it's narrower than a full FlatSequentialState.
  const [peripheralState, setPeripheralState] = useState<Record<string, unknown>>({});
  const [cycle, setCycle] = useState(0);
  const [ready, setReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeedState] = useState(5);
  const autoRunRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const historyRef = useRef<Array<{ engineSnapshot: unknown; metadata?: unknown }>>([]);

  // Default inputs from the harnessed circuit's top-level inputs
  const defaultInputs = useMemo(() => {
    const result: Record<string, boolean | number> = {};
    if (!harnessedCircuit) return result;
    for (const input of harnessedCircuit.inputs) {
      result[input.name] = input.portType.kind === 'bit' ? false : 0;
    }
    return result;
  }, [harnessedCircuit]);

  const [outputs, setOutputs] = useState<Record<string, boolean | number>>({});
  const [inputs, setInputs] = useState<Record<string, boolean | number>>(defaultInputs);

  // ── Compile to sandbox on mount / circuit change ──
  useEffect(() => {
    if (!circuit || !harnessedCircuit) {
      setReady(false);
      setPortValues(new Map());
      return;
    }

    let cancelled = false;

    async function initSandbox() {
      if (!circuit || !harnessedCircuit) return;
      // Extract eval sources from the BuiltCircuit and its dependencies
      const evalSources = extractEvalSources(circuit);

      // Collect all library circuits (stdlib + user).
      // The harnessed circuit references the raw circuit as "dut" by name, so we
      // need to include it + all its dependencies + harness components.
      const libCircuits: Circuit[] = [];
      const seen = new Set<string>();
      const addCircuit = (c: Circuit) => {
        if (seen.has(c.name)) return;
        seen.add(c.name);
        libCircuits.push(c);
      };

      // The raw circuit (referenced as "dut" by the harness)
      addCircuit(circuit.circuit);
      // Its transitive dependencies
      for (const [, dep] of circuit._dependencies) {
        if (dep?.circuit) addCircuit(dep.circuit);
      }
      // Harness components (Switch, Led, etc.)
      for (const c of [Switch, Button, Led, Input, Output, HexDisplay]) {
        addCircuit(c.circuit);
      }
      // Anything else in the library
      const primNames = componentLibrary.getAllPrimitiveNames();
      for (const name of primNames) {
        const c = componentLibrary.resolveCircuit(name);
        if (c) addCircuit(c);
      }

      const result = await sandbox.compileIR(harnessedCircuit, libCircuits, slotId, { evalSources });
      if (cancelled) return;

      if ('error' in result) {
        console.error('[useCircuitSimulator] compileIR failed:', result.error);
        setReady(false);
        return;
      }

      const pvMap = new Map<string, BitValue | BusValue>();
      for (const [k, v] of Object.entries(result.portValues)) {
        pvMap.set(k, v);
      }
      setPortValues(pvMap);
      if (result.peripheralState) setPeripheralState(result.peripheralState);
      setCycle(0);
      setReady(true);
      // isSequential is computed synchronously via useMemo above — no need to set async
    }

    initSandbox();

    return () => {
      cancelled = true;
      sandbox.dispose(slotId).catch(() => {});
    };
  }, [circuit, harnessedCircuit, componentLibrary, sandbox, slotId]);

  // Sync inputs when underlying circuit changes
  useEffect(() => {
    setInputs(defaultInputs);
  }, [defaultInputs]);

  // Extract outputs from portValues
  useEffect(() => {
    if (!ready || portValues.size === 0) return;
    const newOutputs: Record<string, boolean | number> = {};
    for (const output of harnessedCircuit.outputs) {
      const key = `${TOP_LEVEL_NODE}.${output.name}`;
      const value = portValues.get(key);
      if (value !== undefined) {
        newOutputs[output.name] = typeof value === 'number' ? value : Boolean(value);
      }
    }
    setOutputs(newOutputs);
  }, [ready, portValues, harnessedCircuit]);

  // ── Actions ──

  const setNode = useCallback(async (name: string, value: boolean | number) => {
    setInputs(prev => ({ ...prev, [name]: value }));
    if (!ready) return;
    const result = await sandbox.setNode(name, value, slotId);
    if ('error' in result) return;
    const pvMap = new Map<string, BitValue | BusValue>();
    for (const [k, v] of Object.entries(result.portValues)) pvMap.set(k, v);
    setPortValues(pvMap);
    if (result.peripheralState) setPeripheralState(result.peripheralState);
  }, [ready, sandbox, slotId]);

  const toggleInput = useCallback((name: string) => {
    const current = inputs[name];
    const newValue = typeof current === 'boolean' ? !current : (current === 0 ? 1 : 0);
    setNode(name, newValue);
  }, [inputs, setNode]);

  const toggleNode = useCallback(async (nodeId: string) => {
    if (!ready) return;
    const outKey = `${nodeId}.out`;
    const current = portValues.get(outKey);
    const newValue = typeof current === 'boolean' ? !current : (current === 1 ? 0 : 1);
    const result = await sandbox.setNode(nodeId, newValue, slotId);
    if ('error' in result) return;
    const pvMap = new Map<string, BitValue | BusValue>();
    for (const [k, v] of Object.entries(result.portValues)) pvMap.set(k, v);
    setPortValues(pvMap);
    if (result.peripheralState) setPeripheralState(result.peripheralState);
  }, [ready, portValues, sandbox, slotId]);

  const setNodeValue = useCallback(async (nodeId: string, value: number | boolean | Map<number, number>) => {
    if (!ready) return null;
    // Map values (for ROM/RAM loading) are supported via structured clone in postMessage.
    const result = await sandbox.setNode(nodeId, value as any, slotId);
    if ('error' in result) return null;
    const pvMap = new Map<string, BitValue | BusValue>();
    for (const [k, v] of Object.entries(result.portValues)) pvMap.set(k, v);
    setPortValues(pvMap);
    if (result.peripheralState) setPeripheralState(result.peripheralState);
    return pvMap as ReadonlyMap<string, boolean | number>;
  }, [ready, sandbox, slotId]);

  const tick = useCallback(async () => {
    if (!ready) return;
    const result = await sandbox.tick(undefined, slotId);
    if ('error' in result) return;
    const pvMap = new Map<string, BitValue | BusValue>();
    for (const [k, v] of Object.entries(result.portValues)) pvMap.set(k, v);
    setPortValues(pvMap);
    setCycle(result.cycle);
    if (result.peripheralState) setPeripheralState(result.peripheralState);
  }, [ready, sandbox, slotId]);

  // Batched tick — advances N cycles in one round-trip; one React update.
  const tickN = useCallback(async (n: number) => {
    if (!ready || n <= 0) return;
    const result = await sandbox.tickN(n, undefined, slotId);
    if ('error' in result) return;
    const pvMap = new Map<string, BitValue | BusValue>();
    for (const [k, v] of Object.entries(result.portValues)) pvMap.set(k, v);
    setPortValues(pvMap);
    setCycle(result.cycle);
    if (result.peripheralState) setPeripheralState(result.peripheralState);
  }, [ready, sandbox, slotId]);

  const scanPort = useCallback(async (addrNodeId: string, valuePortKey: string, count: number): Promise<number[] | null> => {
    if (!ready || count <= 0) return null;
    const result = await sandbox.scanPort(addrNodeId, valuePortKey, count, slotId);
    if ('error' in result) return null;
    return result.values;
  }, [ready, sandbox, slotId]);

  const reset = useCallback(async () => {
    const result = await sandbox.reset(slotId);
    if ('error' in result) return;
    const pvMap = new Map<string, BitValue | BusValue>();
    for (const [k, v] of Object.entries(result.portValues)) pvMap.set(k, v);
    setPortValues(pvMap);
    setCycle(0);
    setInputs(defaultInputs);
    if (result.peripheralState) setPeripheralState(result.peripheralState);
    else setPeripheralState({});
  }, [sandbox, slotId, defaultInputs]);

  const startAutoRun = useCallback((ticksPerSecond: number, _opts?: { displayRate?: number; onBeforeTick?: () => void }) => {
    if (autoRunRef.current) clearInterval(autoRunRef.current);
    setSpeedState(ticksPerSecond);
    setIsRunning(true);
    const interval = Math.max(1, Math.floor(1000 / ticksPerSecond));
    autoRunRef.current = setInterval(() => { tick(); }, interval);
  }, [tick]);

  const stopAutoRun = useCallback(() => {
    if (autoRunRef.current) {
      clearInterval(autoRunRef.current);
      autoRunRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const setSpeed = useCallback((ticksPerSecond: number) => {
    setSpeedState(ticksPerSecond);
    if (autoRunRef.current) {
      // Restart with new speed
      clearInterval(autoRunRef.current);
      const interval = Math.max(1, Math.floor(1000 / ticksPerSecond));
      autoRunRef.current = setInterval(() => { tick(); }, interval);
    }
  }, [tick]);

  useEffect(() => {
    return () => {
      if (autoRunRef.current) clearInterval(autoRunRef.current);
    };
  }, []);

  // Expose peripheral-bus state as a FlatSequentialState-compatible shape so
  // projection code (which was written against in-process simulation) doesn't
  // need to learn about the sandbox boundary. Only nodes on a peripheral's
  // bus appear here — internal logic state stays sandbox-internal.
  const sequentialState = useMemo<FlatSequentialState | null>(() => {
    const entries = Object.entries(peripheralState);
    if (entries.length === 0) return null;
    const currentState = new Map<string, any>();
    for (const [k, v] of entries) currentState.set(k, v);
    return {
      currentState,
      nextState: new Map(),
      clocks: new Map(),
      cycleCount: cycle,
    };
  }, [peripheralState, cycle]);

  return {
    // State
    outputs,
    inputs,
    cycleCount: cycle,
    ready,
    error: null,
    isSequential,
    circuit: harnessedCircuit,
    portValues: portValues.size > 0 ? portValues : null,
    sequentialState,
    componentLibrary,
    history: historyRef.current,
    historyIndex: -1,
    isViewingPast: false,
    isRunning,
    speed,

    // Actions
    setNode,
    toggleInput,
    toggleNode,
    setNodeValue,
    tick,
    tickN,
    scanPort,
    reset,
    stepBack: () => {},
    stepForward: () => {},
    seek: () => {},
    startAutoRun,
    stopAutoRun,
    setSpeed,
    runCombinational: () => {}, // sandbox.setNode already runs combinational
    getSimulator: () => null, // no local engine when running in sandbox
  };
}
