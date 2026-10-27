# Design: the simulation runtime (#417)

**Status:** Proposed, for review before implementation.
**Issue:** #417. Follow-up: #418 (embed folds into ui).
**Packages after both issues:** `core`, `sandbox`, `ui`, `mcp`. React only in `ui`.

## Summary

- `simulate()` returns one type, `Simulation`, which replaces `SimulationHandle` and `SimulationSession`. It is synchronous, has no timers, and owns history. Ports are public and typed; access to internal nodes by dotted path lives in `@simten/core/internal`.
- New package `@simten/sandbox`, no React: the protocol, `SandboxClient` (one iframe, many sessions) and `SessionClient` (an async mirror of `Simulation`).
- The sandbox worker holds a `Simulation` per session and runs the auto-run loop itself, pushing state to the page at display rate. The page keeps no history and no timers.
- Two hooks in `@simten/ui`, `useCompile` and `useSimulation`, replace six hooks and one helper. Return shapes stay close to today's.
- The drill-down inspector reads the main session by dotted path. No second engine and no second sandbox session for composites.
- Simulation results don't change: the engine is untouched, so `pnpm bench --check` fingerprints stay identical. Saved circuits and share links are unaffected (decision 0003 freezes source names, not the runtime).

## 1. What exists today

Three implementations of the same timeline:

| Where | What | Lines |
|---|---|---|
| `core/src/simulator/simulation-session.ts` | `SimulationSession`: sync history, time travel, `setInterval` auto-run | 432 |
| `core/src/simulator/simulate.ts` | `SimulationHandle`: typed `set`/`get` around a session, 18 members | 328 |
| `embed/src/hooks/useCircuitSimulator.ts` | an async copy of the session written against `useSandbox`: page-side history of snapshot ids, page-side `setInterval` auto-run, prune messages | 847 |
| `ui/src/canvas/CompositeInspectorDialog.tsx` | a third, smaller copy (history, a 200ms auto-run, a local-engine fallback) per drill-down slot | ~250 of 482 |
| `ui/src/canvas/hooks/useSimulationSession.ts` | React binding for `SimulationSession`; nothing imports it | 81 |

Transport: `ui/src/sandbox/useSandbox.ts` (665 lines, React) and `protocol.ts` (154). Sandbox app: `apps/sandbox/src/main.ts` (relay and 5s watchdog), `worker.ts` (all user code and simulators, keyed by "slot").

The worker side is already where the comment on #417 wants it: user code and engines run in the worker, the iframe main thread only relays and watches. What's missing is that the *timeline* (history, auto-run) is still driven from the page.

Problems this causes, beyond duplication:

- Auto-run is a page `setInterval` that sends `tick-n` and waits for the reply. Batches can't overlap, so throughput is capped by round-trip time, and a hung batch is only caught because a request is in flight.
- History lives in two places: snapshot ids on the page, snapshots in the worker. Pruning needs its own message, and orphaned snapshots leak until the slot is disposed.
- `compile-ir` takes "the first slot" as its base library (`worker.ts`, `compileIR`). Which slot that is depends on mount order.
- Every drill-down opens a new sandbox slot running a copy of the circuit, so its state drifts from the canvas it was opened from.

### Call sites

Simulation hooks, 15 call sites:

| Kind | Files |
|---|---|
| Blog demos (10) | `breakout-in-hardware/useBreakoutSimulator.ts`, `building-a-cpu/useSimulator6502.ts`, `computing-trig-in-hardware/useCORDICSimulator.ts`, `crc32-in-hardware/sections/CRC32Section.tsx`, `how-network-switches-work/useSwitchSimulator.ts`, `how-tpus-work/useSystolicSimulator.ts`, `pong-in-hardware/usePongSimulator.ts`, `snake-in-hardware/useSnakeSimulator.ts`, `sorting-networks/sections/PipelineSection.tsx`, `synth-in-hardware/sections/PlayerSection.tsx` (plus a type-only import in `useLiveVoice.ts`) |
| Docs and learn (3) | `docs/CustomCompositionDemo.tsx`, `docs/PropagationDemo.tsx`, `learn/cpu-debugger/useRV32IDebugger.ts` |
| Editor (1) | `visual-editor/components/EditorWorkspace.tsx` (`useCircuitCompiler` + `builtFromIR` + `useCircuitSimulator`) |
| Embed (1) | `embed/src/CircuitViewer.tsx`, behind every `<CircuitEmbed>` (about 90 in web) and the `<circuit-embed>` web component |

Direct sandbox use, 5 files: game `routes/$levelId.tsx` and `game/runtime.ts` (grading), `docs/PipelineVisualizer.tsx` (compile only), `embed/webcomponent/WebComponentEmbed.tsx` (compile), `ui/canvas/CompositeInspectorDialog.tsx`.

`useCompiledCircuit`, 2 files: game `routes/$levelId.tsx`, `components/LevelDrilldown.tsx`.

Providers, 4 files: web `routes/__root.tsx`, `viewer/main.tsx`, game `routes/__root.tsx`, `WebComponentEmbed.tsx`.

`simulate()`: 59 files, almost all tests and `.verify.ts` files, plus the MCP `get_verify_api` text in `mcp/src/tools/reference.ts` and four docs pages. MCP doesn't use the browser hooks; the editor's MCP bridge only reads `sim.cycleCount` and `sim.isSequential`.

Fields read across web call sites (counted with grep): `ready` 49, `portValues` 40, `tick` 27, `cycleCount` 20, `circuit` 20, `setNodeValue` 19, `error` 14, `setNode` 13, `reset` 11, `toggleNode` 10, `sequentialState` 10, `scanPort` 8, `tickN` 7, `outputs` 6, `definitions` 5; everything else 1 or 2. `inputs`, `toggleInput`, `getSimulator` and `runCombinational` are effectively unused.

## 2. `Simulation` in core

### Public type

