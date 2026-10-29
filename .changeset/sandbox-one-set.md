---
'@simten/sandbox': minor
---

`SimulationClient` has one `set` for every input (decision 0010). It takes input port names and the paths of Switch and Input nodes, writes them all before the circuit settles, and rejects the whole call if any key doesn't resolve exactly. `setInput` and `setInputs` are removed. `scan` takes the same keys, and its first parameter is now called `input`.

`SandboxClient.open` no longer takes `harness`: a session runs the circuit it was given, and `@simten/react`'s canvas draws its ports (#531). The sandbox still accepts the option from pages deployed before this release.

A session's `initialInputs` take the same keys. They are where the inputs sit when the session opens; `reset` returns registers and history to the start and leaves the inputs where they are.

`inProcessSandbox()` from `@simten/sandbox/host` is a `SandboxClient` whose sandbox runs in the same process, for tests. It runs circuit code in the test's process, so use it for circuits you trust.

The message format is internal. `@simten/sandbox/protocol` stays exported until the release that removes the sandbox's legacy slot handlers, and nothing outside the package should import it.

| Before | After |
|---|---|
| `sim.setInput('d', 1)` | `sim.set({ d: 1 })` |
| `sim.setInputs({ d: 0, en: 0 })` | `sim.set({ d: 0, en: 0 })` |
| `sim.set({ a: 1 })` then `sim.setInput('sw', 1)` | `sim.set({ a: 1, sw: 1 })`, one request |
| a `SessionHost` behind a hand-written `SandboxTransport` in tests | `inProcessSandbox()` |
| types from `@simten/sandbox/protocol` | none needed: use the clients |
