---
"@simten/core": minor
---

Register gains an optional synchronous reset input (`rst`): when high, `q` clears to 0 on the next clock edge, overriding `data`/`we`. Leaving `rst` unconnected (reads 0) keeps existing registers unchanged, so the addition is backward-compatible and the synthesized FPGA netlist is byte-identical.

The Verilog importer uses this to lift the reset/enable flip-flop family — `$adff` (async reset), `$sdff` (sync reset), and `$dffe` (clock-enable) — onto stdlib `Register` instead of throwing. Async resets are modeled synchronously, which is exact under simten's cycle-accurate simulation for any reset held across a clock edge. A reset to 0 uses `Register.rst`; a non-zero reset preset folds the value into the data path via a `Mux` + `Constant`, so presettable counters/timers import too. Verified against iverilog: an imported synchronous FIFO (reset-to-0) and a 4-bit counter (reset-to-8) each match byte-for-byte on reset, flags, and all defined data. Closes #237.