```ts
// @simten/core
export function simulate<Ins extends PortMap, Outs extends PortMap>(
  circuit: Circuit<Ins, Outs>,
  options?: SimulateOptions,
): Simulation<Ins, Outs>;

export interface SimulateOptions {
  /** Cycles of history kept for stepBack/stepForward/seek. Default 0: off. */
  history?: number;
}

export interface Simulation<Ins extends PortMap = PortMap, Outs extends PortMap = PortMap> {
  /** True if the circuit has state (registers, memories). */
  readonly isSequential: boolean;
  /** Clock cycles since the start or the last reset. */
  readonly cycle: number;

  /** Drive top-level input ports. Unknown names throw. */
  set(values: Partial<{ [K in keyof Ins]: number }>): void;
  /** Read one top-level output port. Unknown names throw. */
  get<K extends keyof Outs & string>(name: K): number;
  /** Read every top-level output port. */
  read(): { [K in keyof Outs]: number };

  /** Advance `count` rising clock edges (default 1). On a combinational circuit, settles. */
  tick(count?: number): void;
  /** Back to cycle 0. Memory contents loaded at build time survive, as flash does. */
  reset(): void;

  /** Where the history cursor is. `{ length: 0, index: -1 }` when history is off. */
  readonly history: { readonly length: number; readonly index: number };
  stepBack(): void;
  stepForward(): void;
  seek(index: number): void;

  /** Opaque saved state, for tests that branch from a point. */
  snapshot(): Snapshot;
  restore(snapshot: Snapshot): void;

  dispose(): void;
}
```

### Internal node access

```ts
// @simten/core/internal
export function createSimulation(
  circuit: CircuitIR,
  library: Library,
  options?: SimulateOptions,
): Simulation;

/** The flat, untyped view of a simulation. For the sandbox, the canvas and tests. */
export function nodesOf(simulation: Simulation): SimulationNodes;

export interface SimulationNodes {
  /** Write a node by exact dotted instance path: a Switch/Input value, a register, or memory contents. */
  set(path: string, value: number | MemoryContents): void;
  /** Every port value, keyed `nodePath.port` (top-level ports under `__top__`). */
  ports(): ReadonlyMap<string, number>;
  /** State of nodes on a peripheral bus (screens, consoles, UARTs), by node path. */
  peripherals(): ReadonlyMap<string, PeripheralValue>;
}

export type PeripheralValue = number | string | ReadonlyMap<number, number>;
```

Ports are public because they're the circuit's typed interface: a verify file, a test or an MCP agent drives a design through its ports and nothing else. Internal nodes are reached by dotted path because that's what the canvas, the inspector and the sandbox work with, but those paths are elaboration details (`dut.ha1.xor1`) and not a contract, so they stay in `internal`. `nodesOf` follows the existing `internalsOf(circuit)` pattern.

### Every member, and why it's there

| Member | Reason | Was |
|---|---|---|
| `isSequential`, `cycle` | UI shows clock controls and the cycle counter; tests assert on cycle | same |
| `set`, `get`, `read` | the typed port interface used by 59 test/verify files | same, minus fallbacks (below) |
| `tick(count?)` | one method for one or many edges | `tick` + `tickN` |
| `reset` | UI and tests | same |
| `history`, `stepBack`, `stepForward`, `seek` | time travel; the sandbox session needs it, and it has to be sync code in core so there's one implementation | lived only on `SimulationSession` |
| `snapshot`, `restore` | tests branch from a saved point (17 and 12 uses) | same |
| `dispose` | frees the engine; 90 test uses in `finally` | same |

### Removed

| Removed | Why | Replacement |
|---|---|---|
| `get(name)` suffix-match fallback (`k.endsWith('.' + name)`) | silently returns a different port when the name is wrong, and returns `0` for a typo | `get` throws on a name that isn't a top-level output. Internal reads use `nodesOf(sim).ports().get(path)` |
| engine `setNode` suffix match (`n.id.endsWith('.' + name)`) | same problem on the write side; can pick the wrong node when two share a leaf name | exact path, throw on unknown. The game grader already resolves port-vs-node itself (`readOutputs`); it does the same for writes |
| `setNode(nodeId, value)` on the public handle | reaches past the typed interface | `nodesOf(sim).set(path, value)`. Memory loaded at build time uses `ROM({ memory })`, which already exists |
| `run({ speed })`, `stop()`, `isRunning` | timers make `simulate()` non-deterministic and keep a Node process alive until `dispose`. Only one test uses them | the sandbox runs the loop (section 3). Node callers write `for` + `tick` |
| `watch`, `watchPort` | only `simulate.test.ts` uses them. A sync object doesn't need change notification: the caller knows when it called `tick` | none in core. `SessionClient.subscribe` exists because a remote mirror does need it |
| `tickN` | merged | `tick(count)` |
| `SimulationSession`, `SessionSnapshot`, `TMeta` metadata, `onBeforeTick`, `metadataFn`, `getEngine` | no caller uses metadata or the hooks; `getEngine` was the escape hatch `nodesOf` replaces | `Simulation` |
| `useSimulationSession` (ui) | unused | deleted |

### Behavior notes

- **Settling after `set`.** Today `set` settles combinational logic only on combinational circuits; on a sequential circuit `get` after `set` returns the value from before the write until the next `tick`. The sandbox already settles after every write. `Simulation` marks itself dirty on `set` or `nodesOf().set` and settles lazily on the next read (`get`, `read`, `ports()`), so a write followed by `tick` costs nothing extra. Clocked results are unchanged; only a read between `set` and `tick` changes, and it changes to the settled value. This is the one visible behavior change; see open question 2.
- **History records one entry per `tick` call**, so `tick(100)` is one step back, same as `tickN` in the embed today. With `history: 0` (the `simulate()` default) nothing is recorded. Today `simulate()` snapshots the engine on every cycle into a 1000-entry ring buffer that no caller can reach, so this is a speed-up for long verify runs.
- **Environmental state** (Switch/Input positions) rewinds with history through the engine snapshot's `inputs` and `nodeValues`, which already exist. The worker's separate `FullSnapshot.env` capture becomes redundant; `environmental-time-travel.test.ts` is ported to `Simulation` to prove it.

