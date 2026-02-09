# 6502 CPU Implementation Plan

**Status:** Stage 8A COMPLETE ✅ | Stage 8B NEXT: Full Memory Infrastructure

**Philosophy:** Prove each stage works before moving to the next. Start simple, validate thoroughly, then scale up.

**Last Updated:** 2026-02-09 (Stage 8A Complete - 16-bit PC, 194 tests passing)

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

### Stage 4: ✅ COMPLETE
- Stack Pointer (8-bit, initialized to 0xFF)
- Stack Memory (16 cells at $F0-$FF)
- PHA/PLA - Push/Pull Accumulator
- JSR/RTS - Subroutine call/return with correct return address (PC-1 pushed)
- ~600-700 components cumulative
- Working files: `16-stage4-memory.dsl`, `17-stage4-stack-ops.dsl`, `18-stage4-subroutines.dsl`, `19-stage4-complete.dsl`
- Test program: `LDA #$00, JSR $10, STA $20` with subroutine `LDA #$42, RTS` → A=0x42, Memory[$20]=0x42 ✅
- Tests: `test/stage4.test.ts` (14 tests passing)

### Stage 5: ✅ COMPLETE
- Flag Register (N, Z, C, V flags with individual update enables)
- CMP #imm instruction (compare A with immediate, sets flags)
- Branch instructions: BEQ, BNE, BCC, BCS, BMI, BPL
- Signed branch offset calculation
- ~800-900 components cumulative
- Working files: `20-stage5-flags.dsl`, `21-stage5-compare.dsl`, `22-stage5-branches.dsl`, `23-stage5-complete.dsl`
- Test program: `LDA #$05, CMP #$05, BEQ +2, LDA #$FF, STA $20, LDA #$42` → A=0x42 (branch taken!) ✅
- Tests: `test/stage5.test.ts` (19 tests passing)

### Key Achievement: Flat Simulator Migration
- Elaboration architecture implemented (compile-time circuit flattening)
- Fixed value propagation bugs that were blocking Stage 3
- Old hierarchical simulator deleted
- All 533 tests passing

### Stage 6: ✅ COMPLETE
- All 111 official 6502 instructions implemented
- All addressing modes: immediate, zero-page, zero-page,X/Y, absolute, absolute,X/Y, indirect, (indirect,X), (indirect),Y
- All flags working: N, V, B, D, I, Z, C
- V flag correctly computed for ADC/SBC (signed overflow detection)
- PHP/PLP for full processor status save/restore
- JMP indirect, RTI implemented
- Working files: `24-stage6-simple.dsl`
- Tests: `test/stage6.test.ts` (44 tests passing)
- Total tests: 168 tests passing across all stage test files

### Stage 7: ✅ COMPLETE
- CPU core separated from memory (pure logic, no internal ROM/RAM)
- External bus interface: `addr_lo`, `addr_hi`, `data_in`, `data_out`, `rw`
- MemoryBus with device routing (RAM256, ROM256)
- Open bus behavior (latches last read value)
- Stack operations use unified RAM at $0100-$01FF (not special memory)
- Critical fix: CPU outputs PC during operand fetch cycles (not just during FETCH state)
- Working files:
  - `32-memory-bus.dsl` - RAM256, ROM256, MemoryBus
  - `33-cpu-core.dsl` - CPU6502Core (extracted from Stage6CPU)
  - `34-system.dsl` - System6502 integration
  - `stage7-combined.dsl` - All-in-one file for UI loading
- Tests: `test/stage7.test.ts` (17 tests passing)
- Verified execution: SEC, SEI, PHP, CLC, CLI, PLP, LDA #$0F, AND #$F0, ORA #$F0, INY, INY, DEX, NOP

### Stage 8A: ✅ COMPLETE (16-bit PC)
- Split 8-bit `pc_reg` into two 8-bit registers: `pc_lo` and `pc_hi`
- 16-bit PC increment with carry propagation from pc_lo to pc_hi
- Page boundary detection (pc_lo == 0xFF triggers pc_hi increment)
- 16-bit PC-1 calculation for JSR with borrow propagation
- 16-bit branch target calculation with sign extension for 8-bit offsets
- 16-bit RTS return address reconstruction (pc_lo_temp + pc_hi_temp + 1)
- Fixed `final_addr_hi` to output `pc_hi` during fetch (was hardcoded to 0)
- Fixed `final_addr_hi` to use `addr_hi_reg` for absolute addressing
- Added `pc_hi_out` output for 16-bit PC debugging
- Updated System6502 with `pc_hi` output
- Working files:
  - `33-cpu-core.dsl` - Updated with 16-bit PC logic
  - `34-system.dsl` - Added pc_hi output
  - `stage7-combined.dsl` - Regenerated with all changes
