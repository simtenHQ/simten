/**
 * useSimulation: compile a circuit in the sandbox and simulate it there.
 *
 * Give it source text (the editor, the embed page) or a circuit built on the
 * page (blog posts, docs, `<CircuitEmbed>`, which goes through `compile-ir`).
 * It compiles, opens a session on the chosen circuit, and mirrors the
 * session's state into React. History, ticking and auto-run all run in the
 * sandbox worker; this hook keeps no timers and no history of its own.
 *
 * A failed compile sets `compileError` and leaves the last good session
 * running. A new compile, a different circuit or new `memory` opens a new
 * session and closes the old one.
 *
 * Needs a `SandboxProvider` above it to share one sandbox; without one it
 * makes its own.
 */

import type { Circuit } from '@simten/core';
import {
  type CircuitDefinitions,
  type CircuitIR,
  internalsOf,
  type MemoryContents,
  type PeripheralValue,
} from '@simten/core/internal';
import { HexDisplay, Input, Led, Output, Switch } from '@simten/core/std';
import type { ExportResult, VerilogExportOptions } from '@simten/core/verilog';
import {
  type Compiled,
  type SandboxClient,
  SandboxError,
  type SimulationClient,
  type SimulationClientState,
} from '@simten/sandbox';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSandboxClient } from './SandboxProvider.js';

/** Source text, with the circuit to simulate picked by name or by a function; or a circuit built on the page. */
export type SimulationSource =
  | {
      source: string;
      /** Defaults to the last circuit the source builds, then the last it exports. */
      circuit?: string | ((circuits: CircuitIR[]) => CircuitIR | undefined);
    }
  | Circuit;

export interface UseSimulationOptions {
  /** Wait this long after `source` text changes before recompiling. The first compile isn't delayed. @default 300 */
  debounceMs?: number;
  /** Wrap the circuit in Switch/Input and Led/HexDisplay nodes. */
  harness?: boolean;
  /** Starting values for the circuit's inputs (the harness's switches when harnessed). */
  initialInputs?: Record<string, number>;
  /** Cycles of history. @default 200 */
  history?: number;
  /** Memory contents by node path, loaded before cycle 0. A new object reopens the session (a new program). */
  memory?: Record<string, MemoryContents>;
  /** Auto-run speed in cycles per second until `run` or `setSpeed` changes it. @default 15 */
  speed?: number;
}

/**
 * A compile error. `line` and `column` are 1-based, or 0 when the error has no
 * location. Shaped like `@simten/react/monaco`'s `SimtenDiagnostic`.
 */
export interface CompileDiagnostic {
  message: string;
  line: number;
  column: number;
}

export interface SimulationViewState {
  ready: boolean;
  /** Fatal: the sandbox didn't load, the circuit failed to open, or an action failed. */
  error: string | null;
  /** Non-fatal: the sandbox restarted this session at cycle 0. */
  notice: string | null;

  circuit: CircuitIR | null;
  /** The simulated circuit by the name given to `circuit(...)`, before any harness. Export uses it. */
  circuitName: string | null;
  definitions: CircuitDefinitions | null;
  /** Every circuit the last good compile built, for pickers. */
  circuits: CircuitIR[];
  isSequential: boolean;

  cycle: number;
  /** Every port value, keyed `nodePath.port` (top-level ports under `__top__`). Null until the first state. */
  portValues: ReadonlyMap<string, number> | null;
  /** Top-level outputs by name; the harness's displays when harnessed. */
  outputs: Record<string, number>;
  /** Screens, consoles, UARTs and the memories behind them, by node path. */
  peripheralState: ReadonlyMap<string, PeripheralValue>;

  isRunning: boolean;
  /** Auto-run speed in cycles per second. */
  speed: number;
}