## 3. `@simten/sandbox`

A new package with no React and no DOM beyond the iframe it creates. `apps/sandbox` (currently also named `@simten/sandbox`, private) is renamed `@simten/sandbox-app` first.

```
packages/sandbox/src/
  protocol.ts         moved from @simten/ui/sandbox/protocol
  sandbox-client.ts   iframe transport, ids, ready handshake, status
  session-client.ts   async mirror of Simulation
  session-host.ts     worker side: compiles, sessions, run loop (imported by apps/sandbox/src/worker.ts)
  errors.ts           SandboxError
  index.ts
```

`session-host.ts` is plain TypeScript over `@simten/core/internal`, so it's unit-tested in Node without an iframe or worker.

### `SandboxClient`

```ts
export type SandboxStatus = 'loading' | 'ready' | 'unavailable';
export type CompileId = string;
export type SessionId = string;

export interface Compiled {
  id: CompileId;
  circuits: CircuitIR[];        // circuits the source defines, in order
  libraryCircuits: CircuitIR[]; // everything they depend on, std included
  definitions: CircuitDefinitions;
}

export type SessionSource =
  /** A circuit from a source compile, by name, or IR built from that compile's circuits (the editor's canvas). */
  | { compiled: Compiled; circuit: string | CircuitIR }
  /** A circuit built on the page from trusted code (blog, docs). Behavior goes as source text. */
  | { circuit: Circuit };

export interface OpenOptions {
  /** Wrap the circuit in Switch/Input and Led/HexDisplay nodes. */
  harness?: boolean;
  initialInputs?: Record<string, number>;
  /** Cycles of history. Default 200, today's embed cap. */
  history?: number;
}

export class SandboxClient {
  constructor(options?: { origin?: string; readyTimeoutMs?: number });

  readonly status: SandboxStatus;
  onStatusChange(listener: (status: SandboxStatus) => void): () => void;

  compile(source: string): Promise<Compiled>;
  /** Free a compile. Its behavior stays alive while an open session uses it. */
  release(compiled: Compiled): void;

  /** Opens a session. Resolves once the sandbox has built it. */
  open(source: SessionSource, options?: OpenOptions): Promise<SessionClient>;

  /** Remove the iframe and fail everything pending. */
  dispose(): void;
}

/** One client per page unless a caller needs isolation. */
export function sharedSandbox(): SandboxClient;
```

One iframe hosts any number of sessions and compiles, keyed by ids the client generates (unique per page, as request ids are today). The word "slot" goes away.

`sharedSandbox()` means every `<circuit-embed>` on a page shares one iframe instead of mounting one each, as `WebComponentEmbed` does today.

Compiles and sessions are separate because they have different lifetimes: the editor recompiles on every edit and then opens one session against the result; the game compiles once to grade and to preview. A session names the compile it was built from, which replaces `compile-ir`'s "first slot" guess.

### `SessionClient`

```ts
export interface SessionState {
  status: 'open' | 'restarted' | 'closed';
  /** Set after a watchdog restart; cleared by the next action. */
  notice: string | null;
  cycle: number;
  ports: ReadonlyMap<string, number>;
  peripherals: ReadonlyMap<string, PeripheralValue>;
  history: { length: number; index: number };
  isRunning: boolean;
}

export class SessionClient {
  readonly id: SessionId;
  /** The simulated circuit as IR, harnessed if asked for. Fixed for the session's life. */
  readonly circuit: CircuitIR;
  readonly definitions: CircuitDefinitions;
  readonly isSequential: boolean;

  /** Last state the sandbox reported. Stable reference between updates. */
  getState(): SessionState;
  subscribe(listener: () => void): () => void;

  // Same names as Simulation, async. Each resolves after the sandbox has applied it.
  get cycle(): number;
  set(values: Record<string, number>): Promise<void>;
  get(name: string): number;                    // from the last state, like Simulation.get
  tick(count?: number): Promise<void>;
  reset(): Promise<void>;
  stepBack(): Promise<void>;
  stepForward(): Promise<void>;
  seek(index: number): Promise<void>;
  dispose(): Promise<void>;

  // From SimulationNodes, by dotted path.
  setNode(path: string, value: number | MemoryContents): Promise<void>;

  // Only here: things that need the sandbox to keep going between messages.
  /** Auto-run at `speed` cycles per second. Calling it while running changes speed. */
  run(speed: number): Promise<void>;
  pause(): Promise<void>;
  /** Tick `count` times and return `port` after each tick (audio). */
  sample(port: string, count: number, inputs?: Record<string, number>): Promise<number[]>;
  /** Drive `path` through 0..count-1, settling each time, and read `port` (debug reads). Doesn't tick. */
  scan(path: string, port: string, count: number): Promise<number[]>;
}
```

How it relates to `Simulation`:

| `Simulation` | `SessionClient` | Why different |
|---|---|---|
| `set`, `tick`, `reset`, `stepBack`, `stepForward`, `seek`, `dispose` | same names, return `Promise<void>` | crossing postMessage |
| `get`, `cycle`, `history`, `isSequential` | same, sync, from the last reported state | after `await s.set(...)` the state is current, so `await s.set({ a: 1 }); s.get('sum')` reads like Node code |
| `nodesOf(sim).set` | `setNode` | the page has no `nodesOf`; the canvas needs node writes |
| `snapshot`, `restore` | none | engine state can't cross the boundary, and the UI uses history instead |
| none | `run`, `pause`, `sample`, `scan` | loops that must run next to the engine |
| none | `getState`, `subscribe` | a remote mirror needs change notification; fits `useSyncExternalStore` |

Requests to one session are applied in the order they're sent (one postMessage channel, one worker), so `setNode(...)` then `tick()` without awaiting the first is safe, as `CRC32Section` relies on today.

Promises reject with `SandboxError` (section 8) instead of resolving to `T | SandboxError` unions.