- Tests: `test/stage8a.test.ts` (9 tests passing)
- Total tests: 194 tests passing across all stage test files

**Stage 8A enables:** PC can now address full 64KB space. JMP/JSR/RTS/branches work across page boundaries.

**Remaining (Stage 8B):** ROM primitive still 8-bit, need ROM16K at $C000, RAM2K at $0000, reset vector fetch.

### Key Achievement: Elaboration Fan-Out Fix
- Fixed clock fan-out through nested composites (resolveInternalPorts now returns array)
- Fixed Register primitive to handle boolean (Bit) data values
- Both fixes were critical for Stage 5 flag register to work correctly

---

## Architecture Overview

### Current (Stage 7 - Bus Architecture ✅ IMPLEMENTED)
```
┌─────────────────┐     ┌─────────────────┐
│  CPU6502Core    │────▶│   MemoryBus     │
│  (pure logic)   │◀────│ (device router) │
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌─────────┐  ┌─────────┐  ┌─────────┐
              │ RAM256  │  │   IO    │  │ ROM256  │
              │$0000-FF │  │ (later) │  │$0000-FF │
              │+ stack  │  └─────────┘  │(overlay)│
              │$0100-FF │               └─────────┘
              └─────────┘

Note: ROM overlays RAM at $00XX for reads (ROM priority)
      Stack at $01XX uses same RAM (256 bytes total)
      8-bit PC limits ROM to 256 bytes
```

### Target (Stage 8 - Full 16-bit Addressing)
```
┌─────────────────────────────────────────────────────────┐
│                   CPU6502Core                            │
│              (Pure logic - NO memory)                    │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │  Registers   │    │     ALU      │    │  Flags   │  │
│  │  - A (8-bit) │◄───│  - Adder     │───►│  - N,Z   │  │
│  │  - X (8-bit) │    │  - Logic     │    │  - C,V,D │  │
│  │  - Y (8-bit) │    │  - Shifter   │    │  - I,B   │  │
│  │  - SP (8-bit)│    └──────────────┘    └──────────┘  │
│  │  - PC (16b)  │                                       │
│  └──────────────┘    ┌──────────────┐    ┌──────────┐  │
│                      │ Instruction  │    │   FSM    │  │
│                      │   Decoder    │───►│ Control  │  │
│                      └──────────────┘    └──────────┘  │
├─────────────────────────────────────────────────────────┤
│  BUS INTERFACE (active low accent accent accent like real 6502)             │
│  ┌──────────────────────────────────────────────────┐   │
│  │  addr[15:0]    - 16-bit address bus (output)     │   │
│  │  data_in[7:0]  - 8-bit data from memory (input)  │   │
│  │  data_out[7:0] - 8-bit data to memory (output)   │   │
│  │  rw            - Read/Write (1=read, 0=write)    │   │
│  │  sync          - High during opcode fetch        │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
                   ┌────────┴────────┐
                   │   Memory Bus    │
                   │ (Address Decode)│
                   └────────┬────────┘
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
    ┌──────────┐      ┌──────────┐      ┌──────────┐
    │   RAM    │      │    IO    │      │   ROM    │
    │$0000-07FF│      │$2000-5FFF│      │$C000-FFFF│
    ├──────────┤      ├──────────┤      ├──────────┤
    │Zero Page │      │ Console  │      │ Program  │
    │$0000-00FF│      │ Buttons  │      │ (loaded) │
    ├──────────┤      │ Display  │      │          │
    │  Stack   │      └──────────┘      └──────────┘
    │$0100-01FF│
    ├──────────┤
    │ General  │
    │$0200-07FF│
    └──────────┘
```

### Memory Bus Design Principles

**1. Device-based architecture (not hardcoded ranges):**
```
MemoryBus {
  devices: [
    { device: RAM,  base: 0x0000, size: 0x0800, mirror: 0x0800 },
    { device: IO,   base: 0x2000, size: 0x2000 },
    { device: ROM,  base: 0xC000, size: 0x4000 },
  ]
}
```

