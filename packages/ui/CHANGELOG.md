# @simten/ui

## 0.11.1

### Patch Changes

- bf55fff: Make port labels legible. `showPortLabels` rendered them at 9px, which is small enough that the name a beginner is hunting for does not register as text. Now 11px, which stays inside the padding the labels already reserve.
- 221b9a8: Keep the Monaco model that shadows a planted lib in step with it. `addExtraLib` registers a virtual file, but the first hover or quick fix on a lib makes Monaco materialise it as a model at the same URI, which then shadows the lib for every later update. Consumers that vary the globals at runtime — handing out a different set of components per screen — got the set frozen at whichever one was open when the first hover happened, and any component added afterwards reported "Cannot find name". Writing through the model also revalidates open files, so a stale marker clears immediately rather than on the next keystroke.

## 0.11.0

### Minor Changes

- 047b33c: Report a sandbox that never loads instead of hanging forever. Requests made before the iframe's ready handshake used to queue indefinitely if the handshake never arrived, so a blocked or unreachable sandbox left every promise unsettled and the canvas frozen with no error. `useSandbox` now gives up after 10s, fails everything waiting with a real error, and exposes a `status` of `loading | ready | unavailable`. `useCircuitSimulator` surfaces that through `SimulatorState.error`, so `CircuitViewer` shows a message rather than an empty canvas.

### Patch Changes

- 047b33c: Re-apply Monaco IntelliSense when `SimtenCodeEditor`'s `intellisense` prop changes. It was only applied in `beforeMount`, which fires once, so a consumer that varies the available globals at runtime kept the set from first mount until a full page reload.

## 0.10.0

### Minor Changes

- 1b36d7b: Add `buildGlobalsFor(names)` — an ambient-globals shim carrying only the named components

  `SIMTEN_CORE_GLOBALS` declares every stdlib component at once, which is right
  for an open editor and wrong for a teaching context that hands components out
  gradually. `buildGlobalsFor(['Nand', 'Switch', 'Led'])` returns the same shim
  with only those, JSDoc intact, for use via `setupSimtenIntellisense`'s
  `extraLibs`:

  ```ts
  setupSimtenIntellisense(monaco, {
    globals: false,
    extraLibs: { "file:///simten-globals.d.ts": buildGlobalsFor(allowed) },
  });
  ```

  A component left out does not autocomplete and does not typecheck, rather than
  being offered and then rejected downstream.

  It filters the existing generated blob rather than adding a second generated
  artifact, because a second file crossing package boundaries is what previously
  let Monaco report errors on valid code after `@simten/core` was rebuilt alone.
  `knownGlobalNames()` and a drift test pin the parse against the generator's
  format, so a change there fails loudly instead of silently dropping components.

  Also shrinks what Monaco holds: a three-component subset is ~4KB against ~52KB
  for the full shim.

### Patch Changes

- 1db85ac: Fix wire colour across composite boundaries on the canvas

  A wire running between two composite components rendered as undefined — grey
  rather than green — even while the simulation carried a 1 along it. Elaboration
  and simulation were correct throughout; only the styling was wrong.

  Edges are projected from the _unelaborated_ circuit, where a composite is one
  node with ports. `portValues` comes from the _flattened_ netlist, where that
  boundary has been dissolved: a `HalfAdder` named `h1` contributes `h1.x1.out`
  and `h1.a1.out`, and no `h1.carry` at all. The lookup tried the connection's
  source and then its target, so a wire touching a primitive still resolved on
  that side — which is why only _some_ composite wires looked dead, and why the
  bug was easy to miss.

  `resolvePortValue` now walks inward when a port is not in the flat map: for an
  output, it follows the internal connection that drives it; for an input, one it
  feeds; and it repeats until the path reaches something the map knows about. The
  path prefix is rebuilt as it descends (`m1` → `m1.i1` → `m1.i1.g`), which
  reconstructs exactly the naming the simulator produces, so arbitrary nesting
  depth resolves — verified against a real three-level elaboration.

  Strictly additive: the direct key is tried first, so every lookup that already
  worked takes the identical path.