## 4. Protocol

Repo convention: request types are verbs, response types are past tense, kebab-case.

### Page → iframe

Every request carries `id: string`.

| Request | Fields | Response |
|---|---|---|
| `compile` | `compile: CompileId`, `source` | `compiled` |
| `release` | `compile` | `released` |
| `open` | `session`, `from: { compile, circuit: string \| CircuitIR } \| { circuit: CircuitIR, library: CircuitIR[], behaviors: Record<string, BehaviorSource> }`, `harness?`, `initialInputs?`, `history` | `opened` |
| `set` | `session`, `values: Record<string, number>` | `updated` |
| `set-node` | `session`, `path`, `value: number \| MemoryContents` | `updated` |
| `tick` | `session`, `count` | `updated` |
| `run` | `session`, `speed`, `frameRate` | `updated`, then pushed `updated` frames |
| `pause` | `session` | `updated` |
| `step-back`, `step-forward` | `session` | `updated` |
| `seek` | `session`, `index` | `updated` |
| `reset` | `session` | `updated` |
| `sample` | `session`, `port`, `count`, `inputs?` | `sampled` |
| `scan` | `session`, `path`, `port`, `count` | `scanned` |
| `close` | `session` | `closed` |

### Iframe → page

| Response | Fields |
|---|---|
| `ready` | none (unchanged handshake) |
| `compiled` | `id`, `compile`, `circuits`, `libraryCircuits` |
| `released` | `id` |
| `opened` | `id`, `session`, `circuit` (harnessed IR), `isSequential`, `state: SessionUpdate` |
| `updated` | `id?` (absent on pushed frames), `session`, `state: SessionUpdate` |
| `sampled` | `id`, `samples: number[]`, `state: SessionUpdate` |
| `scanned` | `id`, `values: number[]` |
| `closed` | `id` |
| `failed` | `id`, `code: 'failed' \| 'timed-out' \| 'restarted'`, `error: string` |
| `restarted` | `sessions: SessionId[]`, `dropped: SessionId[]`, `message` (pushed, section 8) |

```ts
interface SessionUpdate {
  cycle: number;
  ports: Map<string, number>;              // Map, not an object: structured clone keeps it, and the page wants a Map
  peripherals?: Map<string, PeripheralValue>;
  history: { length: number; index: number };
  isRunning: boolean;
}
```

Iframe ↔ worker messages are the same types; the relay forwards both ways unchanged, as now.

### Removed

`compile-ir` (folded into `open`), `tick-n` (`tick` with `count`), `render-samples` (`sample`), `scan-port` (`scan`), `snapshot`, `restore`, `prune-snapshots` (history is in the worker), `dispose` (`close`), every `slot` field, and the `error` response (`failed`). `SandboxResult`, `CompileIRResult`, `TickResult`, `ResetResult`, `SetNodeResult`, `SnapshotResult`, `RestoreResult` go with them. Per decision 0003 there's no support for the old protocol once the last page using it is redeployed.

### Auto-run and streaming

The worker runs the loop:

```ts
// session-host.ts, per running session
const frameMs = 1000 / frameRate;           // frameRate default 30, as today
let owed = 0;                               // cycles due but not yet run
let msPerCycle = 0.05;                      // running estimate, updated every frame
function frame() {
  owed += speed / frameRate;                // drift-free accumulator, as SimulationSession does today
  const affordable = Math.max(1, Math.floor((frameMs * 0.8) / msPerCycle));
  const n = Math.min(Math.floor(owed), affordable);
  if (n > 0) {
    const start = performance.now();
    sim.tick(n);                            // one call, so one history entry per frame
    msPerCycle = 0.8 * msPerCycle + 0.2 * ((performance.now() - start) / n);
    owed -= n;
  }
  if (owed > speed / frameRate) owed = 0;   // fell behind: drop the debt, don't queue it (today's skip rule)
  post({ type: 'updated', session, state: update(sim) });
  timer = setTimeout(frame, Math.max(0, nextDeadline() - performance.now()));
}
```

- The worker posts one `updated` per frame, whether or not the page has drawn the last one. The page's `SessionClient` keeps only the latest state and notifies subscribers; React batches the renders. Handling a message is a structured-clone decode and a reference swap, so frames don't back up.
- Each frame runs as many cycles as the running estimate says fit in about 80% of the frame period, in one `tick(n)` call. A frame can't run long enough to trip the watchdog unless a cycle hangs, and `pause` is handled within one frame.
- The loop doesn't wait for the page between batches, so throughput is bounded by the engine, not by round trips. Today's loop is a page `setInterval` that sends `tick-n` and waits for the reply.
- History records one entry per frame, matching today's batch-boundary history.

Rejected: page pull (the page asks for state each `requestAnimationFrame`). It ties simulation progress to the page's frame rate and puts a round trip back in the loop. Also rejected: per-frame acknowledgements from the page. They add a message type and a stall state for no benefit while frames are this cheap to drop.

## 5. Hooks in `@simten/ui`

