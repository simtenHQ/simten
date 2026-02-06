# 6502 CPU Implementation Plan

**Status:** Stage 1 COMPLETE ✅ | Stage 2+ PAUSED (waiting for elaboration architecture)

**Philosophy:** Prove each stage works before moving to the next. Start simple, validate thoroughly, then scale up.

**Note:** This plan will resume after the circuit elaboration architecture is complete.

---

## Current Progress

### Stage 1: ✅ COMPLETE
- 8-bit ALU (ADD, SUB, AND, OR, XOR) with flags
- Register architecture (A, X, Y registers)
- Multi-cycle sequential execution working
- ~150 components total
- Working files: `01-alu-combined.dsl`, `02-register-file.dsl`, `04-stage1-flat.dsl`

### Key Achievement: Fixed Simulator Bug
- Sequential composites (like RegisterFile) caused false "Cycle detected" errors
- Modified `simulator-v0.1.ts` with `inferCircuitKind()` to classify circuits
- Sequential composites now treated as "state-breaking"

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
- ⏸ Stage 2: Fetch-decode-execute cycle works, 3+ instructions execute
- ⏸ Stage 3: All addressing modes work, memory operations correct
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

## Next Steps (After Elaboration)

1. **Build Program Counter (16-bit)**
   - Two 8-bit registers (low/high bytes)
   - Increment logic with carry propagation
   - Load capability for jumps

2. **Build Instruction Decoder**
   - Start with 5 instructions: LDA #imm, ADC #imm, STA abs, JMP abs, BRK
   - Comparators for each opcode
   - Output: instruction flags, addressing mode, cycle count

3. **Build Control FSM**
   - 4 states: FETCH, DECODE, EXECUTE, WRITEBACK
   - Cycle counter for multi-cycle instructions
   - Control signals: pc_increment, mem_read, mem_write, alu_enable

4. **Integrate Stage 2 CPU**
   - Wire together: PC, decoder, FSM, ALU, registers
   - Add ROM component
   - Test with simple 3-instruction program

---

*Plan Created: 2026-02-05*
*Approach: Staged implementation, test-driven, prove at each step*
*Resume after: Circuit elaboration architecture is complete*
