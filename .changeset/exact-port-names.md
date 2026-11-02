---
'@simten/core': minor
'@simten/mcp': patch
---

`Simulation.get` and `set` throw on a name they don't know, instead of reading 0. Node writes through `nodesOf(sim).set` need the exact node path.

`simulate_circuit` reports an `inputs` key that doesn't resolve as an error, and `memoryData` keys must be exact node paths.