**2. Each device decides if it responds:**
```
Device {
  input addr[16]
  input data_in[8]
  output data_out[8]
  output responds: Bit  // "I handle this address"
}
```

**3. Open bus behavior:**
- Unmapped addresses return `last_data_bus_value`
- Important for real test ROM compatibility
- Model early: `node last_data: Register` latches bus on every read

**4. Stack is NOT special memory:**
- Stack Pointer (SP) lives in CPU
- Stack memory = RAM at $0100-$01FF
- Push: write to `addr = 0x0100 | SP`, then `SP--`
- Pull: `SP++`, then read from `addr = 0x0100 | SP`

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

### Stage 6: Full 6502 ISA ✅ COMPLETE
**Goal:** All remaining instructions. Full 6502 compatibility.

**Completed:** All 111 instructions + V flag fix for ADC/SBC

**Estimated:** 900-1000 components (final)

---

### Stage 7: Bus Architecture Refactor ✅ COMPLETE
**Goal:** Separate CPU core from memory. Enable loading real binaries.

**What was implemented:**

#### CPU6502Core (pure logic)
```dsl
circuit CPU6502Core {
  input reset: Bit
  input data_in: Bus[8]      // Data from memory bus

  output addr_lo: Bus[8]     // Address low byte
  output addr_hi: Bus[8]     // Address high byte (0=zero page, 1=stack)
  output data_out: Bus[8]    // Data to memory bus
  output rw: Bit             // 1=read, 0=write

  // Debug outputs: pc, instruction, reg_a/x/y, reg_sp, flags
  clock clk
}
```

#### Memory Components
- **RAM256**: 256-byte RAM using RAM primitive
- **ROM256**: 256-byte ROM with hardcoded test program via ROM(data=[...])
- **MemoryBus**: Routes addresses to RAM/ROM with open bus behavior

#### System Integration
```dsl
circuit System6502 {
  node cpu: CPU6502Core
  node mem_bus: MemoryBus

  // CPU -> Bus
  connect cpu.addr_lo -> mem_bus.addr_lo
  connect cpu.addr_hi -> mem_bus.addr_hi
  connect cpu.data_out -> mem_bus.data_in
  connect cpu.rw -> mem_bus.rw

  // Bus -> CPU
  connect mem_bus.data_out -> cpu.data_in
}
```

**Key fix required:** CPU must output PC on address bus during operand fetch (exec_sub0), not just during FETCH state. Added `use_pc_for_addr` signal.

**Implementation completed:**
- [x] Extract CPU6502Core from Stage6CPU (remove all memory)
- [x] Create RAM256 (256 bytes, shared for zero page + stack)
- [x] Create ROM256 (256 bytes with test program)
- [x] Create MemoryBus with open-bus behavior
- [x] Create System6502 integration
- [x] Create Stage7Test with displays
- [x] Add stage7.test.ts (17 tests)
- [x] Verify execution: all register values correct

**Current limitations (for Stage 8B):**
- ROM primitive still 8-bit addressing
- ROM program hardcoded in DSL (not loadable)
- No reset vector fetch
- No IO devices yet

---

### Stage 8: Full 16-bit Addressing
**Goal:** Expand to full 64KB address space, loadable programs.

#### Phase A: 16-bit PC ✅ COMPLETE
- [x] Split `pc_reg` into `pc_lo` + `pc_hi` registers
- [x] 16-bit PC increment with carry propagation
- [x] 16-bit PC-1 for JSR with borrow propagation
- [x] 16-bit branch target with sign-extended offset
- [x] 16-bit RTS return address (pc_lo_temp + pc_hi_temp + 1)
- [x] Fix `final_addr_hi` to use `pc_hi` during fetch
- [x] Fix `final_addr_hi` to use `addr_hi_reg` for absolute addressing
- [x] JMP/JSR load full 16-bit PC from addr_lo_reg/addr_hi_reg
- [x] Add `pc_hi_out` output, update System6502
- [x] Create `test/stage8a.test.ts` (9 tests)
- [x] Full regression (194 tests passing)

