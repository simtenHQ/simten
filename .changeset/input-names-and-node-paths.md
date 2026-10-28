---
'@simten/core': minor
---

Top-level input names and node paths no longer share one write. `sim.set` takes the circuit's top-level input names only, and `nodesOf(sim).set` takes node paths only, so a top-level input name passed to `nodesOf(sim).set` now throws instead of driving the input. On the engine (`@simten/core/internal`), `setInput(name, value)` drives a top-level input and `setNode(path, value)` writes a node; `setNode` no longer accepts input names.

`nodesOf(sim).primitiveOf(path)` returns the primitive type of the node at a path, or undefined when there is none.
