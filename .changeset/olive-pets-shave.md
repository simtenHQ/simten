---
'@simten/core': minor
---

Redefining a primitive now replaces its behaviour. Component behaviour was cached by name and kept the first registration, so editing a primitive's `eval` (or `onTick`) left the old function running — the source said one thing and the simulation did another. Affects any host that re-executes circuit source in one realm, which is what the browser editor does.

`eval` may now return a boolean for a 1-bit output, so `({ a, b }) => ({ out: !(a | b) })` type-checks instead of needing `(a | b) ? 0 : 1`. Widened only for `bit`: the Verilog exporter emits JS `!` as `~`, which agrees at one bit and diverges above it, so `bus` outputs still require a number. Adds the `PortOutputValues` type.

`setDebugStateUpdate` is now exported from `@simten/core/simulator`. It gates propagation tracing — seed counts and per-pass eval/changed totals — which is the only view into a circuit once elaboration has flattened it to typed arrays. The tracing existed but nothing could switch it on.

**Verilog import now rejects derived clocks.** A flip-flop clocked by anything other than the module's clock port (a clock divider's `div[15]`, a ripple counter's previous stage, a gated clock) used to import cleanly and simulate as a different circuit — a 4-bit ripple counter came out as four flip-flops toggling together, counting 0, 15, 0. simten models a single synchronous clock domain and cannot represent those, so they now throw with a message naming the signal and pointing at the clock-enable rewrite. Designs that previously imported and behaved incorrectly will now fail loudly.

`autoHarness` keeps its library entry in step with the circuit it wraps, so editing a circuit's ports no longer leaves the harness's `dut` node describing a different interface from the circuit the canvas resolves.