#### Phase B: Full Memory Infrastructure 🔧 NEXT
- [ ] Update ROM primitive to 16-bit addressing (`primitives.ts`)
- [ ] Create ROM16K at $C000-$FFFF (`32-memory-bus.dsl`)
- [ ] Create RAM2K at $0000-$07FF (`32-memory-bus.dsl`)
- [ ] Add reset vector fetch from $FFFC/$FFFD (`33-cpu-core.dsl`)
- [ ] Update MemoryBus address decode for new memory map
- [ ] Create `test/stage8b.test.ts`

**Estimated:** Medium effort - ROM primitive change, memory map refactor

---

### Stage 9: C Code Integration (cc65)
**Goal:** Run C programs compiled with cc65.

**Features:**
- Memory-mapped console output (0xF000)
- cc65 runtime integration
- UI console component

**Test:** Fibonacci program in C

### Stage 10: NES PPU Integration (Optional)
**Goal:** Add NES Picture Processing Unit for running NES games.

**Estimated:** 300-500 components (PPU only)

---

## Timeline & Milestones

| Stage | Duration | Cumulative | Key Milestone |
|-------|----------|------------|---------------|
| Stage 1 | ✅ Done | ✅ Done | ALU + registers work |
| Stage 2 | ✅ Done | ✅ Done | Execute instruction sequence |
| Stage 3 | ✅ Done | ✅ Done | Memory operations work |
| Stage 4 | ✅ Done | ✅ Done | Subroutines work |
| Stage 5 | ✅ Done | ✅ Done | Branches work |
| Stage 6 | ✅ Done | ✅ Done | All 111 instructions + V flag |
| Stage 7 | ✅ Done | ✅ Done | Bus architecture, CPU separated from memory |
| Stage 8A | ✅ Done | ✅ Done | 16-bit PC, page boundary crossing |
| Stage 8B | 🔧 NEXT | — | ROM/RAM expansion, reset vector |
| Stage 9 | — | — | C programs run (cc65) |
| Stage 10 | — | — | NES games run (PPU) |

---

## Success Criteria

### Technical Milestones
- ✅ Stage 1: ALU performs all operations, registers hold state
- ✅ Stage 2: Fetch-decode-execute cycle works, 3+ instructions execute
- ✅ Stage 3: Memory operations work, X register works (TAX, INX)
- ✅ Stage 4: Stack operations work, JSR/RTS work
- ✅ Stage 5: All branches work based on flags
- ✅ Stage 6: All 111 instructions work, V flag correct for ADC/SBC
- ✅ Stage 7: CPU separated from memory, bus architecture works, stack at $01XX
- ✅ Stage 8A: 16-bit PC works, JMP/JSR/RTS/branches cross page boundaries
- 🔧 Stage 8B: Full 64KB addressing, ROM at $C000, reset vector fetch
- ⏸ Stage 9: cc65 compiled C programs execute, printf works
- ⏸ Stage 10: NES ROM loads and runs

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

### Stage 6 (Monolithic CPU - reference)
- `examples/cpu6502/24-stage6-simple.dsl` - Complete CPU with internal memory

### Stage 7 (Bus Architecture)
- `examples/cpu6502/32-memory-bus.dsl` - RAM256, ROM256, MemoryBus components
- `examples/cpu6502/33-cpu-core.dsl` - CPU6502Core (pure logic, no memory)
- `examples/cpu6502/34-system.dsl` - System6502 integration
- `examples/cpu6502/stage7-combined.dsl` - All-in-one for UI loading
- `examples/cpu6502/test/stage7.test.ts` - Bus architecture tests (17 tests)

### Stage 8A (16-bit PC - current)
- `examples/cpu6502/33-cpu-core.dsl` - Updated with 16-bit PC (pc_lo/pc_hi split)
- `examples/cpu6502/34-system.dsl` - Updated with pc_hi output
- `examples/cpu6502/stage7-combined.dsl` - Regenerated with 16-bit PC
- `examples/cpu6502/test/stage8a.test.ts` - 16-bit PC tests (9 tests)
- Total: 194 tests passing across all test files

### Earlier Stages (reference)
- `examples/cpu6502/01-alu-combined.dsl` - ALU with manual test
- `examples/cpu6502/02-register-file.dsl` - RegisterFile with manual test
- `examples/cpu6502/04-stage1-flat.dsl` - Stage 1 integration demo
- `examples/cpu6502/15-stage3-complete.dsl` - Stage 3 CPU
- `examples/cpu6502/19-stage4-complete.dsl` - Stage 4 CPU
- `examples/cpu6502/23-stage5-complete.dsl` - Stage 5 CPU

