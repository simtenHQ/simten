/**
 * useCircuitSimulator — the public circuit-simulation hook.
 *
 * Composes the sandbox bridge (`useSandbox` in @simten/ui) with circuit-level
 * concerns: auto-harness, time-travel history, auto-run, snapshot/restore.
 * This is what every embed/blog/editor consumer calls.
 *
 * Runtime topology (browser path):
 *   useCircuitSimulator (here)
 *     → useSandbox             — packages/ui/src/sandbox/useSandbox.ts (postMessage bridge)
 *     → apps/sandbox/main.ts   — runs inside the cross-origin iframe
 *     → core/simulator         — pure simulator engine
 *
 * For non-browser callers (vitest, CI), skip this hook entirely and use
 * `@simten/core/sim` directly — no iframe, no React, just the engine.
 *
 * See: apps/web/content/docs/architecture.mdx → "Runtime topology".
 */

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

  // ── Time-travel history ──
  // Each entry stores:
  //   - snapshotId: opaque handle to a simulator snapshot held in the sandbox
  //   - cycle: clock cycle at that snapshot (for the UI counter)
  //   - inputs: user-visible input values at that moment. The simulator's
  //     snapshot only covers *simulation* state (flip-flops, memory). User
  //     inputs (switch positions, etc.) are "environmental state" that lives
  //     in React — see packages/core/src/simulator/environmental-state.ts.
  //     On rewind we restore both so the UI is fully consistent with the
  //     cycle being viewed (not just the logic outputs).
  //
  // historyIndex points at the snapshot currently reflected in portValues.
  // At the "head" (live state) historyIndex === historyRef.current.length - 1.
  // When the user steps back, historyIndex moves left without shrinking history.
  // If they then make a state-mutating action (tick, setNode), we branch:
  // history is truncated at historyIndex + 1, orphaned sandbox snapshots leak
  // (GC'd by slot disposal or the next cap prune — acceptable for demo sizes).
  type HistoryEntry = {
    snapshotId: number;
    cycle: number;
    inputs: Record<string, boolean | number>;
  };
  const historyRef = useRef<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [historyLen, setHistoryLen] = useState(0); // duplicate of historyRef.length for re-renders
  const HISTORY_CAP = 200;

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
  // Mirror of inputs in a ref so tick/tickN can snapshot the latest value
  // synchronously without waiting for setState → re-render.
  const inputsRef = useRef(inputs);
  useEffect(() => { inputsRef.current = inputs; }, [inputs]);

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

      // Only bother snapshotting if the circuit is sequential — combinational
      // circuits don't have state worth rewinding to.
      const result = await sandbox.compileIR(harnessedCircuit, libCircuits, slotId, {
        evalSources,
        snapshot: isSequential,
      });
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

      // Seed history with the initial snapshot (if any). Fresh compile means
      // the previous history (if any) is invalid anyway — sandbox already
      // cleared its own snapshots on the recompile.
      historyRef.current = result.snapshotId !== undefined
        ? [{ snapshotId: result.snapshotId, cycle: 0, inputs: { ...defaultInputs } }]
        : [];
      setHistoryIndex(result.snapshotId !== undefined ? 0 : -1);
      setHistoryLen(historyRef.current.length);

      setReady(true);
      // isSequential is computed synchronously via useMemo above — no need to set async
    }

    initSandbox();

    return () => {
      cancelled = true;
      sandbox.dispose(slotId).catch(() => {});
    };
  }, [circuit, harnessedCircuit, componentLibrary, sandbox, slotId, isSequential]);

  // Sync inputs when underlying circuit changes
  useEffect(() => {
    setInputs(defaultInputs);
  }, [defaultInputs]);

  // Extract outputs from portValues
  useEffect(() => {
    if (!ready || portValues.size === 0 || !harnessedCircuit) return;
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

  // ── History bookkeeping helper ──
  //
  // Called after any state-mutating sandbox operation that returns a snapshot.
  // Handles branch-on-past-edit (truncates future), enforces the 200-entry cap,
  // and updates React state so the UI re-renders with fresh ◀▶ counts.
  //
  // The `inputsSnapshot` is what the user-visible inputs (switches, buttons,
  // etc.) looked like at this moment — used on rewind so the UI restores not
  // just the simulator state but the user inputs too.
  const recordSnapshot = useCallback((
    snapshotId: number | undefined,
    newCycle: number,
    inputsSnapshot: Record<string, boolean | number>,
  ) => {
    if (snapshotId === undefined) return; // combinational circuit — nothing to record

    const hist = historyRef.current;
    const currentIdx = historyIndexRef.current;

    // If the user was viewing the past and just made a mutating action,
    // we branch: discard everything after their current position, then
    // append the new snapshot as the new head. The orphaned sandbox
    // snapshots leak until the next cap-prune or slot disposal.
    if (currentIdx >= 0 && currentIdx < hist.length - 1) {
      hist.length = currentIdx + 1;
    }

    hist.push({ snapshotId, cycle: newCycle, inputs: { ...inputsSnapshot } });

    // Cap at HISTORY_CAP: drop oldest entries and tell the sandbox to
    // free their snapshots. `keepAfterId` is the highest snapshotId we
    // DO NOT want to keep — anything <= that gets freed in the sandbox.
    if (hist.length > HISTORY_CAP) {
      const drop = hist.length - HISTORY_CAP;
      const keepAfterId = hist[drop - 1].snapshotId;
      hist.splice(0, drop);
      sandbox.pruneSnapshots(keepAfterId, slotId).catch(() => {});
    }

    historyIndexRef.current = hist.length - 1;
    setHistoryIndex(hist.length - 1);
    setHistoryLen(hist.length);
  }, [sandbox, slotId]);

  // Mirror historyIndex in a ref so the helper above can see its live value
  // without recompiling on every change (avoids rebuilding every callback).
  const historyIndexRef = useRef(-1);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

  // ── Actions ──

  const setNode = useCallback(async (name: string, value: boolean | number) => {
    // Input changes (switch toggles, button presses) don't create a new
    // history entry — history tracks CYCLES (post-tick states), not every
    // input edit. The current cycle's "inputs" stay live: the next tick
    // will snapshot them as part of its history entry. If the user is
    // viewing the past when they toggle, the next tick branches from there.
    const newInputs = { ...inputsRef.current, [name]: value };
    inputsRef.current = newInputs;
    setInputs(newInputs);
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
    // Same reasoning as setNode: no new history entry on input edit.
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
    // Same reasoning as setNode: no history entry on this path.
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
    const result = await sandbox.tick(undefined, slotId, { snapshot: isSequential });
    if ('error' in result) return;
    const pvMap = new Map<string, BitValue | BusValue>();
    for (const [k, v] of Object.entries(result.portValues)) pvMap.set(k, v);
    setPortValues(pvMap);
    setCycle(result.cycle);
    if (result.peripheralState) setPeripheralState(result.peripheralState);
    // tick() doesn't modify user inputs — the switch position at tick time
    // is what goes into history.
    recordSnapshot(result.snapshotId, result.cycle, inputsRef.current);
  }, [ready, sandbox, slotId, isSequential, recordSnapshot]);

  // Batched tick — advances N cycles in one round-trip; one React update.
  // Only snapshots the final state (not every intermediate cycle) — time-travel
  // through a batched tick jumps straight to pre-batch.
  const tickN = useCallback(async (n: number) => {
    if (!ready || n <= 0) return;
    const result = await sandbox.tickN(n, undefined, slotId, { snapshot: isSequential });
    if ('error' in result) return;
    const pvMap = new Map<string, BitValue | BusValue>();
    for (const [k, v] of Object.entries(result.portValues)) pvMap.set(k, v);
    setPortValues(pvMap);
    setCycle(result.cycle);
    if (result.peripheralState) setPeripheralState(result.peripheralState);
    recordSnapshot(result.snapshotId, result.cycle, inputsRef.current);
  }, [ready, sandbox, slotId, isSequential, recordSnapshot]);

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

    // Sandbox reset already cleared its own snapshots. Clear ours too,
    // then seed a fresh initial snapshot for the post-reset state so
    // time-travel starts over from here.
    historyRef.current = [];
    if (isSequential) {
      const snap = await sandbox.snapshot(slotId);
      if (!('error' in snap) && snap.snapshotId !== undefined) {
        historyRef.current = [{ snapshotId: snap.snapshotId, cycle: 0, inputs: { ...defaultInputs } }];
      }
    }
    historyIndexRef.current = historyRef.current.length > 0 ? 0 : -1;
    setHistoryIndex(historyRef.current.length > 0 ? 0 : -1);
    setHistoryLen(historyRef.current.length);
  }, [sandbox, slotId, defaultInputs, isSequential]);

  // ── Time-travel actions ──

  // Shared restore helper — applies a history entry to both the simulator
  // and the host-side input state. We restore inputs because the UI "rewind"
  // promise is a full restoration of user-visible state: switch positions,
  // input values, circuit state. Omitting inputs would leave the UI showing
  // a stale switch while the circuit actually runs with the restored value —
  // see environmental-state.ts in packages/core for the same distinction.
  const applyHistoryEntry = useCallback(async (entry: HistoryEntry, targetIndex: number) => {
    const result = await sandbox.restore(entry.snapshotId, slotId);
    if ('error' in result) return;
    const pvMap = new Map<string, BitValue | BusValue>();
    for (const [k, v] of Object.entries(result.portValues)) pvMap.set(k, v);
    setPortValues(pvMap);
    setCycle(result.cycle);
    if (result.peripheralState) setPeripheralState(result.peripheralState);
    else setPeripheralState({});
    // Restore user inputs too. Keep inputsRef in lockstep so that any
    // immediately-following setNode sees the restored values as its base.
    const restoredInputs = { ...entry.inputs };
    inputsRef.current = restoredInputs;
    setInputs(restoredInputs);
    historyIndexRef.current = targetIndex;
    setHistoryIndex(targetIndex);
  }, [sandbox, slotId]);

  const stepBack = useCallback(async () => {
    if (!ready) return;
    const hist = historyRef.current;
    const idx = historyIndexRef.current;
    if (idx <= 0) return; // already at or before the start
    await applyHistoryEntry(hist[idx - 1], idx - 1);
  }, [ready, applyHistoryEntry]);

  const stepForward = useCallback(async () => {
    if (!ready) return;
    const hist = historyRef.current;
    const idx = historyIndexRef.current;
    // Already at the live head — nothing to step into yet.
    // (Clicking ▶ at the head is a no-op, not a tick. Users run the clock
    //  explicitly via Tick/autorun to add new history.)
    if (idx >= hist.length - 1) return;
    await applyHistoryEntry(hist[idx + 1], idx + 1);
  }, [ready, applyHistoryEntry]);

  const seek = useCallback(async (index: number) => {
    if (!ready) return;
    const hist = historyRef.current;
    if (index < 0 || index >= hist.length) return;
    await applyHistoryEntry(hist[index], index);
  }, [ready, applyHistoryEntry]);

  // Stable indirection so setInterval always calls the latest tick(). Without
  // this, an auto-run started before `ready` flips true would capture the
  // bail-early version of tick and never recover, even after the sandbox
  // becomes ready — the interval would fire forever calling a stale closure.
  const tickRef = useRef(tick);
  useEffect(() => { tickRef.current = tick; }, [tick]);

  const startAutoRun = useCallback((ticksPerSecond: number, _opts?: { displayRate?: number; onBeforeTick?: () => void }) => {
    if (autoRunRef.current) clearInterval(autoRunRef.current);
    setSpeedState(ticksPerSecond);
    setIsRunning(true);
    const interval = Math.max(1, Math.floor(1000 / ticksPerSecond));
    autoRunRef.current = setInterval(() => { tickRef.current(); }, interval);
  }, []);

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
      autoRunRef.current = setInterval(() => { tickRef.current(); }, interval);
    }
  }, []);

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

  // Shadow-typed history for the UI: the consumer only needs a length for
  // showing the `N/M` counter and the ◀ ▶ enable logic. historyLen drives
  // re-renders; the array identity is intentionally stable per-slot.
  const historyForUi = useMemo(
    () => historyRef.current.slice(0, historyLen).map(h => ({ engineSnapshot: h.snapshotId, metadata: h.cycle })),
    [historyLen],
  );

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
    history: historyForUi,
    historyIndex,
    isViewingPast: historyIndex >= 0 && historyIndex < historyLen - 1,
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
    stepBack,
    stepForward,
    seek,
    startAutoRun,
    stopAutoRun,
    setSpeed,
    runCombinational: () => {}, // sandbox.setNode already runs combinational
    getSimulator: () => null, // no local engine when running in sandbox
  };
}