export interface SimulationActions {
  /** Drive top-level inputs by name. */
  set(values: Record<string, number>): Promise<void>;
  /** Write a Switch or Input node (keyboards write Inputs) by node path. Nothing else. */
  setInput(path: string, value: number): Promise<void>;
  /** Write several Switch or Input nodes by node path, all before the circuit settles. */
  setInputs(values: Record<string, number>): Promise<void>;
  /** Flip a Switch node between 0 and 1. */
  toggleNode(path: string): Promise<void>;
  tick(count?: number): Promise<void>;
  reset(): Promise<void>;
  stepBack(): Promise<boolean>;
  stepForward(): Promise<boolean>;
  seek(index: number): Promise<boolean>;
  /** Auto-run in the sandbox at `speed` cycles per second (default: the current speed). */
  run(speed?: number): Promise<void>;
  pause(): Promise<void>;
  /** Changes the auto-run speed; doesn't start a stopped run. */
  setSpeed(speed: number): void;
  /** Tick `count` times and return `port` (a port-map key) after each tick. */
  sample(port: string, count: number, inputs?: Record<string, number>): Promise<number[]>;
  /** Drive input `path` through 0..count-1, settling each time, and read `port`. Doesn't tick. */
  scan(path: string, port: string, count: number): Promise<number[]>;
  /** Compile now, skipping the debounce. */
  recompile(): Promise<void>;
  /** Verilog for the simulated circuit, from the same compile. */
  exportVerilog(options?: VerilogExportOptions): Promise<ExportResult>;
}

export interface UseSimulationResult {
  /** The last compile's error; null on success. The last good session keeps running. */
  compileError: CompileDiagnostic | null;
  /** What the circuit is doing now. Changes on every update. */
  state: SimulationViewState;
  /** Where the history cursor is. */
  history: { length: number; index: number; isViewingPast: boolean };
  /** One identity for the life of the hook, so they're safe in dependency arrays. */
  actions: SimulationActions;
  /** The open session, for anything that reads it directly. */
  client: SimulationClient | null;
}

const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_SPEED = 15;
const TOP = '__top__';
const NO_PORTS: ReadonlyMap<string, number> = new Map();
const NO_PERIPHERALS: ReadonlyMap<string, PeripheralValue> = new Map();
const NO_CIRCUITS: CircuitIR[] = [];
const NO_OUTPUTS: Record<string, number> = {};
const ignore = () => {};

/** The parts a harness adds, which the compile's own definitions may not have. */
let harnessParts: Map<string, CircuitIR> | null = null;
function harnessPart(name: string): CircuitIR | undefined {
  harnessParts ??= new Map(
    [Switch, Led, Input(), Output, HexDisplay()].map((c) => {
      const { ir } = internalsOf(c);
      return [ir.name, ir];
    }),
  );
  return harnessParts.get(name);
}

function withHarnessParts(definitions: CircuitDefinitions): CircuitDefinitions {
  return {
    resolveCircuit: (name) => definitions.resolveCircuit(name) ?? harnessPart(name),
    getAllPrimitiveNames: () => definitions.getAllPrimitiveNames(),
  };
}

function isSourceText(source: SimulationSource): source is { source: string } {
  return typeof (source as { source?: unknown }).source === 'string';
}

/**
 * A compile error as a diagnostic. The sandbox reports errors as text only;
 * a parse error from the source runner ends in `(line:column)`, as in
 * `Unexpected token (1:11)`, so the location is read from there.
 */
export function diagnosticOf(error: unknown): CompileDiagnostic {
  const message = error instanceof Error ? error.message : String(error);
  const at = message.match(/\((\d+):(\d+)\)/);
  return {
    message,
    line: at ? Number.parseInt(at[1], 10) : 0,
    column: at ? Number.parseInt(at[2], 10) : 0,
  };
}

function pickCircuit(
  compiled: Compiled,
  choice: string | ((circuits: CircuitIR[]) => CircuitIR | undefined) | undefined,
): string | undefined {
  if (typeof choice === 'string') return choice;
  if (choice) return choice(compiled.circuits)?.name;
  return (compiled.circuits.at(-1) ?? compiled.exported.at(-1))?.name;
}

/** Outputs by name: the circuit's own, or the harness's displays. */
function outputsOf(circuit: CircuitIR, ports: ReadonlyMap<string, number>): Record<string, number> {
  const outputs: Record<string, number> = {};
  for (const port of circuit.outputs) {
    const value = ports.get(`${TOP}.${port.name}`);
    if (value !== undefined) outputs[port.name] = value;
  }
  for (const node of circuit.nodes) {
    if (!node.harness || (node.componentRef !== 'Led' && node.componentRef !== 'HexDisplay')) {
      continue;
    }
    const value = ports.get(`${node.id}.in`);
    if (value !== undefined) outputs[node.id] = value;
  }
  return outputs;
}

