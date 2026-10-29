---
'@simten/sandbox': minor
---

New package `@simten/sandbox` runs circuits in a cross-origin sandbox from any page, with no React (#417). `SandboxClient` is one sandbox: it compiles source, opens sessions by circuit name and exports Verilog with the compile's own behavior. `open` returns a `SimulationClient`, which has the same methods as core's `Simulation`, async, plus `run(speed)` and `pause()`, `sample` and `scan`. Its `set` takes input port names and Switch and Input paths, as core's does. History and the auto-run loop run in the sandbox's worker, which pushes about 30 updates a second while a session runs. Loading a program into memory means opening a session with `memory`; nothing else on the page can write memory or registers.

The sandbox's own side (the worker's session host and the iframe's relay) is in `@simten/sandbox/host`, with `inProcessSandbox()` for tests. The message format between them is internal.
