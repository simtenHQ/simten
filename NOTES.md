# Systolic Array Output Mapping Issue

## What we're getting:
- c01 = 32 = 4×8 = a11×b11
- All other outputs = 0

## What this means:
1. Only ONE multiplication happened (no accumulation)
2. The value a11=4 reached some PE
3. That PE had weight b11=8 loaded
4. The result 32 was captured as c01

## Weight loading (appears correct):
```
PE00 ← b00=5
PE01 ← b01=6
PE10 ← b10=7
PE11 ← b11=8
```

## Data flow issue:
The fact that a11×b11 appears in c01 suggests:
- a11 (row 1, col 1 of A) is flowing somewhere
- It's being multiplied by b11 (correct weight for PE11)
- But PE11's output is being captured as c01 (WRONG!)

## Correct mapping should be:
```
c00 = sum of column 0 accumulation after row 0 data = (a00×b00 + a01×b10)
c01 = sum of column 1 accumulation after row 0 data = (a00×b01 + a01×b11)
c10 = sum of column 0 accumulation after row 1 data = (a10×b00 + a11×b10)
c11 = sum of column 1 accumulation after row 1 data = (a10×b01 + a11×b11)
```

## But my current capture:
```
Cycle 3: c00 ← PE10.out, c01 ← PE11.out
Cycle 4: c10 ← PE10.out, c11 ← PE11.out
```

This is WRONG! PE10 and PE11 are bottom row PEs, they accumulate columns, but we're capturing them for multiple row results!

## The real issue:
In a 2×2 weight-stationary systolic array, the OUTPUT MAPPING depends on which PE and WHEN you capture.

The fact that debug version worked (single PE, single multiply) but the 2×2 fails means the multi-PE coordination is wrong.

## Hypothesis:
The partial sums aren't accumulating properly, so we're only getting the LAST value that flowed through each PE, not the accumulated sum.
