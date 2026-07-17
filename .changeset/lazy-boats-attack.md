---
"@simten/embed": minor
"@simten/ui": minor
---

Editor consolidation: the Monaco editor and circuit-compile mechanics that `apps/web` kept in a bespoke component now live in the library.

**`@simten/ui/monaco`** — `SimtenCodeEditor` gains:
- an imperative `ref` handle (`getEditor` / `getMonaco` / `getValue` / `setValue`);
- a monaco-free `diagnostics` prop that renders squiggles (callers never import `monaco-editor` to show errors);
- `registerSimtenThemes(monaco, { lightBackground? })` plus `SIMTEN_DARK` / `SIMTEN_LIGHT` — the Simten editor themes, previously inlined per-app.

**`@simten/embed`** — two new hooks:
- `useCircuitCompiler(source, opts)` — the compile bridge (debounce, `sandbox.compile`, worker-restart retry, error line/col extraction, `library` lookup, keep-last-good, stale-compile cancellation) with no opinion about what to do with the result;
- `useCompiledCircuit(source, opts)` — source → live simulation, composing `useCircuitCompiler` with `builtFromIR` + `useCircuitSimulator`.

**Breaking: drops React 18 support.** Both packages now require React 19 (peer narrowed to `^19`). `forwardRef` is gone in favour of React 19's ref-as-prop across all components. Everything on React 19 is unaffected; React 18 consumers should stay on the previous version.
