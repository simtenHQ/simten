/**
 * useSimulation: compile a circuit in the sandbox and simulate it there.
 *
 * Give it a circuit built on the page (sent as IR plus behavior as text,
 * `compile-ir`) or source text (`{ source }`). It compiles, opens a session on
 * the chosen circuit and mirrors the session's state into React. History,
 * ticking and auto-run all run in the sandbox worker; this hook keeps no timers
 * and no history of its own.
 *
 * It returns `{ state, actions }`. `state` is what the simulation is doing now;
 * `actions` is what you can tell it to do, with one identity for the life of
 * the hook. The options say how the simulation starts: a change to
 * `initialInputs`, `memory` or `history` opens a new session at cycle 0.
 *
 * Inputs are named as a person at the board sees them: input ports by name,
 * Switch and Input nodes by path. The session runs the circuit itself; the
 * canvas draws its ports.
 *
 * A failed compile sets `state.compileError` and leaves the last good session
 * running, and so does a circuit that compiles but fails to open (an eval that
 * throws as it first settles, say): both are mistakes in the circuit. Source
 * text recompiles 50 ms after it stops changing; the first compile goes at once.
 *
 * The sandbox is the page-wide one, or the nearest `SandboxProvider`'s.
 */

import type { Circuit, InputKey, PortMap } from '@simten/core';
import type {
  CircuitDefinitions,
  CircuitIR,
  MemoryContents,
  PeripheralValue,
} from '@simten/core/internal';
import type { ExportResult, VerilogExportOptions } from '@simten/core/verilog';
import {
  type Compiled,
  type SandboxClient,
  SandboxError,
  type SimulationClient,
  type SimulationClientState,
} from '@simten/sandbox';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useByValue } from '../lib/useByValue.js';
import { useSandboxClient } from './SandboxProvider.js';

/** Source text, with the circuit to simulate picked by name or by a function. */
export interface SourceText {
  source: string;
  /** Defaults to the last circuit the source builds, then the last it exports. */
  circuit?: string | ((circuits: CircuitIR[]) => CircuitIR | undefined);
}

/** A circuit built on the page, or source text. */
export type SimulationSource = Circuit | SourceText;

/** How a simulation starts. A change to any of these starts a new one at cycle 0. */
export interface UseSimulationOptions<Keys extends string = string> {
  /** Where the inputs sit at power-on, by the keys `set` takes. `reset` doesn't move them. */
  initialInputs?: Partial<Record<Keys, number>>;
  /** Memory contents by node path (`imem`, `cpu.rom`), loaded before cycle 0. A new program is a new run. */
  memory?: Record<string, MemoryContents>;
  /** History entries kept for `stepBack`, `stepForward` and `seek`; 0 for none. @default 200 */
  history?: number;
}

/**
 * A compile error. `line` and `column` are 1-based, or 0 when the error has no
 * location. Pass it to `CodeEditor`'s `diagnostics` to mark the line.
 */
export interface CompileDiagnostic {
  message: string;
  line: number;
  column: number;
}

/** What the simulation is doing now. A new object when anything in it changes. */
export interface SimulationState<Outs extends string = string> {
  /** A session is open and has reported its state. */
  ready: boolean;
  /** Fatal: the sandbox didn't load or an action failed. */
  error: string | null;
  /** Non-fatal: the sandbox restarted this session at cycle 0. */
  notice: string | null;
  /**
   * Why the last compile failed, or why its circuit failed to open; null on
   * success. The last good session keeps running.
   */
  compileError: CompileDiagnostic | null;

  /** The circuit's outputs by name. */
  outputs: Record<Outs, number>;
  /**
   * Every port value, keyed `nodePath.port`, for the canvas and tooling: the
   * circuit's own ports under `__top__` (`__top__.sum`), its nodes by path
   * (`ha1.x.out`). Null until the first state.
   */
  portValues: ReadonlyMap<string, number> | null;
  /** Screens, consoles, UARTs and the memories behind them, by session path. */
  peripheralState: ReadonlyMap<string, PeripheralValue>;
  cycle: number;
  /** Whether the circuit has a clock (registers, memories). */
  isSequential: boolean;
  isRunning: boolean;
  /** Auto-run speed in cycles per second: the last one given to `run`. */
  speed: number;
  /** Where the history cursor is. */
  history: { length: number; index: number; isViewingPast: boolean };

  /** The circuit the session runs, for the canvas and tooling. */
  circuit: CircuitIR | null;
  /** The simulated circuit's name, as given to `circuit(...)`. */
  circuitName: string | null;
  /** Every circuit the last good compile built, for pickers. */
  circuits: CircuitIR[];
  definitions: CircuitDefinitions | null;
}

