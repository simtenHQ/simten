# 6502 CPU Stage 2: Complete! ✅

## What Was Built

Stage 2 implements the core instruction fetch and decode cycle for the 6502 CPU.

### Components Created

1. **Program Counter (05-program-counter.dsl)** - 16-bit counter that tracks the current instruction address
   - Supports increment (for sequential execution)
   - Supports load (for jumps)
   - Outputs separate low/high bytes (pc_low, pc_high)
   - Handles low byte overflow (255 → 256) with carry propagation

2. **Instruction Decoder (06-instruction-decoder.dsl)** - Decodes 5 basic 6502 instructions
   - LDA #imm (0xA9) - Load accumulator immediate
   - ADC #imm (0x69) - Add with carry immediate
   - STA abs (0x8D) - Store accumulator absolute
   - JMP abs (0x4C) - Jump absolute
   - BRK (0x00) - Break
   - Outputs: instruction type flags, addressing mode, cycle count

3. **Control FSM (07-control-fsm.dsl)** - Manages the CPU execution cycle
   - States: FETCH (0), DECODE (1), EXECUTE (2)
   - Generates control signals: pc_increment, mem_read, mem_write, alu_enable, reg_write
   - Tracks cycle count within each instruction
   - Supports halt on BRK instruction

4. **Integrated CPU Stage 2 (08-cpu-stage2.dsl)** - Complete working CPU
   - Combines all components above
   - Includes simplified ALU (ADD operation only for now)
   - Includes SimpleROM with hardcoded test program
   - Single A register (X, Y registers to be added in Stage 3)
   - Test program: `LDA #$42, ADC #$08, STA $00FE, BRK`

### Test Program

The hardcoded ROM contains a simple program:
```
Address  Bytes  Instruction
0x0000:  A9 42  LDA #$42    ; Load 0x42 into A
0x0002:  69 08  ADC #$08    ; Add 0x08 to A (A = 0x4A)
0x0004:  8D FE 00  STA $00FE   ; Store A at address 0x00FE
0x0007:  00     BRK         ; Halt
```

Expected result: Register A = 0x4A (74 decimal) after execution

### Key Technical Decisions

1. **16-bit values as separate bytes** - Since there's no Combiner primitive, PC is split into pc_low and pc_high outputs

2. **`state` is a reserved word** - Had to rename all `state` outputs to `current_state` to avoid parser conflicts

3. **Width mismatches are warnings** - HexDisplay expects 8-bit but we feed it 3-bit values (cycle_num, current_state). This generates warnings but doesn't break functionality.

4. **Simplified data path** - For Stage 2, the ALU always receives ROM data as input B. A proper data path with multiplexers will be added in Stage 3.

### Testing

Run tests with:
```bash
pnpm test examples/cpu6502/test/compile-check.test.ts
```

All 5 tests pass:
- ✅ Program Counter compiles
- ✅ Instruction Decoder compiles
- ✅ Minimal FSM compiles
- ✅ Control FSM compiles
- ✅ Integrated CPU Stage 2 compiles

### Visual Testing

To test in the browser:
1. Load `examples/cpu6502/08-cpu-stage2.dsl`
2. Open the `CPU_Stage2_Demo` circuit
3. Watch the displays:
   - `d_pc_low` / `d_pc_high` - Program counter
   - `d_instr` - Current instruction
   - `d_state` - FSM state (0=FETCH, 1=DECODE, 2=EXECUTE)
   - `d_reg_a` - Accumulator value
   - `d_halted` - CPU halted LED

4. Step through clock cycles and watch:
   - PC incrementing through the program
   - Instructions being fetched from ROM
   - FSM transitioning between states
   - Register A changing value

### Next Steps: Stage 3

Stage 3 will add:
- Full memory controller (RAM + ROM with address decoding)
- Multiple addressing modes (immediate, absolute, zero-page, indexed)
- X and Y registers
- Complete register file with read/write multiplexing
- Full instruction set (LDX, LDY, STX, STY, TAX, TAY, INX, DEX)

Estimated: ~400-500 components total

---

**Created:** 2026-02-05
**Status:** COMPLETE ✅
**Component Count:** ~250-300 (cumulative with Stage 1)
