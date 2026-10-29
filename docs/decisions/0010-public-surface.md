# 0010. The public surface: data, input and output in the library; presentation in the apps

**Status:** Accepted. Lands before the first release after #418.

## Context

After #417 and #418 the packages are `@simten/core`, `@simten/sandbox`, `@simten/react` and `@simten/mcp`. Their insides are clean, but what they export grew one piece at a time:

- Five React components show a circuit: `CircuitCanvas`, `SimulationView`, `CircuitViewer`, `CircuitEmbed` and `EmbedCard`. Each wraps the one before it. `CircuitCanvas` takes 21 props, and about eight of them (circuit, definitions, port values, peripheral state and the callbacks) are the same values every caller copies from a simulation by hand. `SimulationView` and `CircuitViewer` exist only to do that copying.
- `CircuitEmbed` is the blog's card: a title bar, sizing and a Fork button that opens simten.dev. That's the look of one site, not something a library user needs.
- `@simten/react` has 14 entry points. Some are generic UI widgets only our apps use (`./primitives/*`), some are app features (`./share`, the share links and their Cloudflare KV store), and some are canvas internals (`./nodes`, plus layout and drill-down helpers exported from `./canvas`).
- `circuit`, `bit` and `bus` can be imported from both `@simten/core` and `@simten/core/circuit`.

Nothing has been released since these grew, so this is the cheapest time to change them. The release after #418 already asks every user to change their imports.

## Decision

**The library gives you data, input and output. Apps arrange them.**

- **One canvas takes a simulation.** `<CircuitCanvas simulation={sim} />` draws any running circuit. It shows its own loading and error states, and clicking a switch calls the simulation's actions. Drill-down is built in: double-clicking a composite opens its insides as a live view of the same simulation, with breadcrumbs, so callers pass nothing for it. The editor, the game, the blog demos and the embed page all use it. `SimulationView` and `CircuitViewer` are deleted.
- **`ClockControls` takes the same simulation and renders nothing for a circuit without a clock.** It stays a separate component because the editor and the game put it in their own toolbars. Render it next to the canvas and it does the right thing for any circuit.
- **`WaveformViewer` takes the same simulation.** It's the second way to look at a run, signals over time, not a second way to draw the circuit.
- **`CodeEditor` is the input.** It's Monaco with Simten's autocomplete and error markers, and it knows nothing about simulations. Its entry is `@simten/react/code-editor` (renamed from `./monaco`), kept separate so the canvas never pulls in Monaco. Wiring it up is two lines: `useSimulation({ source })`, and `diagnostics` from `compileError`.
- **Cards are app code.** The blog's card and Fork button move to `apps/web`, and the embed page's card to `apps/embed-page`. `CircuitEmbed` and `EmbedCard` leave the library. The zero-code way to show a circuit on any page is the iframe embed.
- **`useSimulation` returns `{ state, actions }` and takes only how the simulation starts.**
  - Options: `initialInputs` (where the switches sit at power-on, which `reset` returns to), `memory` (contents by node path, so a new program is a new run) and `history` (entries kept, 0 for none).
  - `state` is what the simulation is doing now: `outputs` by name, `portValues`, `cycle`, `isRunning`, `speed`, `ready`, `error`, `compileError` and `history`.
  - `actions` is what you can tell it to do:
    - inputs: `set({ a: 1, d: 0 })` for anything a person at the board could change, and `toggle(name)` to flip one 1-bit input or switch;
    - the clock: `tick(n)`, `run(speed)`, `pause()`, `reset()`;
    - history: `stepBack()`, `stepForward()`, `seek(i)`;
    - bulk reads that save round trips: `scan`, which takes an input name or a control path, and `sample`;
    - `exportVerilog()` and `recompile()`.
  - Removed from today's hook: the `harness`, `speed` and `debounceMs` options, `setSpeed`, and `client` in the result. They were UI behaviour or duplicates. Harnessing is always on inside the hook, and `set` and `outputs` work by name either way. `run(speed)` is the one way to set a speed. The debounce is fixed at 50 ms after the first compile, which is immediate. `useSandboxClient` covers what `client` did.
  - **One `set` for ports and controls.** Today `set` takes a circuit's input port names and `setInput`/`setInputs` take the paths of Switch and `Input` components inside it. To a user both are the circuit's inputs: on the d-latch level, `d` and `en` are switches, not ports. So `set` takes either, and every key must resolve exactly:
    - an input port name sets that port;
    - the path of a Switch or `Input` component sets that component;
    - anything else (a register, a memory, a gate) is rejected, which keeps 0009's rule that the page only changes what a person at the board could;
    - a key that matches a port and a different component is an error, not a guess.

    Every key in one call is written before the circuit settles, so `set({ d: 0, en: 0 })` grades the d-latch as #521 does. `scan` takes the same keys. `setInput` and `setInputs` go. A harness's switches are named after the ports they drive, so `a` means the same thing harnessed or not.
  - **The same words in core.** `simulate(top)` gets the same `set`, so a testbench drives a level's switches with `sim.set({ d: 0, en: 0 })` instead of `nodesOf(sim).set` from `@simten/core/internal`. It also gets `simulate(top, { memory })`, the same option as `useSimulation`, for loading a program before cycle 0. The words then match across core, `SimulationClient`, the hook and the MCP's `inputs`: `set` and `memory` to start a run; `tick`, `run`, `reset` and `stepBack` to move it. Core's `read()` and the hook's `state.outputs` are the same thing in two shapes, because core is synchronous and the hook has to deliver changing state to React. Core needs no cleanup, while a sandbox holds a worker until it's closed.
  - **Types follow the circuit when there is one.** `Circuit<Ins, Outs, Nodes>` carries its port names and, at type level only, its node types. So `useSimulation(DLatchLevel)` types `set` and `toggle` keys as the input ports plus the top-level Switch and `Input` nodes, and `state.outputs` by the output ports. A typo is a compile error. Nested paths such as `dut.kbd` are typed too if walking the node types recursively stays cheap for the type checker on the largest circuits (RV32I); otherwise nested keys are plain strings. With source text (`useSimulation({ source })`) the circuit only exists after the sandbox compiles it, so keys are strings checked at runtime with exact names.
  - The harness still shows in one place: `portValues` uses the harness's paths, so an output `sum` appears as the path of the light it drives. Users read `outputs`. `portValues` is for the canvas and tooling. The fix is for the canvas to draw a circuit's own ports as controls and indicators itself, so there's no harness at all (#531). That changes no public API apart from those paths, so it can come after the release.
