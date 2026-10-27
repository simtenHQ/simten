---
'@simten/core': minor
---

Behavior (`eval`/`onTick`) belongs to a compile instead of a global registry keyed by name (#465). A built circuit carries its own behavior, a compile collects a library for exactly its circuit tree (the circuit definitions and their behavior), and the engine runs that library. Two compiles with same-named circuits no longer affect each other, a user circuit named like a std one no longer changes std in other designs, and importing the package registers nothing (`sideEffects: false`).

Two different circuits under one name in one design are now a compile error naming the circuit, for primitives as well as composites. Before, a primitive got a console warning and one silently ran as the other.

`simulate()` no longer takes a second `{ library }` argument, since the circuit you pass already carries everything it needs.

`@simten/core/internal`:

- removed: `getCircuitBehavior`, `registerCircuitBehavior`, `getAllCircuitBehaviors`, `BehaviorEntry`, `ensureEvaluatorRegistered`, `PRIMITIVE_TYPE_INDICES`, `PRIMITIVE_INDEX_TO_NAME`, `createCircuitLibrary` (use `createDefinitions`)
- renamed: `CircuitLibrary` and `MutableCircuitLibrary` are now `CircuitDefinitions` and `MutableCircuitDefinitions`. A library is now definitions plus behavior.
- added: `Library` and `MutableLibrary` (`{ definitions, behaviors }`), `libraryOf` (the library for a circuit tree), `addToLibrary`, `emptyLibrary`, `getStdLibrary`, `createDefinitions`, `Behavior`, `BehaviorTable`, `behaviorOf` (a built circuit's behavior)
- `createEngine` options take a `library` in place of `componentLibrary`; `compileForSimulation` and `tracePropagation` take a library in place of the definitions
- `executeCircuitCode`/`executeJsCode` results and `compileSource` carry a `library` of definitions and behavior; `importNetlist` returns `definitions` (was `library`) and `behaviors`; `buildFromIR` takes an optional behavior table to attach to primitives

`@simten/core/verilog`: `exportVerilog` options take an optional `behaviors` table for eval-synth, defaulting to the standard library's.