- Updated dependencies [68f48a1]
  - @simten/core@0.15.0

## 0.9.0

### Minor Changes

- 15e044c: Add `@simten/ui/primitives/dialog` — the shadcn Dialog wrapper.

  Built on `@radix-ui/react-dialog`, which `Sheet` already depends on, so this adds no new dependency; a Sheet is a Dialog pinned to an edge. Use `Dialog` when the content is a moment with one obvious next action, and `Sheet` when it is a surface the page keeps working behind.

## 0.8.0

### Minor Changes

- abf0bc1: Export `@simten/ui/primitives/sheet`, and let it render without the dimming backdrop.

  `SheetContent` always rendered `SheetOverlay`, which is `fixed inset-0 bg-black/50` — so it swallowed every click on the page regardless of whether the sheet was modal. That made `<Sheet modal={false}>` useless in practice: Radix stops trapping focus, but the backdrop still blocks the page underneath.

  `showOverlay={false}` turns it off, which is what a non-modal sheet actually needs. Defaults to `true`, so existing usage is unchanged.

  The primitive is also now exported as a subpath, alongside `tooltip` and `resizable`. `apps/web` had been carrying a byte-identical copy of it.

## 0.7.1

### Patch Changes

- Updated dependencies [10994f0]
  - @simten/core@0.14.0

## 0.7.0

### Minor Changes

- bc69e2a: Add `autoLayout` to `CircuitCanvas`, for canvases where nobody drags nodes.

  The layout engine only re-runs when nodes are added or removed. That is right for the editor — people drag nodes there, and a rename should leave them where they were — but the check keys on node ids alone, so adding a _wire_ between two existing nodes counts as no change at all. The nodes stay in a layout computed before that wire existed, and the new edge takes a long detour to reach a node that should have moved.

  A read-only canvas has no hand-placed positions worth keeping. `autoLayout` re-runs the layout on every structural change, so the diagram always reflects the circuit as it is now.

  Defaults to `false`; the editor's behaviour is unchanged.

## 0.6.0

### Minor Changes

- 7146f9b: Ship the design tokens the components already depend on, as `@simten/ui/styles/theme.css`.

  Every component in this package is written with `bg-card`, `border-border`, `text-muted-foreground` and friends, but nothing in the package defined those custom properties — so a consumer had to reverse-engineer and hand-author the whole palette or the components rendered unstyled. The stylesheet now ships alongside them:

  ```css
  @import "tailwindcss";
  @import "@simten/ui/styles/theme.css";
  @source "../node_modules/@simten/ui/dist";
  ```

  The `@source` line matters: Tailwind v4 does not scan dependencies, so without it the utility classes the components reference are never emitted and nodes render with no width or padding.

  This does not remove the Tailwind requirement — an app without Tailwind still cannot consume these components from source. `@simten/embed` solves that by compiling its CSS at build time and shipping the result; this package should grow the same, and that is tracked separately.

  Also adds `@simten/ui/primitives/resizable`, the shadcn wrapper over `react-resizable-panels`, which was previously copy-pasted per app.

### Patch Changes

- 7146f9b: Fix multiple sandboxes on one page answering each other's requests.

  Every `<circuit-embed>` mounts its own `SandboxProvider`, so a page with several embeds has several sandbox iframes — and they all `postMessage` to the same parent window, which every `useSandbox` instance listens on. Request ids came from a per-instance counter, so each sandbox's first request was `sb-1`, and `handleMessage` resolved any pending request whose id matched without checking which iframe the message came from.

  The result: the first circuit to compile resolved the pending request in _every_ sandbox on the page. Three embeds in a blog post all rendered the first circuit, and an embed containing invalid code rendered a circuit instead of an error.

  Two changes, either of which would fix it:

  - `handleMessage` ignores messages whose `event.source` is not its own iframe. This is the real fix, and it also means another frame cannot feed a sandbox forged responses.
  - Request ids come from a module-scoped counter, so they are unique per page rather than per instance.

  Does not affect `simten.dev`: `CircuitEmbed` is given an already-built circuit there and never calls `sandbox.compile`, and `useCircuitSimulator` already derived a unique simulation slot per instance. This only reached consumers of the `<circuit-embed>` web component.

