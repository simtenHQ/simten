# Next levels: combinational logic and arithmetic

Twelve levels that extend the campaign past the full adder, ending on a 4-bit ALU. They need no new game machinery: every input and output is a single bit, every level is graded by the existing vector grader, and earlier components are handed over in the starter code the way the full adder's stub hands over `HalfAdder`.

This is the next section only. The longer arc (an 8-bit CPU, machine code, an assembler, RISC-V) is a separate decision, to be made once we can see how far players get.

## Where it goes on the map

The map forks after `making-a-component`. This section adds a logic column and an arithmetic column, so no existing level gets new prerequisites and nobody's progress changes. The new arithmetic branches off the full adder, so the fork is four columns wide:

```
PROCESSOR    cpu-jumps
             cpu-alu
             cpu-load
             alu-4

LOGIC        ARITHMETIC                 MEMORY
                                        program-counter
parity       less-than                  register-file
equal        subtract                   register
mux-4        negate                     counter
decoder      adder-4                    toggle
wide-gates                 full-adder   d-latch
majority                   half-adder   latch

COMPONENTS   buses
             multiplexer
             making-a-component
```

The multiplexer and buses sit on the trunk, before the fork, because every branch uses both: memory holds or loads with a multiplexer, and every branch has 4-bit levels. So no stub can hand over a part the player skipped.

`LEVELS` runs in this order too (trunk, logic, arithmetic, memory, processor), so the Next button and the level numbers walk up each lane in turn.

The fork is three lanes side by side, each labelled at its foot, and the ALU opens a new full-width "Processor" band above them. That band is where the registers and the CPU go later.

`alu-4` is the first level that needs two lanes finished. It requires the top of each (`parity` and `less-than`).

Why the arithmetic lane is two columns wide: the full adder feeds both `adder-4` and `counter`. With `adder-4` directly above it, the counter's wire would run through it and read as a dependency that isn't there. Branching the new arithmetic off to the left leaves the column above the full adder empty, so the counter's wire climbs it and turns in under the counter, which sits at the top of the memory lane.

`counter` keeps its requirements (`full-adder` and `toggle`).

Map changes, all in `map.ts`:

- `MAP_ROWS`: ranks only. `MAP_COLUMNS` pins each fork level to a column, so a row of two no longer re-centres and drifts off its branch.
- `MAP_REQUIRES`: each new level needs the one below it in its column (`equal` sits in the logic column after `wide-gates`, since it is XNORs plus a four-input AND and no arithmetic), `multiplexer` needs `making-a-component`, `adder-4` needs `full-adder`, and `alu-4` needs `parity` and `less-than`.
- `MAP_SECTIONS`: a section can be a lane (`columns`) instead of a full-width band. The fork is lanes for Logic, Arithmetic and Memory, and "Processor" starts at the ALU.
- Width: four 210px nodes plus gaps is about 970px, and the bands are 1010px. Fine on desktop. Not yet checked on a phone.

## Conventions for every level

- **Order:** `LEVELS` runs trunk, logic, arithmetic, memory, processor. Array order sets the map numbers and the Next button.
- **Allowed:** `ARITHMETIC_GATES` (Nand, Not, And, Or, Nor, Xor, Xnor) unless a level says otherwise.
- **Par:** taken from the reference solution. `levels.test.ts` already requires par to equal the reference's gate count, so it can't drift.
  - Proven minimal by exhaustive search for the small levels: multiplexer 3, majority 4, wider gates 6, decoder 4, parity 3, negate 5. The rest are the reference's count and can be beaten: mux-4 9, adder-4 17, subtract 25, equal 7, less-than 25, alu-4 86.
- **Target names** carry a size (`Mux2`, `Adder4`, `Alu4`), like `Xor2` and `Counter2`. The stdlib already has `Mux`, `Decoder` and `Subtractor`, and the grader also looks targets up among library circuits.
- **Handed-over parts** are written once in `levels.ts` (`MUX2`, `MUX4`, `HALF_ADDER`, `FULL_ADDER`, `ADDER4`, `SUBTRACT4`) and interpolated into each stub that needs them.
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
- **Vectors:** 16 of the 64. For each select value: the selected input on and the rest off, the reverse, and two mixed patterns. The first two catch a circuit that reads the wrong input, whichever one it reads.

### 6. `equal`: Equality
*Light up when two 4-bit numbers are the same.*

- **New idea:** compare bit by bit (XNOR), then require all bits to match (the 4-input AND from level 3).
- **Interface:** inputs `a3`–`a0`, `b3`–`b0` → output `eq`
- **Vectors:** 12: several equal pairs, and pairs differing in exactly one bit, each bit position at least once.

### 7. `parity`: Parity
*Light up when an odd number of switches are on.*

