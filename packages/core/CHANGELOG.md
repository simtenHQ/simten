# @simten/core

## 0.2.3

### Patch Changes

- 3e4aaeb: chore(packaging): declare `engines.node: ">=20"` on all four packages and expose `./package.json` via `exports`

  Two small packaging-hygiene fixes:

  - **Consistent `engines.node`**: `core` and `mcp` already declared `node >=20`; `ui` and `embed` omitted the field. Added it for parity — package managers now warn consistently across all four packages when a consumer is on an older Node.
  - **`./package.json` is now an explicit subpath export**: previously `require('@simten/<pkg>/package.json')` threw `ERR_PACKAGE_PATH_NOT_EXPORTED`, which trips up bundler plugins, version probes, and a few SDK auto-detection tools. Adding `"./package.json": "./package.json"` to each `publishConfig.exports` is the conventional fix.

- 3e4aaeb: build: inline `.ts` source content into sourcemaps (`tsconfig.compilerOptions.inlineSources: true`)

  Previously each `.js.map` referenced `../src/**/*.ts` files that aren't in the published tarball, and `sourcesContent` was empty — so consumers' debuggers could never resolve to actual source. The maps were dead weight. Adding `inlineSources` embeds the source text directly in each map. Tarballs grow ~50% but debuggers now work end-to-end: consumers can step into `@simten/*` code with real line numbers and identifiers.

## 0.2.2

### Patch Changes

- c7c5e67: docs(readme): correct the "Running it" instructions — `@simten/core` is ESM-only, consumer must opt into ESM

  The previous note claimed `tsx` would skip the need for `"type": "module"`. That's wrong: `@simten/core`'s exports only define the `import` condition, so a default CJS-mode consumer hits `ERR_PACKAGE_PATH_NOT_EXPORTED` on the subpath import (e.g. `@simten/core/circuit`) regardless of whether tsx is doing the transform. Updated the instructions to make the ESM requirement explicit — either add `"type": "module"` to `package.json` or save the file with the `.mts` extension.

## 0.2.1

### Patch Changes

- 2649b7c: docs(readme): correct quickstart example to match shipped `SimulationHandle` API

  The original quickstart used `using sim = simulate(...)`, `sim.setInput(...)`, and `sim.getOutput(...)` — none of which exist on the shipped type. The actual API is `const sim = simulate(...)`, `sim.set({ a: 1 })`, and `sim.get('sum')`. Updated the example to match the real API and noted that `using` is not currently supported (the handle exposes a plain `dispose()` method).

## 0.2.0

### Minor Changes

- fix(elaboration): chained-composite feedthrough wires now propagate via transitive closure (#138)

  Previously, composite circuits that chained feedthrough wires through multiple nested composites could silently produce wrong netlists — signals that should have reached downstream nodes were dropped at elaboration time. The fix computes the full transitive closure of feedthrough connections so multi-level chains stitch correctly.

### Patch Changes

- test: structural invariants helper for FlatCircuit + 17 targeted elaboration patterns (#140)

  Adds an internal invariants checker used by the test suite to catch malformed flat netlists earlier, plus 17 targeted elaboration test patterns covering edge cases surfaced during the audit. No public API change; ships as a patch so consumers picking up `@simten/core@0.2.0` get the additional safety net.
