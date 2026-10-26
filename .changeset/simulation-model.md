---
'@simten/core': minor
---

The simulator now follows the simulation model in decision 0002.

- Every output is masked to its port width, so an eval that returns `a + b` on an 8-bit port stores the low 8 bits. Values are unsigned: a 32-bit all-ones value reads back as `0xFFFFFFFF`, not `-1`.
- A bus wider than 32 bits is a compile error when the circuit is compiled for simulation.
- A state block on a falling edge, on a clock other than its component's own, or a component with more than one clock is a compile error naming the node. These used to run on the rising edge without a word. `updateClockStates` is gone from `@simten/core/simulator`.
- `bit` counts as `bus(1)` in the width check: `bus(n)` into `bit` is a "truncates" error that suggests `Slice`, and `bit` into `bus(n)` widens with a warning.
- `Constant` throws when its `value` does not fit its `width` (`Constant({ value: 255 })` needs `width: 8`).
- `restore()` puts back top-level inputs and the values `setNode` wrote into Switch/Input nodes, and snapshots no longer share the clocks map. A memory field in a multi-block state is copy-on-write in `onTick`, like a lone memory.
- The propagation cap scales with the circuit (64 evaluations per node, at least 10 000), and the error names the nodes still changing.
