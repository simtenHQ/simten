---
'@simten/react': minor
---

New package `@simten/react`: Simten's React components and hooks in one place (#418). It replaces `@simten/ui` and `@simten/embed`, which are deprecated, and continues `@simten/ui`'s version line. Embedding on a page that isn't React is the iframe from Share > Embed on simten.dev, with no package.

Where things moved. The surface itself is decision 0010's, described in the `useSimulation` entry:

| Old | New |
|---|---|
| `CircuitEmbed`, `CircuitViewer` from `@simten/embed` | `useSimulation` with `CircuitCanvas` and `ClockControls` from `@simten/react` |
| `CircuitCanvas`, `CircuitCanvasProps` from `@simten/embed` | `@simten/react`, taking `simulation` |
| `@simten/embed/styles.css` | `@simten/react/styles.css` |
| `ClockControls` from `@simten/ui/editor/components` | `@simten/react`, taking `simulation` |
| `@simten/ui/sandbox` | `@simten/react` |
| `@simten/ui/monaco` | `@simten/react/code-editor` |
| `@simten/ui/waveform` | `@simten/react`: `WaveformViewer`, taking `simulation` |
| `@simten/ui/canvas`, `/nodes`, `/share`, `/primitives/*`, `/styles/theme.css`; `ErrorDisplay`, `ErrorBoundary`, `ShareCircuitProvider`, `useShareCircuit`, `FlatPortValueMap` from `@simten/embed` | no longer public: canvas internals, or Simten's own app code |

New in this package:

- `@simten/react/styles.css` is the one stylesheet, with the theme as CSS variables.
- `"sideEffects": ["*.css"]`, so bundlers keep the stylesheets the components import.
- `preloadMonaco()` in `@simten/react/code-editor` starts downloading Monaco before an editor mounts.

Changes since `@simten/ui` 0.15 and `@simten/embed` 0.5:

- Circuits simulate only through `useSimulation` (#417), which runs them in the sandbox's worker. The page-side hooks are gone: `useCircuitSimulator`, `useCircuitCompiler`, `useCompiledCircuit` and `builtFromIR` from `@simten/embed`, and `useSandbox`, `useSandboxContext` and `SANDBOX_UNAVAILABLE_ERROR` from `@simten/ui/sandbox`, with their types. `CompileDiagnostic` is exported from `@simten/react`.
- The canvas pans when you left-drag the background, not only with the middle or right button. Dragging a node still moves the node. Bus wires are drawn thicker than single-bit wires.
- Pin labels are on by default on every canvas. Blocks grow to fit their pins and label names, the layout spaces them by the same sizes, and labels hide when the canvas is zoomed out too far to read them.
- The code editor defaults to `wordWrap: 'on'`, `tabSize: 2` and `fixedOverflowWidgets: true`, and no longer pops up parameter hints on its own, so the signature box stops covering completions. Cmd/Ctrl+Shift+Space still shows them.
