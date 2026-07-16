# @simten/ui

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