- Updated dependencies [7146f9b]
  - @simten/core@0.13.2

## 0.5.1

### Patch Changes

- 62d6d17: Give port labels room when `showPortLabels` is on. The labels render inside the node, and on a two-input gate — roughly 88px wide — a symbol plus `a`, `b` and `out` did not fit: the side labels sat against the border and `out` overlapped the gate symbol. Node content now takes wider horizontal padding while labels are shown, and the default spacing is unchanged when they are not.

## 0.5.0

### Minor Changes

- 6081386: **Breaking: `Switch` is no longer a factory — write `Switch`, not `Switch()`.**

  Its options parameter was never used. The config ignored `_opts` entirely; the `value` a switch holds arrives at runtime through `node.arguments`, set by the canvas or by `autoHarness`. The factory form existed only to declare an option that nothing read, at the cost of empty parentheses at every use — and next to `And`, `Led` and `Or`, which take none, the rule was "memorise which components happen to be parameterised".

  `Input({ value })` stays a factory, because there the argument does real work — it's how a circuit ships with a starting value. So the rule is now the useful one: parentheses mean you are passing something.

  **Breaking: `Button` is removed.**

  Its documentation promised momentary behaviour — "outputs 1 only while held down, 0 otherwise" — that was never implemented. Its `eval` was character-for-character identical to `Switch`, it had no entry in the canvas node-type map so it rendered _as_ a Switch, no pointer handling existed anywhere in the UI package, and no circuit in the repository used it. A component whose described behaviour cannot be observed is worse than no component: a reset built on it latches instead of pulsing, in a way the docs say is impossible.

  `Switch` covers the same ground. If momentary input is wanted later it should arrive with a renderer that implements it.

  Migration is mechanical: `Switch()` → `Switch`, and `Button` → `Switch`.

### Patch Changes

- Updated dependencies [6081386]
  - @simten/core@0.13.0

## 0.4.0

### Minor Changes

- 5aa06b2: Scaffold snippets for circuit source in the Monaco editor. Typing `circuit` expands the composite skeleton with the circuit name as a linked edit and node names propagating into the `connect` destructure; `circuit-primitive` and `circuit-sequential` cover the `eval` and `state`/`onTick` shapes. Registered automatically by `setupSimtenIntellisense` (disable with `snippets: false`), or directly via the new `registerSimtenSnippets` export. `SIMTEN_SNIPPETS` exposes the definitions.

  Handles and edges stay aligned when a circuit's ports change. Handles sit at a percentage of node height, so adding a port moves every handle on that node — but they animated to their new positions, and React Flow measures handle bounds once, immediately after the DOM updates. It caught them mid-animation and never re-measured, leaving edges routed to coordinates the handles had already left. Handle position is no longer transitioned.

  Nodes no longer overlap when a circuit gains or loses one. Surviving nodes kept positions from the previous layout while new nodes took the current one, so an added node could land exactly on top of an existing one and hide it. Positions now refresh when nodes are purely added or removed; a rename does both, so it still preserves positions. The viewport also refits in that case, since the diagram's extent changes.

### Patch Changes

- Updated dependencies [5aa06b2]
  - @simten/core@0.12.0

## 0.3.5

### Patch Changes

- Updated dependencies [28ae7b0]
  - @simten/core@0.11.0

## 0.3.4

### Patch Changes

- Updated dependencies [cbbd9c3]
  - @simten/core@0.10.0

## 0.3.3

### Patch Changes

