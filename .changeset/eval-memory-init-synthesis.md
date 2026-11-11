---
'@simten/core': patch
---

Verilog export: a memory's initial contents in an `eval`/`onTick` circuit now go out for `target: 'synthesis'` too. They were only written for simulation, so a lookup table read 0 on an FPGA.
