# Design: the simulation runtime (#417)

**Status:** Two rounds of questions answered on #493 (see Decisions at the end); one proposal (`setInput`) is waiting for an answer. Not yet implemented.
**Issue:** #417. Follow-up: #418 (embed folds into ui).
**Packages after both issues:** `core`, `sandbox`, `ui`, `mcp`. React only in `ui`.

## Summary

- `simulate()` returns one type, `Simulation`, which replaces `SimulationHandle` and `SimulationSession`. It is synchronous, has no timers, and owns history. Ports are public and typed; access to internal nodes by dotted path lives in `@simten/core/internal`.
- New package `@simten/sandbox`, no React: the protocol, `SandboxClient` (one iframe, many sessions) and `SessionClient` (an async mirror of `Simulation`).
- The sandbox worker holds a `Simulation` per session and runs the auto-run loop itself, pushing state to the page at display rate. The page keeps no history and no timers.
- Two hooks in `@simten/ui`, `useCompile` and `useSimulation`, replace six hooks and one helper. Return shapes stay close to today's.
- The sandbox takes source text only. Page-built demos pass their circuits module's text (`import src from './circuits.ts?raw'`) and a circuit name; `compile-ir`, behavior sent as `fn.toString()` text and the worker's `new Function` rebuild are removed. Closures in user factories work because the code runs where it was written.
- Verilog export runs in the sandbox too (`export` request), so the editor's Export button exports the same way headless and in the browser.
- Every simulation runs in the sandbox; nothing simulates on the page. That lets the engine leave the page bundle later (#419).
- The drill-down inspector reads the main session by dotted path. Gate-level reference builds, which aren't in the running netlist, get a second session in the same shared iframe, fed with the parent's input values.
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
- Page-built circuits (blog, docs, `<CircuitEmbed>`) reach the worker as IR plus each primitive's `eval`/`onTick` as `fn.toString()` text, which the worker rebuilds with `new Function`. That drops the closure: an `eval` that reads a factory option has nothing to read. The worker works around it by keeping its own closure when the text matches one it already has (`sameSource`, `addBehaviorSources`), and std components built with the config form carry their shape in `node.arguments` through `withArgs` for the same reason. It also contradicts decision 0001: source is canonical, and the page shouldn't be shipping code.
- The editor's Verilog export runs on the page with std behavior only (`stdBehaviorsFor`), because the page has no user behavior. A user primitive exports as unsupported in the browser but not headless.

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

`SessionClient` (section 3) does have `setNode(path)`, and that's deliberate. Its callers are the canvas and keyboard input, which set nodes inside the circuit: clicking a Switch writes `a` or `dut.ha1.sw`, and a key press writes a scan code into an Input node. A harnessed circuit has no top-level inputs at all, so ports alone can't drive it. Those callers are UI code in this repo, not users writing against the typed interface, so the method belongs on the client the UI uses and not on `Simulation`.

```ts
// @simten/core/internal, used only by the sandbox's session host
export function timelineOf(simulation: Simulation): SimulationTimeline;

export interface SimulationTimeline {
  /** Tick without recording history. */
  advance(count: number): void;
  /** Record the current state as one history entry. */
  record(): void;
}
```

`tick(n)` is `advance(n)` then `record()`. The host needs the two halves separately to run one request in several slices and still record it as one step (section 4).

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

- **Settling after `set`.** Today `set` settles combinational logic only on combinational circuits; on a sequential circuit `get` after `set` returns the value from before the write until the next `tick`. The sandbox already settles after every write. `Simulation` marks itself dirty on `set` or `nodesOf().set` and settles lazily on the next read (`get`, `read`, `ports()`), so a write followed by `tick` costs nothing extra. Clocked results are unchanged; only a read between `set` and `tick` changes, and it changes to the settled value. This is the one visible behavior change, and it's accepted (decision 2).
- **History records one entry per `tick` call**, so `tick(100)` is one step back, same as `tickN` in the embed today. With `history: 0` (the `simulate()` default) nothing is recorded. Today `simulate()` snapshots the engine on every cycle into a 1000-entry ring buffer that no caller can reach, so this is a speed-up for long verify runs.
- **Environmental state** (Switch/Input positions) rewinds with history through the engine snapshot's `inputs` and `nodeValues`, which already exist. The worker's separate `FullSnapshot.env` capture becomes redundant; `environmental-time-travel.test.ts` is ported to `Simulation` to prove it.

### `ExecuteResult`

`executeCircuitCode` and `executeJsCode` (core's source runner, used by the worker, MCP and tests) return four overlapping views of the same circuits today: `circuit` (the last one, as IR), `circuits` (IR), `exportedCircuits` (IR) and `builtCircuits` (`Circuit`). The new shape:

```ts
export interface ExecuteResult {
  /** Every circuit the source built with `circuit(...)`, in the order it built them. */
  circuits: Circuit[];
  /** Circuits the source exports, defined there or not (`export default FullAdder`). */
  exported: Circuit[];
  /** Definitions and behavior of everything built, dependencies included. Owned by this run. */
  library: MutableLibrary;
  /** Set when the source threw or failed to parse; the lists are then empty. */
  error: string | null;
}
```

- Callers that need IR use `internalsOf(circuit).ir`.
- There is no "main circuit". Today the worker silently simulates the last circuit, which is why the game's grader has to re-select its target. Every caller now names the circuit it wants: sessions open by name, MCP and the bench pick explicitly.
- Callers to update: `apps/sandbox/src/worker.ts` (moves into `session-host.ts`), `packages/mcp/src/lib/compile-source.ts`, `packages/core/bench/workloads.ts`, the local grader in `apps/game/src/game/__tests__/runtime.test.ts`, and 17 test files that call `executeCircuitCode`.

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
  circuits: CircuitIR[];        // circuits the source builds, in order (ExecuteResult.circuits as IR)
  exported: CircuitIR[];        // circuits the source exports (ExecuteResult.exported as IR)
  libraryCircuits: CircuitIR[]; // everything they depend on, std included
  definitions: CircuitDefinitions;
}

/** Source text in, always. A circuit is chosen by the name given to `circuit(...)`. */
export type SessionSource =
  | { compiled: Compiled; circuit: string }
  /** Compiles first (cached by text, so ten embeds of one module compile once), then opens. */
  | { source: string; circuit: string };

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

  /** Verilog for one circuit of a compile, with the compile's own behavior. */
  export(compiled: Compiled, circuit: string, options?: VerilogExportOptions): Promise<ExportResult>;

  /** Remove the iframe and fail everything pending. */
  dispose(): void;
}

