---
'@simten/sandbox': minor
'@simten/ui': patch
---

New package `@simten/sandbox` runs circuits in a cross-origin sandbox from any page, with no React (#417). `SandboxClient` is one sandbox: it compiles source, opens sessions by circuit name and exports Verilog with the compile's own behavior. `open` returns a `SimulationClient`, which has the same methods as core's `Simulation`, async, plus `setInput(path, value)` for Switch and Input nodes, `run(speed)` and `pause()`, `sample` and `scan`. History and the auto-run loop run in the sandbox's worker, which pushes about 30 updates a second while a session runs. Loading a program into memory means opening a session with `memory`; nothing else on the page can write memory or registers.

The protocol is in `@simten/sandbox/protocol`, and the sandbox's own side (the worker's session host and the iframe's relay) in `@simten/sandbox/host`.

`@simten/ui/sandbox/protocol` now re-exports the message types `useSandbox` uses from `@simten/sandbox/protocol`. Nothing about them changes.
