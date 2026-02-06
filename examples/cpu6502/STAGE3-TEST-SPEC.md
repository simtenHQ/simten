# Stage 3.1 Test Specification

## Test Circuit

Load: **`12-stage3-proper-execution.dsl`**
Select: **`Stage3Test`**

## Program Being Executed

```asm
Address  Bytes  Instruction
0x00:    A9     LDA #$42    ; Load 0x42 into A
0x01:    42     (operand)
0x02:    69     ADC #$08    ; Add 0x08 to A
0x03:    08     (operand)
```

**Expected final result: A = 0x4A (74 decimal)**

## Display Components

- **d_pc** - Program Counter
- **d_instruction** - Instruction Register (stored opcode)
- **d_operand** - Operand Register (stored operand)
- **d_state** - FSM State (0=FETCH, 1=DECODE, 2=EXECUTE)
- **d_subcycle** - Execute sub-cycle (0=fetch operand, 1=execute)
- **d_a** - Accumulator register

## Expected Execution Trace

### LDA #$42 Execution (Cycles 0-5)

| Cycle | State | Sub | PC | Instruction | Operand | A  | Notes |
|-------|-------|-----|----|-----------|---------|----|-------|
| 0 | 0 (FETCH) | 0 | 00 | ?? | ?? | 00 | Initial state |
| 1 | 1 (DECODE) | 0 | 01 | A9 | ?? | 00 | Fetched LDA opcode, PC++ |
| 2 | 2 (EXEC) | 0 | 01 | A9 | ?? | 00 | Decode LDA |
| 3 | 2 (EXEC) | 1 | 02 | A9 | 42 | 00 | Fetch operand 42, PC++ |
| 4 | 0 (FETCH) | 0 | 02 | A9 | 42 | 42 | Execute LDA: A←42 ✅ |

### ADC #$08 Execution (Cycles 5-9)

| Cycle | State | Sub | PC | Instruction | Operand | A  | Notes |
|-------|-------|-----|----|-----------|---------|----|-------|
| 5 | 1 (DECODE) | 0 | 03 | 69 | 42 | 42 | Fetched ADC opcode, PC++ |
| 6 | 2 (EXEC) | 0 | 03 | 69 | 42 | 42 | Decode ADC |
| 7 | 2 (EXEC) | 1 | 04 | 69 | 08 | 42 | Fetch operand 08, PC++ |
| 8 | 0 (FETCH) | 0 | 04 | 69 | 08 | 4A | Execute ADC: A←42+08=4A ✅ |

## Key Test Points

### ✅ Test 1: LDA Loads (Not Adds)
After cycles 0-4:
- **A should be 0x42** (not 0xA9 or 0x00)
- This proves LDA loads the operand directly

### ✅ Test 2: ADC Adds
After cycles 5-8:
- **A should be 0x4A** (66 + 8 = 74)
- This proves ADC adds to the accumulator

### ✅ Test 3: PC Advances Correctly
- PC should increment twice per instruction:
  - Once during FETCH (for opcode)
  - Once during EXECUTE sub-cycle 0 (for operand)
- After both instructions: **PC = 0x04**

### ✅ Test 4: Instruction Register Holds Opcode
- During EXECUTE, instruction display should show:
  - **A9** while executing LDA
  - **69** while executing ADC
- Proves opcodes are stored and used for dispatch

### ✅ Test 5: Operand Register Holds Operands
- During EXECUTE sub-cycle 1, operand display should show:
  - **42** when executing LDA
  - **08** when executing ADC
- Proves operands are fetched and stored

## How to Test

1. **Load the circuit** and set reset_input to 0
2. **Click clock 10 times** and record the values
3. **Check critical checkpoints:**
   - After ~4 cycles: A = 0x42? ✅
   - After ~8 cycles: A = 0x4A? ✅
   - Final PC = 0x04? ✅

## Pass Criteria

- ✅ A = 0x42 after LDA instruction
- ✅ A = 0x4A after ADC instruction
- ✅ PC = 0x04 at the end
- ✅ Instruction register shows A9, then 69
- ✅ Operand register shows 42, then 08

## Comparison with Stage 2

### Stage 2 (Wrong):
```
A = 0 + 42 = 42
A = 42 + 69 = AB
A = AB + 08 = B3  ❌
```

### Stage 3.1 (Correct):
```
A ← 42 (LDA)
A = 42 + 08 = 4A  ✅
```

---

**Test this and report back with the actual values!**
