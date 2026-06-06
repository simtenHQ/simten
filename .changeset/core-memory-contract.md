---
"@simten/core": minor
---

Memory models follow the CPU data-bus contract: `RV32I_DataMem`, `RV32I_InstrMem`, and `DualPortROM` reads now return the raw word at the aligned address (`addr & ~3`); byte/half extraction and sign/zero extension happen in the CPU's WB-stage aligner, matching the FPGA memory and the riscv-arch-test harness. Previously these models pre-extracted, so unaligned byte/half loads (e.g. C string literals in compiled programs) read back 0 through RV32I_Core. Boards that placed an extra `RV32I_LoadAlign` on the ROM data path should remove it — it now double-extracts.
