---
'@simten/core': minor
---

Add `MOS6502_Core`, a cycle-accurate NMOS 6502 built from the chip's block diagram (decode PLA, ALU with decimal mode, registers, DB/SB/ADL/ADH buses), and `MOS6502_ALU`. It passes Tom Harte's SingleStepTests for all 151 documented opcodes and Klaus Dormann's functional and decimal tests. Adds a `6502-computer` example: the core with 2 KB RAM, ROM and a console.
