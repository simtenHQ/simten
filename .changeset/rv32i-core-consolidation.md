---
"@simten/core": minor
"@simten/hardware-ulx3s": patch
---

Add canonical `RV32I_Core` to `@simten/core/std` as the single source of truth for the 5-stage pipelined RV32I CPU datapath (previously hand-wired and drifting across three copies). The FPGA build now imports it instead of an inline copy — verified byte-identical at the flattened-netlist level and locked by a CI guard (`dump-netlist --check` against a hardware-provenanced golden). An optional `debug` flag exposes a register scan port and the five pipeline-stage PCs as outputs.
