---
"@simten/core": minor
---

The Verilog importer now handles integer divide and remainder (`$div`, `$mod`), signed and unsigned, plus reduction XNOR (`$reduce_xnor`). Adds five stdlib components — `Divider`, `Modulo`, `SignedDivider`, `SignedModulo`, `ReduceXnor` — and lifts the cells onto them (signed div/mod variant when both operands are signed). Signed division truncates toward zero and remainder takes the sign of the dividend (Verilog semantics); division/modulo by zero returns all-ones / the dividend respectively (Verilog leaves it undefined). Verified against iverilog across a grid of unsigned and signed cases. With these, the whole `snbk001/Verilog-Design-Examples` ALU imports clean. Closes the `$div`/`$mod`/`$reduce_xnor` items in #249.

(Verilog *export* of these components — a `primitive-map` entry — is not included yet; the import + simulate path is complete.)