```ts
// @simten/ui/sandbox
export function SandboxProvider(props: { client?: SandboxClient; children: ReactNode }): JSX.Element;
export function useSandboxClient(): SandboxClient;

export function useCompile(source: string | null, options?: UseCompileOptions): UseCompileResult;

export interface UseCompileOptions {
  /** Debounce before recompiling after an edit. The first compile isn't debounced. @default 300 */
  debounceMs?: number;
  /** @default true */
  autoCompile?: boolean;
}

export interface UseCompileResult {
  /** Last successful compile, kept through later failures. */
  compiled: Compiled | null;
  /** Diagnostics from the last compile ([] on success). Same shape as SimtenDiagnostic. */
  diagnostics: CompileDiagnostic[];
  compiling: boolean;
  /** Compile now, skipping the debounce. */
  compile(): Promise<void>;
}

export function useSimulation(
  source: Circuit | { compiled: Compiled; circuit: string | CircuitIR } | null,
  options?: { harness?: boolean; initialInputs?: Record<string, number>; history?: number },
): UseSimulationResult;

export interface UseSimulationResult {
  ready: boolean;
  /** Fatal: the sandbox didn't load, or the circuit failed to open. */
  error: string | null;
  /** Non-fatal: the sandbox restarted this session at cycle 0. */
  notice: string | null;

  circuit: CircuitIR | null;
  definitions: CircuitDefinitions | null;
  isSequential: boolean;

  cycle: number;
  portValues: ReadonlyMap<string, number> | null;
  /** Top-level outputs by name; the harness's displays when harnessed. */
  outputs: Record<string, number>;
  peripheralState: ReadonlyMap<string, PeripheralValue>;

  historyLength: number;
  historyIndex: number;
  isViewingPast: boolean;
  isRunning: boolean;
  speed: number;

  set(values: Record<string, number>): Promise<void>;
  setNode(path: string, value: number | MemoryContents): Promise<void>;
  /** Flip a Switch/Button node between 0 and 1. */
  toggleNode(path: string): Promise<void>;
  tick(count?: number): Promise<void>;
  reset(): Promise<void>;
  stepBack(): Promise<void>;
  stepForward(): Promise<void>;
  seek(index: number): Promise<void>;
  run(speed?: number): Promise<void>;
  pause(): Promise<void>;
  /** Changes the auto-run speed; doesn't start a stopped run. */
  setSpeed(speed: number): void;
  sample(port: string, count: number, inputs?: Record<string, number>): Promise<number[]>;
  scan(path: string, port: string, count: number): Promise<number[]>;

  /** For the inspector and anything else that reads this session directly. */
  session: SessionClient | null;
}
```

`useSimulation` opens a session when `source` changes and closes the old one. For a page-built `Circuit` it sends the IR, library and behavior source text, as `useCircuitSimulator` does now. Harnessing moves into the worker, so the page no longer builds harness definitions itself. The hook subscribes to the session with `useSyncExternalStore`. Action rejections are caught: `failed` goes to `error`, `restarted` goes to `notice`.

Renames from `useCircuitSimulator`, applied at call sites:

| Old | New | Uses |
|---|---|---|
| `cycleCount` | `cycle` | 20 |
| `setNodeValue`, `setNode` | `setNode` (one method; always resolves after the write) | 19 + 13 |
| `tickN(n)` | `tick(n)` | 7 |
| `scanPort` | `scan` | 8 |
| `renderSamples` | `sample` | 2 |
| `sequentialState` | `peripheralState` (it only ever held peripheral-bus nodes) | 10, plus the `CircuitCanvas` prop |
| `startAutoRun(speed)`, `stopAutoRun()` | `run(speed)`, `pause()` | 1 + 1 |
| `history.length` | `historyLength` | 2 |
| `inputs`, `toggleInput`, `getSimulator`, `runCombinational` | removed (unused, or no-ops today) | |

`useCompile` replaces `useCircuitCompiler` and keeps its behavior: debounce, cancel stale compiles, keep the last good result, parse `(line:col)` from errors, and retry once when a compile was collateral damage of a restart (now `code === 'restarted'` instead of matching the string `'Worker restarted'`). It releases the previous compile when a newer one succeeds.

Replaced: `useSandbox`, `useSandboxContext`, `useCircuitCompiler`, `useCompiledCircuit`, `useCircuitSimulator`, `useSimulationSession`, `builtFromIR`.

### Before and after

**Blog demo** (`crc32-in-hardware/sections/CRC32Section.tsx`):

```tsx
// before
import { useCircuitSimulator } from '@simten/embed';
const sim = useCircuitSimulator(CRC32ByteDemo);
const handleStep = useCallback(() => {
  sim.setNodeValue?.('data', byteVal);
  sim.tick();
  setCycleCount((c) => c + 1);
}, [sim, dataInput]);
const v = sim.portValues.get('display.in');

// after
import { useSimulation } from '@simten/ui/sandbox';
const sim = useSimulation(CRC32ByteDemo);
const handleStep = useCallback(() => {
  sim.setNode('data', byteVal);
  sim.tick();
  setCycleCount((c) => c + 1);
}, [sim, dataInput]);
const v = sim.portValues.get('display.in');
```

**Editor** (`EditorWorkspace.tsx`):

```tsx
// before
const compiler = useCircuitCompiler(code, { autoCompile: true, debounceMs: 500, slot: 'editor-main' });
const editorCircuit = useMemo(() => {
  if (!compiler.result || !circuit) return null;
  return builtFromIR(circuit, [...compiler.result.libraryCircuits, ...compiler.result.circuits]);
}, [compiler.result, circuit]);
const sim = useCircuitSimulator(editorCircuit, { autoHarness: false });
const onToggleNode = useCallback((nodeId: string) => {
  const currentValue = simRef.current.portValues?.get(`${nodeId}.out`);
  simRef.current.setNode(nodeId, currentValue ? 0 : 1);
  simRef.current.runCombinational();
}, []);
<ClockControls
  cycle={sim.cycleCount}
  historyLength={sim.history.length}
  onRun={() => sim.startAutoRun(sim.speed || DEFAULT_SPEED)}
  onPause={() => sim.stopAutoRun()}
  onSpeedChange={(speed) => sim.setSpeed(speed)}
  ...
/>

// after
const compiler = useCompile(code, { debounceMs: 500 });
const sim = useSimulation(
  compiler.compiled && circuit ? { compiled: compiler.compiled, circuit } : null,
);
const onToggleNode = useCallback((path: string) => simRef.current.toggleNode(path), []);
<ClockControls
  cycle={sim.cycle}
  historyLength={sim.historyLength}
  onRun={() => sim.run(sim.speed || DEFAULT_SPEED)}
  onPause={() => sim.pause()}
  onSpeedChange={(speed) => sim.setSpeed(speed)}
  ...
/>
```

`compiler.result` becomes `compiler.compiled` in the store-wiring effects and the Verilog export; `compiler.definitions` becomes `compiler.compiled?.definitions`.

