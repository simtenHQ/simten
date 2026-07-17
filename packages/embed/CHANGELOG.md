# @simten/embed

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