/** One client per page unless a caller needs isolation. */
export function sharedSandbox(): SandboxClient;
```

One iframe hosts any number of sessions and compiles, keyed by ids the client generates (unique per page, as request ids are today). The word "slot" goes away.

`sharedSandbox()` means every `<circuit-embed>` on a page shares one iframe instead of mounting one each, as `WebComponentEmbed` does today.

Compiles and sessions are separate because they have different lifetimes: the editor recompiles on every edit and then opens one session against the result; the game compiles once to grade and to preview. A session names the compile it was built from, which replaces `compile-ir`'s "first slot" guess.

### Source text only

The sandbox accepts one kind of input: source text. Nothing the page sends is executable, and nothing executable is rebuilt from text.

**What goes.** `compile-ir`, the `evalSources: Record<string, BehaviorSource>` field and `BehaviorSource` itself, `extractBehaviorSources` in `useCircuitSimulator`, and in the worker `addBehaviorSources`, `sameSource` and the `new Function` rebuild. `withArgs` goes from each of its five call sites (`std/routing.ts` twice, `import/primitives.ts` three times) where it only exists so a rebuilt `eval` can find its shape in `node.arguments`. Each site is checked against the Verilog exporter and eval-synth first, since those read `node.arguments` too; any site they depend on stays, with its comment corrected.

**Page-built circuits.** Blog, docs and learn demos pass their circuits module as text, using Vite's `?raw` import, plus the name of the circuit to show:

```tsx
import circuitsSource from '../circuits.ts?raw';
import type { CRC32ByteDemo } from '../circuits';      // type only: nothing from the module is bundled to run

const { state, actions } = useSimulation({ source: circuitsSource, circuit: 'CRC32ByteDemo' });
```

The sandbox compiles that text exactly as it compiles editor source, so a factory's closure is intact.

Rules for a module passed this way, enforced by a test that compiles every `?raw` circuits module through `executeCircuitCode` in Node (`apps/web/src/__tests__/raw-circuits.test.ts`):
- imports only from `@simten/core/*` (the sandbox resolves those to its own copy) or with `import type`, which `stripTypes` removes. Relative value imports don't resolve in the sandbox: today `building-a-cpu/circuits.ts` imports `FullAdder` from `@/features/splash/circuits`, and modules that import from `../types` must make those imports type-only. Each one is inlined or made type-only in the PR that moves its post.
- builds the named circuit at module level. A circuit that needs runtime data (the 6502 demo builds `Blog6502Computer({ rom })` from a program fetched at runtime) appends a one-line entry to the text: `` `${circuitsSource}\nexport const Program = Blog6502Computer(${JSON.stringify({ rom })});` ``. Arguments are JSON, as `ArgumentValue` already is.

**`<CircuitEmbed>` keeps its typed `layout`.** Today `layout?: HarnessedLayout<C>` is inferred from the `circuit: C` prop, which is the built circuit the embed then runs. The new props separate what runs from what types the layout:

```ts
export interface CircuitEmbedProps<C extends Circuit = Circuit> {
  /** Text of the module that builds the circuit. This is what runs. */
  source: string;
  /** The circuit to show, by the name given to circuit(...). */
  circuit: string;
  /** Node positions. Keys are checked against C's ports and node labels when C is given. */
  layout?: HarnessedLayout<C>;
  // height, aspectRatio, showControls, theme, title, subtitle, description, href, forkSource,
  // focus, showPortLabels, onPortClick, glowUnconnected, autoRunSpeed, initialInputs,
  // onPortValuesChange: unchanged
}
```

```tsx
import fullAdderSource from './circuits.ts?raw';
import type { FullAdder } from './circuits';

<CircuitEmbed<typeof FullAdder>
  source={fullAdderSource}
  circuit="FullAdder"
  layout={{ a: { x: 0, y: 0 }, b: { x: 0, y: 80 }, dut: { x: 200, y: 40 }, sum: { x: 400, y: 0 }, carry: { x: 400, y: 80 } }}
