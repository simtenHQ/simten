/**
 * The worker side of the session protocol: compiles, sessions and the
 * auto-run loop. `apps/sandbox/src/worker.ts` creates one `SessionHost` and
 * hands it every session request; the host answers through `post`.
 *
 * Plain TypeScript over `@simten/core/internal`, with the clock and the source
 * runner passed in, so it runs in Node for tests as it does in the worker.
 *
 * Scheduling. Requests to one session run in the order they arrive (a queue
 * per session). Anything that ticks a lot (a large `tick`, `sample`, every
 * auto-run frame) runs in slices of about 80% of a frame and gives the event
 * loop back between slices, so other sessions' requests get in. A sliced
 * request is still one history step (`advance` then one `record`). While it
 * runs the host sends `progressed` at most once a second, which keeps the
 * relay's watchdog quiet: the watchdog looks for silence, not for slow requests.
 *
 * Output is structured-clone data only: no functions, no class instances.
 */

import type { Circuit, Simulation } from '@simten/core';
import {
  type Behavior,
  type BehaviorFn,
  type CircuitDefinitions,
  type CircuitIR,
  createSimulation,
  type ExecuteResult,
  executeCircuitCode,
  getStdLibrary,
  internalsOf,
  type Library,
  libraryOf,
  nodesOf,
  type SimulationNodes,
} from '@simten/core/internal';
import { autoHarness as legacyHarness } from './legacy-harness.js';
import type {
  BehaviorSource,
  CompileId,
  HostMessage,
  SessionId,
  SessionRequest,
  SessionResponse,
  SessionUpdate,
} from './protocol.js';

