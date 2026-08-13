# @simten/embed

## 0.3.7

### Patch Changes

- 047b33c: Report a sandbox that never loads instead of hanging forever. Requests made before the iframe's ready handshake used to queue indefinitely if the handshake never arrived, so a blocked or unreachable sandbox left every promise unsettled and the canvas frozen with no error. `useSandbox` now gives up after 10s, fails everything waiting with a real error, and exposes a `status` of `loading | ready | unavailable`. `useCircuitSimulator` surfaces that through `SimulatorState.error`, so `CircuitViewer` shows a message rather than an empty canvas.
- Updated dependencies [047b33c]
- Updated dependencies [047b33c]
  - @simten/ui@0.11.0

## 0.3.6

### Patch Changes

- Updated dependencies [1db85ac]
- Updated dependencies [1b36d7b]
- Updated dependencies [68f48a1]
  - @simten/ui@0.10.0
  - @simten/core@0.15.0

## 0.3.5

### Patch Changes

- Updated dependencies [15e044c]
  - @simten/ui@0.9.0

## 0.3.4

### Patch Changes

- Updated dependencies [abf0bc1]
  - @simten/ui@0.8.0

## 0.3.3

### Patch Changes

- Updated dependencies [10994f0]
  - @simten/core@0.14.0
  - @simten/ui@0.7.1

## 0.3.2

### Patch Changes

- Updated dependencies [bc69e2a]
  - @simten/ui@0.7.0

## 0.3.1

### Patch Changes

- 7146f9b: Stop the embed stylesheet restyling the page it is embedded in.

  `dist/styles.css` is meant to be dropped into someone else's site with a plain `<link>` tag — that is the point of the `<circuit-embed>` web component. It was built with `@import "tailwindcss"`, which includes Preflight, and Preflight's resets are unscoped. So the shipped stylesheet carried:

  ```css
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-size: inherit;
    font-weight: inherit;
  }
  a {
    color: inherit;
    text-decoration: inherit;
  }
  ```

  Embedding a circuit in a blog post therefore flattened every heading on the page and stripped the colour and underline from every link. The damage lands on the host's article rather than on the embed, so it was invisible to anyone testing the embed on its own.

  Tailwind's theme and utility layers are now imported directly and Preflight's resets are re-applied scoped to `[data-embed-theme]`, the root element both `CircuitViewer` and the web component render. There is no Shadow DOM to fall back on — ReactFlow needs direct DOM access — so the scoping is what provides the isolation.

  Verified in a host page carrying its own `h1` and link styling: both survive untouched, and the embed still renders its nodes and edges with `box-sizing: border-box` intact.

  One thing this does not fix: the utility classes are unprefixed, so a host page that also uses Tailwind will define `.flex` and `.absolute` twice. Values normally match, but a different Tailwind version on the host could disagree.

  Also in this release: `<circuit-embed>` now renders compile failures through the package's `ErrorDisplay`, which carries `role="alert"` and `aria-live`, rather than a bespoke `div` that announced nothing; and each element compiles into its own sandbox slot instead of the shared default.

- Updated dependencies [7146f9b]
- Updated dependencies [7146f9b]
- Updated dependencies [7146f9b]
  - @simten/core@0.13.2
  - @simten/ui@0.6.0

## 0.3.0

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
  - @simten/ui@0.5.0

## 0.2.5

### Patch Changes

- Updated dependencies [5aa06b2]
- Updated dependencies [5aa06b2]
  - @simten/core@0.12.0
  - @simten/ui@0.4.0

## 0.2.4

### Patch Changes

- Updated dependencies [28ae7b0]
  - @simten/core@0.11.0
  - @simten/ui@0.3.5

## 0.2.3

### Patch Changes

- Updated dependencies [cbbd9c3]
  - @simten/core@0.10.0
  - @simten/ui@0.3.4

## 0.2.2

### Patch Changes

- Updated dependencies [eb6f6cd]
  - @simten/core@0.9.0
  - @simten/ui@0.3.2

## 0.2.1

### Patch Changes

- Updated dependencies [10d77f9]
  - @simten/core@0.8.0
  - @simten/ui@0.3.1

## 0.2.0

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

- Updated dependencies [9415cb4]
- Updated dependencies [36ed723]
  - @simten/ui@0.3.0

## 0.1.16

### Patch Changes

- Updated dependencies [d1888f6]
  - @simten/ui@0.2.0

## 0.1.15

### Patch Changes

- 5cfe6b8: `useCircuitSimulator` now waits for the sandbox to be ready before its first `compileIR`. Previously it compiled the moment it received a circuit, so a consumer that mounted a circuit before the sandbox iframe finished loading got a "Sandbox not ready" error with no retry. Callers no longer need to gate on `isReady()` themselves.

## 0.1.14

### Patch Changes

- Updated dependencies [40194ac]
  - @simten/core@0.7.0
  - @simten/ui@0.1.14

## 0.1.13

### Patch Changes

- Updated dependencies [2c3a92c]
  - @simten/core@0.6.1
  - @simten/ui@0.1.13

## 0.1.12

### Patch Changes

- Updated dependencies [b441bf9]
  - @simten/core@0.6.0
  - @simten/ui@0.1.12

