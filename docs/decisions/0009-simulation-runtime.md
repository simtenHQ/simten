# 0009. One simulation, run in the sandbox

**Status:** Accepted. Tracked in #417; the detailed plan is in PR #493.

## Context

History, time travel and auto-run existed three times: in core's `SimulationSession`, in a hand-written async copy inside the browser hook `useCircuitSimulator`, and in a smaller copy inside the inspector dialog. The public handle that `simulate()` returned had fourteen methods, including timers, string node paths and a `get` that fell back to "any port ending in this name". Six hooks overlapped. The page drove auto-run with a timer and waited for the worker after every batch.

## Decision

- **One `Simulation` type in core.** `simulate(top, { history })` returns `set`, `get`, `read`, `tick(n)`, `reset`, `stepBack`, `stepForward`, `seek`, `snapshot` and `restore`. History is off unless asked for. There is no `dispose` and no timers: a simulation is plain data, so there is nothing to clean up. Unknown port names throw instead of reading 0.
- **Names and paths mean different things.** `sim.set` takes the circuit's own input names. Our code reaches inside a circuit through `nodesOf(sim)` in `@simten/core/internal`, which takes node paths only.
- **In the browser the simulation runs in the sandbox worker.** The page holds a `SimulationClient`: the same method names as `Simulation`, made async, forwarding each call as a message. All simulation logic exists once, in core. Auto-run happens in the worker, which pushes the latest values about 30 times a second without waiting for replies.
- **`@simten/sandbox` is a separate package with no React:** the message protocol, `SandboxClient`, `SimulationClient` and the worker's session host. React bindings sit on top of it in their own package, the same split as Sandpack's `sandpack-client` and `sandpack-react`.
- **One React hook, `useSimulation`,** compiles and simulates. Code that only needs to compile calls the sandbox client directly.
- **The page can only flip inputs.** `setInput` accepts input components (switches, inputs, keyboards) and nothing else. Loading a program, such as a new binary for the RV32I debugger, starts a fresh simulation with the program in memory, as loading a program does on real hardware.
- **Verilog export runs in the sandbox,** where the design's real behavior is, and its code loads only on the first export.
- **Large ticks are sliced** so one simulation can't hold the worker. The watchdog fires after five seconds of silence, with a heartbeat during long work, and a restart replays every compile and simulation.
- **One sandbox per embed or component,** as before.
- **Rolled out expand-then-contract:** the sandbox first understands old and new messages, the pages move over, then the old path is deleted. Every step can be deployed and rolled back on its own.

## Rejected

- **Keeping history and auto-run on the page.** That was the duplication this removes, and it kept a round trip in every frame.
- **Running simulations on the page with `simulate()`.** It would run user code outside the sandbox (decision 0001).
- **A broad `setNode` on the browser API.** It could put a simulation in states its own logic can never produce.
- **One sandbox shared by every embed on a page.** It saves memory, but adds cross-talk and a shared failure for little gain at current sizes.
- **Putting the client inside the React package.** It isn't React code, and non-React users and the worker need it.

## What would change it

A page with many live simulations that is measurably slow would bring back a shared sandbox. A need to edit memory while a simulation runs would add an explicit, separately named debugging action, not a general node setter.
