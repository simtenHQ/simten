---
'@simten/core': minor
---

`Simulation.get(name)` reads inputs as well as outputs: an input port by name, or a Switch or Input node by path, the same keys `set` takes. You can read back anything you can write. A name that is neither throws, listing the circuit's inputs, its Switches and Inputs, and its outputs. `get`'s parameter type takes the output names and `set`'s keys.

A name that is both a port (input or output) and a Switch or Input is ambiguous for `get` and `set` alike, and throws. Before, `set` wrote the Switch while `get` would have read the output.

`@simten/core/internal` adds `resolveKey`, `isControlType` and `primitivePaths`, so the sandbox's client resolves names exactly as `Simulation` does, and `nodesOf(sim).resolve(name)`, which says what `get` reads for a name and how many bits wide it is.