---

## Klaus Dormann Test Roadmap

**Goal:** Pass the Klaus Dormann 6502 functional test - the gold standard for 6502 compatibility.

**Current Status:** 111 instructions implemented with V flag fix - READY FOR KLAUS TEST

---

### ✅ IMPLEMENTED (78 instructions)

**Load/Store - Immediate & Zero Page:**
- [x] LDA #imm (0xA9), LDA zp (0xA5), LDA abs (0xAD)
- [x] LDX #imm (0xA2), LDY #imm (0xA0)
- [x] STA zp (0x85), STA abs (0x8D)
- [x] STX zp (0x86), STY zp (0x84)

**Arithmetic - Immediate:**
- [x] ADC #imm (0x69), SBC #imm (0xE9)

**Logic - Immediate:**
- [x] AND #imm (0x29), ORA #imm (0x09), EOR #imm (0x49)

**Compare - Immediate:**
- [x] CMP #imm (0xC9), CPX #imm (0xE0), CPY #imm (0xC0)

**Register Transfers:**
- [x] TAX (0xAA), TXA (0x8A), TAY (0xA8), TYA (0x98)
- [x] TXS (0x9A), TSX (0xBA)

**Increment/Decrement - Registers:**
- [x] INX (0xE8), DEX (0xCA), INY (0xC8), DEY (0x88)

**Increment/Decrement - Memory (Zero Page):**
- [x] INC zp (0xE6), DEC zp (0xC6)

**Shift/Rotate - Accumulator:**
- [x] ASL A (0x0A), LSR A (0x4A), ROL A (0x2A), ROR A (0x6A)

**Shift/Rotate - Zero Page:**
- [x] ASL zp (0x06), LSR zp (0x46), ROL zp (0x26), ROR zp (0x66)

**Stack Operations:**
- [x] PHA (0x48), PLA (0x68)
- [x] PHP (0x08), PLP (0x28)

**Subroutine Instructions:**
- [x] JSR (0x20), RTS (0x60)

**Branch Instructions (all 8):**
- [x] BEQ (0xF0), BNE (0xD0)
- [x] BCC (0x90), BCS (0xB0)
- [x] BMI (0x30), BPL (0x10)
- [x] BVC (0x50), BVS (0x70)

**Flag Instructions (all 7):**
- [x] SEC (0x38), CLC (0x18)
- [x] SEI (0x78), CLI (0x58)
- [x] SED (0xF8), CLD (0xD8)
- [x] CLV (0xB8)

**Bit Test:**
- [x] BIT zp (0x24), BIT abs (0x2C)

**Jump:**
- [x] JMP abs (0x4C)

**Other:**
- [x] NOP (0xEA), BRK (0x00)

**Indexed Addressing Modes (major achievement!):**
- [x] Zero-page,X: LDA (0xB5), STA (0x95), ADC (0x75), SBC (0xF5), AND (0x35), ORA (0x15), EOR (0x55), CMP (0xD5)
- [x] Zero-page,Y: LDX (0xB6), STX (0x96)
- [x] Absolute,X: LDA (0xBD), STA (0x9D), ADC (0x7D), SBC (0xFD), AND (0x3D), ORA (0x1D), EOR (0x5D), CMP (0xDD)
- [x] Absolute,Y: LDA (0xB9), STA (0x99), ADC (0x79), SBC (0xF9), AND (0x39), ORA (0x19), EOR (0x59), CMP (0xD9), LDX (0xBE)
- [x] Indirect,X: LDA (0xA1), STA (0x81), ADC (0x61), SBC (0xE1), AND (0x21), ORA (0x01), EOR (0x41), CMP (0xC1)
- [x] Indirect,Y: LDA (0xB1), STA (0x91), ADC (0x71), SBC (0xF1), AND (0x31), ORA (0x11), EOR (0x51), CMP (0xD1)

---

### ❌ REMAINING (~33 instructions)

#### Part 17: Jump & Interrupt (2 instructions) ✅ COMPLETE
- [x] JMP indirect (0x6C) - Jump via pointer (reads address from memory)
- [x] RTI (0x40) - Return from Interrupt (pulls P, then PC from stack)