/** What you can tell the simulation to do. Failures land in `state.error`, not in a rejection. */
export interface SimulationActions<Keys extends string = string> {
  /**
   * Set inputs: input ports by name and Switch and Input nodes by path, all
   * before the circuit settles. A key that names anything else, or both a port
   * and a Switch, is an error, and then nothing is written.
   */
  set(values: Partial<Record<Keys, number>>): Promise<void>;
  /** Flip one 1-bit input or Switch between 0 and 1. */
  toggle(name: Keys): Promise<void>;
  /** Advance `count` clock cycles (default 1), as one history step. */
  tick(count?: number): Promise<void>;
  /** Auto-run in the sandbox at `speed` cycles per second (default: the current `state.speed`). */
  run(speed?: number): Promise<void>;
  pause(): Promise<void>;
  /**
   * The reset line: back to cycle 0, registers and history to the start.
   * Memory contents stay, and so do the inputs. To start over from power-on,
   * `restart()`.
   */
  reset(): Promise<void>;
  /**
   * Start over from power-on: a new session on the same compile, at cycle 0,
   * in place of this one. Unlike `reset`, the inputs go back to
   * `initialInputs` too, so a latch built from gates settles as it did when
   * the circuit opened.
   */
  restart(): Promise<void>;
  stepBack(): Promise<boolean>;
  stepForward(): Promise<boolean>;
  seek(index: number): Promise<boolean>;
  /** Drive one input through 0..count-1, settling each time, and read `port` (a `portValues` key) after each. Doesn't tick. */
  scan(input: Keys, port: string, count: number): Promise<number[]>;
  /** Tick `count` times, after setting `inputs`, and read `port` (a `portValues` key) after each tick. */
  sample(port: string, count: number, inputs?: Partial<Record<Keys, number>>): Promise<number[]>;
  /** Verilog for the simulated circuit, from the same compile. */
  exportVerilog(options?: VerilogExportOptions): Promise<ExportResult>;
  /** Compile the source text now, without waiting for the debounce. */
  recompile(): Promise<void>;
}

/** A running simulation, as `CircuitCanvas` and `ClockControls` take it. */
export interface UseSimulationResult<Keys extends string = string, Outs extends string = string> {
  state: SimulationState<Outs>;
  actions: SimulationActions<Keys>;
}

/** A circuit's output port names, or `string` when its type isn't known. */
type OutputName<C extends Circuit> =
  C extends Circuit<PortMap, infer Outs> ? keyof Outs & string : string;

/** Source text waits this long after the last change before it compiles. */
const DEBOUNCE_MS = 50;
const DEFAULT_SPEED = 15;
const DEFAULT_HISTORY = 200;
const TOP = '__top__';
const NO_PERIPHERALS: ReadonlyMap<string, PeripheralValue> = new Map();
const NO_CIRCUITS: CircuitIR[] = [];
const NO_OUTPUTS: Record<string, number> = {};
const ignore = () => {};

