---
"@simten/core": patch
---

A circuit with inputs and outputs but no nodes and no `eval` is now an empty composite rather than a primitive. Its outputs are simply undriven, and a pass-through built this way now carries its signal (#147) and exports as a plain `assign`.
