# RV32I CPU Debug Log

## Goal
Get UART output working from the synthesized RV32I CPU on ULX3S 85K.

## Hardware confirmed working
- ULX3S 25 MHz clock, pin G2
- UART TX pin L4, 115200 baud, CLKS_PER_BIT=217 ✓
- Standalone `uart_test_top.v` prints "HELLO\r\n" cleanly → UART hardware is not the problem

## CPU status
- **Simulation**: passes (load-use hazard stall implemented, RV32I_LoadAlignFull added)
- **Hardware**: garbled / no output

## Open questions
- Is the CPU executing instructions correctly at all?
- Is the UART write strobe firing at the right time?
- Is the correct byte reaching the UART data port?

## Key discovery
All `--rawN` tests (N>18) were silently running the C firmware due to a bug in the
`useRaw` check — only `--raw` through `--raw18` were listed. Fixed to use regex.
All prior "garbled/no output" results were the broken C firmware, not the raw tests.

## Tests run
| Test | Result | Conclusion |
|------|--------|------------|
| `uart_test_top.v` standalone | "HELLO" cleanly | UART HW + pin OK |
| `raw23` — unconditional `sw`, no poll | "AAAA..." cleanly | `sw`, forwarding, address decode all OK |
| `raw22` — `lw` poll + `beqz` + `sw` | "AAAA..." cleanly | load, branch, full polling loop OK |
| `hello.c` via CPU | no/garbled output | bug is somewhere in the C firmware execution |

## Current status
Basic pipeline (ALU, branches, loads, stores, forwarding, LBU, polling) all verified working.
C firmware still prints nothing. Untested: **AUIPC** and **JAL** (both used in C startup).

## Tests run (continued)
| Test | Result | Conclusion |
|------|--------|------------|
| `raw18` — sb to DMEM + lbu + sw | "AAAA..." | LBU byte-0, DMEM byte-store OK |
| `raw12` — C-style poll (`lw a5,0(a5)` + `andi` + `beqz`) | "AAAA..." | load-use hazard + C poll pattern OK |

| `raw25` — AUIPC + JAL + trap | "AAAA..." cleanly | JAL works, trap never reached |

## Confirmed working
AUIPC, JAL, sw, lw/poll/branch, LBU byte-0, DMEM byte-store, load-use hazard, forwarding.

## C firmware startup sequence (hello.c disassembly)
```
0x00: auipc sp, 0x11       ← tested ✓
0x04: addi  sp, sp, -32    ← stack frame
0x08: jal   ra, +8         ← call main() ← tested ✓
0x0C: j     0x0C           ← (never reached)
0x10: main(): ...
```

## What's untested
The C firmware writes a **string** from DMEM via a loop with:
- `lbu a4, 0(a3)` where a3 is a byte pointer that increments
- Counter in DMEM (sw/lw round-trip for the loop variable)
- Non-zero byte offsets for LBU (bytes 1, 2, 3 within a word)

Most likely culprit: **LBU with byte offset != 0** (data_addr[1:0] = 01, 10, 11).
raw18 only tested byte-0. The string "Hello, World!\n" has characters at all byte offsets.

| `raw26` — LBU byte offsets 0/1/2/3 | "ABCDABCD..." | All 4 byte lanes correct |

## Confirmed working
AUIPC, JAL, sw, lw/poll/branch, LBU all byte offsets (0-3), DMEM byte-store, load-use hazard, forwarding.

| `raw27` — LBU from IMEM addresses | "ABCDABCD..." | IMEM data reads work |

| `raw28` — ADD r-type | "AAAA..." | ADD works |
| `raw29` — BGE loop | "ABCDEABCDE..." | BGE works |

| `raw30` — exact C firmware poll (lui→lw→andi→beqz→lui) | "AAAA..." | WB forwarding of LUI works |
| `raw31` — full C firmware stack pattern (neg offsets, s0 frame ptr) | nothing | firmware bug: j skipped the `lw a4` loop check → a4 uninitialized on first iter |
| `raw32` — SW/LW negative offsets isolated | "AAAA..." | negative SW/LW offsets work |
| `raw33` — SB/LBU negative offsets isolated | "AAAA..." | negative SB/LBU offsets work |

## Disassembly obtained
`hello.c` uses `static const unsigned char msg[]` — a `static const` local.
GCC places this in `.rodata`, which our linker puts in **IMEM** (0x0–0x7FF range).
`cpu_top.v` has `sel_imem` for data reads from that range, and the mux does return `imem_rdata` when `sel_imem & data_mem_read`.
So IMEM reads *should* work — but this has never been tested with raw firmware.

## New suspect: load-use hazard on rs2 of ADD
Looking at the C firmware disassembly:
```
2c: lw  a5, -20(s0)   a5 = i
30: add a5, a4, a5    a5 = msg_addr + i  ← load-use hazard: a5 is rs2 of ADD!
34: lbu a5, 0(a5)     c = msg[i]
```
All previous load-use hazard tests used the loaded register as **rs1** of the next instruction.
This is the first case where it's used as **rs2**. If the hazard unit only checks rs1, the ADD
gets the stale value of a5, computing a garbage address, and lbu reads 0 → nothing prints.

## Root cause of raw36 failures: wrong `lui` encoding

All raw36 attempts printed nothing due to a bytecode encoding bug, not a CPU bug.

**The mistake:** `lui a5, 0x80000` was encoded as `0x80000737` (which is actually `lui a4`) instead of the correct `0x800007b7` (`lui a5`). The difference is the rd field: a4=14=`01110`, a5=15=`01111`.

**Effect:** The SW instruction `sw a4, 0(a5)` was writing to address `a5=0` (never set) instead of `0x80000000` (UART). The write went to IMEM address 0 silently.

**Discovered via:** Running the firmware through the TypeScript RTL simulator (`cpu_sim.ts`) which showed `data_addr=0x00000000 mem_w=1` at the SW cycle instead of `data_addr=0x80000000`.

**Fix:** Use `0x800007b7` for `lui a5, 0x80000` throughout.

| `raw36` — corrected encoding, poll + reload + send | "AAAA..." | Encoding fix confirmed, CPU fine |

| `raw36` — rs2 load-use hazard (lw a5 / add a4,x0,a5) | "AAAA..." | rs2 hazard stall works ✓ |

## Confirmed working
AUIPC, JAL, sw, lw/poll/branch, LBU all byte offsets (0-3), DMEM byte-store, SW/LW negative offsets, SB/LBU negative offsets, load-use hazard on rs1 AND rs2, forwarding, WB forwarding of LUI.

## Current status
All individual pipeline features verified. C firmware still fails.
Last known failure: **raw31** — full C firmware stack pattern printed nothing.
Diagnosis at the time: `j` at 0x08 jumps to loop check at 0x44 where `lw a4` executes first — but a4 was being used uninitialized on first iteration.
raw34 (raw31 with `lui s0` instead of auipc chain) result not yet recorded.

## Next: revisit raw34 / raw31
