# @simten/sandbox

## 0.2.2

### Patch Changes

- Updated dependencies [a0d58a1]
- Updated dependencies [4f876e6]
- Updated dependencies [2eace91]
- Updated dependencies [e1a0c03]
- Updated dependencies [e7084ef]
- Updated dependencies [54fceee]
- Updated dependencies [f00b18a]
- Updated dependencies [ca093a5]
- Updated dependencies [6b50161]
- Updated dependencies [ce8c6c4]
- Updated dependencies [adbbd37]
- Updated dependencies [5aa7a6a]
  - @simten/core@0.26.0

## 0.2.1

### Patch Changes

- Updated dependencies [73b9714]
- Updated dependencies [007c2b8]
- Updated dependencies [e9c287c]
- Updated dependencies [46f1ce4]
- Updated dependencies [328116a]
- Updated dependencies [1806ea0]
- Updated dependencies [ebf4fba]
- Updated dependencies [8e23718]
- Updated dependencies [e8beb26]
- Updated dependencies [44df86c]
  - @simten/core@0.25.0

## 0.2.0

### Minor Changes

- ca8cb5a: A circuit's own ports are keyed by their name in every port-value map: `portValues.get('sum')`, where it was `portValues.get('__top__.sum')`. A node's port is still keyed by path (`ha1.x.out`). `sample` and `scan` take the same keys, so `sim.scan('scan_addr', 'pixel_out', 64)` and `actions.sample('audio', n)`. The `__top__.` form is no longer accepted anywhere. A port name may not contain a dot, since dots separate node paths.

  The hosted sandbox sends the new keys, so a page on `@simten/react` 0.16 or earlier no longer shows a circuit's own outputs on the canvas. Update `@simten/react` and `@simten/sandbox` together.

### Patch Changes

- Updated dependencies [41bebbb]
- Updated dependencies [ca8cb5a]
  - @simten/core@0.24.0

## 0.1.0

### Minor Changes

- fdf488d: `SimulationClient` has one `set` for every input (decision 0010). It takes input port names and the paths of Switch and Input nodes, writes them all before the circuit settles, and rejects the whole call if any key doesn't resolve exactly. `setInput` and `setInputs` are removed. `scan` takes the same keys, and its first parameter is now called `input`.

  `SandboxClient.open` no longer takes `harness`: a session runs the circuit it was given, and `@simten/react`'s canvas draws its ports (#531).

  A session's `initialInputs` take the same keys. They are where the inputs sit when the session opens; `reset` returns registers and history to the start and leaves the inputs where they are.

  `inProcessSandbox()` from `@simten/sandbox/host` is a `SandboxClient` whose sandbox runs in the same process, for tests. It runs circuit code in the test's process, so use it for circuits you trust.

  The message format is internal, so there is no `@simten/sandbox/protocol` export.

  | Before                                                            | After                                   |
  | ----------------------------------------------------------------- | --------------------------------------- |
  | `sim.setInput('d', 1)`                                            | `sim.set({ d: 1 })`                     |
  | `sim.setInputs({ d: 0, en: 0 })`                                  | `sim.set({ d: 0, en: 0 })`              |
  | `sim.set({ a: 1 })` then `sim.setInput('sw', 1)`                  | `sim.set({ a: 1, sw: 1 })`, one request |
  | a `SessionHost` behind a hand-written `SandboxTransport` in tests | `inProcessSandbox()`                    |
  | types from `@simten/sandbox/protocol`                             | none needed: use the clients            |

- 1377bd3: New package `@simten/sandbox` runs circuits in a cross-origin sandbox from any page, with no React (#417). `SandboxClient` is one sandbox: it compiles source, opens sessions by circuit name and exports Verilog with the compile's own behavior. `open` returns a `SimulationClient`, which has the same methods as core's `Simulation` (async, apart from `get`, which reads the last state), plus `run(speed)` and `pause()`, `sample` and `scan`. Its `set` takes input port names and Switch and Input paths, as core's does. History and the auto-run loop run in the sandbox's worker, which pushes about 30 updates a second while a session runs. Loading a program into memory means opening a session with `memory`; nothing else on the page can write memory or registers.

  The sandbox's own side (the worker's session host and the iframe's relay) is in `@simten/sandbox/host`, with `inProcessSandbox()` for tests. The message format between them is internal.

- 047eee1: A `restart` session request and `SimulationClient.restart()`: the worker builds the session's simulation again from the circuit and options it was opened with, under the same session id, and stops an auto-run first. The session is back in the state it opened in, which `reset` can't reach for a latch built from gates.
- c7e5768: `SimulationClient.toggle(name)` flips one input between 0 and 1. It takes the keys `set` takes, and rejects anything wider than one bit, writing nothing: use `set` for a bus. The sandbox reads the value it holds and writes the other, so toggles sent back to back without awaiting each flip in turn, where a toggle computed from the page's last reported state could flip the same stale value twice.

  `SimulationClient.get(name)` takes the same names as core's `Simulation.get`: outputs, input ports, and Switch and Input nodes by path, read from the last state. Names resolve exactly as core resolves them, and a name that is none of these throws with core's message.

### Patch Changes

- Updated dependencies [4f74855]
- Updated dependencies [d730bbf]
- Updated dependencies [c7e5768]
- Updated dependencies [90126f4]
- Updated dependencies [6052ee8]
- Updated dependencies [f5c8869]
- Updated dependencies [8eaedd2]
- Updated dependencies [f4c5153]
- Updated dependencies [38feb78]
- Updated dependencies [f7a6a51]
- Updated dependencies [1377bd3]
- Updated dependencies [d3031cb]
- Updated dependencies [25966b0]
- Updated dependencies [fdf488d]
- Updated dependencies [4f74855]
- Updated dependencies [5dc1429]
- Updated dependencies [2dbad6f]
  - @simten/core@0.23.0
