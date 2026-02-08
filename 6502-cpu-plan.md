# 6502 CPU Implementation Plan

**Status:** Stage 3 COMPLETE ✅ | Stage 4+ Ready to start

**Philosophy:** Prove each stage works before moving to the next. Start simple, validate thoroughly, then scale up.

**Last Updated:** 2026-02-08

---

## Current Progress

### Stage 1: ✅ COMPLETE
- 8-bit ALU (ADD, SUB, AND, OR, XOR) with flags
- Register architecture (A, X, Y registers)
- Multi-cycle sequential execution working
- ~150 components total
- Working files: `01-alu-combined.dsl`, `02-register-file.dsl`, `04-stage1-flat.dsl`

### Stage 2: ✅ COMPLETE
- Program Counter (16-bit with increment/load)
- Instruction Decoder (LDA, ADC, STA, JMP, BRK)
- Control FSM (FETCH, DECODE, EXECUTE states)
- ~250-300 components cumulative
- Working files: `05-program-counter.dsl`, `06-instruction-decoder.dsl`, `07-control-fsm.dsl`, `08-cpu-stage2.dsl`
- Documentation: `STAGE2-COMPLETE.md`

### Stage 3: ✅ COMPLETE
- Proper instruction execution (LDA loads, ADC adds)
- Memory operations working (STA, LDA from memory)
- X register with TAX, INX instructions
- Memory controller with RAM
- ~400-500 components cumulative
- Working files: `15-stage3-complete.dsl`
- Test program: `LDA #$42, STA $0010, LDA $0010, TAX, INX` → A=0x42, X=0x43 ✅
- Documentation: `STAGE3-PLAN.md`, `STAGE3-TEST-SPEC.md`

### Key Achievement: Flat Simulator Migration
- Elaboration architecture implemented (compile-time circuit flattening)
- Fixed value propagation bugs that were blocking Stage 3
- Old hierarchical simulator deleted
- All 533 tests passing

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     CPU6502                              │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │  Registers   │    │     ALU      │    │  Flags   │  │
│  │  - A (8-bit) │◄───│  - Adder     │───►│  - N,Z   │  │
│  │  - X (8-bit) │    │  - Logic     │    │  - C,V   │  │
│  │  - Y (8-bit) │    │  - Shifter   │    └──────────┘  │
│  │  - SP (8-bit)│    └──────────────┘                   │
│  │  - PC (16b)  │                                       │
│  └──────────────┘    ┌──────────────┐    ┌──────────┐  │
│                      │ Instruction  │    │   FSM    │  │
│         ┌───────────►│   Decoder    │───►│ Control  │  │
│         │            └──────────────┘    │  Logic   │  │
│         │                                └──────────┘  │
│    ┌────┴─────┐                                        │
│    │  Memory  │                                        │
│    │Interface │◄───────────────────────────────────────┤
│    └──────────┘                                        │
└─────────────────────────────────────────────────────────┘
         │
         ▼
   Memory (JS Array)
   - $0000-$07FF: RAM
   - $8000-$FFFF: ROM
