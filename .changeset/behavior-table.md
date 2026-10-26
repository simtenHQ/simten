---
'@simten/core': minor
---

Behavior (`eval`/`onTick`) belongs to a compile instead of a global registry keyed by name (#465). A built circuit carries its own behavior, a compile collects a table for exactly its circuit tree, and the engine runs that table. Two compiles with same-named circuits no longer affect each other, a user circuit named like a std one no longer changes std in other designs, and importing the package registers nothing (`sideEffects: false`).

Two different circuits under one name in one design are now a compile error naming the circuit, for primitives as well as composites. Before, a primitive got a console warning and one silently ran as the other.

`@simten/core/internal`:

- removed: `getCircuitBehavior`, `registerCircuitBehavior`, `getAllCircuitBehaviors`, `BehaviorEntry`, `ensureEvaluatorRegistered`, `PRIMITIVE_TYPE_INDICES`, `PRIMITIVE_INDEX_TO_NAME`
- added: `Behavior`, `BehaviorTable`, `behaviorOf` (a built circuit's behavior), `designOf` (library and behavior table for a circuit tree), `addToDesign`, `emptyDesign`, `createLibrary`, `getStdBehaviors`
- `createEngine` options take a required `behaviors` table; `compileForSimulation` and `tracePropagation` take it as a third argument
- `executeCircuitCode`/`executeJsCode` results and `compileSource` carry `behaviors`; `importNetlist` returns `behaviors` for the circuits it built; `buildFromIR` takes an optional table to attach to primitives

`@simten/core/verilog`: `exportVerilog` options take an optional `behaviors` table for eval-synth, defaulting to the standard library's.
