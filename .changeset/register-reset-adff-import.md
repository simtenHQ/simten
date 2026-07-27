---
"@simten/core": minor
---

Register gains an optional synchronous reset input (`rst`): when high, `q` clears to 0 on the next clock edge, overriding `data`/`we`. Leaving `rst` unconnected (reads 0) keeps existing registers unchanged, so the addition is backward-compatible and the synthesized FPGA netlist is byte-identical.

The Verilog importer uses this to lift the reset/enable flip-flop family — `$adff` (async reset), `$sdff` (sync reset), and `$dffe` (clock-enable) — onto stdlib `Register` instead of throwing. Async resets are modeled synchronously, which is exact under simten's cycle-accurate simulation for any reset held across a clock edge. Verified against iverilog: an imported synchronous FIFO matches byte-for-byte on reset, flags, and all defined data. Closes #237.
