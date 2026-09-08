---
'@simten/core': minor
'@simten/ui': minor
'@simten/embed': minor
'@simten/mcp': minor
---

Make the value domain numeric. `BitValue` is `0 | 1`, not `boolean`.

Booleans are gone from `FieldValue`, `PrimitiveState`, primitive options and
`@simten/embed` props. A bit and a bus are now the same kind of thing at
runtime, so nothing has to infer a width from a JS type. The one deliberate
exception is `PortOutputValues`, which still widens bit outputs to
`number | boolean` so `{ out: !(a | b) }` reads naturally in an `eval`. That is
pinned by a test; it is not an oversight.

Test files were never type-checked. Every package excluded them from its build
tsconfig so `tsc -b` would not emit them into `dist`, and Vitest strips types
with esbuild without checking them, so no test in the repo had ever been through
the compiler. Each package now has a `tsconfig.check.json` and a
`typecheck:tests` script, and the root `typecheck` runs both passes. That
surfaced 206 errors, and behind them these bugs:

- `sim.set()` ran `Boolean(value)` on bit ports, so the public testbench API
  converted every bit it was handed.
- `DFlipFlop` stored boolean state through `onTick: () => ({ value: Boolean(d) })`.
- `circuit()`'s factory path wrote `initialValue: false` into the serialized IR.
- `Register` and `DFlipFlop` took their state width from the JS type of the
  initial value, so `Register({ width: 16 })` could still declare 8 bits of state.
- Declarative `reg()` / `mem()` leaked their declaration types into `eval` and
  `onTick`, so the API could not be used without casts that did not compile.
- `simulateCircuit` and the `simulate_circuit` MCP schema still accepted booleans.
