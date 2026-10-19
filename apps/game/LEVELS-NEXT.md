# Next levels: combinational logic and arithmetic

Twelve levels that extend the campaign past the full adder, ending on a 4-bit ALU. They need no new game machinery: every input and output is a single bit, every level is graded by the existing vector grader, and earlier components are handed over in the starter code the way the full adder's stub hands over `HalfAdder`.

This is the next section only. The longer arc (an 8-bit CPU, machine code, an assembler, RISC-V) is a separate decision, to be made once we can see how far players get.

## Where it goes on the map

The map forks after `making-a-component` into arithmetic and memory. This section adds a third column, so no existing level gets new prerequisites and nobody's progress changes:

```
COMPONENTS             making-a-component
                ┌──────────────┼──────────────┐
COMBINATIONAL   │ ARITHMETIC   │ MEMORY        │
  multiplexer   │ half-adder   │ latch         │
  majority      │ full-adder   │ d-latch       │
  wide-gates    │ adder-4      │ toggle        │
  decoder       │ negate       │ counter       │
  mux-4         │ subtract     │               │
  parity        │ equal        │               │
                │ less-than    │               │
                └──────┬───────┘
                     alu-4  (needs mux-4 and subtract)
```

`alu-4` is the first level that needs two columns finished. That's the point where the separate pieces come together.

`counter` stays where it is, needing `full-adder` and `toggle`. The new arithmetic levels open from `full-adder` alongside it, so they don't change what the counter needs.

Map changes, all in `map.ts`:

- `MAP_ROWS`: the fork rows get a third entry, for example `['multiplexer', 'half-adder', 'latch']`.
- `MAP_REQUIRES`: `multiplexer` needs `making-a-component`, each combinational level needs the one before it, `adder-4` needs `full-adder`, and `alu-4` needs `mux-4` and `subtract`.
- `MAP_SECTIONS`: the "Arithmetic and memory" band becomes "Logic, arithmetic and memory", since one band covers the fork.
- Width: three 210px nodes plus gaps is about 720px. Fine on desktop; check that the map still pans comfortably on a phone.

## Conventions for every level

- **Order:** appended to `LEVELS` after `counter`, combinational column first, then arithmetic, then `alu-4`. Array order sets the map numbers and the Next button, so appending keeps every existing level's number.
- **Allowed:** `ARITHMETIC_GATES` (Nand, Not, And, Or, Nor, Xor, Xnor) unless a level says otherwise.
- **Par:** taken from the reference solution. `levels.test.ts` already requires par to equal the reference's gate count, so it can't drift.
- **Vectors:** exhaustive when there are at most 16 combinations. Above that, a chosen set of at most 16 columns that covers the edge cases (listed per level). 16 columns is roughly the widest the spec table can show comfortably; the full adder has 8 today.
- **Starter code:** gives the components from earlier levels finished, plus a comment explaining the one new idea. The player writes the target circuit.
- **Reference solution:** one per level in `game/solutions/`, proven by the existing tests (it must pass; constant answers must fail).

## Combinational column

### 1. `multiplexer`: Multiplexer
*Choose which of two signals gets through.*

- **New idea:** a select line. When `sel` is 0, `out` follows `a`; when it's 1, `out` follows `b`.
- **Interface:** inputs `a`, `b`, `sel` → output `out`
- **Starter:** nothing extra. The hint suggests one AND gate per input, each enabled by `sel` or its inverse, then an OR.
- **Vectors:** all 8.
- **Par:** 3, the proven minimum: `a XOR (sel AND (a XOR b))`. The hinted AND/OR build costs 4, so it passes over par and leaves the shorter answer to find.
- **Why here:** every later level that chooses between values uses this, the ALU above all.

### 2. `majority`: Majority Vote
*Turn the light on when at least two of three switches are on.*

- **New idea:** none, on purpose. It's a puzzle using gates the player already has, a breather after the multiplexer.
- **Interface:** inputs `a`, `b`, `c` → output `out`
- **Vectors:** all 8.
- **Note:** a real circuit. Voting between three copies is how fault-tolerant systems (aircraft, spacecraft) mask one failing unit. Worth a line in the outro.

### 3. `wide-gates`: Wider Gates
*Check four signals at once.*

- **New idea:** chaining two-input gates to make wider ones.
- **Interface:** inputs `a`, `b`, `c`, `d` → outputs `all` (every input on), `any` (at least one on)
- **Vectors:** all 16.
- **Why here:** the decoder and the equality check both need a 4-input AND.

### 4. `decoder`: Decoder
*Turn a 2-bit number into one of four lines.*

- **New idea:** one output per value. Exactly one of `y0` to `y3` is on, the one numbered by `a1 a0`.
- **Interface:** inputs `a1`, `a0` → outputs `y0`, `y1`, `y2`, `y3`
- **Vectors:** all 4.
- **Why here:** this is how memory picks a cell and how a CPU picks a register, later on.

### 5. `mux-4`: Four-Way Multiplexer
*Choose one of four signals with a 2-bit select.*

