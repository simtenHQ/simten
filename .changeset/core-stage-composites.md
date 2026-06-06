---
"@simten/core": minor
---

RV32I_Core is now structured as drillable stage composites (IF/IFID/ID/IDEX/EX/EXMEM/MEMWB/WB plus hazard and forwarding units) instead of a flat 100-node netlist. External ports and behavior are unchanged; the flattened netlist is isomorphic (verified on a ULX3S: fibonacci output match, 69/69 firmware suite, 38/38 riscv-arch-test vs Spike). Flattened node IDs gain stage prefixes (e.g. `EX.alu` instead of `alu`), so anything addressing internal nodes by path needs updating.
