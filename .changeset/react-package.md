---
'@simten/react': minor
---

New package `@simten/react`: Simten's React components and hooks in one place (#418). It replaces `@simten/ui` and `@simten/embed`, which are deprecated, and continues `@simten/ui`'s version line. Embedding on a page that isn't React is the iframe from Share > Embed on simten.dev, with no package.

Where things moved:

| Old | New |
|---|---|
| `CircuitEmbed`, `CircuitViewer`, `ErrorDisplay`, `ErrorBoundary`, `ShareCircuitProvider`, `useShareCircuit`, `FlatPortValueMap` from `@simten/embed` | `@simten/react/embed` |
| `CircuitCanvas`, `CircuitCanvasProps`, `CircuitLayout` from `@simten/embed` | `@simten/react/canvas` |
| `@simten/embed/styles.css` | `@simten/react/styles.css` |
| `ClockControls` from `@simten/ui/editor/components` | `@simten/react/canvas` |
| `@simten/ui/canvas`, `/nodes`, `/sandbox`, `/monaco`, `/waveform`, `/share`, `/primitives/*`, `/styles/theme.css` | the same subpath of `@simten/react` |

New in this package:

- `SimulationView` and `SimulationViewProps` in `@simten/react/embed`: the canvas and clock controls for any `useSimulation` result, for a circuit given as source text.
- `@simten/react/styles.css` is the compiled stylesheet for apps without Tailwind; `@simten/react/styles/theme.css` stays the tokens for apps with it.
- `"sideEffects": ["*.css"]`, so bundlers keep the stylesheets the components import.
- `Button` at `@simten/react/primitives/button`, and `preloadMonaco()` in `@simten/react/monaco` to start downloading Monaco before an editor mounts.

Changes since `@simten/ui` 0.15 and `@simten/embed` 0.5:

- Circuits simulate only through `useSimulation` (#417), which runs them in the sandbox's worker. The page-side hooks are gone: `useCircuitSimulator`, `useCircuitCompiler`, `useCompiledCircuit` and `builtFromIR` from `@simten/embed`, and `useSandbox`, `useSandboxContext` and `SANDBOX_UNAVAILABLE_ERROR` from `@simten/ui/sandbox`, with their types. `CompileDiagnostic` is exported from `@simten/react/sandbox`. `SandboxProvider` holds only the shared sandbox client that `useSimulation` and `useSandboxClient` use.
- `CircuitEmbed`'s `circuit` prop takes a `Circuit`, formerly `BuiltCircuit`, following the `@simten/core` renames (#416).
- Props and fields that hold the name-to-circuit lookup are called `definitions`: `CircuitCanvasProps.componentLibrary`, `CompositeInspectorDialogProps.componentLibrary` and `InspectorFrame.library` are now `definitions`.
- `EmbedConsoleNode` and `EmbedScreenNode` are removed. Use `ConsoleNode` and `ScreenNode`.
- Share links never expire, and Fork creates a share only on simten.dev. Anywhere else Fork opens `/circuit/<encoded>` with the source in the URL. In `@simten/react/share`, `INLINE_URL_THRESHOLD` and `shouldUseShortLink` are removed, and the KV format shared by simten.dev and embed.simten.dev is added: `ShareKV`, `saveShare`, `loadShare`, `isShareHash`, `validateShareHash`.
- `CircuitCanvas` pans when you left-drag the background, not only with the middle or right button. Dragging a node still moves the node. Bus wires are drawn thicker than single-bit wires.
- Pin labels are on by default on every canvas. Blocks grow to fit their pins and label names, the layout spaces them by the same sizes, and labels hide when the canvas is zoomed out too far to read them.
- `SimtenCodeEditor` defaults to `wordWrap: 'on'`, `tabSize: 2` and `fixedOverflowWidgets: true`, and no longer pops up parameter hints on its own, so the signature box stops covering completions. Cmd/Ctrl+Shift+Space still shows them.