/**
 * `value`, or the one returned before if it's equal by value, so a caller
 * passing an inline object doesn't reopen the session on every render.
 */
function useByValue<T>(value: T): T {
  const last = useRef<{ seen: T; stable: T; key: string } | null>(null);
  if (last.current && last.current.seen === value) return last.current.stable;
  const key = JSON.stringify(value ?? null);
  if (last.current && last.current.key === key) {
    last.current.seen = value;
    return last.current.stable;
  }
  last.current = { seen: value, stable: value, key };
  return value;
}

/** The session and what it was opened from. */
interface Live {
  session: SimulationClient;
  compiled: Compiled;
  name: string;
}

/**
 * Undo a rejected write's entries in `written`: each path goes back to what was
 * remembered `before`, unless a later write has replaced the value since.
 */
function restoreWritten(
  written: Map<string, number>,
  values: Record<string, number>,
  before: Map<string, number | undefined>,
): void {
  for (const [path, value] of before) {
    if (written.get(path) !== values[path]) continue;
    if (value === undefined) written.delete(path);
    else written.set(path, value);
  }
}

export function useSimulation(
  source: SimulationSource | null,
  options: UseSimulationOptions = {},
): UseSimulationResult {
  const { debounceMs = DEFAULT_DEBOUNCE_MS, harness = false, history } = options;
  const initialInputs = useByValue(options.initialInputs);
  const memory = useByValue(options.memory);
  const client = useSandboxClient();
  // Latest-value refs (client, choice, text, speed) let the stable actions and
  // effects read the current props without being recreated.
  const clientRef = useRef(client);
  clientRef.current = client;

  const text = source && isSourceText(source) ? source.source : null;
  const built = source && !isSourceText(source) ? source : null;
  const choice = source && isSourceText(source) ? source.circuit : undefined;
  const choiceRef = useRef(choice);
  choiceRef.current = choice;
  // A name is compared by value; a picker function is read when a session opens.
  const choiceName = typeof choice === 'string' ? choice : undefined;

  const [compiled, setCompiled] = useState<Compiled | null>(null);
  const [compileError, setCompileError] = useState<CompileDiagnostic | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  /** The open session for the stable actions, which can't read `live` without changing identity. */
  const liveRef = useRef<Live | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [speed, setSpeedState] = useState(options.speed ?? DEFAULT_SPEED);
  const speedRef = useRef(speed);
  /** A `run` called before the session opened (an embed's handle on mount); it starts when it does. */
  const pendingRun = useRef<number | null>(null);
  /**
   * Values written with `setInput` or `setInputs` since the session last moved through
   * history. `toggleNode` reads these first: the pushed state lags behind
   * writes still in flight, so a fast double click would otherwise flip from
   * the same stale value twice.
   */
  const written = useRef(new Map<string, number>());

  /** Every compile this hook holds in the sandbox, so each is released once nothing needs it. */
  const held = useRef(new Set<Compiled>());
  /** The sandbox each compile lives in: when the provider's client changes, an old compile can't open in the new one. */
  const compiledIn = useRef(new WeakMap<Compiled, SandboxClient>());
  /** Bumped by every compile, so an older one finishing after a newer one started is dropped. */
  const generation = useRef(0);

  const releaseExcept = useCallback((keep: Compiled | null) => {
    const sandbox = clientRef.current;
    for (const c of held.current) {
      if (c === keep) continue;
      held.current.delete(c);
      sandbox?.release(c);
    }
  }, []);

  // ── Compile ──────────────────────────────────────────────────────────────

  const compile = useCallback(
    async (sandbox: SandboxClient, input: string | Circuit, retried = false): Promise<void> => {
      const gen = ++generation.current;
      try {
        const result =
          typeof input === 'string'
            ? await sandbox.compile(input)
            : await sandbox.compileCircuit(input);
        if (gen !== generation.current) {
          sandbox.release(result);
          return;
        }
        held.current.add(result);
        compiledIn.current.set(result, sandbox);
        setCompiled(result);
        setCompileError(null);
      } catch (e) {
        if (gen !== generation.current) return;
        if (e instanceof SandboxError) {
          if (e.code === 'closed') return;
          // Collateral damage of a restart caused by something else: once more.
          if (e.code === 'restarted' && !retried) return compile(sandbox, input, true);
        }
        setCompileError(diagnosticOf(e));
      }
    },
    [],
  );

  // Source text: debounce edits, but not the first compile.
  /** Whether the first compile has gone out; only later ones wait for the debounce. */
  const compiledOnce = useRef(false);
  useEffect(() => {
    if (!client || text === null || !text.trim()) return;
    const timer = setTimeout(
      () => {
        compiledOnce.current = true;
        void compile(client, text);
      },
      compiledOnce.current ? debounceMs : 0,
    );
    return () => clearTimeout(timer);
  }, [client, text, debounceMs, compile]);

  // A circuit built on the page: compile it once per circuit.
  useEffect(() => {
    if (!client || !built) return;
    void compile(client, built);
  }, [client, built, compile]);

  // ── Open ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!client || !compiled) return;
    if (compiledIn.current.get(compiled) !== client) return;
    const name = pickCircuit(compiled, choiceName ?? choiceRef.current);
    if (!name) {
      setCompileError({ message: 'No circuit to simulate.', line: 0, column: 0 });
      return;
    }
    let cancelled = false;
    client.open({ compiled, circuit: name }, { harness, initialInputs, history, memory }).then(
      (session) => {
        if (cancelled) {
          session.close().catch(ignore);
          return;
        }
        const previous = liveRef.current;
        const next = { session, compiled, name };
        liveRef.current = next;
        written.current.clear();
        setLive(next);
        setActionError(null);
        // Closing also stops the old session's auto-run.
        previous?.session.close().catch(ignore);
        releaseExcept(compiled);
        if (pendingRun.current !== null) {
          session.run(pendingRun.current).catch((e: unknown) => {
            setActionError(e instanceof Error ? e.message : String(e));
          });
          pendingRun.current = null;
        }
      },
      (e: unknown) => {
        if (cancelled || (e instanceof SandboxError && e.code === 'closed')) return;
        setActionError(e instanceof Error ? e.message : String(e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client, compiled, choiceName, harness, initialInputs, history, memory, releaseExcept]);

  // Unmount: close the session and free every compile.
  useEffect(
    () => () => {
      generation.current++;
      liveRef.current?.session.close().catch(ignore);
      liveRef.current = null;
      releaseExcept(null);
    },
    [releaseExcept],
  );

  // ── State ────────────────────────────────────────────────────────────────

  const session = live?.session ?? null;
  const subscribe = useCallback(
    (listener: () => void) => (session ? session.subscribe(listener) : ignore),
    [session],
  );
  const getSnapshot = useCallback(
    (): SimulationClientState | null => session?.getState() ?? null,
    [session],
  );
  const current = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const [unavailable, setUnavailable] = useState<string | null>(null);
  useEffect(() => {
    if (!client) return;
    const check = () =>
      setUnavailable(
        client.status === 'unavailable'
          ? 'Sandbox failed to load. It may be blocked by a browser extension, or unreachable.'
          : null,
      );
    check();
    return client.onStatusChange(check);
  }, [client]);

  const definitions = useMemo(
    () => (session ? withHarnessParts(session.definitions) : null),
    [session],
  );
  const ports = current?.ports ?? NO_PORTS;
  const outputs = useMemo(
    () => (session ? outputsOf(session.circuit, ports) : NO_OUTPUTS),
    [session, ports],
  );

  const closedBySandbox = current?.status === 'closed' ? current.notice : null;
  const state: SimulationViewState = {
    ready: current !== null && current.status !== 'closed',
    error: unavailable ?? actionError ?? closedBySandbox,
    notice: current?.status === 'restarted' ? current.notice : actionNotice,
    circuit: session?.circuit ?? null,
    circuitName: live?.name ?? null,
    definitions,
    circuits: compiled?.circuits ?? NO_CIRCUITS,
    isSequential: session?.isSequential ?? false,
    cycle: current?.cycle ?? 0,
    portValues: current && ports.size > 0 ? ports : null,
    outputs,
    peripheralState: current?.peripherals ?? NO_PERIPHERALS,
    isRunning: current?.isRunning ?? false,
    speed,
  };

  const historyLength = current?.history.length ?? 0;
  const historyIndex = current?.history.index ?? -1;
  const historyView = useMemo(
    () => ({
      length: historyLength,
      index: historyIndex,
      isViewingPast: historyIndex >= 0 && historyIndex < historyLength - 1,
    }),
    [historyLength, historyIndex],
  );

  // ── Actions ──────────────────────────────────────────────────────────────

  const textRef = useRef(text);
  textRef.current = text;

  const actions = useMemo((): SimulationActions => {
    /** Run `work` on the open session; report a failure instead of throwing it. */
    async function withSession<T>(
      fallback: T,
      work: (session: SimulationClient) => Promise<T>,
    ): Promise<T> {
      const session = liveRef.current?.session;
      if (!session) return fallback;
      setActionNotice(null);
      try {
        return await work(session);
      } catch (e) {
        report(e);
        return fallback;
      }
    }

    async function moved(move: Promise<boolean>): Promise<boolean> {
      const result = await move;
      written.current.clear();
      return result;
    }

    function report(e: unknown): void {
      const message = e instanceof Error ? e.message : String(e);
      if (e instanceof SandboxError) {
        // The session was replaced or unmounted while this was in flight.
        if (e.code === 'closed') return;
        // The worker restarted; the session is back at cycle 0 and says so.
        if (e.code === 'restarted' || e.code === 'timed-out') {
          setActionNotice(message);
          return;
        }
      }
      setActionError(message);
    }

    /**
     * Remember each value before sending it, for `toggleNode`; see `written`.
     * A rejected write changed nothing in the sandbox, so put back what was
     * remembered before it, unless a later write has replaced the value since.
     */
    function setInputs(values: Record<string, number>): Promise<void> {
      return withSession(undefined, async (s) => {
        const paths = Object.keys(values);
        const before = new Map(paths.map((path) => [path, written.current.get(path)]));
        for (const path of paths) written.current.set(path, values[path]);
        try {
          await s.setInputs(values);
        } catch (e) {
          restoreWritten(written.current, values, before);
          throw e;
        }
      });
    }

    return {
      set: (values) => withSession(undefined, (s) => s.set(values)),
      setInput: (path, value) => setInputs({ [path]: value }),
      setInputs,
      toggleNode: (path) =>
        withSession(undefined, (s) => {
          // A Switch only changes when the page writes it, so the last write
          // is its value; the pushed state may not have caught up yet.
          const now = written.current.get(path) ?? s.getState().ports.get(`${path}.out`);
          const next = now === 1 ? 0 : 1;
          written.current.set(path, next);
          return s.setInput(path, next);
        }),
      tick: (count = 1) => withSession(undefined, (s) => s.tick(count)),
      reset: () => withSession(undefined, (s) => s.reset()),
      // History puts switches back where they were, so the pushed state is
      // their value again once a move lands.
      stepBack: () => withSession(false, (s) => moved(s.stepBack())),
      stepForward: () => withSession(false, (s) => moved(s.stepForward())),
      seek: (index) => withSession(false, (s) => moved(s.seek(index))),
      run: (next) => {
        const runSpeed = next ?? speedRef.current;
        speedRef.current = runSpeed;
        setSpeedState(runSpeed);
        if (!liveRef.current) pendingRun.current = runSpeed;
        return withSession(undefined, (s) => s.run(runSpeed));
      },
      pause: () => {
        pendingRun.current = null;
        return withSession(undefined, (s) => s.pause());
      },
      setSpeed: (next) => {
        speedRef.current = next;
        setSpeedState(next);
        const session = liveRef.current?.session;
        if (session?.getState().isRunning) {
          withSession(undefined, (s) => s.run(next)).catch(ignore);
        }
      },
      sample: (port, count, inputs) => withSession([], (s) => s.sample(port, count, inputs)),
      scan: (path, port, count) => withSession([], (s) => s.scan(path, port, count)),
      recompile: async () => {
        const sandbox = clientRef.current;
        const source = textRef.current;
        if (sandbox && source?.trim()) await compile(sandbox, source);
      },
      exportVerilog: async (exportOptions) => {
        const sandbox = clientRef.current;
        const opened = liveRef.current;
        if (!sandbox || !opened)
          throw new Error('Nothing to export yet: the circuit is still compiling.');
        return sandbox.export(opened.compiled, opened.name, exportOptions);
      },
    };
  }, [compile]);

  return { compileError, state, history: historyView, actions, client: session };
}
