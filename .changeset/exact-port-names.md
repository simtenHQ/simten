---
'@simten/core': minor
'@simten/mcp': patch
---

`Simulation.get` and `set` take only the circuit's own top-level port names, and unknown port names now throw instead of reading 0. Node writes through `nodesOf(sim).set` need the exact node path.

`simulate_circuit` reports an `inputs` name that isn't a top-level input as an error, and `memoryData` keys must be exact node paths.
