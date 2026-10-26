---
'@simten/ui': minor
---

Follows the `@simten/core` renames (#416).

| Old | New |
|---|---|
| `Circuit` from `@simten/ui/editor/types` | `CircuitIR` |
| `EvalSource` from `@simten/ui/sandbox` | `BehaviorSource` |
| `useSandbox().simulate()`, `SimulateResult` and the `simulate` sandbox request | removed (nothing called them; run circuits with `simulate()` from `@simten/core`) |