## 0.1.11

### Patch Changes

- Updated dependencies [d271692]
  - @simten/core@0.5.2
  - @simten/ui@0.1.11

## 0.1.10

### Patch Changes

- 6cb2f13: CircuitEmbed: the Fork button now uses the shared shadcn tooltip instead of the native `title` attribute, and shows the pointer cursor. Both Fork placements (floating corner / info-bar) are unified into one `ForkButton` component.
- Updated dependencies [6cb2f13]
  - @simten/ui@0.1.10

## 0.1.9

### Patch Changes

- Updated dependencies [62597a1]
- Updated dependencies [62597a1]
  - @simten/ui@0.1.9
  - @simten/core@0.5.1

## 0.1.8

### Patch Changes

- Updated dependencies [dcddcf0]
  - @simten/core@0.5.0
  - @simten/ui@0.1.8

## 0.1.7

### Patch Changes

- b32514c: IMEM node code templates define `main()` instead of `_start()` (the compiler links a crt0 that provides `_start`; the old templates failed with a duplicate-symbol link error). Default simulation speed raised from 5 to 15 ticks/s in the embed viewer.
- Updated dependencies [b32514c]
- Updated dependencies [b32514c]
- Updated dependencies [b32514c]
- Updated dependencies [b32514c]
  - @simten/core@0.4.0
  - @simten/ui@0.1.7

## 0.1.6

### Patch Changes

- Updated dependencies [d51b424]
  - @simten/core@0.3.0
  - @simten/ui@0.1.6

## 0.1.5

### Patch Changes

- Updated dependencies [e87c2a5]
  - @simten/core@0.2.4
  - @simten/ui@0.1.5

## 0.1.4

### Patch Changes

- 3e4aaeb: chore(packaging): declare `engines.node: ">=20"` on all four packages and expose `./package.json` via `exports`

  Two small packaging-hygiene fixes:

  - **Consistent `engines.node`**: `core` and `mcp` already declared `node >=20`; `ui` and `embed` omitted the field. Added it for parity — package managers now warn consistently across all four packages when a consumer is on an older Node.
  - **`./package.json` is now an explicit subpath export**: previously `require('@simten/<pkg>/package.json')` threw `ERR_PACKAGE_PATH_NOT_EXPORTED`, which trips up bundler plugins, version probes, and a few SDK auto-detection tools. Adding `"./package.json": "./package.json"` to each `publishConfig.exports` is the conventional fix.

- 3e4aaeb: build: inline `.ts` source content into sourcemaps (`tsconfig.compilerOptions.inlineSources: true`)

  Previously each `.js.map` referenced `../src/**/*.ts` files that aren't in the published tarball, and `sourcesContent` was empty — so consumers' debuggers could never resolve to actual source. The maps were dead weight. Adding `inlineSources` embeds the source text directly in each map. Tarballs grow ~50% but debuggers now work end-to-end: consumers can step into `@simten/*` code with real line numbers and identifiers.

- 3e4aaeb: docs(readme): correct license text — was BUSL 1.1, all machine-readable signals (package.json + LICENSE file) are Apache-2.0

  The README License section claimed Business Source License 1.1 while the package's `license` field, shipped LICENSE file, and SPDX identifier are all Apache-2.0. The machine-readable signals are what npmjs.com, license scanners, and Dependabot trust — a court would side with the LICENSE file. Updated the README prose to match: Apache-2.0.

- Updated dependencies [3e4aaeb]
- Updated dependencies [3e4aaeb]
  - @simten/core@0.2.3
  - @simten/ui@0.1.4

## 0.1.3

### Patch Changes

- c7c5e67: fix: re-export `CircuitLayout` type from package entry

  The README documents `import { type CircuitLayout } from '@simten/embed'` and the `CircuitEmbed` component's `layout` prop is typed `CircuitLayout<C>`, but the entry was only re-exporting `CircuitCanvasProps` from `@simten/ui/canvas` — leaving `CircuitLayout` reachable only via the deeper `@simten/ui/canvas` path. Consumers following the README got `TS2305: Module '"@simten/embed"' has no exported member 'CircuitLayout'`. Re-exported now so the documented import works.

- cc6b76e: docs(readme): include `react react-dom` in the install command

  The install line previously read `npm install @simten/embed @simten/core`, which works under npm 7+ (auto-installs declared peers) but breaks under pnpm with strict-peer-dependencies (the default) and under yarn. React and react-dom are declared peer dependencies; the install line now lists them explicitly, matching `@simten/ui`'s README.

- c7c5e67: docs(readme): add `@types/react @types/react-dom` to the install line for TypeScript consumers

  The install line was correct at runtime but omitted the TS-side dev deps. A TypeScript consumer (the target audience) following the readme verbatim got implicit-any errors on every React-typed prop until they figured out to install the types. Added them explicitly as a dev-deps line right after the main install.

- Updated dependencies [c7c5e67]
  - @simten/core@0.2.2
  - @simten/ui@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [2649b7c]
  - @simten/core@0.2.1
  - @simten/ui@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @simten/core@0.2.0
  - @simten/ui@0.1.1