/>
```

`C` is supplied as an explicit type argument from a type-only import, so the layout keys are checked at compile time and the circuit module isn't bundled as code. Without a type argument `layout` is `Record<string, Position>`, as for the web component today. A name the compile doesn't contain shows an error listing the names it does contain. Fork keeps opening the selected circuit through `circuitToSource` of its compiled IR unless `forkSource` is given; sending a whole multi-circuit module to the editor would open the wrong circuit.

**Call sites that change.**

| What | Files | Count |
|---|---|---|
| `<CircuitEmbed circuit={X}>` becomes `source` + `circuit="X"` | `apps/web/src/features/blog` (57 uses in 48 files), `features/learn` (13 in 11), `features/docs` (8 in 4, including `examples.mdx`), `features/splash/ClaudeDemoSection.tsx` (2), `routes/index.tsx` (3), and the docs pages under `apps/web/content/docs` (20 in 5: `index`, `building-custom-uis`, `examples`, `how-it-works`, `architecture`) | 103 in 70 files, by grep |
| `useCircuitSimulator(X)` becomes `useSimulation({ source, circuit })` | the 13 demo call sites in section 1 | 13 |
| `buildFromIR` for display | `docs/PipelineVisualizer.tsx` | 1 |
| `CircuitViewer` internals | `embed/src/CircuitViewer.tsx`, `CircuitEmbed.tsx` (props), `webcomponent/WebComponentEmbed.tsx` (already passes text; drops its own compile) | 3 |
| a string sample that mentions the prop | `apps/web/src/__tests__/doc-samples.test.ts` (2 uses), `packages/core/src/source/circuit-to-source.ts` (comment) | 2 files |
| circuits modules made self-contained | each `circuits.ts` with a relative value import (found by the new test) | about 15 |

**Test first.** Before any of this, a test records how a user factory with a closure behaves through `<CircuitEmbed>` today, so the change is measured, not assumed. In `packages/embed/e2e/circuit-embed.spec.ts`:

```ts
const Scale = circuit('Scale', (opts: { k: number }) => ({
  inputs: { a: bus(8) }, outputs: { out: bus(8) },
  eval: ({ a }) => ({ out: (a * opts.k) & 0xff }),       // reads the factory's closure
}));
// mount <CircuitEmbed circuit={Scale({ k: 3 })} />, set a = 2, read out
```

Expected today: `out` is wrong (the rebuilt `eval` has no `opts`), or the compile throws. Whatever it shows is written into the test as today's result, and the PR that moves `<CircuitEmbed>` to source text flips the assertion to `out === 6`.

### Verilog export

```ts
// request
{ id, type: 'export', compile: CompileId, circuit: string, options?: VerilogExportOptions }
// response
{ id, type: 'exported', result: ExportResult }   // { verilog, files, unsupported }
```

The worker calls `exportVerilogFromIR(ir, compile.library, options)` with the compile's own behavior, which is what `exportVerilog` does headless. The editor's Export button calls `sandbox.export(compiled, selectedName)` and keeps its handling of `unsupported` and the sidecar `.hex` downloads. `stdBehaviorsFor` and the page's import of `exportVerilogFromIR` go away, so a user primitive exports the same in the browser as in `tsx`, and the page no longer needs core's exporter (#419). Export is sliced like any other request only if it needs to be; it doesn't tick, so it's subject to the watchdog like a compile.

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
| `nodesOf(sim).set` (internal) | `setNode` | switch toggles on the canvas and keyboard input write nodes inside the circuit, and a harnessed circuit has no top-level inputs to `set`. See section 2 |
| `snapshot`, `restore` | none | engine state can't cross the boundary, and the UI uses history instead |
| none | `run`, `pause`, `sample`, `scan` | loops that must run next to the engine |
| none | `getState`, `subscribe` | a remote mirror needs change notification; fits `useSyncExternalStore` |

Requests to one session are applied in the order they're sent (one postMessage channel, one worker, and a per-session queue in the host), so `setNode(...)` then `tick()` without awaiting the first is safe, as `CRC32Section` relies on today. Requests to different sessions don't wait for each other beyond one slice (section 4).

Promises reject with `SandboxError` (section 8) instead of resolving to `T | SandboxError` unions.

## 4. Protocol

Repo convention: request types are verbs, response types are past tense, kebab-case.

### Page → iframe

Every request carries `id: string`.

| Request | Fields | Response |
|---|---|---|
| `compile` | `compile: CompileId`, `source` | `compiled` |
| `release` | `compile` | `released` |
| `open` | `session`, `compile`, `circuit: string`, `harness?`, `initialInputs?`, `history` | `opened` |
| `export` | `compile`, `circuit: string`, `options?` | `exported` |
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
| `compiled` | `id`, `compile`, `circuits`, `exported`, `libraryCircuits` |
| `exported` | `id`, `result: ExportResult` |
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

Iframe ↔ worker messages are the same types, plus one the relay keeps to itself: `progressed` (`id`), which the worker sends at most once a second while a sliced request is still running. The relay uses it to re-arm the watchdog and doesn't forward it. Everything else is forwarded both ways unchanged, as now.

### Removed

`compile-ir` and any IR or behavior text going into the sandbox (`open` takes a compile id and a name; `BehaviorSource` is deleted), `tick-n` (`tick` with `count`), `render-samples` (`sample`), `scan-port` (`scan`), `snapshot`, `restore`, `prune-snapshots` (history is in the worker), `dispose` (`close`), every `slot` field, and the `error` response (`failed`). `SandboxResult`, `CompileIRResult`, `TickResult`, `ResetResult`, `SetNodeResult`, `SnapshotResult`, `RestoreResult` go with them. Per decision 0003 there's no support for the old protocol once the last page using it is redeployed.

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
    timeline.advance(n);                    // timelineOf(sim)
    timeline.record();                      // one history entry per frame
    msPerCycle = 0.8 * msPerCycle + 0.2 * ((performance.now() - start) / n);
    owed -= n;
  }
  if (owed > speed / frameRate) owed = 0;   // fell behind: drop the debt, don't queue it (today's skip rule)
  post({ type: 'updated', session, state: update(sim) });
  timer = setTimeout(frame, Math.max(0, nextDeadline() - performance.now()));
}
```