function isSourceText(source: SimulationSource): source is SourceText {
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

function pickCircuit(compiled: Compiled, choice: SourceText['circuit']): CircuitIR | undefined {
  if (typeof choice === 'string') return compiled.definitions.resolveCircuit(choice);
  if (choice) return choice(compiled.circuits);
  return compiled.circuits.at(-1) ?? compiled.exported.at(-1);
}

/** The circuit's outputs by name. */
function outputsOf(circuit: CircuitIR, ports: ReadonlyMap<string, number>): Record<string, number> {
  const outputs: Record<string, number> = {};
  for (const port of circuit.outputs) {
    const value = ports.get(`${TOP}.${port.name}`);
    if (value !== undefined) outputs[port.name] = value;
  }
  return outputs;
}

/** Zero for each output of a circuit built on the page, so `outputs` has every key before the first state. */
function zeroOutputs(circuit: Circuit | null): Record<string, number> {
  if (!circuit) return NO_OUTPUTS;
  return Object.fromEntries(Object.keys(circuit.outputs).map((name) => [name, 0]));
}

/** The session and what it was opened from. */
interface Live {
  session: SimulationClient;
  compiled: Compiled;
  name: string;
  /**
   * What the session runs, kept from the first session on this compile, so a
   * restart doesn't hand the canvas a new circuit to lay out again.
   */
  circuit: CircuitIR;
  definitions: CircuitDefinitions;
}

/**
 * Open a new session on the compile and circuit `live` runs and hand it to
 * `adopt`, for `restart`. If something replaced `live` meanwhile (a recompile,
 * another restart), that one wins: the new session is closed, and a failure to
 * open is no longer news.
 */
async function reopen(
  sandbox: SandboxClient | null,
  live: Live,
  start: Parameters<SandboxClient['open']>[1],
  isCurrent: () => boolean,
  adopt: (next: Live) => void,
): Promise<void> {
  if (!sandbox) return;
  try {
    const session = await sandbox.open({ compiled: live.compiled, circuit: live.name }, start);
    if (isCurrent()) adopt({ ...live, session });
    else session.close().catch(ignore);
  } catch (e) {
    if (isCurrent()) throw e;
  }
}

export function useSimulation<C extends Circuit>(
  circuit: C | null,
  options?: UseSimulationOptions<InputKey<C>>,
): UseSimulationResult<InputKey<C>, OutputName<C>>;
export function useSimulation(
  source: SourceText | null,
  options?: UseSimulationOptions,
): UseSimulationResult;
export function useSimulation(
  source: SimulationSource | null,
  options?: UseSimulationOptions,
): UseSimulationResult;
export function useSimulation(
  source: SimulationSource | null,
  options: UseSimulationOptions = {},
): UseSimulationResult {
  const history = options.history ?? DEFAULT_HISTORY;
  const initialInputs = useByValue(options.initialInputs);
  const memory = useByValue(options.memory);
  const client = useSandboxClient();
  // Latest-value refs (client, choice, text) let the stable actions and
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
  /** Why the last session failed to open, cleared when one opens. */
  const [openError, setOpenError] = useState<CompileDiagnostic | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  /** The open session for the stable actions, which can't read `live` without changing identity. */
  const liveRef = useRef<Live | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const speedRef = useRef(speed);
  /** A `run` called before the session opened (a demo that starts running on mount); it starts when it does. */
  const pendingRun = useRef<number | null>(null);

  /** Every compile this hook holds in the sandbox, so each is released once nothing needs it. */
  const held = useRef(new Set<Compiled>());
  /** The sandbox each compile lives in: when the client changes, an old compile can't open in the new one. */
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
      compiledOnce.current ? DEBOUNCE_MS : 0,
    );
    return () => clearTimeout(timer);
  }, [client, text, compile]);

  // A circuit built on the page: compile it once per circuit.
  useEffect(() => {
    if (!client || !built) return;
    void compile(client, built);
  }, [client, built, compile]);

  // ── Open ─────────────────────────────────────────────────────────────────

  /** How every session starts. */
  const start = useMemo(
    () => ({
      initialInputs: initialInputs as Record<string, number> | undefined,
      history,
      memory,
    }),
    [initialInputs, history, memory],
  );
  /** For `restart`, which opens a session outside the effect. */
  const startRef = useRef(start);
  startRef.current = start;

  /** Make `next` the open session, closing the one it replaces. */
  const adopt = useCallback(
    (next: Live) => {
      const previous = liveRef.current;
      liveRef.current = next;
      setLive(next);
      setActionError(null);
      setOpenError(null);
      // Closing also stops the old session's auto-run.
      previous?.session.close().catch(ignore);
      releaseExcept(next.compiled);
      if (pendingRun.current !== null) {
        next.session.run(pendingRun.current).catch((e: unknown) => {
          setActionError(e instanceof Error ? e.message : String(e));
        });
        pendingRun.current = null;
      }
    },
    [releaseExcept],
  );

  useEffect(() => {
    if (!client || !compiled) return;
    if (compiledIn.current.get(compiled) !== client) return;
    const target = pickCircuit(compiled, choiceName ?? choiceRef.current);
    if (!target) {
      setCompileError({ message: 'No circuit to simulate.', line: 0, column: 0 });
      return;
    }
    const name = target.name;
    const opening = client.open({ compiled, circuit: name }, start);
    let cancelled = false;
    opening.then(
      (session) => {
        if (cancelled) {
          session.close().catch(ignore);
          return;
        }
        adopt({
          session,
          compiled,
          name,
          circuit: session.circuit,
          definitions: session.definitions,
        });
      },
      (e: unknown) => {
        if (cancelled || (e instanceof SandboxError && e.code === 'closed')) return;
        setOpenError(diagnosticOf(e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client, compiled, choiceName, start, adopt]);

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

  const definitions = useMemo(() => live?.definitions ?? null, [live]);
  const ports = current?.ports ?? null;
  const beforeFirstState = useMemo(() => zeroOutputs(built), [built]);
  const outputs = useMemo(
    () => (session && ports ? outputsOf(session.circuit, ports) : beforeFirstState),
    [session, ports, beforeFirstState],
  );

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

  // A circuit that compiles but won't open is reported like one that won't compile.
  const circuitError = useMemo(() => compileError ?? openError, [compileError, openError]);
  const closedBySandbox = current?.status === 'closed' ? current.notice : null;
  const ready = current !== null && current.status !== 'closed';
  const error = unavailable ?? actionError ?? closedBySandbox;
  const notice = current?.status === 'restarted' ? current.notice : actionNotice;
  const portValues = ports && ports.size > 0 ? ports : null;
  const peripheralState = current?.peripherals ?? NO_PERIPHERALS;
  const cycle = current?.cycle ?? 0;
  const isSequential = session?.isSequential ?? false;
  const isRunning = current?.isRunning ?? false;
  const simulated = live?.circuit ?? null;
  const circuitName = live?.name ?? null;
  const circuits = compiled?.circuits ?? NO_CIRCUITS;
  // A new object only when something in it changes, so memos that depend on it hold.
  const state = useMemo(
    (): SimulationState => ({
      ready,
      error,
      notice,
      compileError: circuitError,
      outputs,
      portValues,
      peripheralState,
      cycle,
      isSequential,
      isRunning,
      speed,
      history: historyView,
      circuit: simulated,
      circuitName,
      circuits,
      definitions,
    }),
    [
      ready,
      error,
      notice,
      circuitError,
      outputs,
      portValues,
      peripheralState,
      cycle,
      isSequential,
      isRunning,
      speed,
      historyView,
      simulated,
      circuitName,
      circuits,
      definitions,
    ],
  );

  // ── Actions ──────────────────────────────────────────────────────────────

  const textRef = useRef(text);
  textRef.current = text;

  const actions = useMemo((): SimulationActions => {
    /** Run `work` on the open session; report a failure instead of throwing it. */
    async function withSession<T>(fallback: T, work: (opened: Live) => Promise<T>): Promise<T> {
      const opened = liveRef.current;
      if (!opened) return fallback;
      setActionNotice(null);
      try {
        return await work(opened);
      } catch (e) {
        report(e);
        return fallback;
      }
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

    return {
      set: (values) =>
        withSession(undefined, ({ session: s }) => {
          const given: Record<string, number> = {};
          for (const [key, value] of Object.entries(values)) {
            if (value !== undefined) given[key] = value;
          }
          return s.set(given);
        }),
      // The sandbox flips the value it holds: the state pushed here lags
      // writes still in flight, so a fast double click would flip the same
      // stale value twice.
      toggle: (name) => withSession(undefined, ({ session: s }) => s.toggle(name)),
      tick: (count = 1) => withSession(undefined, ({ session: s }) => s.tick(count)),
      run: (next) => {
        const runSpeed = next ?? speedRef.current;
        speedRef.current = runSpeed;
        setSpeed(runSpeed);
        if (!liveRef.current) pendingRun.current = runSpeed;
        return withSession(undefined, ({ session: s }) => s.run(runSpeed));
      },
      pause: () => {
        pendingRun.current = null;
        return withSession(undefined, ({ session: s }) => s.pause());
      },
      reset: () => withSession(undefined, ({ session: s }) => s.reset()),
      restart: () =>
        withSession(undefined, (opened) =>
          reopen(
            clientRef.current,
            opened,
            startRef.current,
            () => liveRef.current === opened,
            adopt,
          ),
        ),
      stepBack: () => withSession(false, ({ session: s }) => s.stepBack()),
      stepForward: () => withSession(false, ({ session: s }) => s.stepForward()),
      seek: (index) => withSession(false, ({ session: s }) => s.seek(index)),
      scan: (input, port, count) => withSession([], ({ session: s }) => s.scan(input, port, count)),
      sample: (port, count, inputs) =>
        withSession([], ({ session: s }) =>
          s.sample(port, count, inputs as Record<string, number> | undefined),
        ),
      exportVerilog: async (exportOptions) => {
        const sandbox = clientRef.current;
        const opened = liveRef.current;
        if (!sandbox || !opened)
          throw new Error('Nothing to export yet: the circuit is still compiling.');
        return sandbox.export(opened.compiled, opened.name, exportOptions);
      },
      recompile: async () => {
        const sandbox = clientRef.current;
        const source = textRef.current;
        if (sandbox && source?.trim()) await compile(sandbox, source);
      },
    };
  }, [compile, adopt]);

  return useMemo(() => ({ state, actions }), [state, actions]);
}