**Game level** (`routes/$levelId.tsx`):

```tsx
// before
const sandbox = useSandboxContext();
const preview = useCompiledCircuit(source, { slot: 'preview', select: select as never, autoHarness: true });
// ... preview.compileError, preview.portValues, preview.circuit, preview.definitions
const verdict = await grade(sandboxRuntime(sandbox), level, source);

// after
const sandbox = useSandboxClient();
const compile = useCompile(source);
const target = compile.compiled ? select(compile.compiled.circuits) : undefined;
const preview = useSimulation(
  target && compile.compiled ? { compiled: compile.compiled, circuit: target.name } : null,
  { harness: true },
);
const compileError = compile.diagnostics[0]?.message ?? null;
const verdict = await grade(sandboxRuntime(sandbox), level, source);
```

`sandboxRuntime` becomes:

```ts
export function sandboxRuntime(sandbox: SandboxClient): GradeRuntime {
  let compiled: Compiled | null = null;
  let session: SessionClient | null = null;
  return {
    async compile(source) {
      compiled = await sandbox.compile(source);
      return { circuits: compiled.circuits, libraryCircuits: compiled.libraryCircuits };
    },
    async select(target) {
      await session?.dispose();
      session = await sandbox.open({ compiled: compiled!, circuit: target.name }, { history: 0 });
    },
    async evaluate(inputs, outputs) {
      const s = session!;
      const ports = new Set(s.circuit.inputs.map((p) => p.name));
      for (const [name, value] of Object.entries(inputs)) {
        if (ports.has(name)) await s.set({ [name]: value });
        else await s.setNode(name, value);
      }
      await s.tick();
      return readOutputs(Object.fromEntries(s.getState().ports), outputs);
    },
  };
}
```

`GradeRuntime.select` drops its `library` parameter, since the compile id carries it. The local test runtime in `runtime.test.ts` switches to `createSimulation`, and the port-or-node rule moves into `GradeRuntime` instead of relying on the engine's fallback.

## 6. Screen, UART and keyboard

**Decision: peripheral state is part of every session update, not a separate stream of messages.** Keyboard input is an ordinary `set` or `setNode`.

Why:

- **Time travel.** A peripheral's state is engine state (a RAM behind a screen, a console's text buffer). Stepping back has to rewind the screen with the registers. In the update it rewinds for free; a side stream would need its own history.
- **No tearing.** Frame N's ports and frame N's screen come from the same cycle. Two streams can interleave.
- **It already works this way.** The worker computes `peripheralBusNodes` once per compile and attaches `peripheralState` to every response. This keeps that rule (nodes tagged `meta.synthesizable: false` and nodes wired directly to them) and renames the field.
- **Keyboard is an input.** `useKeyboardInput` in the editor and the Snake demo already write scan codes with `setNode`. A key event message would be a second way to do the same thing.

Cost: a 64x64 framebuffer RAM goes across every frame. At 30 frames a second that's small next to the port map. If the browser bench shows otherwise, the update can carry only peripherals whose state object changed since the last frame (the engine keeps stable references for unchanged state). That is an optimization inside `SessionUpdate`, not a protocol change.

## 7. The inspector and the level drilldown

**Decision: an inspector frame is a view of the session it was opened from, at a dotted instance path.** No sandbox session and no engine of its own.

```ts
export interface InspectorFrame {
  componentName: string;
  componentDef: CircuitIR;
  nodeLabel: string;
  definitions?: CircuitDefinitions;
  /** Dotted instance path in the parent session, e.g. 'dut.ha1'. Absent for a reference build. */
  path?: string;
}

export interface CompositeInspectorDialogProps {
  stack: InspectorFrame[];
  definitions: CircuitDefinitions;
  /** The simulation the canvas is showing. */
  simulation: UseSimulationResult;
  // theme, onClose, onPopLevel, onPushLevel, onNavigate unchanged
}
```

- **Composites.** `InspectorCanvas` reads `scopePortValues(simulation.portValues, frame.path + '.', frame.componentDef)`. That function already exists in `drill-down-view.ts` and nothing calls it. Drilling deeper appends the clicked node's id to the path. Because it's the same session, the inspector shows the same cycle as the canvas behind it, keeps updating while auto-run is on, and its clock controls are the main session's (`simulation.tick`, `run`, `stepBack`...).
- **Writes.** A Switch or Input inside the composite writes `setNode(frame.path + '.' + nodeId)`. A boundary input is writable when the wire feeding the instance in its parent comes from a Switch or Input node; clicking it writes that node. Otherwise it's read-only, because a value driven by logic can't be overridden without breaking the circuit. Today each drill-down has its own copy where every boundary input is a free switch, so this is a visible change: open question 6.
- **Reference builds** (`MADE_OF`: Adder, Subtractor, Incrementer, Mux, Comparator) aren't in the running netlist, so there's no path to read. They're combinational and built only from std, so the inspector evaluates them on the page with `simulate(MADE_OF[name](args))`, driving its inputs from the parent session's ports at the instance path on every update. That's a pure function of values the session already reports, so it can't drift. It runs no user code: `resolveDrillTarget` picks a user's composite over a reference build, and `MADE_OF` contains only std builders bundled with the page. Open question 1.
- `CircuitCanvas` passes its `simulation` prop to its built-in inspector. Its root frame gets `path` from the double-clicked node's id.
- **`LevelDrilldown`** (game map) uses `useCompile(draft)` + `useSimulation(..., { harness: true })`, as the level page does, and seeds the stack with `{ ..., path: 'dut' }`. The harness wraps the level circuit as node `dut`, so its boundary inputs are writable through the harness switches.

Deleted from `CompositeInspectorDialog`: slot ids, `compileIR` of the view circuit, the local-engine fallback (`createEngine` with std behavior), the 200ms auto-run, and its history. About 250 lines.

## 8. Errors, the watchdog and restarts (#51)

The relay and its 5s watchdog stay in the iframe's main thread. What changes is what it remembers and what the page is told.

