---
'@simten/core': minor
---

Top-level input names and node paths no longer share one write on the node level. `nodesOf(sim).set` takes node paths only, so a top-level input name passed to it now throws instead of driving the input. (`sim.set` takes input names and Switch and Input paths, resolved exactly; see the `set` changeset.) On the engine (`@simten/core/internal`), `setInput(name, value)` drives a top-level input and `setNode(path, value)` writes a node; `setNode` no longer accepts input names.

`nodesOf(sim).primitiveOf(path)` returns the primitive type of the node at a path, or undefined when there is none.