- The worker posts one `updated` per frame, whether or not the page has drawn the last one. The page's `SessionClient` keeps only the latest state and notifies subscribers; React batches the renders. Handling a message is a structured-clone decode and a reference swap, so frames don't back up.
- Each frame runs as many cycles as the running estimate says fit in about 80% of the frame period. A frame can't run long enough to trip the watchdog unless a cycle hangs, and `pause` is handled within one frame.
- The loop doesn't wait for the page between batches, so throughput is bounded by the engine, not by round trips. Today's loop is a page `setInterval` that sends `tick-n` and waits for the reply.
- History records one entry per frame, matching today's batch-boundary history.

### Large `tick` requests

A `tick` with a large `count` (the 6502 demo asks for thousands per request) is sliced the same way, so one session can't hold the worker while others wait:

```ts
// session-host.ts
async function tick(session: HostSession, count: number) {
  let left = count;
  while (left > 0) {
    const n = Math.min(left, session.affordable());   // same estimate as auto-run: ~80% of a frame
    session.timeline.advance(n);
    left -= n;
    if (left > 0) await yieldToOtherWork();           // setTimeout(0): lets other sessions' requests in
  }
  session.timeline.record();                          // the whole request is one history step
}
```

- Requests for one session wait in that session's queue until the slice loop finishes, so order within a session is kept.
- Requests for other sessions run between slices, so a long `tick` on one session delays another session's response by about one frame.
- `sample` is sliced the same way. `scan` doesn't tick and its `count` is small (64 for Snake), so it runs in one go.
- The worker sends `progressed` at most once a second during a sliced request, so the watchdog (section 8) measures whether the worker is responsive, not how long a request takes. A `tick(10_000_000)` that takes 20s is allowed; a single cycle that hangs for 5s is not.

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
  source: SessionSource | null,   // { source, circuit } or { compiled, circuit }
  options?: { harness?: boolean; initialInputs?: Record<string, number>; history?: number },
): UseSimulationResult;

export interface UseSimulationResult {
  /** What the circuit is doing now. Changes every update. */
  state: SimulationViewState;
  /** Where the history cursor is. */
  history: { length: number; index: number; isViewingPast: boolean };
  /** Stable for the life of the session, so they're safe in dependency arrays and canvas callbacks. */
  actions: SimulationActions;
  /** For the inspector and anything else that reads this session directly. */
  session: SessionClient | null;
}

export interface SimulationViewState {
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

  isRunning: boolean;
  speed: number;
}

export interface SimulationActions {
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
}
```

`useSimulation` opens a session when `source` changes and closes the old one. Given `{ source, circuit }` it compiles first (cached by text), so a demo is one line. Harnessing moves into the worker, so the page no longer builds harness definitions itself. The hook subscribes to the session with `useSyncExternalStore`. Action rejections are caught: `failed` goes to `state.error`, `restarted` goes to `state.notice`.

The return is grouped so what changes every frame is separate from what never changes. `actions` keeps one identity for the session's life, which removes the `simRef` workaround in `EditorWorkspace` (it exists so canvas callbacks don't change on every tick). Call sites destructure what they need: `const { state, actions } = useSimulation(...)`.

Mapping from `useCircuitSimulator`, applied at call sites:

| Old | New | Uses |
|---|---|---|
| `ready`, `error`, `circuit`, `definitions`, `isSequential`, `portValues`, `outputs`, `isRunning`, `speed` | `state.` + same name | 49, 14, 20, 5, 2, 40, 6, 2, 2 |
| `cycleCount` | `state.cycle` | 20 |
| `sequentialState` | `state.peripheralState` (it only ever held peripheral-bus nodes) | 10, plus the `CircuitCanvas` prop |
| `history.length`, `historyIndex`, `isViewingPast` | `history.length`, `history.index`, `history.isViewingPast` | 2, 1, 1 |
| `setNodeValue`, `setNode` | `actions.setNode` (one method; always resolves after the write) | 19 + 13 |
| `tick`, `tickN(n)` | `actions.tick()`, `actions.tick(n)` | 27 + 7 |
| `scanPort` | `actions.scan` | 8 |
| `renderSamples` | `actions.sample` | 2 |
| `startAutoRun(speed)`, `stopAutoRun()` | `actions.run(speed)`, `actions.pause()` | 1 + 1 |
| `toggleNode`, `reset`, `stepBack`, `stepForward`, `seek`, `setSpeed` | `actions.` + same name | |
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
import circuitsSource from '../circuits.ts?raw';
const { state, actions } = useSimulation({ source: circuitsSource, circuit: 'CRC32ByteDemo' });
const handleStep = useCallback(() => {
  actions.setNode('data', byteVal);
  actions.tick();
  setCycleCount((c) => c + 1);
}, [actions, dataInput]);
const v = state.portValues.get('display.in');
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
const { state, history, actions } = useSimulation(
  compiler.compiled && selected ? { compiled: compiler.compiled, circuit: selected.name } : null,
  { harness: true },   // the store's canvas circuit is autoHarness(selected); the worker builds it now
);
const sandbox = useSandboxClient();
const handleExportVerilog = useCallback(async () => {
  if (!compiler.compiled || !selected) return;
  const { verilog, files, unsupported } = await sandbox.export(compiler.compiled, selected.name);
  // unchanged: refuse on `unsupported`, download the .v and each sidecar file
}, [sandbox, compiler.compiled, selected]);
// actions is stable for the session's life, so simRef is no longer needed
const onToggleNode = actions.toggleNode;
<ClockControls
  cycle={state.cycle}
  historyLength={history.length}
  historyIndex={history.index}
  isViewingPast={history.isViewingPast}
  onRun={() => actions.run(state.speed || DEFAULT_SPEED)}
  onPause={actions.pause}
  onSpeedChange={actions.setSpeed}
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
const victory = useVictoryRun(level.vectors, preview.setNodeValue, preview.tick);
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
// ... preview.state.portValues, preview.state.circuit, preview.state.definitions
const victory = useVictoryRun(level.vectors, preview.actions.setNode, preview.actions.tick);
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

**Decision: an inspector frame is a view of the session it was opened from, at a dotted instance path.** A composite gets no session and no engine of its own. A reference build, which isn't in the running netlist, gets a second session in the same shared iframe. Every simulation runs in the sandbox; nothing simulates on the page.

```ts
export interface InspectorFrame {
  componentName: string;
  componentDef: CircuitIR;
  nodeLabel: string;
  definitions?: CircuitDefinitions;
  /** Dotted instance path in the session the frame was opened from, e.g. 'dut.ha1'. */
  path: string;
}