#### Part 18: Shifts - Additional Modes (12 instructions) ✅ COMPLETE
**Zero-page,X:**
- [x] ASL zp,X (0x16)
- [x] LSR zp,X (0x56)
- [x] ROL zp,X (0x36)
- [x] ROR zp,X (0x76)

**Absolute:**
- [x] ASL abs (0x0E)
- [x] LSR abs (0x4E)
- [x] ROL abs (0x2E)
- [x] ROR abs (0x6E)

**Absolute,X:**
- [x] ASL abs,X (0x1E)
- [x] LSR abs,X (0x5E)
- [x] ROL abs,X (0x3E)
- [x] ROR abs,X (0x7E)

#### Part 19: INC/DEC - Additional Modes (6 instructions) ✅ COMPLETE
**Zero-page,X:**
- [x] INC zp,X (0xF6)
- [x] DEC zp,X (0xD6)

**Absolute:**
- [x] INC abs (0xEE)
- [x] DEC abs (0xCE)

**Absolute,X:**
- [x] INC abs,X (0xFE)
- [x] DEC abs,X (0xDE)

#### Part 20: Compare - Additional Modes (4 instructions) ✅ COMPLETE
**Zero Page:**
- [x] CPX zp (0xE4)
- [x] CPY zp (0xC4)

**Absolute:**
- [x] CPX abs (0xEC)
- [x] CPY abs (0xCC)

#### Part 21: Load/Store - Additional Modes (9 instructions) ✅ COMPLETE
**LDX additional modes:**
- [x] LDX zp (0xA6)
- [x] LDX abs (0xAE)

**LDY additional modes:**
- [x] LDY zp (0xA4)
- [x] LDY zp,X (0xB4)
- [x] LDY abs (0xAC)
- [x] LDY abs,X (0xBC)

**STX additional modes:**
- [x] STX abs (0x8E)

**STY additional modes:**
- [x] STY zp,X (0x94)
- [x] STY abs (0x8C)

#### Part 22: Flag Fixes ✅ COMPLETE
- [x] ADC/SBC V flag - proper signed overflow detection
  - Implemented V = (A[7] == M[7]) AND (result[7] != A[7]) for ADC
  - Implemented V = (A[7] != M[7]) AND (result[7] != A[7]) for SBC
  - Added splitters for operand and result bit 7 extraction
  - Extended update_v_signal to trigger on ADC/SBC
  - All test cases pass for signed overflow detection

---

### Implementation Priority Order

1. **Part 17: JMP indirect + RTI** (2) - ✅ COMPLETE
2. **Part 18: Shifts additional modes** (12) - ✅ COMPLETE
3. **Part 19: INC/DEC additional modes** (6) - ✅ COMPLETE
4. **Part 20: Compare additional modes** (4) - ✅ COMPLETE
5. **Part 21: Load/Store additional modes** (9) - ✅ COMPLETE
6. **Part 22: V flag fix** - ✅ COMPLETE

**Stage 6 Complete: All 111 instructions + V flag fix implemented**

---

### Klaus Test Success Criteria

1. All 56 official 6502 opcodes work correctly
2. All 13 addressing modes work correctly
3. All 8 branch conditions work correctly
4. All 7 flags (N, V, -, B, D, I, Z, C) set correctly
5. Stack operations preserve return addresses correctly
6. Interrupt return (RTI) works correctly

---

### Test Strategy

Each "Part" should have:
1. **Structural tests** - Verify control signals exist
2. **Execution tests** - Run actual programs and verify results
3. **Edge case tests** - Boundary conditions (wrap, overflow, etc.)

---

### Estimated Effort

| Part | Instructions | Complexity | Notes |
|------|-------------|------------|-------|
| 17   | 2           | Medium     | JMP indirect needs address fetch, RTI needs flag restore |
| 18   | 12          | Low        | Pattern already exists from zp shifts |
| 19   | 6           | Low        | Pattern already exists from zp INC/DEC |
| 20   | 4           | Low        | Pattern already exists from imm compares |
| 21   | 9           | Low        | Pattern already exists from LDA/STA |
| 22   | 1           | Medium     | V flag math needs careful implementation |

**Total: 6 parts to complete Stage 6**

---

*Plan Created: 2026-02-05*
*Last Updated: 2026-02-09 (Stage 8A Complete - 16-bit PC, 194 tests passing)*
*Approach: Staged implementation, test-driven, prove at each step*
*Target: Klaus Dormann 6502 Functional Test*