The relay keeps:
- the last `compile` request per compile id, and
- the `open` request per session id.

**A request hangs** (a `tick`, `set` or `open` that runs user code for 5s): as now, the worker is terminated and a new one started. The stuck request fails with `code: 'timed-out'`; other in-flight requests fail with `code: 'restarted'`.

**A running session goes quiet**: a session in `run` sends a frame at least every `1000 / frameRate` ms. If 5s pass without a frame or a response from the worker while any session is running, the relay restarts the worker the same way. The 80% frame budget means this only happens when a single cycle hangs.

**After the restart**, the relay replays every compile (ids unchanged), then reopens every session at cycle 0 with history cleared and auto-run off. A compile or open that hangs again is dropped, and the relay starts over with a fresh worker, as `replayCompiles` does now. Then it pushes:

```ts
{ type: 'restarted', sessions: ['s-3', 's-7'], dropped: ['s-9'],
  message: 'The simulation stopped responding for 5 seconds and was restarted from cycle 0.' }
```

What the page sees:
- Pending promises reject with `SandboxError` (`code: 'timed-out' | 'restarted'`).
- Each reopened `SessionClient` sets its state to cycle 0, `isRunning: false`, empty history, `status: 'restarted'`, `notice: message`. `useSimulation` shows `notice` as a non-blocking banner, cleared by the next action. No attempt is made to recover history, as #417's comment says.
- A dropped session moves to `status: 'closed'` and `useSimulation` reports `error`.
- `useCompile` retries once after a `restarted` failure, since that compile was collateral damage.

The iframe failing to load is unchanged: after 10s without `ready`, status becomes `unavailable` and every call rejects with `code: 'unavailable'`.

```ts
export class SandboxError extends Error {
  readonly code: 'failed' | 'timed-out' | 'restarted' | 'unavailable' | 'closed';
}
```

## 9. Migration

Each PR keeps main green and deployable. The sandbox accepts old and new messages from PR 4 until PR 7, so web, game and sandbox can deploy in any order during the transition and there's no flag day.

| # | PR | Files | Tests | Click-test | Size (+/-) |
|---|---|---|---|---|---|
| 1 | Rename `apps/sandbox` to `@simten/sandbox-app` | `apps/sandbox/package.json`, `--filter` uses in root `package.json`, `.github/workflows/ci.yml`, `bench/browser.mts`, docs mentioning the filter | root `pnpm test`, CI e2e | none (no runtime change) | +20 / -20 |
| 2 | `Simulation` in core | `simulator/simulation.ts` (new), delete `simulation-session.ts`, `simulate.ts` becomes the factory, `simulator/index.ts`, `src/index.ts`, `src/internal.ts`; delete `ui/canvas/hooks/useSimulationSession.ts`; port `simulate.test.ts`, `session-time-travel.test.ts`, `snapshot-roundtrip.test.ts`, `environmental-time-travel.test.ts`, `mos6502/machine.ts`; move test `setNode` calls to `nodesOf` or `ROM({ memory })`; MCP `reference.ts` text; docs `verifying-circuits`, `mcp-integration`, `known-issues`, `architecture` | root `pnpm test`, `pnpm bench --check` (fingerprints) | none (the browser doesn't use `simulate()`) | +450 / -900 |
| 3 | Exact names | engine `setNode` suffix match removed; `Simulation.get`/`set` throw on unknown names; game `GradeRuntime` resolves port-vs-node; fixes for anything the full suite turns up | root `pnpm test`, `bench --check`, sandbox e2e | every blog post with a demo, the editor's 6502 and RV32I, 3 game levels (an exact-name miss now shows an error instead of a silent 0) | +80 / -40, plus fixes |
| 4 | `@simten/sandbox` | `packages/sandbox/*` (protocol moved from ui, `SandboxClient`, `SessionClient`, `session-host.ts`); `apps/sandbox/src/worker.ts` handles new messages through `SessionHost` alongside the old slot messages; `main.ts` relay remembers sessions and watches running ones; `ui/sandbox/protocol.ts` re-exports from the new package | `session-host.test.ts` (Node: open, set, tick, history, run loop with a fake clock, peripheral updates); `session-client.test.ts` over a `MessageChannel` to an in-process host; extend `apps/sandbox/e2e/watchdog.mts` with a hanging `run` and the `restarted` push; `bench/browser.mts` unchanged | deploy sandbox, then confirm production web and game still work on the old messages | +1,500 / -50 |
| 5 | Hooks, embed and demos | `ui/sandbox/useCompile.ts`, `useSimulation.ts`, `SandboxProvider` over `SandboxClient`; `embed/CircuitViewer.tsx`, `WebComponentEmbed.tsx` (`sharedSandbox()`); the 13 demo call sites; `docs/PipelineVisualizer.tsx`; `CircuitCanvas` `sequentialState` prop renamed `peripheralState`; docs `building-custom-uis`, `code-editor`, `index`, `architecture` | root `pnpm test`; embed e2e (`circuit-embed.spec.ts`); `pnpm bench:browser` against baseline | each blog post with a custom demo: 6502 (run, console), RV32I debugger (load program, step), Snake (keys, framebuffer), Pong, Breakout, CORDIC, TPU, network switches, CRC32, sorting pipeline, synth (audio via `sample`); one `<CircuitEmbed>` combinational and one sequential; a page with 3 `<circuit-embed>` elements | +700 / -350 |
| 6 | Editor, game, inspector | `EditorWorkspace.tsx`; game `routes/$levelId.tsx`, `game/runtime.ts`, `runtime.test.ts`, `LevelDrilldown.tsx`; `CompositeInspectorDialog.tsx`, `CircuitCanvas.tsx`, `canvas/types.ts` (`path` on frames) | root `pnpm test`; `bench:browser` (level load, editor load, step, auto-run) | the three from #417: a combinational level, a sequential level, a CPU level (submit, victory run, step back). Editor: 6502 run, pause, scrub, speed change; drill into a composite while running and see it update; drill into an Adder (reference build); keyboard demo; MCP `show` round trip | +450 / -650 |
| 7 | Delete the old path | `ui/sandbox/useSandbox.ts`, its test, old `protocol.ts` types; `embed/hooks/useCircuitSimulator.ts`, `useCircuitCompiler.ts`, `useCompiledCircuit.ts` and their exports; old slot handlers in `worker.ts` and slot replay in `main.ts`; `normalizePortValues` boolean coercion | root `pnpm test`, both e2e suites, `bench:browser` | deploy sandbox; repeat PR 6's game and editor checks against production | +20 / -2,300 |

Total about +3,200 / -4,300, net about -1,100. The biggest single deletion is `useCircuitSimulator.ts` (847 lines).

#418 follows: `CircuitEmbed` moves to `@simten/ui/embed` and `@simten/embed` is deprecated. This design keeps `CircuitEmbed` and the web component in `embed` so the two issues don't collide; PR 5 only changes what they import.

### Measuring speed

`pnpm bench:browser` already measures `auto-run (6502)` and `auto-run (rv32i)` in ticks/s and fps, `step (6502)` in ms, and level and editor load times, against `bench/browser-baseline.json`. Every PR from 4 on runs it, and PRs 5 to 7 must not regress any number beyond run-to-run noise (5 runs, as the script does).

Both auto-run baselines read 10,091 ticks/s, which suggests the bench measures at a requested speed rather than at the engine's limit. PR 4 adds an `auto-run (rv32i), max ticks/s` entry that requests a speed well above what the engine can reach, so the worker-side loop is measured against the old page-driven one at full throttle. It also logs the size of one `updated` frame for RV32I, so we know the per-frame payload before deciding whether the peripheral delta from section 6 is needed.

`pnpm bench --check` runs in PRs 2 and 3. It times the engine directly, so it proves the engine's results didn't change; `Simulation` doesn't touch the engine except for removing the suffix match in PR 3.

## 10. Risks and expected pushback

**"Pushing frames without acknowledgements will flood the page."** The page does one structured-clone decode and a reference swap per frame and renders at most once per animation frame. At 30 frames a second that's well under the page's budget even for RV32I's port map. The bench's fps number would show it. If it does, the fallback is an acknowledgement per frame, which only touches `session-host.ts` and `SessionClient`.

**"The whole port map every frame is wasteful."** It's what every response carries today. The inspector needs internal ports, so they have to cross somehow. If the frame-size measurement in PR 4 is large, send only changed entries; the engine knows which ports changed per tick (`resetChangeFlags`). That's a change inside `SessionUpdate`.

**"Removing `run`, `stop`, `watch`, `watchPort` and `tickN` breaks the public API."** It's pre-1.0, and decision 0003 freezes `circuit`, `bit`, `bus`, std names and import paths, not `simulate()`'s members. The MCP reference never documented them. `tickN` and `setNode` are the only ones with real use; `tick(n)` and `nodesOf` cover them. The changelog lists each.

**"Throwing on unknown names will break things that work today."** That's the purpose: today a typo reads 0, which passes any check that expects 0 (the game's `runtime.ts` comment describes exactly that bug). It's isolated in PR 3 so it can be reverted alone, and the full suite plus the click-test list is the gate.