- **The canvas's internals aren't exported.** The node components, layout, drill-down helpers and the inspector dialog are how `CircuitCanvas` works. Today the game's level drill-down reaches into them (`CompositeInspectorDialog`, `InspectorFrame`, `useDetectTheme`) to show a level's circuit from the map. It renders a `CircuitCanvas` of that circuit in its own dialog instead, and the canvas's built-in drill-down handles anything nested, so nothing new becomes public. The level map's `NODE_TYPES` are the game's own and aren't affected.
- **A private, unpublished workspace package holds what the apps share:** the UI primitives, share links and their store, the Fork button, `ErrorBoundary` and `CompositeBadge`.
- **One import for authoring.** `circuit`, `bit` and `bus` come from `@simten/core` only, and `@simten/core/circuit` is removed. This supersedes the line of 0003 that froze that path. That freeze protected saved circuits, but the browser never resolved the path: `stripImports` removes import lines before code runs, and the sandbox injects the names. What it did protect was the editor's type checking of old drafts, so the code editor keeps `@simten/core/circuit` as an alias. Node projects that run circuit files with `tsx` change one import in the release. `@simten/core/std` stays: it's the component library, a different thing.
- **Circuits on a page share one sandbox by default, with no setup.** The first `useSimulation` on a page creates a page-wide sandbox, and every later one reuses it. A page with no circuits creates nothing. The sandbox is only created in the browser.
  - Measured on an M1 Pro against a production build of the sandbox, served locally (medians of 5 runs):

    | | 1 circuit | 10 circuits, 10 sandboxes | 10 circuits, 1 sandbox |
    |---|---|---|---|
    | Time until every circuit shows values | 155 ms | 607 ms | 155 ms |
    | Renderer memory | 94 MB | 210 MB | 100 MB |

    Each extra sandbox costs about 50 ms and 12 MB, before network latency, while an extra session in a shared sandbox costs under 1 MB. The first sandbox costs about 42 MB, nearly all of it the separate process Chromium gives a cross-origin frame. That's the price of the isolation in 0001 and 0008, and sharing doesn't change it.
  - Separate sandboxes do run on separate cores. Two RV32I computers auto-running at full speed reached 35.3k ticks/s in total in separate sandboxes, against 18.4k in one, where each got half. That only matters when several heavy circuits run at once, which is rare. Most pages show several small circuits.
