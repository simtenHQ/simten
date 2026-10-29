# 0010. The public surface: data, input and output in the library; presentation in the apps

**Status:** Proposed. Lands before the first release after #418.

## Context

After #417 and #418 the packages are `@simten/core`, `@simten/sandbox`, `@simten/react` and `@simten/mcp`. Their insides are clean, but what they export grew one piece at a time:

- Five React components show a circuit: `CircuitCanvas`, `SimulationView`, `CircuitViewer`, `CircuitEmbed` and `EmbedCard`. Each wraps the one before it. `CircuitCanvas` takes 21 props, and about eight of them (circuit, definitions, port values, peripheral state and the callbacks) are the same values every caller copies from a simulation by hand. `SimulationView` and `CircuitViewer` exist only to do that copying.
- `CircuitEmbed` is the blog's card: a title bar, sizing and a Fork button that opens simten.dev. That's the look of one site, not something a library user needs.
- `@simten/react` has 14 entry points. Some are generic UI widgets only our apps use (`./primitives/*`), some are app features (`./share`, the share links and their Cloudflare KV store), and some are canvas internals (`./nodes`, plus layout and drill-down helpers exported from `./canvas`).
- `circuit`, `bit` and `bus` can be imported from both `@simten/core` and `@simten/core/circuit`.

Nothing has been released since these grew, so this is the cheapest time to change them. The release after #418 already asks every user to change their imports.

## Decision

**The library gives you data, input and output. Apps arrange them.**

- **One canvas takes a simulation.** `<CircuitCanvas simulation={sim} />` draws any running circuit. It shows its own loading and error states, and clicking a switch calls the simulation's actions. A `path` prop shows part of a simulation, which is how drill-down works. The editor, the game, the inspector, the blog demos and the embed page all use it. `SimulationView` and `CircuitViewer` are deleted.
- **`ClockControls` takes the same simulation and renders nothing for a circuit without a clock.** It stays a separate component because the editor and the game put it in their own toolbars. Render it next to the canvas and it does the right thing for any circuit.
- **`WaveformViewer` takes the same simulation.** It's the second way to look at a run, signals over time, not a second way to draw the circuit.
- **`CodeEditor` is the input.** It's Monaco with Simten's autocomplete and error markers, and it knows nothing about simulations. Its entry is `@simten/react/code-editor` (renamed from `./monaco`), kept separate so the canvas never pulls in Monaco. Wiring it up is two lines: `useSimulation({ source })`, and `diagnostics` from `compileError`.
- **Cards are app code.** The blog's card and Fork button move to `apps/web`, and the embed page's card to `apps/embed-page`. `CircuitEmbed` and `EmbedCard` leave the library. The zero-code way to show a circuit on any page is the iframe embed.
- **The canvas's internals aren't exported.** The node components, layout, drill-down helpers and the inspector dialog are how `CircuitCanvas` works. Today the game's level map and drill-down reach into them (`NODE_TYPES`, `CompositeInspectorDialog`, `useDetectTheme`). They move onto `CircuitCanvas` and its `path` prop, so nothing new becomes public.
- **A private, unpublished workspace package holds what the apps share:** the UI primitives, share links and their store, the Fork button, `ErrorBoundary` and `CompositeBadge`.
- **One import for authoring.** `circuit`, `bit` and `bus` come from `@simten/core` only, and `@simten/core/circuit` is removed. This supersedes the line of 0003 that froze that path. That freeze protected saved circuits, but the browser never resolved the path: `stripImports` removes import lines before code runs, and the sandbox injects the names. What it did protect was the editor's type checking of old drafts, so the code editor keeps `@simten/core/circuit` as an alias. Node projects that run circuit files with `tsx` change one import in the release. `@simten/core/std` stays: it's the component library, a different thing.
- **Sandboxes are isolated unless grouped.** Without a provider, each `useSimulation` gets its own sandbox. `<SandboxProvider>` groups everything under it into one sandbox, which is what simten.dev does at its root. This is the model of Sandpack, the closest comparable library: each instance is isolated, a provider groups instances that belong together, and cost is managed by starting lazily, not by sharing a runtime between unrelated embeds. It keeps 0009's choice of one sandbox per embed. Measured: _pending_.
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
| `@simten/sandbox/protocol`, `/host` | the message types, the worker side |
| `@simten/react` | `useSimulation`, `SandboxProvider`, `useSandboxClient`, `CircuitCanvas`, `ClockControls`, `WaveformViewer` |
| `@simten/react/code-editor` | `CodeEditor` |
| `@simten/react/styles.css` | the stylesheet |
| `@simten/mcp` | the `simten-mcp` server, `./schemas` |

## Rejected

- **Keeping `CircuitEmbed` as a preset.** It's one site's card in a library, and every new need would become another prop. It had 18, and 8 of them were unused.
- **Building `ClockControls` into the canvas.** The editor and the game place them elsewhere, which would need a switch to turn them off plus a separate component: two ways.
- **Keeping `@simten/core/circuit` and dropping the root re-export instead.** Then a script that builds and simulates needs two imports, and the path we'd keep only mattered to the editor, which an alias covers.
- **Sharing one sandbox by default.** It saves memory, but one thread runs every circuit on the page and a hang restarts them all. Sandpack chose isolation by default for the same reasons.
- **Publishing the UI primitives and share code.** Only our apps use them, and publishing them would make every change to a button a release concern.

## What would change it

A real need to style nodes differently would add a deliberate way to customise how nodes are drawn, not re-export the node components. Users asking for a ready-made card would get a documented recipe first, and a component only if the recipe proves too much. If a page with many circuits measures slow to start, sandboxes would start only when their circuit scrolls into view, as Sandpack's `initMode` does.
