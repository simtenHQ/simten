# Stage 3.1: Proper Instruction Execution - Design Document

## Problem Statement

Stage 2 CPU treats every byte as data to ADD. We need it to:
1. Distinguish opcodes from operands
2. Execute the correct operation (LDA loads, ADC adds)
3. Fetch operands before executing

## Current Behavior (Stage 2)

```
Program: A9 42 69 08 (LDA #$42, ADC #$08)

Cycle 0-2: Fetch 42, Execute: A = 0 + 42 = 42
Cycle 3-5: Fetch 69, Execute: A = 42 + 69 = AB
Cycle 6-8: Fetch 08, Execute: A = AB + 08 = B3
```

Result: A = B3 ❌ (Should be 4A)

## Desired Behavior (Stage 3.1)

```
Program: A9 42 69 08

Cycles 0-2: Fetch opcode A9, Decode as LDA #imm
Cycles 3-5: Fetch operand 42, Execute LDA: A = 42
Cycles 6-8: Fetch opcode 69, Decode as ADC #imm
Cycles 9-11: Fetch operand 08, Execute ADC: A = 42 + 08 = 4A
```

Result: A = 4A ✅

## Architecture Changes

### 1. Add Instruction Register (IR)
```
node instruction_reg: Register  // Stores the opcode
```

**Behavior:**
- During FETCH: IR ← ROM[PC]
- During DECODE/EXECUTE: IR holds the opcode

### 2. Add Operand Register
```
node operand_reg: Register  // Stores immediate operands
```

**Behavior:**
- During operand fetch: operand_reg ← ROM[PC]
- During execute: Use operand_reg as ALU input

### 3. Multi-Cycle Execute

**For immediate mode instructions (LDA #imm, ADC #imm):**
- Execute cycle 0: Fetch operand, store in operand_reg, increment PC
- Execute cycle 1: Perform operation using operand_reg

### 4. Instruction Dispatch Logic

```
if (IR == LDA_imm):
  A ← operand_reg
else if (IR == ADC_imm):
  A ← A + operand_reg
```

## Modified FSM Behavior

### FETCH (State 0)
- Read opcode from ROM[PC]
- Store in instruction_reg
- Increment PC
- Go to DECODE

### DECODE (State 1)
- Decode instruction_reg
- Determine instruction type, addressing mode, cycle count
- Go to EXECUTE

### EXECUTE (State 2)
- **Cycle 0:** If immediate mode, fetch operand from ROM[PC], increment PC
- **Cycle 1+:** Execute instruction using stored opcode and operand
- When done, go to FETCH

## Test Cases

### Test 1: LDA Immediate
```
Program: A9 42
Expected: A = 0x42, PC = 0x02
```

### Test 2: LDA then ADC
```
Program: A9 42 69 08
Expected: A = 0x4A (74 decimal), PC = 0x04
```

### Test 3: Multiple Instructions
```
Program: A9 10 69 20 69 30
Expected: A = 0x60 (16 + 32 + 48 = 96), PC = 0x06
```

## Implementation Steps

1. ✅ Write test specifications (this document)
2. Add instruction register to CPU
3. Add operand register to CPU
4. Modify control FSM for multi-cycle execute
5. Add instruction dispatch logic (LDA vs ADC)
6. Add operand fetch logic
7. Write automated tests
8. Run tests and verify

## Success Criteria

- ✅ LDA #$42 loads 0x42 into A (not adds it)
- ✅ ADC #$08 adds 0x08 to A
- ✅ Sequential instructions execute correctly
- ✅ PC advances by 2 per instruction (opcode + operand)
- ✅ All automated tests pass

---

**Status:** Ready to implement
**Next:** Create enhanced CPU circuit with instruction/operand registers