export interface CompositeInspectorDialogProps {
  stack: InspectorFrame[];
  definitions: CircuitDefinitions;
  /** The simulation the canvas is showing. */
  simulation: UseSimulationResult;
  // theme, onClose, onPopLevel, onPushLevel, onNavigate unchanged
}
```

- **Composites.** `InspectorCanvas` reads `scopePortValues(simulation.state.portValues, frame.path + '.', frame.componentDef)`. That function already exists in `drill-down-view.ts` and nothing calls it. Drilling deeper appends the clicked node's id to the path. Because it's the same session, the inspector shows the same cycle as the canvas behind it, keeps updating while auto-run is on, and its clock controls are the main session's (`simulation.actions.tick`, `run`, `stepBack`...).
- **Writes.** A Switch or Input inside the composite writes `setNode(frame.path + '.' + nodeId)`. A boundary input is writable when the wire feeding the instance in its parent comes from a Switch or Input node; clicking it writes that node. Otherwise it's read-only, because a value driven by logic can't be overridden without breaking the circuit. Today each drill-down has its own copy where every boundary input is a free switch, so this is a visible change, and it's accepted (decision 6).
- **Reference builds** (`MADE_OF`: Adder, Subtractor, Incrementer, Mux, Comparator) aren't in the running netlist, so there's no path to read. The inspector opens a second session for the build in the same shared iframe, from generated source text (below), and feeds it the parent's input values: on every parent update it reads the instance's input ports from the parent's `portValues` at `frame.path` and calls `set` on the reference session with any that changed. The builds are combinational, so the reference session's outputs are a function of those inputs and can't drift from the parent. Its clock controls are hidden. The session closes when the frame is popped. A frame opened inside a reference build gets a `path` in the reference session, so nested drilling works the same way.
  ```ts
  const source = `import { MADE_OF } from '@simten/core/std';
  export default MADE_OF[${JSON.stringify(name)}](${JSON.stringify(args)});`;
  const reference = await sandbox.open({ source, circuit: name }, { history: 0 });
  ```
- **Why a session and not `simulate()` on the page.** Every simulation runs in the sandbox, with no exceptions to explain. That keeps the rule from decision 0001 absolute, and it means the page never calls the engine, so the engine can later leave the page bundle (#419). The cost is one `set` round trip per parent update while a reference frame is open, inside the same iframe.
- `CircuitCanvas` passes its `simulation` prop to its built-in inspector. Its root frame gets `path` from the double-clicked node's id.
- **`LevelDrilldown`** (game map) uses `useCompile(draft)` + `useSimulation(..., { harness: true })`, as the level page does, and seeds the stack with `{ ..., path: 'dut' }`. The harness wraps the level circuit as node `dut`, so its boundary inputs are writable through the harness switches.

Deleted from `CompositeInspectorDialog`: slot ids, `compileIR` of the view circuit, the local-engine fallback (`createEngine` with std behavior, the last place the page simulates anything), the 200ms auto-run, and its history. About 250 lines, against about 40 added for the reference session.

## 8. Errors, the watchdog and restarts (#51)

The relay and its 5s watchdog stay in the iframe's main thread. What changes is what it remembers and what the page is told.

The relay keeps:
- the last `compile` request per compile id, and
- the `open` request per session id.

**The rule:** the watchdog measures whether the worker is responsive, not how long a request takes. While the worker owes a response or a running session owes frames, the relay expects some message from it at least every 5s: a response, an `updated` frame, or a `progressed` heartbeat from a sliced `tick` or `sample` (section 4). Five seconds of silence means a single cycle, or a compile, is stuck in user code.

**On silence**, as now, the worker is terminated and a new one started. The oldest in-flight request fails with `code: 'timed-out'`; other in-flight requests fail with `code: 'restarted'`. If nothing was in flight (a session was auto-running), every running session is treated as the cause. Slicing means a legitimate `tick(10_000_000)` that takes 20s keeps the watchdog quiet, which it doesn't today.

**After the restart**, the relay replays every compile (ids unchanged), then reopens every session, reference sessions included, at cycle 0 with history cleared and auto-run off. A compile or open that hangs again is dropped, and the relay starts over with a fresh worker, as `replayCompiles` does now. Then it pushes:

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

Each PR keeps main green and deployable. The sandbox accepts old and new messages from PR 6 until PR 10, so web, game and sandbox can deploy in any order during the transition and there's no flag day.

| # | PR | Files | Tests | Click-test | Size (+/-) |
|---|---|---|---|---|---|
| 1 | Test: a factory closure through `<CircuitEmbed>` | `packages/embed/e2e/circuit-embed.spec.ts` (the `Scale` case in section 3), asserting whatever happens today | embed e2e | none | +40 / -0 |
| 2 | Rename `apps/sandbox` to `@simten/sandbox-app` | `apps/sandbox/package.json`, `--filter` uses in root `package.json`, `.github/workflows/ci.yml`, `bench/browser.mts`, docs mentioning the filter | root `pnpm test`, CI e2e | none (no runtime change) | +20 / -20 |
| 3 | `ExecuteResult` shape | `core/src/source/execute.ts`; callers `apps/sandbox/src/worker.ts`, `mcp/src/lib/compile-source.ts`, `core/bench/workloads.ts`, `game/__tests__/runtime.test.ts`, 17 tests | root `pnpm test`, `bench --check` | editor compile, one game level (the worker picks its circuit explicitly now, behavior unchanged) | +120 / -110 |
| 4 | `Simulation` in core | `simulator/simulation.ts` (new), delete `simulation-session.ts`, `simulate.ts` becomes the factory, `simulator/index.ts`, `src/index.ts`, `src/internal.ts`; delete `ui/canvas/hooks/useSimulationSession.ts`; port `simulate.test.ts`, `session-time-travel.test.ts`, `snapshot-roundtrip.test.ts`, `environmental-time-travel.test.ts`, `mos6502/machine.ts`; move test `setNode` calls to `nodesOf` or `ROM({ memory })`; MCP `reference.ts` text; docs `verifying-circuits`, `mcp-integration`, `known-issues`, `architecture` | root `pnpm test`, `pnpm bench --check` (fingerprints) | none (the browser doesn't use `simulate()`) | +450 / -900 |
| 5 | Exact names | engine `setNode` suffix match removed; `Simulation.get`/`set` throw on unknown names; game `GradeRuntime` resolves port-vs-node; fixes for anything the full suite turns up | root `pnpm test`, `bench --check`, sandbox e2e | every blog post with a demo, the editor's 6502 and RV32I, 3 game levels (an exact-name miss now shows an error instead of a silent 0) | +80 / -40, plus fixes |
| 6 | `@simten/sandbox` | `packages/sandbox/*` (protocol moved from ui, `SandboxClient`, `SessionClient`, `session-host.ts` with `compile`, `open` by name, `export`, compile cache by text); `apps/sandbox/src/worker.ts` handles new messages through `SessionHost` alongside the old slot messages; `main.ts` relay remembers sessions and watches running ones; `ui/sandbox/protocol.ts` re-exports from the new package | `session-host.test.ts` (Node: open, set, tick, history, run loop with a fake clock, peripheral updates, a large `tick` split into slices and recorded as one history step, `export` matching headless `exportVerilog` for a user primitive); `session-client.test.ts` over a `MessageChannel` to an in-process host. Required cases: interleaved `set`/`tick` on two sessions each end in their own state; a long `tick` on one session delays another session's response by no more than a frame or two; request, compile and session ids are unique across sessions and across several `SandboxClient`s on one page; a restart replays every compile and session and rejects every pending request. Extend `apps/sandbox/e2e/watchdog.mts` with a hanging `run`, a 20s sliced `tick` that must not trip the watchdog, and the `restarted` push; `bench/browser.mts` unchanged | deploy sandbox, then confirm production web and game still work on the old messages | +1,550 / -50 |
| 7 | Hooks and embed | `ui/sandbox/useCompile.ts`, `useSimulation.ts`, `SandboxProvider` over `SandboxClient`; `embed/CircuitEmbed.tsx` (`source` + `circuit` name + typed `layout`), `CircuitViewer.tsx`, `WebComponentEmbed.tsx` (`sharedSandbox()`); `CircuitCanvas` `sequentialState` prop renamed `peripheralState`; PR 1's test flips to the correct result | root `pnpm test`; embed e2e; a type test (`expectTypeOf`) that a wrong `layout` key fails with `typeof FullAdder` and any key passes without it | the embed's own e2e pages; one combinational and one sequential embed in the web app, ported in this PR as the first two call sites; a page with 3 `<circuit-embed>` elements | +600 / -250 |
| 8 | Demos to source text | the 103 `<CircuitEmbed>` uses and 13 hook call sites in the table in section 3; `docs/PipelineVisualizer.tsx`; circuits modules made self-contained; `raw-circuits.test.ts`; docs `building-custom-uis`, `code-editor`, `index`, `architecture`. Mechanical, so it can be split per post if the diff is too big to review | root `pnpm test` (including `raw-circuits.test.ts` and the MDX build); `pnpm bench:browser` against baseline | every blog and learn post, scrolling each embed and clicking its inputs; the custom demos: 6502 (run, console, load a program), RV32I debugger (load program, step), Snake (keys, framebuffer), Pong, Breakout, CORDIC, TPU, network switches, CRC32, sorting pipeline, synth (audio via `sample`) | +900 / -800 |
| 9 | Editor, game, inspector | `EditorWorkspace.tsx` (session by name with `harness: true`, Export through `sandbox.export`); game `routes/$levelId.tsx`, `game/runtime.ts`, `runtime.test.ts`, `LevelDrilldown.tsx`; `CompositeInspectorDialog.tsx`, `CircuitCanvas.tsx`, `canvas/types.ts` (`path` on frames) | root `pnpm test`; `bench:browser` (level load, editor load, step, auto-run) | the three from #417: a combinational level, a sequential level, a CPU level (submit, victory run, step back). Editor: 6502 run, pause, scrub, speed change; Export on a std design and on one with a user primitive (now exports instead of reporting unsupported); drill into a composite while running and see it update; drill into an Adder (reference build, a second session) and toggle the parent's inputs to see it follow; keyboard demo; MCP `show` round trip | +450 / -700 |
| 10 | Delete the old path | `ui/sandbox/useSandbox.ts`, its test, old `protocol.ts` types and `BehaviorSource`; `embed/hooks/useCircuitSimulator.ts`, `useCircuitCompiler.ts`, `useCompiledCircuit.ts` and their exports; in `worker.ts` the slot handlers, `compile-ir`, `addBehaviorSources`, `sameSource` and the `new Function` rebuild; slot replay in `main.ts`; `withArgs` where it only served the rebuild; `stdBehaviorsFor`; `normalizePortValues` boolean coercion | root `pnpm test`, both e2e suites, `bench:browser` | deploy sandbox; repeat PR 9's game and editor checks against production | +20 / -2,500 |

Total about +4,200 / -5,400, net about -1,200. The biggest single deletion is `useCircuitSimulator.ts` (847 lines). PR 8 is large in lines but each change is the same two-prop edit.

#418 follows: `CircuitEmbed` moves to `@simten/ui/embed` and `@simten/embed` is deprecated. This design keeps `CircuitEmbed` and the web component in `embed` so the two issues don't collide; PR 7 changes their props and what they import, not where they live.

### Measuring speed

`pnpm bench:browser` already measures `auto-run (6502)` and `auto-run (rv32i)` in ticks/s and fps, `step (6502)` in ms, and level and editor load times, against `bench/browser-baseline.json`. Every PR from 6 on runs it, and PRs 7 to 10 must not regress any number beyond run-to-run noise (5 runs, as the script does).

Both auto-run baselines read 10,091 ticks/s, which suggests the bench measures at a requested speed rather than at the engine's limit. PR 6 adds an `auto-run (rv32i), max ticks/s` entry that requests a speed well above what the engine can reach, so the worker-side loop is measured against the old page-driven one at full throttle. It also logs the size of one `updated` frame for RV32I, so we know the per-frame payload before deciding whether the peripheral delta from section 6 is needed.

`pnpm bench --check` runs in PRs 3 to 5. It times the engine directly, so it proves the engine's results didn't change; `Simulation` doesn't touch the engine except for removing the suffix match in PR 5.

## 10. Risks and expected pushback

**"Pushing frames without acknowledgements will flood the page."** The page does one structured-clone decode and a reference swap per frame and renders at most once per animation frame. At 30 frames a second that's well under the page's budget even for RV32I's port map. The bench's fps number would show it. If it does, the fallback is an acknowledgement per frame, which only touches `session-host.ts` and `SessionClient`.

**"The whole port map every frame is wasteful."** It's what every response carries today. The inspector needs internal ports, so they have to cross somehow. If the frame-size measurement in PR 6 is large, send only changed entries; the engine knows which ports changed per tick (`resetChangeFlags`). That's a change inside `SessionUpdate`.

**"Removing `run`, `stop`, `watch`, `watchPort` and `tickN` breaks the public API."** It's pre-1.0, and decision 0003 freezes `circuit`, `bit`, `bus`, std names and import paths, not `simulate()`'s members. The MCP reference never documented them. `tickN` and `setNode` are the only ones with real use; `tick(n)` and `nodesOf` cover them. The changelog lists each.

**"Throwing on unknown names will break things that work today."** That's the purpose: today a typo reads 0, which passes any check that expects 0 (the game's `runtime.ts` comment describes exactly that bug). It's isolated in PR 5 so it can be reverted alone, and the full suite plus the click-test list is the gate.

**"Lazy settling changes `simulate()` results."** Clocked results don't change: `tick` propagates from the inputs as it does now. Only a read between `set` and `tick` on a sequential circuit changes, from a stale value to the settled one, which is what the canvas already shows. Accepted (decision 2).

**"Why not keep history on the page and only move auto-run?"** Then snapshots live in the worker and their ids on the page, which is the split that needs `prune-snapshots` and leaks. History is sync code over engine snapshots; it belongs next to the engine.

**"Why not run page-built blog circuits locally and skip the sandbox?"** It would split the runtime in two again, and decision 0001 says the page never runs user code. The embed and blog share `CircuitViewer`, and the embed runs share-link source.

**"Passing module text is stringly typed: a renamed circuit breaks the embed at runtime, not at build."** `raw-circuits.test.ts` compiles every `?raw` module and checks that each name passed to `<CircuitEmbed circuit=...>` or `useSimulation` exists in it, so a rename fails CI. The layout keys stay type-checked through the type argument.

**"Every embed now compiles its module, which is slower than handing over a built circuit."** The `SandboxClient` caches compiles by source text, so a post with six embeds from one `circuits.ts` compiles once. The bench's level and editor load times cover the compile path; PR 8 adds a blog post with many embeds to `bench/browser.mts` if load time moves.

**"Circuits modules can't import each other any more."** Not relative value imports, no. That is the same rule the editor and share links already live under, and the new test names every module that breaks it. The ones found so far (`building-a-cpu/circuits.ts` importing `FullAdder` from splash) are a few lines to inline.

**"The page still bundles the circuits modules' text."** Text, not code: the modules stop being executed on the page, which is what lets core's builder, engine and exporter leave the page bundle (#419). For most posts the text is smaller than the built code it replaces.

**"A reference build as a second session is heavier than a local `simulate()`."** It's one extra session in an iframe that's already there, opened only while a reference frame is on screen, with history off. In exchange the page never runs the engine, so there's one rule with no exceptions and the engine can leave the page bundle (#419).

**"The inspector's boundary inputs become read-only."** Only where logic drives them. The old behavior made the inspector's state disagree with the canvas behind it, which is the bug #417 asks to fix.

**"A single batch could still run 5s."** Only if one cycle takes 5s, which is a hang, and restarting is the right response.

**"A worker restart loses everyone's history, not just the culprit's."** Same as today. Recovering history across a terminated worker would need snapshots copied out of the worker continuously, which costs more than it saves for something that happens on infinite loops.

**Memory.** 200 history entries of RV32I state per session is today's cost. A page with many sequential embeds now shares one iframe, so all their histories sit in one worker; each embed's history was already in one worker per iframe. `history` is per session, so a page can lower it.

## Decisions

Answered on #493 before implementation.

1. **Reference builds in the inspector run in the sandbox,** as a second session in the shared iframe fed with the parent's input values. Every simulation runs in the sandbox; nothing simulates on the page, so the engine can later leave the page bundle (#419). See section 7.
2. **`get` after `set` on a sequential circuit returns the settled value.** `Simulation` settles lazily on the next read. See section 2.
3. **`setNodeValue` merges into `setNode`.** `setNode(path)` isn't on the public `Simulation` (internal `nodesOf` only). It's on `SessionClient` because the canvas (switch toggles) and keyboard input set nodes inside the circuit. See section 2.
4. **Superseded by decision 8.** The first round kept page-built circuits sending behavior as `fn.toString()` text; the second round removed that path entirely.
5. **History is 200 entries per sandbox session and off by default in `simulate()`.**
6. **Inspector boundary inputs are writable only when a Switch or Input drives them.** See section 7.
7. **One shared iframe per page** (`sharedSandbox()`), so every `<circuit-embed>` uses the same one.

Also decided in the same review: `useSimulation` returns `{ state, history, actions }` plus `session` (section 5), and the worker splits large `tick` requests into frame-sized slices like auto-run (section 4).

Second round, also on #493:

8. **The sandbox takes source text only.** `compile-ir`, `BehaviorSource`, the `new Function` rebuild, `sameSource`/`addBehaviorSources`, and `withArgs` where it only served the rebuild are removed. Blog, docs and `<CircuitEmbed>` pass their circuits module's text (`?raw`) and a circuit name; `<CircuitEmbed>` keeps a typed `layout` through an explicit type argument. A test of a factory closure through `<CircuitEmbed>` lands first to record today's behavior. See section 3.
9. **Verilog export runs in the sandbox** through an `export` request returning `ExportResult`, used by the editor's Export button, so export behaves the same headless and in the browser and the page no longer needs core's exporter (#419). See section 3.
10. **`ExecuteResult` is `{ circuits: Circuit[], exported: Circuit[], library, error }`.** IR comes from `internalsOf`; every caller names the circuit it wants. See section 2.

## Proposed, pending an answer

**`SessionClient.setNode(path, value)` becomes `setInput(path, value)`.** It would accept only input components (Input, Switch, the keyboard's scan-code Input) and throw for anything else, so the public `@simten/sandbox` API can't overwrite a register or memory inside a running circuit. Effects if accepted:

- `useSimulation`'s `actions.setNode` and `toggleNode` become `actions.setInput` and `toggleInput`; canvas toggles, the game's victory run, CRC32, Snake and the keyboard hook already only write inputs.
- Two current uses write something that isn't an input and need another route. The RV32I debugger and the editor's `onLoadMemory` load ROM contents at runtime with `setNodeValue(romId, Map)`: those would rebuild the circuit with contents in its source (`ROM({ memory })` through an appended entry line, as the 6502 demo does) or use a separate, explicit `loadMemory(path, contents)`. `scan` drives a debug address port, which is an Input in every current use (Snake's `scan_addr`).
- `nodesOf(sim).set` in core stays as it is, for tests.

Until this is answered, the rest of the document uses `setNode`.
