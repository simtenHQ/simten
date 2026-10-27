---
'@simten/ui': minor
'@simten/embed': minor
---

Props and fields that hold the name-to-circuit lookup are now called `definitions`, since a library in core means definitions plus behavior:

- `@simten/ui`: `CircuitCanvasProps.componentLibrary` -> `definitions`, `CompositeInspectorDialogProps.componentLibrary` -> `definitions`, `InspectorFrame.library` -> `definitions`, `useCircuitLibraryStore` -> `useCircuitDefinitionsStore` (its `library` -> `definitions` and `setLibrary` -> `setDefinitions`), `CircuitLibraryStore` -> `CircuitDefinitionsStore`
- `@simten/embed`: `useCircuitSimulator().componentLibrary` and `useCompiledCircuit().componentLibrary` -> `definitions`, `useCircuitCompiler().library` -> `definitions`, `CompiledLibrary` -> `CompiledDefinitions`
