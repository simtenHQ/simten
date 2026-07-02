---
"@simten/core": minor
---

`DualPortRAM` now takes `addressWidth` and `dataWidth` options (both default 8, so existing uses are unchanged). A wider `addressWidth` grows the memory to `2 ** addressWidth` words — e.g. `DualPortRAM({ addressWidth: 9 })` for a 512-word memory. The Verilog exporter already read these arguments, so the emitted memory depth/width now match simulation.