- **`SandboxProvider` is optional, for when you want to choose the sandbox.** The nearest provider above a `useSimulation` wins.
  - `<SandboxProvider client={client}>` uses a given client. Tests use it to run every component inside against an in-process sandbox. A site that can't frame `simtenusercontent.dev` uses it to point at its own sandbox (`new SandboxClient({ origin })`, hosted with `@simten/sandbox/host`).
  - `<SandboxProvider>` with no client gives its subtree a sandbox of its own: a heavy demo gets its own core, and a hang there doesn't restart the rest of the page.
  - It's context, not an option on `useSimulation`, because it has to reach hooks inside components you don't control, such as a component under test. The getting-started docs don't mention it. simten.dev and the game drop their root providers, because the default does the same thing.
- **This refines 0009 for circuits inside one React app.** 0009 rejected one sandbox shared by every embed on a page, because of cross-talk and shared failure between independent embeds. Independent embeds on other sites are now iframes from Share → Embed, each a separate page with its own sandbox, so that rule still holds for them. Inside one app, the circuits belong to one developer, and the measurement favours sharing.
- **The message format is internal.** Users get a client, a host gets `@simten/sandbox/host`, and tests get `inProcessSandbox()` from `/host`, a client wired to a host in the same process. Nothing outside the package handles raw messages, so the protocol can change without breaking anyone. `@simten/sandbox/protocol` stays exported only until the release, because the sandbox app's legacy slot handlers need its types, and it goes in the same change that deletes them.
- **Everything else that's exported has a stated reason:**
  - `@simten/core/internal`, `/bundle` and `/editor-globals` are published because Simten's other packages need them at runtime. They carry no stability promise.
  - `@simten/core/examples` is published because the MCP's `get_started` serves it.
  - `@simten/sandbox/host` is the worker side of the sandbox. It's published so the client can be tested in-process and a sandbox can be hosted elsewhere.
  - `useSandboxClient` stays, for React code that compiles without simulating.
  - One stylesheet, `styles.css`, carries the theme as CSS variables.

The surface after this:

| Import | Exports |
|---|---|
| `@simten/core` | `circuit`, `bit`, `bus`, `simulate`, `Simulation`, types |
| `@simten/core/std` | the standard components |
| `@simten/core/verify`, `/verilog`, `/examples` | testbenches, Verilog export and import, example circuits |
| `@simten/sandbox` | `SandboxClient`, `SimulationClient`, `SandboxError` |
| `@simten/sandbox/host` | the worker side (`SessionHost`, `createRelay`) and `inProcessSandbox()` for tests |
| `@simten/react` | `useSimulation`, `SandboxProvider`, `useSandboxClient`, `CircuitCanvas`, `ClockControls`, `WaveformViewer` |
| `@simten/react/code-editor` | `CodeEditor` |
| `@simten/react/styles.css` | the stylesheet |
| `@simten/mcp` | the `simten-mcp` server, `./schemas` |

## Rejected

- **Keeping `CircuitEmbed` as a preset.** It's one site's card in a library, and every new need would become another prop. It had 18, and 8 of them were unused.
- **A second verb for switches** (`setInput`, or a rename such as `setControl`). It made users learn whether an input is a port or a switch component, which only matters to Simten. 0009 kept names and paths apart so the protocol is never ambiguous. Exact resolution, with ambiguity as an error, keeps that guarantee behind one method.
- **Building `ClockControls` into the canvas.** The editor and the game place them elsewhere, which would need a switch to turn them off plus a separate component: two ways.
- **Keeping `@simten/core/circuit` and dropping the root re-export instead.** Then a script that builds and simulates needs two imports, and the path we'd keep only mattered to the editor, which an alias covers.
- **A sandbox per circuit unless a provider groups them.** This is Sandpack's model, and it was this record's first draft. Measured, it costs every page that skips the provider 50 ms and 12 MB per circuit, and the people who skip it are the ones who don't know it exists. Sandpack pages usually hold one or two heavy playgrounds. Ours usually hold many small circuits.
- **Starting sandboxes only when their circuit scrolls into view, instead of sharing.** It speeds up the first screen but still pays per sandbox as the reader scrolls, with a startup delay each time. It helps a shared sandbox too, by not compiling circuits nobody has looked at, so it's a later optimisation on top of sharing, not an alternative (#530).
- **Publishing the UI primitives and share code.** Only our apps use them, and publishing them would make every change to a button a release concern.

## What would change it

A real need to style nodes differently would add a deliberate way to customise how nodes are drawn, not re-export the node components. Users asking for a ready-made card would get a documented recipe first, and a component only if the recipe proves too much. If pages commonly ran several heavy circuits at once, the default would move back towards a sandbox each, for the parallelism. If a page with many circuits measures slow to start even with sharing, circuits would compile only when they scroll into view (#530).
