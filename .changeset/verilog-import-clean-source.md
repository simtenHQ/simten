---
"@simten/core": minor
---

Verilog import now produces clean, editable simten source from arbitrary synthesizable single-driver Verilog. Word-level cells lift to recognizable stdlib components with no `Rtl*` in the output, backed by a single `{kind, home}` component registry, sign/zero-extension collapse, and node-id/module-name sanitization.

New stdlib components: `Slice`, `SignExtend`, `ZeroExtend`, `DynamicSlice`, `WrappingMultiplier`, `SignedRightShifter`, `BusXnor`, `LogicAnd`/`LogicOr`/`LogicNot`, `ReduceOr`/`ReduceAnd`/`ReduceXor`. `Concat`, `BusNot`, `Comparator`, and `SignedComparator` are now width-parameterized (backward compatible). `$mem_v2` init data (`$readmemh`/ROM contents) is applied on import.

A foreign RISC-V core imports to zero `Rtl*` and re-simulates identically, verified by a ratcheted cleanliness metric plus round-trip and editability tests.
