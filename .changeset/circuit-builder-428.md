---
'@simten/core': minor
---

`circuit()` fixes from #428:

- A factory's default state is kept: `circuit('C', ({ value = 7 } = {}) => ({ state: { value }, ... }))` now starts `C()` at 7, not 0. The resolved initial is recorded in the instance's arguments. `simulate()` on a bare factory primitive now honours its arguments too.
- A connection that runs the wrong way (`outputs.q.to(...)`, or a node output as a `.to` target) is a build error naming both ends. The types already rejected these; untyped editor code built them silently.
- A `connect` that returns something other than a flat array of connections is reported in the validation error list instead of throwing a bare TypeError.
- Two different composites under one name in the same design (for example a factory whose options change its insides) are a build error. Before, both simulated as whichever was seen first.
- Registering a different primitive under a name already used in the same run logs a warning. The editor starts a new run on each recompile.
- Documented that plain number state is always `bus(32)` and plain Map state a 16/8-bit memory.
