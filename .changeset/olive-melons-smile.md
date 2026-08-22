---
'@simten/core': patch
---

Import no longer emits a fresh node every time it needs the same one.

Every bit vector was rebuilt from scratch, so a module reading bit 0 of the same
register in nine places got nine identical `Slice` nodes, and one needing a zero
got a fresh `Constant` each time. picorv32 emitted 1270 constants, 1158 of them
repeats.

These nodes are pure and take the same inputs, so they are the same node.
Sharing them is fan-out, which the IR already expresses. Nodes are keyed on what
they are, their shape, and where their inputs come from — anything short of all
three still gets its own node.

| design | nodes | largest module | recon ÷ semantic |
|---|---|---|---|
| RV32I_CPU_Core | 1076 → 656 | 1076 → 656 | 0.333 → 0.304 |
| SERV `serv_rf_top` | 1011 → 887 | 262 → 183 | 0.414 → 0.263 |
| picorv32 | 4154 → 2892 | 2077 → 1446 | 0.374 → 0.365 |

`cleanliness.test.ts` bounds are ratcheted down to match, and SERV joins it as a
second fixture — the bound had only ever been measured against a design written
for this importer, and unmodified upstream Verilog was over it.