- **New idea:** building a bigger multiplexer from smaller ones (a tree of three), or from the decoder plus AND/OR. Both work, and par rewards the cheaper.
- **Interface:** inputs `d0`, `d1`, `d2`, `d3`, `s1`, `s0` → output `out`
- **Starter:** the finished `Mux` from level 1.
- **Vectors:** 16 of the 64. For each select value, four data patterns in which the selected input differs from all the others, so a circuit that picks the wrong input can't pass by luck.

### 6. `parity`: Parity
*Light up when an odd number of switches are on.*

- **New idea:** XOR as "odd number of ones". A puzzle with a short answer that most people won't spot straight away.
- **Interface:** inputs `a`, `b`, `c`, `d` → output `odd`
- **Vectors:** all 16.
- **Note:** a parity bit is the simplest error check, used in serial links and memory. Worth a line in the outro.

## Arithmetic column (after `full-adder`)

### 7. `adder-4`: 4-Bit Adder
*Add two 4-bit numbers.*

- **New idea:** chaining full adders, each carry feeding the next (ripple carry).
- **Interface:** inputs `a3`–`a0`, `b3`–`b0` → outputs `s3`–`s0`, `cout`
- **Starter:** the finished `FullAdder`.
- **Vectors:** 12 of the 256: 0 + 0, 1 + 1, 5 + 3, 7 + 8, 15 + 1 (overflow), 15 + 15, and others that make the carry ripple through every bit.
- **Spec display:** the table shows the bits. A footnote shows the same rows as decimal sums (5 + 3 = 8), so the player can see what the bits mean. That's a small addition to the spec panel.

### 8. `negate`: Negative Numbers
*Turn a number into its negative.*

- **New idea:** two's complement. Flip every bit and add one. In 4 bits, 3 becomes 13, which is -3.
- **Interface:** inputs `a3`–`a0` → outputs `n3`–`n0`
- **Starter:** the finished `Adder4`, so the player only adds the NOT gates and the + 1.
- **Vectors:** all 16.
- **Outro:** why this trick means a CPU needs no separate subtraction circuit.

### 9. `subtract`: Subtractor
*Compute a − b.*

- **New idea:** a − b is a + (−b), so the adder from level 7 does it, given an inverted `b` and a carry-in of 1.
- **Interface:** inputs `a3`–`a0`, `b3`–`b0` → outputs `d3`–`d0`, `borrow`
- **Starter:** `Adder4`, with a carry-in port added. The stub says so.
- **Vectors:** 12, including a < b (borrow set), a = b (zero), and 0 − 1.
- **Note:** `borrow` is the inverse of the adder's carry-out. The comment points that out rather than leaving it as a trap.

### 10. `equal`: Equality
*Light up when two 4-bit numbers are the same.*

- **New idea:** compare bit by bit (XNOR), then require all bits to match (the 4-input AND from level 3).
- **Interface:** inputs `a3`–`a0`, `b3`–`b0` → output `eq`
- **Vectors:** 12: several equal pairs, and pairs differing in exactly one bit, each bit position at least once.

### 11. `less-than`: Less Than
*Light up when a is smaller than b.*

- **New idea:** a < b exactly when a − b borrows. The subtractor already answers it.
- **Interface:** inputs `a3`–`a0`, `b3`–`b0` → output `lt`
- **Starter:** the finished `Subtractor`.
- **Vectors:** 12, including a = b, a = b − 1, 0 and 15 at both ends.
- **Scope:** unsigned only. Signed comparison is a later level, once overflow has come up.

## Where the columns meet

### 12. `alu-4`: Arithmetic Logic Unit
*One circuit that adds, subtracts, ANDs or ORs, chosen by an op code.*

- **Requires:** `mux-4` and `subtract`.
- **New idea:** compute every result at once, then select one with the op code. That's the shape of every ALU, including the one in the 6502 post and the RV32I core.
- **Interface:** inputs `op1`, `op0`, `a3`–`a0`, `b3`–`b0` → outputs `r3`–`r0`
  - `00` add, `01` subtract, `10` AND, `11` OR
- **Starter:** the finished `Adder4`, `Subtractor` and `Mux4`. The player writes the bitwise AND/OR and the four multiplexers that pick each output bit.
- **Vectors:** 16, four per operation.
- **Size check:** this is the largest level in the section, but it's wiring parts the player has already built, not new logic.

## Spec panel changes this needs

All small:

1. A decimal footnote under the table for the adder, negate, subtract and ALU levels (for example "5 + 3 = 8"), so long rows of bits are readable.
2. Nothing else. The vector grader, the Feedback column, the tour and the map's `requires` support are unchanged.

## Open questions

- **Signed numbers:** `negate` introduces them, `less-than` stays unsigned. A signed less-than level could follow, or wait for the CPU section.
- **A check level at the end of each column** (a mixed truth table using everything in it): cheap to make, but the puzzles may already do that job.
- **Buses:** the section stays on single bits on purpose. The first level that needs a real `bus(8)` should introduce buses as its one new idea, and needs the spec panel to show multi-bit values in hex.