**"Lazy settling changes `simulate()` results."** Clocked results don't change: `tick` propagates from the inputs as it does now. Only a read between `set` and `tick` on a sequential circuit changes, from a stale value to the settled one, which is what the canvas already shows. Open question 2.

**"Why not keep history on the page and only move auto-run?"** Then snapshots live in the worker and their ids on the page, which is the split that needs `prune-snapshots` and leaks. History is sync code over engine snapshots; it belongs next to the engine.

**"Why not run page-built blog circuits locally and skip the sandbox?"** It would split the runtime in two again, and decision 0001 says the page never runs user code. The embed and blog share `CircuitViewer`, and the embed runs share-link source.

**"Behavior still crosses as source text for page-built circuits."** True, and unchanged: `BehaviorSource` stays for `{ circuit: Circuit }` sessions, and std behavior whose text matches keeps its closure, as now. Removing it would mean blog demos compile from source text. Open question 4.

**"The inspector's boundary inputs become read-only."** Only where logic drives them. The old behavior made the inspector's state disagree with the canvas behind it, which is the bug #417 asks to fix.

**"A single batch could still run 5s."** Only if one cycle takes 5s, which is a hang, and restarting is the right response.

**"A worker restart loses everyone's history, not just the culprit's."** Same as today. Recovering history across a terminated worker would need snapshots copied out of the worker continuously, which costs more than it saves for something that happens on infinite loops.

**Memory.** 200 history entries of RV32I state per session is today's cost. A page with many sequential embeds now shares one iframe, so all their histories sit in one worker; each embed's history was already in one worker per iframe. `history` is per session, so a page can lower it.

## Open questions

1. **Reference builds in the inspector:** evaluate on the page with `simulate()` (std only, combinational, driven from the parent's ports), as proposed, or open a second sandbox session for them? The proposal avoids a second session lifecycle; the alternative keeps "nothing simulates on the page" absolute.
2. **Lazy settling in `simulate()`:** accept that `get` after `set` on a sequential circuit returns the settled value instead of the stale one?
3. **`setNodeValue` becomes `setNode`:** #417 lists `setNodeValue` among names to keep. The proposal merges it into `setNode` to match core and `SessionClient` (19 call-site renames). Keep the old name instead?
4. **Page-built circuits:** keep sending behavior as source text (proposed), or move blog demos to compile from source text so `BehaviorSource` can be deleted?
5. **History length:** 200 for sandbox sessions (today's embed cap) and off by default for `simulate()`, as proposed? Core's session uses 1000 today.
6. **Inspector boundary inputs:** writable only when fed by a Switch or Input in the parent, read-only otherwise, as proposed?
7. **`sharedSandbox()`:** one iframe for every `<circuit-embed>` on a page. Any reason an embedding site would want them isolated?