/** Time and timers, so tests can run the auto-run loop on a fake clock. */
export interface HostClock {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface SessionHostOptions {
  /** Send a message to the relay (and on to the page). */
  post(message: HostMessage): void;
  /**
   * Run circuit source. Defaults to core's `executeCircuitCode`; the worker
   * passes one that also loads npm imports.
   */
  execute?(source: string): ExecuteResult | Promise<ExecuteResult>;
  /** Defaults to `performance.now` and the global timers, read at each call. */
  clock?: HostClock;
}

/** Auto-run and sliced work aim to fill this share of a frame, leaving the rest for messages. */
const FRAME_SHARE = 0.8;
/** The frame rate large `tick` and `sample` requests are sliced for. */
const SLICE_FRAME_RATE = 30;
/** Cycles in the first slice of a session, to measure what a cycle costs. */
const PROBE_CYCLES = 16;
/** At most one `progressed` heartbeat per this many ms. */
const HEARTBEAT_MS = 1000;
/** Primitives `set-input` may write: what a person at the board could change. */
const INPUT_COMPONENTS = new Set(['Switch', 'Input']);

/** A callback queued to run as soon as the event loop has handled what's waiting. */
interface Soon {
  run: (() => void) | null;
}

/**
 * Run `callback` after the messages already waiting, without the 4ms floor
 * browsers put on nested `setTimeout(0)`. Back-to-back auto-run slices yield
 * this way, so a busy loop spends its time simulating rather than waiting.
 */
const soon = (() => {
  const queue: Soon[] = [];
  let channel: MessageChannel | null = null;
  return (callback: () => void): Soon => {
    if (!channel) {
      channel = new MessageChannel();
      channel.port1.onmessage = () => queue.shift()?.run?.();
      // In Node, don't keep the process alive for it.
      (channel.port1 as { unref?: () => void }).unref?.();
    }
    const entry: Soon = { run: callback };
    queue.push(entry);
    channel.port2.postMessage(null);
    return entry;
  };
})();

const defaultClock: HostClock = {
  now: () => performance.now(),
  setTimeout: (callback, ms) => (ms <= 0 ? soon(callback) : setTimeout(callback, ms)),
  clearTimeout: (handle) => {
    if (handle && typeof handle === 'object' && 'run' in handle) (handle as Soon).run = null;
    else clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

/** A request the host couldn't carry out; its message goes to the page as is. */
class HostError extends Error {}

type Request<T extends SessionRequest['type']> = Extract<SessionRequest, { type: T }>;
/** Requests that run in one session's queue. */
type SessionScopedRequest = Exclude<
  SessionRequest,
  { type: 'compile' | 'compile-ir' | 'release' | 'export' }
>;
type Reply = SessionResponse extends infer R
  ? R extends SessionResponse
    ? Omit<R, 'id'>
    : never
  : never;

// ============================================================================
// Compiles
// ============================================================================

/** A circuit a session can open: its IR and the behavior it runs. */
interface Openable {
  ir: CircuitIR;
  library: Library;
}

interface HostCompile {
  circuits: CircuitIR[];
  exported: CircuitIR[];
  libraryCircuits: CircuitIR[];
  /** The circuit named `name`, or undefined. */
  find(name: string): Openable | undefined;
  /** Every circuit `find` knows, for error messages. */
  names(): string[];
}

/** Circuits cross postMessage; a JSON round trip drops anything that can't. */
function serializable(c: CircuitIR): CircuitIR {
  return JSON.parse(JSON.stringify(c));
}

/** Definitions that look in `circuits` first, then in `base`, and take additions on top. */
function layeredDefinitions(
  base: CircuitDefinitions,
  circuits: Iterable<CircuitIR> = [],
): CircuitDefinitions & { addCircuit(c: CircuitIR): void } {
  const own = new Map<string, CircuitIR>();
  for (const c of circuits) own.set(c.name, c);
  return {
    resolveCircuit: (name) => own.get(name) ?? base.resolveCircuit(name),
    getAllPrimitiveNames: () => {
      const names = new Set(base.getAllPrimitiveNames());
      for (const c of own.values()) {
        if (c.implementation.kind === 'primitive') names.add(c.name);
      }
      return [...names];
    },
    addCircuit: (c) => {
      own.set(c.name, c);
    },
  };
}

/**
 * A compile of source text. Each circuit opens with its own tree's behavior
 * (`libraryOf`), so where two circuits in one file share a name without
 * meeting in one design, the one a circuit uses is the one it runs. That is
 * also exactly what `exportVerilog(top)` uses headless.
 */
function sourceCompile(result: ExecuteResult): HostCompile {
  if (result.error) throw new HostError(result.error);
  if (result.circuits.length === 0 && result.exported.length === 0) {
    throw new HostError(
      "Nothing to show. Define a circuit with circuit('Name', { ... }), or export a component to look at.",
    );
  }
  const libraryCircuits: CircuitIR[] = [];
  for (const name of result.library.definitions.getAllCircuitNames()) {
    const c = result.library.definitions.resolveCircuit(name);
    if (c) libraryCircuits.push(serializable(c));
  }
  // The last circuit built under a name wins, then the last one exported.
  const byName = new Map<string, Circuit>();
  for (const c of [...result.exported, ...result.circuits]) byName.set(c.name, c);
  return {
    circuits: result.circuits.map((c) => serializable(internalsOf(c).ir)),
    exported: result.exported.map((c) => serializable(internalsOf(c).ir)),
    libraryCircuits,
    find(name) {
      const c = byName.get(name);
      return c && { ir: internalsOf(c).ir, library: libraryOf(c) };
    },
    names: () => [...byName.keys()],
  };
}

/** Whether behavior sent as text is the same code as a closure std already has. */
function sameSource(entry: Behavior, info: BehaviorSource): boolean {
  return (
    String(entry.evalFn) === info.evalSource &&
    (entry.onTickFn ? String(entry.onTickFn) : undefined) === info.onTickSource
  );
}

/**
 * Behavior sent as source text, on top of std's. Text identical to a std entry
 * keeps std's closure: rebuilding with `new Function` keeps the body but not
 * the closure, which is wrong for any eval that reads its factory's variables.
 * Anything else, a user circuit that shares a std name included, is rebuilt
 * and used in this compile only.
 */
function rebuildBehaviors(sources: Record<string, BehaviorSource>): Map<string, Behavior> {
  const table = new Map(getStdLibrary().behaviors);
  for (const [name, info] of Object.entries(sources)) {
    const existing = table.get(name);
    if (existing && sameSource(existing, info)) continue;
    const rebuild = (src: string) => new Function(`return (${src})`)() as BehaviorFn;
    try {
      table.set(name, {
        inputNames: info.inputNames,
        outputNames: info.outputNames,
        evalFn: rebuild(info.evalSource),
        onTickFn: info.onTickSource ? rebuild(info.onTickSource) : undefined,
        stateKeys: info.stateKeys,
      });
    } catch (e) {
      throw new HostError(
        `Couldn't rebuild the behavior of '${name}': ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return table;
}

/**
 * A compile of a circuit built on the page (blog, docs, `useSimulation(circuit)`): its
 * IR, its dependencies' IR and their behavior as text. Self-contained: it
 * doesn't borrow from any other compile.
 */
function irCompile(request: Request<'compile-ir'>): HostCompile {
  const definitions = layeredDefinitions(getStdLibrary().definitions, [
    ...request.libraryCircuits,
    request.circuit,
  ]);
  const library: Library = { definitions, behaviors: rebuildBehaviors(request.behaviors) };
  return {
    circuits: [request.circuit],
    exported: [],
    libraryCircuits: request.libraryCircuits,
    find(name) {
      const ir = definitions.resolveCircuit(name);
      return ir && { ir, library };
    },
    names: () => [request.circuit.name],
  };
}

// ============================================================================
// Sessions
// ============================================================================

interface AutoRun {
  speed: number;
  frameMs: number;
  /** Cycles due but not yet run. */
  owed: number;
  /** Cycles run since the last history entry. */
  unrecorded: number;
  /** When the next frame is due, on the host clock. */
  nextAt: number;
  timer: unknown;
}

interface HostSession {
  id: SessionId;
  simulation: Simulation;
  nodes: SimulationNodes;
  library: Library;
  /** Running estimate of one cycle's cost, for slicing; null until the first measurement. */
  msPerCycle: number | null;
  run: AutoRun | null;
  closed: boolean;
}

/** What `open` builds: the simulation, the IR it runs (harnessed if asked) and its library. */
interface Opened {
  simulation: Simulation;
  ir: CircuitIR;
  library: Library;
}

/**
 * The starting inputs `set` can write. A harness gives each input port the
 * circuit reads a Switch or Input named after it, and none to a port nothing
 * reads, so a value for one of those has nothing to set and is dropped.
 */
function startingInputs(
  request: Request<'open'>,
  target: CircuitIR,
  ir: CircuitIR,
): Record<string, number> | null {
  const given = Object.entries(request.initialInputs ?? {});
  if (given.length === 0) return null;
  if (!request.harness || ir === target) return Object.fromEntries(given);
  const ports = new Set(target.inputs.map((p) => p.name));
  const nodes = new Set(ir.nodes.map((n) => n.id));
  return Object.fromEntries(given.filter(([key]) => !ports.has(key) || nodes.has(key)));
}

/** A Simulation of `target`, with std underneath for the harness's switches and displays. */
function openSimulation(target: Openable, request: Request<'open'>): Opened {
  const std = getStdLibrary();
  const own = target.library.definitions;
  const definitions = layeredDefinitions({
    resolveCircuit: (name) => own.resolveCircuit(name) ?? std.definitions.resolveCircuit(name),
    getAllPrimitiveNames: () => [
      ...new Set([...own.getAllPrimitiveNames(), ...std.definitions.getAllPrimitiveNames()]),
    ],
  });
  const library: Library = {
    definitions,
    behaviors: new Map([...std.behaviors, ...target.library.behaviors]),
  };
  // Pages deployed before #531 ask for a harness and draw it; removed at the
  // release (#424). The harness's `dut` node is the target, by name.
  const ir = request.harness ? legacyHarness(target.ir, definitions) : target.ir;
  // The memory is in place from cycle 0, and `reset` goes back to it.
  const simulation = createSimulation(ir, library, {
    history: request.history,
    memory: request.memory,
  });
  // Power-on: the inputs start here, and cycle 0 and history begin with them.
  // `reset` leaves the inputs where they are, as a reset line does.
  const initialInputs = startingInputs(request, target.ir, ir);
  if (initialInputs) {
    simulation.set(initialInputs);
    simulation.reset();
  }
  return { simulation, ir, library };
}

export class SessionHost {
  private readonly post: (message: HostMessage) => void;
  private readonly execute: (source: string) => ExecuteResult | Promise<ExecuteResult>;
  private readonly clock: HostClock;

  private readonly compiles = new Map<CompileId, Promise<HostCompile>>();
  private readonly sessions = new Map<SessionId, HostSession>();
  /** The tail of each session's request queue. */
  private readonly queues = new Map<SessionId, Promise<void>>();
  private lastPostAt = Number.NEGATIVE_INFINITY;

  constructor(options: SessionHostOptions) {
    this.post = options.post;
    this.execute = options.execute ?? executeCircuitCode;
    this.clock = options.clock ?? defaultClock;
  }

  /** Take one request. The answer is posted when it's done. */
  handle(request: SessionRequest): void {
    switch (request.type) {
      case 'compile':
        this.startCompile(request.id, request.compile, async () =>
          sourceCompile(await this.execute(request.source)),
        );
        return;
      case 'compile-ir':
        this.startCompile(request.id, request.compile, async () => irCompile(request));
        return;
      case 'release':
        this.compiles.delete(request.compile);
        this.send(request.id, { type: 'released' });
        return;
      case 'export':
        void this.answer(request.id, () => this.exportCircuit(request));
        return;
      default:
        this.enqueue(request.session, () => this.answer(request.id, () => this.apply(request)));
    }
  }

  // ── Plumbing ────────────────────────────────────────────────────────────

  /** Post a reply to request `id`, or with no id, a frame nobody asked for. */
  private send(id: string | undefined, reply: Reply): void {
    this.lastPostAt = this.clock.now();
    this.post((id === undefined ? reply : { ...reply, id }) as HostMessage);
  }

  /** Run `work` and post its reply, or a `failed` with what it threw. */
  private async answer(id: string, work: () => Reply | Promise<Reply>): Promise<void> {
    let reply: Reply;
    try {
      reply = await work();
    } catch (e) {
      reply = { type: 'failed', code: 'failed', error: e instanceof Error ? e.message : String(e) };
    }
    this.send(id, reply);
  }

  private enqueue(session: SessionId, job: () => Promise<void>): void {
    const tail = (this.queues.get(session) ?? Promise.resolve()).then(job);
    this.queues.set(session, tail);
    void tail.then(() => {
      if (this.queues.get(session) === tail) this.queues.delete(session);
    });
  }

  /** Give the event loop back so other sessions' requests can run. */
  private yieldToOtherWork(): Promise<void> {
    return new Promise((resolve) => this.clock.setTimeout(resolve, 0));
  }

  /** Tell the relay a long request is alive, at most once a second. */
  private heartbeat(id: string): void {
    const now = this.clock.now();
    if (now - this.lastPostAt < HEARTBEAT_MS) return;
    this.lastPostAt = now;
    this.post({ type: 'progressed', id });
  }

  // ── Compiles ────────────────────────────────────────────────────────────

  private startCompile(id: string, compile: CompileId, build: () => Promise<HostCompile>): void {
    const result = build();
    this.compiles.set(compile, result);
    void this.answer(id, async () => {
      const c = await result;
      return {
        type: 'compiled',
        compile,
        circuits: c.circuits,
        exported: c.exported,
        libraryCircuits: c.libraryCircuits,
      };
    });
  }

  private async requireCompile(compile: CompileId): Promise<HostCompile> {
    const result = this.compiles.get(compile);
    if (!result) throw new HostError(`No compile '${compile}' in this sandbox.`);
    return result;
  }

  private async findCircuit(compile: CompileId, name: string): Promise<Openable> {
    const c = await this.requireCompile(compile);
    const target = c.find(name);
    if (!target) {
      throw new HostError(
        `No circuit named '${name}' in this compile. Its circuits: ${c.names().join(', ') || '(none)'}`,
      );
    }
    return target;
  }

  private async exportCircuit(request: Request<'export'>): Promise<Reply> {
    const target = await this.findCircuit(request.compile, request.circuit);
    // Loaded on first use: see export-circuit.ts.
    const { exportVerilogFromIR } = await import('./export-circuit.js');
    const result = exportVerilogFromIR(target.ir, target.library, request.options);
    return { type: 'exported', result };
  }

  // ── Session requests ────────────────────────────────────────────────────

  private requireSession(id: SessionId): HostSession {
    const session = this.sessions.get(id);
    if (!session) throw new HostError(`No session '${id}' in this sandbox.`);
    return session;
  }

  private async apply(request: SessionScopedRequest): Promise<Reply> {
    if (request.type === 'open') return this.open(request);
    const session = this.requireSession(request.session);
    const { simulation } = session;
    switch (request.type) {
      case 'set':
        simulation.set(request.values);
        return this.updated(session);
      // Read and write in one step here, where the value lives: the page's
      // copy lags writes still in flight.
      case 'toggle':
        simulation.set({ [request.name]: simulation.get(request.name) === 1 ? 0 : 1 });
        return this.updated(session);
      // Kept for pages deployed before decision 0010; removed at the release (#424).
      case 'set-input':
        this.setLegacyInputs(session, request.values);
        return this.updated(session);
      case 'tick':
        await this.slicedTick(session, request.id, request.count);
        return this.updated(session);
      case 'run':
        this.startRun(session, request.speed, request.frameRate);
        return this.updated(session);
      case 'pause':
        this.stopRun(session);
        return this.updated(session);
      case 'step-back':
        return this.updated(session, simulation.stepBack());
      case 'step-forward':
        return this.updated(session, simulation.stepForward());
      case 'seek':
        return this.updated(session, simulation.seek(request.index));
      case 'reset':
        simulation.reset();
        return this.updated(session);
      case 'sample':
        return this.sample(session, request);
      case 'scan':
        return this.scan(session, request);
      case 'close':
        this.stopRun(session);
        session.closed = true;
        this.sessions.delete(session.id);
        return { type: 'closed' };
    }
  }

  private async open(request: Request<'open'>): Promise<Reply> {
    if (this.sessions.has(request.session)) {
      throw new HostError(`Session '${request.session}' is already open.`);
    }
    const target = await this.findCircuit(request.compile, request.circuit);
    const { simulation, ir, library } = openSimulation(target, request);
    const session: HostSession = {
      id: request.session,
      simulation,
      nodes: nodesOf(simulation),
      library,
      msPerCycle: null,
      run: null,
      closed: false,
    };
    this.sessions.set(session.id, session);
    return {
      type: 'opened',
      session: session.id,
      circuit: serializable(ir),
      isSequential: simulation.isSequential,
      state: this.snapshotState(session),
    };
  }

  private updated(session: HostSession, moved?: boolean): Reply {
    return { type: 'updated', session: session.id, state: this.snapshotState(session), moved };
  }

  private snapshotState(session: HostSession): SessionUpdate {
    const { simulation, nodes } = session;
    const peripherals = nodes.peripherals();
    return {
      cycle: simulation.cycle,
      ports: new Map(nodes.ports()),
      peripherals: peripherals.size > 0 ? new Map(peripherals) : undefined,
      history: { ...simulation.history },
      isRunning: session.run !== null,
    };
  }

  /**
   * The legacy `set-input`: write every path, then let the next read settle
   * the circuit once. Every path is checked before any is written, so a bad
   * one leaves the inputs as they were. `set` does the same for ports and
   * paths alike. Removed at the release (#424).
   */
  private setLegacyInputs(session: HostSession, values: Record<string, number>): void {
    const entries = Object.entries(values);
    for (const [path] of entries) this.requireInput(session, path, 'setInput');
    for (const [path, value] of entries) session.nodes.set(path, value);
  }

  /** Only what a person at the board could change: a Switch, or an Input (keyboards write those). */
  private requireInput(session: HostSession, path: string, method: string): void {
    const type = session.nodes.primitiveOf(path);
    if (type === undefined) throw new HostError(`${method}('${path}'): no node has that path.`);
    const metadata = session.library.definitions.resolveCircuit(type)?.metadata;
    if (!INPUT_COMPONENTS.has(type) || !metadata?.interactiveArg) {
      throw new HostError(
        `${method}('${path}'): '${path}' is a ${type}, not an input. Only Switch and Input nodes can be set; a memory's contents go in the session's memory option.`,
      );
    }
  }

  private requirePort(session: HostSession, port: string, method: string): void {
    if (!session.nodes.ports().has(port)) {
      throw new HostError(
        `${method}: no port '${port}'. Ports are keyed nodePath.port, with top-level ports under __top__.`,
      );
    }
  }

  // ── Ticking in slices ───────────────────────────────────────────────────

  /**
   * How many cycles fit in `FRAME_SHARE` of a frame of `frameMs`, by the
   * running estimate. Before the first measurement, a small probe.
   */
  private affordable(session: HostSession, frameMs: number): number {
    if (session.msPerCycle === null) return PROBE_CYCLES;
    return Math.max(1, Math.floor((frameMs * FRAME_SHARE) / session.msPerCycle));
  }

  /** Fold one measurement into the session's cost estimate. */
  private measured(session: HostSession, elapsedMs: number, cycles: number): void {
    const sample = elapsedMs / cycles;
    session.msPerCycle =
      session.msPerCycle === null ? sample : 0.8 * session.msPerCycle + 0.2 * sample;
  }

  /** Advance `count` cycles without recording, and update the cost estimate. */
  private timedAdvance(session: HostSession, count: number): void {
    const start = this.clock.now();
    session.nodes.advance(count);
    this.measured(session, this.clock.now() - start, count);
  }

  /**
   * Advance `count` cycles in frame-sized slices, giving other sessions a turn
   * between slices, then record the whole request as one history step.
   * `onCycle` (for `sample`) makes every slice step one cycle at a time.
   */
  private async advanceSliced(
    session: HostSession,
    id: string,
    count: number,
    onCycle?: (index: number) => void,
  ): Promise<void> {
    const frameMs = 1000 / SLICE_FRAME_RATE;
    let done = 0;
    while (done < count && !session.closed) {
      const n = Math.min(count - done, this.affordable(session, frameMs));
      if (onCycle) {
        const start = this.clock.now();
        for (let i = 0; i < n; i++) {
          session.nodes.advance(1);
          onCycle(done + i);
        }
        this.measured(session, this.clock.now() - start, n);
      } else {
        this.timedAdvance(session, n);
      }
      done += n;
      if (done < count) {
        this.heartbeat(id);
        await this.yieldToOtherWork();
      }
    }
    session.nodes.record();
  }

  private async slicedTick(session: HostSession, id: string, count: number): Promise<void> {
    const n = Math.max(0, Math.floor(count));
    // A combinational circuit has no clock: one settle is the whole request.
    if (!session.simulation.isSequential) session.simulation.tick(n);
    else await this.advanceSliced(session, id, n);
  }

  /** Tick `count` times and read `port` after each tick (audio). */
  private async sample(session: HostSession, request: Request<'sample'>): Promise<Reply> {
    this.requirePort(session, request.port, 'sample');
    if (request.inputs) session.simulation.set(request.inputs);
    const samples = new Array<number>(Math.max(0, Math.floor(request.count))).fill(0);
    await this.advanceSliced(session, request.id, samples.length, (i) => {
      samples[i] = session.nodes.ports().get(request.port) ?? 0;
    });
    return { type: 'sampled', samples, state: this.snapshotState(session) };
  }

  /**
   * Drive the input `path` (a port name or a Switch or Input path, as `set`
   * takes) through 0..count-1, settling each time, and read `port`. Doesn't tick.
   */
  private scan(session: HostSession, request: Request<'scan'>): Reply {
    this.requirePort(session, request.port, 'scan');
    const values = new Array<number>(Math.max(0, Math.floor(request.count))).fill(0);
    for (let i = 0; i < values.length; i++) {
      session.simulation.set({ [request.path]: i });
      values[i] = session.nodes.ports().get(request.port) ?? 0;
    }
    return { type: 'scanned', values };
  }

  // ── Auto-run ────────────────────────────────────────────────────────────

  /** Start the loop, or change its speed if it's already running. */
  private startRun(session: HostSession, speed: number, frameRate: number): void {
    const frameMs = 1000 / Math.max(1, frameRate);
    if (session.run) {
      session.run.speed = speed;
      session.run.frameMs = frameMs;
      return;
    }
    const run: AutoRun = {
      speed,
      frameMs,
      owed: 0,
      unrecorded: 0,
      nextAt: this.clock.now() + frameMs,
      timer: undefined,
    };
    session.run = run;
    this.scheduleStep(session, run, frameMs);
  }

  private stopRun(session: HostSession): void {
    if (!session.run) return;
    this.clock.clearTimeout(session.run.timer);
    if (session.run.unrecorded > 0) session.nodes.record();
    session.run = null;
  }

  private scheduleStep(session: HostSession, run: AutoRun, delay: number): void {
    run.timer = this.clock.setTimeout(
      () => this.enqueue(session.id, async () => this.step(session, run)),
      delay,
    );
  }

  /**
   * One slice of auto-run. At each frame boundary the cycles for one more
   * frame fall due, and the frame is recorded as one history step and pushed
   * to the page without waiting for it. A slice runs as many due cycles as
   * fit in 80% of a frame. If cycles are still due after it (the engine is
   * slower than the speed asked for), the next slice runs as soon as other
   * work has had its turn; otherwise the loop waits for the next frame.
   */
  private step(session: HostSession, run: AutoRun): void {
    if (session.run !== run) return;
    const perFrame = (run.speed * run.frameMs) / 1000;
    const frameDue = this.clock.now() >= run.nextAt;
    if (frameDue) run.owed += perFrame;
    const n = Math.min(Math.floor(run.owed), this.affordable(session, run.frameMs));
    if (n > 0) {
      this.timedAdvance(session, n);
      run.owed -= n;
      run.unrecorded += n;
    }
    const now = this.clock.now();
    if (frameDue) {
      if (run.unrecorded > 0) {
        session.nodes.record();
        run.unrecorded = 0;
      }
      this.send(undefined, this.updated(session));
      // Fell behind: carry at most a frame of debt rather than queue it all.
      // At least one cycle, or a speed under one cycle per two frames would
      // never build up the whole cycle it needs to run.
      const cap = Math.max(perFrame, 1);
      if (run.owed > cap) run.owed = cap;
      run.nextAt += run.frameMs;
      // More than a frame late: start the schedule again from now.
      if (run.nextAt < now - run.frameMs) run.nextAt = now;
    }
    const behind = run.owed >= 1;
    this.scheduleStep(session, run, behind ? 0 : Math.max(0, run.nextAt - now));
  }
}