- **New idea:** XOR as "odd number of ones". A puzzle with a short answer that most people won't spot straight away.
- **Interface:** inputs `a`, `b`, `c`, `d` → output `odd`
- **Vectors:** all 16.
- **Note:** a parity bit is the simplest error check, used in serial links and memory. Worth a line in the outro.

## Arithmetic column (after `full-adder`)

### 8. `adder-4`: 4-Bit Adder
*Add two 4-bit numbers.*

- **New idea:** chaining full adders, each carry feeding the next (ripple carry).
- **Interface:** inputs `a3`–`a0`, `b3`–`b0` → outputs `s3`–`s0`, `cout`
- **Starter:** the finished `FullAdder`.
- **Vectors:** 12 of the 256: 0 + 0, 1 + 1, 5 + 3, 7 + 8, 15 + 1 (overflow), 15 + 15, and others that make the carry ripple through every bit.
- **Spec display:** the table shows the bits. A footnote shows the same rows as decimal sums (5 + 3 = 8), so the player can see what the bits mean. That's a small addition to the spec panel.

### 9. `negate`: Negative Numbers
*Turn a number into its negative.*

- **New idea:** two's complement. Flip every bit and add one. In 4 bits, 3 becomes 13, which is -3.
- **Interface:** inputs `a3`–`a0` → outputs `n3`–`n0`
- **Starter:** nothing handed over. There is no constant 1 to add, and the gate-level answer is far smaller anyway: a bit flips exactly when some bit below it is on, so `n0 = a0` and the rest is XOR and OR. Par 5, proven minimal.
- **Vectors:** all 16.
- **Outro:** why this trick means a CPU needs no separate subtraction circuit.

### 10. `subtract`: Subtractor
*Compute a − b.*

- **New idea:** a − b is a + (−b), so the adder from level 7 does it, given an inverted `b` and a carry-in of 1.
- **Interface:** inputs `a3`–`a0`, `b3`–`b0` → outputs `d3`–`d0`, `borrow`
- **Starter:** `Adder4` as built, no carry-in port. a - b is computed as NOT(NOT a + b), which needs no constant 1, and the adder's `cout` is then exactly the borrow (on when b > a). The stub explains both. Par 25 (4 + 17 + 4).
- **Vectors:** 12, including a < b (borrow set), a = b (zero), and 0 − 1.

### 11. `less-than`: Less Than
*Light up when a is smaller than b.*

- **New idea:** a < b exactly when a − b borrows. The subtractor already answers it.
- **Interface:** inputs `a3`–`a0`, `b3`–`b0` → output `lt`
- **Starter:** the finished `Subtract4`. Par 25 counts the whole subtractor, including the NOTs on the difference bits that go nowhere, which the outro hints at.
- **Vectors:** 12, including a = b, a = b − 1, 0 and 15 at both ends.
- **Scope:** unsigned only. Signed comparison is a later level, once overflow has come up.

## Where the columns meet

### 12. `alu-4`: Arithmetic Logic Unit
*One circuit that adds, subtracts, ANDs or ORs, chosen by an op code.*

- **Requires:** `parity` and `less-than`, the tops of the two columns.
- **New idea:** compute every result at once, then select one with the op code. That's the shape of every ALU, including the one in the 6502 post and the RV32I core.
- **Interface:** inputs `op1`, `op0`, `a3`–`a0`, `b3`–`b0` → outputs `r3`–`r0`
  - `00` add, `01` subtract, `10` AND, `11` OR
- **Starter:** the finished `Mux2`, `Mux4`, `Adder4` and `Subtract4`. Par 86. The player writes the bitwise AND/OR and the four multiplexers that pick each output bit.
- **Vectors:** 16, four per operation.
- **Size check:** this is the largest level in the section, but it's wiring parts the player has already built, not new logic.

## Memory lane, continued

Three sequential levels above `counter`, built the same way: single-bit inputs and outputs, at most 16 steps, the vector grader as it is. They fill the top of the memory lane and lead to the CPU. Allowed: every logic gate plus `DFlipFlop`.

### 13. `register`: Register

- **New idea:** a load line. Each bit is a flip-flop whose next value is a multiplexer's choice between its own `q` (hold) and the new bit (load).
- **Interface:** `load`, `d3`–`d0` → `q3`–`q0`. Needs `counter`.
- **Starter:** nothing handed over. The multiplexer is in the logic lane, which the player may not have done, so the hint describes it instead.
- **Vectors:** 10 steps; the same inputs come back with a different number stored. Par 16.

### 14. `register-file`: Register File

- **New idea:** several registers, writing one and reading two at once. Two reads and one write is how real register files work (RISC-V reads `rs1` and `rs2`, writes `rd`), and the CPU needs it: its ALU takes two registers at the same time.
- **Interface:** `write`, `wsel`, `asel`, `bsel`, `d3`–`d0` → `a3`–`a0`, `b3`–`b0`. Two registers, so each select is one bit. Needs `register`.
- **Starter:** the finished `Register4`.
- **Why two registers:** four would want the decoder and four-way multiplexer, but those are in the logic lane and a wire from there to here would cross the arithmetic lane. The outro says so.
- **Vectors:** 12 steps. Par 58.

