---
'@simten/core': minor
---

`sim.set` takes a circuit's inputs as a person at the board sees them: input ports by name, and Switch and Input nodes by path (decision 0010). A testbench drives a circuit made of switches the same way as one with ports, so the game's d-latch level is `sim.set({ d: 0, en: 0 })`. Every key in one call is written before the circuit settles. A key that names any other node, that names nothing, or that names both an input port and a Switch throws, and nothing is written.

`simulate(top, { memory })` loads memory contents by node path before cycle 0, the same option as the sandbox's `open` and `useSimulation`. `reset()` keeps them.

`simulate(circuit)` types `set`'s keys from the circuit: its input ports, plus its Switch and Input nodes and their paths up to five levels down. A typo is a compile error.

| Before | After |
|---|---|
| `nodesOf(sim).set('d', 1)` for a Switch | `sim.set({ d: 1 })` |
| two `nodesOf(sim).set` calls for two switches | `sim.set({ d: 0, en: 0 })`, settled once |
| `nodesOf(sim).set('rom', contents)` before the first tick | `simulate(top, { memory: { rom: contents } })` |
| `sim.set({ reg: 1 })` with a register named `reg` | still throws; registers and memories aren't inputs |