- 38dd123: Fix wide (≥31-bit) editor inputs being stuck at 0. The input nodes clamped values to `(1 << Math.min(width, 31)) - 1`, but JavaScript's `<<` is signed 32-bit: `1 << 31` is negative, so `maxValue` went negative and `Math.min(maxValue, value)` forced every entered value to 0. A 32-bit input (e.g. an imported ALU's operands) could never be set to anything but 0, while narrow inputs worked. Now uses `2 ** Math.min(width, 32) - 1`, allowing the full unsigned range up to 2^32-1.
- Updated dependencies [acb4871]
  - @simten/core@0.9.1

## 0.3.2

### Patch Changes

- Updated dependencies [eb6f6cd]
  - @simten/core@0.9.0

## 0.3.1

### Patch Changes

- Updated dependencies [10d77f9]
  - @simten/core@0.8.0

## 0.3.0

### Minor Changes

- 9415cb4: Editor consolidation: the Monaco editor and circuit-compile mechanics that `apps/web` kept in a bespoke component now live in the library.

  **`@simten/ui/monaco`** — `SimtenCodeEditor` gains:

  - an imperative `ref` handle (`getEditor` / `getMonaco` / `getValue` / `setValue`);
  - a monaco-free `diagnostics` prop that renders squiggles (callers never import `monaco-editor` to show errors);
  - `registerSimtenThemes(monaco, { lightBackground? })` plus `SIMTEN_DARK` / `SIMTEN_LIGHT` — the Simten editor themes, previously inlined per-app.

  **`@simten/embed`** — two new hooks:

  - `useCircuitCompiler(source, opts)` — the compile bridge (debounce, `sandbox.compile`, worker-restart retry, error line/col extraction, `library` lookup, keep-last-good, stale-compile cancellation) with no opinion about what to do with the result;
  - `useCompiledCircuit(source, opts)` — source → live simulation, composing `useCircuitCompiler` with `builtFromIR` + `useCircuitSimulator`.

  **Breaking: drops React 18 support.** Both packages now require React 19 (peer narrowed to `^19`). `forwardRef` is gone in favour of React 19's ref-as-prop across all components. Everything on React 19 is unaffected; React 18 consumers should stay on the previous version.

### Patch Changes

- 36ed723: Depend on sibling `@simten/*` packages with a caret range rather than an exact version.

  The workspace deps were declared `workspace:*`, which pnpm rewrites to the **exact** version at publish time — so e.g. published `@simten/embed@0.1.15` pinned `@simten/ui` to exactly `0.1.14`. When a consumer bumped `@simten/ui` ahead (to get a new feature) but kept an older `@simten/embed`, the exact pin forced pnpm to install **two** copies of `@simten/ui`. Two copies don't share module identity, so objects minted by one (a sim from `useCircuitSimulator`) weren't recognized by the other (`CircuitCanvas`), silently breaking rendering.

  Switching to `workspace:^` publishes a caret range, letting a single compatible copy satisfy both packages. No behavior change for anyone already on matching versions.

## 0.2.0

### Minor Changes

- d1888f6: Add `@simten/ui/monaco` — Monaco editor IntelliSense for circuit source.

  Gives typed completions and hovers for the Simten stdlib, plus automatic type acquisition so third-party imports (`react`, `zod`, …) resolve to real types rather than `any`.

  ```bash
  pnpm add @simten/ui @monaco-editor/react
  ```

  ```tsx
  import { SimtenCodeEditor } from "@simten/ui/monaco";

  <SimtenCodeEditor value={source} onChange={setSource} />;
  ```

  Two layers are exported:

  - `SimtenCodeEditor` — Monaco, pre-wired. The default choice.
  - `setupSimtenIntellisense` / `useTypeAcquisition` — headless primitives for consumers that own their own Monaco instance, such as a collaborative editor with a Yjs binding where the source of truth is a `Y.Text` rather than a `value` prop.

  The `@simten/core` type payloads are inlined at build time, so they need no network and work under any bundler. Third-party types are fetched from jsDelivr at runtime by `@typescript/ata`; failures degrade to "no completions", never a broken editor. Pass `typeAcquisition={{ enabled: false }}` to opt out, or `{ typescriptCdn }` to self-host.

  `@monaco-editor/react` and `monaco-editor` are **optional** peer dependencies: only this subpath needs them, so every other `@simten/ui` subpath stays Monaco-free both on disk and in the bundle. Being optional, they are not auto-installed — hence naming `@monaco-editor/react` explicitly in the install command above (`monaco-editor` follows as a peer of it). Existing consumers are unaffected.

  Also corrects the README, which documented `@simten/ui/editor` as exporting an `EditorWorkspace` (it exports simulator state capture/restore helpers) and `@simten/ui/editor/hooks` as providing `useCircuitSimulator` (that entry point is empty; the hook lives in `@simten/embed`).