### 15. `program-counter`: Program Counter

- **New idea:** a counter that can also be loaded, which is how a jump works.
- **Interface:** `jump`, `a3`–`a0` → `pc3`–`pc0`. Needs `register-file` (ladder order; it builds on counter and register).
- **Starter:** nothing handed over.
- **Vectors:** 15 steps, including wrap from 15 to 0 and an address set with `jump` off, which must be ignored. Par 21, using the flip-flop's `q_bar` for bit 0.

### 16–18. The CPU, in three levels

The CPU is built up the Processor band one kind of instruction at a time, the way a real one is brought up, rather than all at once. Each level starts from the last level's finished CPU, wired, with the new parts placed, and is tested by running a short program. The parts are folded away in one region.

- **Instruction format** (8 bits): bits 7–6 the kind (`00` LOAD, `01` ALU, `10` JUMP, `11` JUMP IF LESS), bit 5 `ra`, bit 4 `rb`, bits 3–0 `n` (a number, an address, or in bits 1–0 the ALU op). `Instruction` splits it into named fields.
- **The grader plays memory:** each step's input `i` is the instruction at the address the last step left in `pc`.
- **`Control` grows with the CPU**, one output per level.

| Level | Player adds | Control | Tested by | Par |
|---|---|---|---|---|
| `cpu-load` Load Instruction | Control, and wiring Instruction to the register file | `op1 op0 → write` | eight LOADs | 59 |
| `cpu-alu` ALU Instructions | the ALU path: registers into the ALU, `Choose4` picking n or its answer | `+ useAlu`, and ALU instructions write too | LOADs, then ADD/SUB/AND/OR | 157 |
| `cpu-jumps` Jumps | the program counter's jump, and the comparison | `+ less → jump` | 4-bit Fibonacci: loops twice, wraps, falls through, stops on `JUMP 8` (16 steps) | 206 |

Load Instruction needs `alu-4` and `program-counter`, so all three lanes meet there. The level names avoid Turing Complete's (Registers, Instruction Decoder, Calculations, Conditions); the instruction set is our own, closer to RISC-V (compare two registers and branch to an address in the instruction).

## Buses

Levels with real 4-bit numbers take them on one wire: `Input({ width: 4 })` in, `HexDisplay({ width: 4 })` out, with a `Splitter` and `Combiner` placed in the stub so the player still works with bits. The `buses` level teaches this on the trunk, right after `making-a-component`, so every lane can use it. Decoder and four-way multiplexer keep their selects as separate bits.

## Parts and sub-circuits

Every part a stub hands over is the reference answer of the level that introduced it, with ports, and with the same interface the player built: numbers on buses where their level used buses (`Invert4`, `Adder4`, `Subtract4`, `Register4`). The sources live once in `levels.ts`, folded into one region in each stub.

Where a level repeats something per bit, it asks for a sub-circuit rather than wiring it flat, which keeps every level's canvas to about a dozen boxes:

| Level | The player makes | Top-level boxes |
|---|---|---|
| Register | one bit (a flip-flop and a `Mux2`), used four times | 9 |
| Register File | a 4-bit-wide chooser (`BusMux2`), one per way out | 13 |
| Program Counter | one counter bit (flip-flop, half adder, `Mux2`) | 10 |
| ALU | bitwise AND, bitwise OR, a 4-way number chooser | 10 |

Subtractor uses the player's own `Invert4` from Buses: invert a, add, invert the sum. The Buses completion card mentions that a node can be a list and `connect` can loop over it, which shortens the per-bit parts.

## Spec panel changes

1. Levels can set `numbers`, naming bit groups to read as numbers (`a` gathers `a3 a2 a1 a0`), each `unsigned` or `signed`. Under the table, the panel reads the hovered column back, or the failed one after a bad submit: "a = 5, b = 3, s = 8", or "n = 13 (-3)" for a signed group. One line instead of a footnote listing every column, which wouldn't fit. Used on the decoder, mux-4 and the 4-bit levels.
2. Nothing else. The grader, the Feedback column and the tour are unchanged.

## Open questions

- **Signed numbers:** `negate` introduces them, `less-than` stays unsigned. A signed less-than level could follow, or wait for the CPU section.
- **A check level at the end of each column** (a mixed truth table using everything in it): cheap to make, but the puzzles may already do that job.
- **Buses:** the section stays on single bits on purpose. The first level that needs a real `bus(8)` should introduce buses as its one new idea, and needs the spec panel to show multi-bit values in hex.
