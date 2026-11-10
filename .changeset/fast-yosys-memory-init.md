---
"@simten/core": patch
---

Exported Verilog skips the memory-zeroing loop under Yosys, so `write_cxxrtl` no longer takes minutes on 64K memories.