## 0.1.14

### Patch Changes

- Updated dependencies [40194ac]
  - @simten/core@0.7.0

## 0.1.13

### Patch Changes

- Updated dependencies [2c3a92c]
  - @simten/core@0.6.1

## 0.1.12

### Patch Changes

- Updated dependencies [b441bf9]
  - @simten/core@0.6.0

## 0.1.11

### Patch Changes

- Updated dependencies [d271692]
  - @simten/core@0.5.2

## 0.1.10

### Patch Changes

- 6cb2f13: Expose the shadcn tooltip via a new `@simten/ui/primitives/tooltip` export, and add `cursor-pointer` to the `Button` base so all buttons show the pointer on hover (disabled ones excluded).

## 0.1.9

### Patch Changes

- 62597a1: ClockControls: add optional `pulseRun` prop that pulses the Run button as a first-run hint (used by the editor's empty-state onboarding; off by default for embeds).
- Updated dependencies [62597a1]
  - @simten/core@0.5.1

## 0.1.8

### Patch Changes

- Updated dependencies [dcddcf0]
  - @simten/core@0.5.0

## 0.1.7

### Patch Changes

- b32514c: IMEM node code templates define `main()` instead of `_start()` (the compiler links a crt0 that provides `_start`; the old templates failed with a duplicate-symbol link error). Default simulation speed raised from 5 to 15 ticks/s in the embed viewer.
- Updated dependencies [b32514c]
- Updated dependencies [b32514c]
- Updated dependencies [b32514c]
  - @simten/core@0.4.0

## 0.1.6

### Patch Changes

- Updated dependencies [d51b424]
  - @simten/core@0.3.0

## 0.1.5

### Patch Changes

- Updated dependencies [e87c2a5]
  - @simten/core@0.2.4

## 0.1.4

### Patch Changes

- 3e4aaeb: chore(packaging): declare `engines.node: ">=20"` on all four packages and expose `./package.json` via `exports`

  Two small packaging-hygiene fixes:

  - **Consistent `engines.node`**: `core` and `mcp` already declared `node >=20`; `ui` and `embed` omitted the field. Added it for parity — package managers now warn consistently across all four packages when a consumer is on an older Node.
  - **`./package.json` is now an explicit subpath export**: previously `require('@simten/<pkg>/package.json')` threw `ERR_PACKAGE_PATH_NOT_EXPORTED`, which trips up bundler plugins, version probes, and a few SDK auto-detection tools. Adding `"./package.json": "./package.json"` to each `publishConfig.exports` is the conventional fix.

- 3e4aaeb: build: inline `.ts` source content into sourcemaps (`tsconfig.compilerOptions.inlineSources: true`)

  Previously each `.js.map` referenced `../src/**/*.ts` files that aren't in the published tarball, and `sourcesContent` was empty — so consumers' debuggers could never resolve to actual source. The maps were dead weight. Adding `inlineSources` embeds the source text directly in each map. Tarballs grow ~50% but debuggers now work end-to-end: consumers can step into `@simten/*` code with real line numbers and identifiers.

- Updated dependencies [3e4aaeb]
- Updated dependencies [3e4aaeb]
  - @simten/core@0.2.3

## 0.1.3

### Patch Changes

- Updated dependencies [c7c5e67]
  - @simten/core@0.2.2

## 0.1.2

### Patch Changes

- Updated dependencies [2649b7c]
  - @simten/core@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @simten/core@0.2.0
