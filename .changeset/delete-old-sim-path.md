---
'@simten/embed': minor
'@simten/ui': minor
---

Remove the page-side simulation hooks (#417). Circuits now simulate only through `useSimulation` from `@simten/ui/sandbox`, which runs them in the sandbox's worker.

- `@simten/embed`: `useCircuitSimulator`, `useCircuitCompiler`, `useCompiledCircuit` and `builtFromIR` are removed, with their types `SimulatorState`, `SimulatorActions`, `UseCircuitSimulatorOptions`, `CircuitCompilerState`, `CompiledLibrary`, `UseCircuitCompilerOptions`, `CompiledCircuitState`, `UseCompiledCircuitOptions` and `CompileDiagnostic`. Use `useSimulation` (`CompileDiagnostic` is exported from `@simten/ui/sandbox`). `CircuitEmbed`, `CircuitViewer` and the web component are unchanged.
- `@simten/ui/sandbox`: `useSandbox`, `useSandboxContext` and `SANDBOX_UNAVAILABLE_ERROR` are removed, with the slot types `SandboxHandle`, `SandboxStatus`, `SimSlot`, `CompileResult`, `CompileIRResult`, `TickResult`, `ResetResult`, `SetNodeResult`, `SandboxError` and `BehaviorSource` (`EvalSource` in 0.15). `SandboxProvider` now holds only the shared sandbox client that `useSimulation` and `useSandboxClient` use.
