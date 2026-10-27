---
'@simten/core': minor
---

`simulate(top, options?)` returns a `Simulation`, which replaces `SimulationHandle` and `SimulationSession` (#417). It is synchronous, has no timers and nothing to dispose, and keeps history when you ask for it: `simulate(top, { history: 200 })` records one step per `tick` call, and `stepBack()`, `stepForward()` and `seek(index)` move through it. History is off by default, and then those three return `false`.

| Old | New |
|---|---|
| `sim.tickN(n)` | `sim.tick(n)` |
| `sim.dispose()` | nothing to call; delete the line |
| `sim.setNode(path, value)` | `nodesOf(sim).set(path, value)` from `@simten/core/internal`. For memory loaded at build time, `ROM({ memory })` |
| `sim.run({ speed })`, `sim.stop()`, `sim.isRunning` | removed from core. In Node, call `tick` in a loop |
| `sim.watch(fn)`, `sim.watchPort(name, fn)` | removed. You know when state changes, because you called `tick` |
| `SimulationSession`, `SessionSnapshot`, `getEngine()` (`/internal`) | `createSimulation(ir, library, options)` and `nodesOf(sim)` (`ports()`, `peripherals()`, `advance(n)`, `record()`) |

`get` and `read` after `set` on a sequential circuit now return settled values. They used to return the value from before the write until the next `tick`. Clocked results are unchanged: `tick` already propagated from the new inputs.

On a combinational circuit, `tick(n)` settles the logic and leaves `cycle` at 0. `tickN(n)` used to count n cycles there.
