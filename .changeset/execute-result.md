---
'@simten/core': patch
---

`executeCircuitCode` and `executeJsCode` (in `@simten/core/internal`) return `{ circuits, exported, library, error }`. `circuits` holds the built `Circuit`s in build order and `exported` every circuit the source exports, built there or not. `circuit`, `exportedCircuits` and `builtCircuits` are gone, and nothing is picked as a main circuit: callers choose one by name or take the last. IR comes from `internalsOf(circuit).ir`.