```

**Clock Strategy:** Single global clock (1 tick = 1 CPU cycle)

---

## Implementation Stages

### Stage 2: Instruction Fetch & Decode
**Goal:** Execute sequence of instructions from memory. Fetch-decode-execute cycle.

**Components:**
- Program Counter (16-bit)
- Instruction Decoder (LDA, ADC, STA, JMP, BRK)
- CPU Control FSM (FETCH, DECODE, EXECUTE states)
- Minimal CPU Integration

**Test Program:** LDA #$42, ADC #$08, STA $FFFE

**Estimated:** 250-300 components cumulative

### Stage 3: Memory Operations & Addressing Modes
**Goal:** Full memory model (RAM + ROM), multiple addressing modes.

**Components:**
- Memory Controller (RAM/ROM separation)
- Addressing Mode Calculator (immediate, absolute, zero-page, indexed)

**New Instructions:** LDX, LDY, STX, STY, TAX, TAY, INX, DEX

**Estimated:** 400-500 components cumulative

### Stage 4: Stack & Subroutines
**Goal:** Stack pointer, JSR/RTS, PHA/PLA. Enable subroutine calls.

**Components:**
- Stack Pointer (8-bit with increment/decrement)
- Extended Control FSM (multi-cycle instructions)

**New Instructions:** JSR, RTS, PHA, PLA, PHP, PLP

**Estimated:** 600-700 components cumulative

### Stage 5: Branches & Flags
**Goal:** Conditional branches, complete flag register.

**Components:**
- Flag Register (N, Z, C, V)
- Branch Logic Unit

**New Instructions:** BEQ, BNE, BCC, BCS, BMI, BPL, BVC, BVS, CMP, CPX, CPY

**Estimated:** 800-900 components cumulative

### Stage 6: Full 6502 ISA
**Goal:** All remaining instructions. Full 6502 compatibility.

**Remaining:** SBC, INC, DEC, AND, ORA, EOR, BIT, ASL, LSR, ROL, ROR, NOP, SEI, CLI, SEC, CLC, SED, CLD

**Test:** Klaus Dormann 6502 functional test suite

**Estimated:** 900-1000 components (final)

### Stage 7: C Code Integration (cc65)
**Goal:** Run C programs compiled with cc65.

**Features:**
- Memory-mapped console output (0xF000)
- cc65 runtime integration
- UI console component

**Test:** Fibonacci program in C

### Stage 8: NES PPU Integration (Optional)
**Goal:** Add NES Picture Processing Unit for running NES games.

**Estimated:** 300-500 components (PPU only)

---

## Timeline & Milestones

| Stage | Duration | Cumulative | Key Milestone |
|-------|----------|------------|---------------|
| Stage 1 | ✅ Done | ✅ Done | ALU + registers work |
| Stage 2 | 4-5 days | 7-9 days | Execute instruction sequence |
| Stage 3 | 3-4 days | 10-13 days | Memory operations work |
| Stage 4 | 3-4 days | 13-17 days | Subroutines work |
| Stage 5 | 3-4 days | 16-21 days | Branches work |
| Stage 6 | 5-7 days | 21-28 days | Klaus test passes ✅ |
| Stage 7 | 2-3 days | 23-31 days | C programs run ✅ |
| Stage 8 | 7-10 days | 30-41 days | NES games run ✅ |

---

## Success Criteria

### Technical Milestones
- ✅ Stage 1: ALU performs all operations, registers hold state
- ✅ Stage 2: Fetch-decode-execute cycle works, 3+ instructions execute
- ✅ Stage 3: Memory operations work, X register works (TAX, INX)
- ⏸ Stage 4: Stack operations work, JSR/RTS work
- ⏸ Stage 5: All branches work based on flags
- ⏸ Stage 6: Klaus 6502 functional test passes (full ISA validation)
- ⏸ Stage 7: cc65 compiled C programs execute, printf works
- ⏸ Stage 8: NES ROM loads and runs

### Quality Criteria
- All tests pass
- Cycle-accurate timing (correct CPI for each instruction)
- No combinational loops
- Clean FSM state machines
- Comprehensive error handling

---

## Key Learnings from Stage 1

- DSL uses `Bus[8]` not `Bus<8>`
- Use decimal values in Constants (66 not 0x42)
- Primitive port names matter (Incrementer uses `in`/`out` not `input`/`output`)
- Sequential composites work correctly after simulator fix
- Keep registers as primitives OR use sequential composites (both work!)

---

## Critical Files

### Existing Files (Stage 1)
- `examples/cpu6502/01-alu-combined.dsl` - ALU with manual test
- `examples/cpu6502/02-register-file.dsl` - RegisterFile with manual test
- `examples/cpu6502/04-stage1-flat.dsl` - Complete integration demo
- `examples/cpu6502/15-stage3-complete.dsl` - Advanced CPU (WIP, has bugs)

### To Create (Stage 2+)
- `examples/cpu6502/05-program-counter.dsl`
- `examples/cpu6502/06-instruction-decoder.dsl`
- `examples/cpu6502/07-control-fsm.dsl`
- `examples/cpu6502/08-cpu-stage2.dsl`
- Test files for each stage

---

## Next Steps (Stage 4: Stack & Subroutines)

1. **Add Stack Pointer Register (8-bit)**
   - Starts at 0xFF (stack grows downward)
   - Increment/decrement logic
   - Stack is at page 1 (0x0100-0x01FF)

2. **Add Stack Instructions**
   - PHA - Push accumulator to stack
   - PLA - Pull accumulator from stack
   - PHP - Push processor status
   - PLP - Pull processor status

3. **Add Subroutine Instructions**
   - JSR abs - Jump to subroutine (push return address)
   - RTS - Return from subroutine (pull return address)

4. **Test Program**
   ```asm
   ; Main program
   JSR $0020    ; Call subroutine
   BRK          ; Halt

   ; Subroutine at $0020
   LDA #$42
   RTS          ; Return
   ```

---

*Plan Created: 2026-02-05*
*Last Updated: 2026-02-08*
*Approach: Staged implementation, test-driven, prove at each step*
