# 6502 CPU Implementation

A gate-level 6502 CPU implementation built using the Turing Incomplete DSL, progressing through staged development from basic ALU operations to a full instruction-executing processor.

## Project Status

**Stage 1: ALU + Registers** ✅ **COMPLETE**

## Stage 1: Foundation (ALU + Registers)

### Overview

Stage 1 proves the fundamental building blocks work:
- 8-bit ALU performing arithmetic and logic operations
- Register file with multiple registers (A, X, Y)
- Sequential circuit execution with proper clock cycle behavior
- Modular architecture using composites

### Components Built

#### 1. **ALU (Arithmetic Logic Unit)** - `01-alu-combined.dsl`
- **Type**: Combinational composite
- **Operations**: ADD, SUB, AND, OR, XOR
- **Inputs**:
  - `a`, `b` (8-bit operands)
  - `op` (3-bit operation selector)
  - `carry_in` (1-bit)
- **Outputs**:
  - `result` (8-bit)
  - `carry_out`, `zero`, `negative` flags
- **Testing**: `ALUManualTest` circuit with manual Input controls

#### 2. **Register File** - `02-register-file.dsl`
- **Type**: Sequential composite (contains Registers)
- **Registers**: A, X, Y (8-bit each)
- **Write Port**: `write_sel` (2-bit), `write_data` (8-bit), `write_enable` (1-bit)
- **Read Port**: `read_sel` (2-bit), `read_data` (8-bit)
- **Testing**: `RegisterFileTest` circuit with manual controls

#### 3. **Stage 1 Integration** - `04-stage1-flat.dsl`
- **Type**: Complete sequential system
- **Demonstration**: Multi-cycle program execution
  - Cycle 0: Initial state
  - Cycle 1: A ← 66 (0x42)
  - Cycle 2: A ← A + 8 = 74 (0x4A)
  - Cycle 3: X ← A = 74
  - Cycle 4: X ← X + 10 = 84 (0x54)
- **Outputs**: `cycle`, `reg_a`, `reg_x` (with HexDisplays)

### Architecture Decisions

#### Combinational vs Sequential Composites

Following the SystemVerilog approach (`always_ff` vs `always_comb`):

**Combinational Composites** (pure logic):
- ALU, decoders, multiplexers
- Outputs are pure functions of inputs
- No internal state
- Participate in cycle detection

**Sequential Composites** (contain state):
- RegisterFile, counters, FSMs
- Contain Registers or DFlipFlops
- Have clock inputs
- Break combinational cycles (don't participate in cycle detection)

#### Register Placement Strategy

**Pattern that works:**
```dsl
circuit CPU {
  impl {
    // Primitive sequential elements at top level
    node regA: Register
    node regX: Register

    // Combinational composites
    node alu: ALU

    // Connections create feedback through registers
    connect regA.q -> alu.a
    connect alu.result -> regA.data
    connect clk -> regA.clk
  }
}
```

**Why this works:**
- Registers are visible as primitives (cycle-breaking)
- Combinational composites process data
- Clock edges coordinate state updates

### Key Bug Fix: Sequential Composite Cycle Detection

#### The Problem
The simulator's cycle detection algorithm treated ALL composites as potentially combinational, causing false "Cycle detected in circuit" errors when using composites like RegisterFile in feedback loops.

#### The Solution
Modified `simulator-v0.1.ts` to:
1. Add `inferCircuitKind()` function that classifies circuits as 'combinational' or 'sequential'
2. Treat sequential composites as "state-breaking" nodes (like primitive Registers)
3. Exclude them from combinational cycle detection

**Inference rules:**
- Explicit metadata always wins: `circuit.metadata.kind`
- Fallback: Sequential if has both clocks AND registers
- Conservative approach prevents false negatives

#### Impact
✅ Can now use modular sequential composites (RegisterFile, etc.)
✅ Proper hierarchical design without false cycle errors
✅ Matches how real HDL tools (Verilog/VHDL) handle sequential logic

### Files

#### Working Circuits
- `01-simple-test.dsl` - Basic adder test (combinational)
- `01-alu-combined.dsl` - Full ALU with manual test
- `02-register-file.dsl` - Register file with manual test
- `04-stage1-flat.dsl` - Complete Stage 1 integration ⭐ **Recommended**
- `04-stage1-demo.dsl` - Wrapper with HexDisplays (coming soon)

#### Archive/Learning
- `01-alu.dsl` - ALU component (superseded by combined version)
- `03-stage1-complete.dsl` - Integration using composite approach (has reader bug)

### How to Use

1. **Open Turing Incomplete** in your browser
2. **Open DSL Editor** (split view or panel)
3. **Load a test file**:
   - For ALU testing: `01-alu-combined.dsl` → compile → adjust Input values
   - For Register testing: `02-register-file.dsl` → compile → use clock controls
   - For full demo: `04-stage1-flat.dsl` → compile → click clock repeatedly

4. **Expected Results** (Stage 1 Flat):
   ```
   Cycle 1: A=42, X=00  (Load 66 into A)
   Cycle 2: A=4A, X=00  (Add 8 to A)
   Cycle 3: A=4A, X=4A  (Transfer A to X)
   Cycle 4: A=4A, X=54  (Add 10 to X)
   ```

### Testing

All components tested:
- ✅ ALU operations (ADD, SUB, AND, OR, XOR)
- ✅ Register read/write with correct selectors
- ✅ Multi-cycle execution with clock
- ✅ Feedback loops through registers work correctly
- ✅ No false cycle detection errors

### Lessons Learned

1. **DSL Syntax**: Uses `Bus[8]` not `Bus<8>`, `connect` statements for wiring
2. **Constant Values**: Use decimal notation (66 not 0x42) for reliability
3. **Primitive Ports**: Check actual port names (e.g., Incrementer uses `in`/`out`)
4. **Sequential Composites**: Mark circuits with internal state as sequential
5. **Cycle Detection**: Registers and sequential composites break combinational cycles

### Performance

**Component Count**: ~150 components total in Stage 1
- ALU: ~50 components
- RegisterFile: ~40 components
- Integration logic: ~60 components

**Target for full 6502**: ~900-1000 components (achievable!)

## Next: Stage 2 - Instruction Fetch & Decode

Coming soon:
- 16-bit Program Counter
- Instruction Decoder (opcode → control signals)
- Memory Interface (ROM/RAM)
- Control FSM (fetch-decode-execute)

---

**Created**: February 5, 2026
**Status**: Stage 1 complete and validated ✅
