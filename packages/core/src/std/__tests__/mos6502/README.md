# MOS6502_Core conformance

Tests for `MOS6502_Core` against two independent 6502 test suites.

## Tom Harte's SingleStepTests

[SingleStepTests/65x02](https://github.com/SingleStepTests/65x02) (MIT) has 10,000 cases per opcode. Each case gives the CPU state and RAM before one instruction, every bus cycle the instruction makes, and the state after it. `harte.ts` loads the starting state into the core, serves RAM one cycle per tick, and checks every cycle and the final state.

- `harte-sample.json` is a slice of the suite (the first cases of each documented opcode, plus page-crossing and decimal-mode cases). It is committed and runs in CI through `../mos6502-cpu.test.ts`.
- The full suite runs offline:

```sh
npx tsx src/std/__tests__/mos6502/fetch-harte.ts   # ~650 MB into vectors/ (gitignored)
npx tsx src/std/__tests__/mos6502/run-harte.ts     # all 151 documented opcodes, ~6 min
npx tsx src/std/__tests__/mos6502/run-harte.ts 69 7d --limit 500
npx tsx src/std/__tests__/mos6502/make-sample.ts   # regenerate the CI slice
```

## Klaus Dormann's functional and decimal tests

[6502_65C02_functional_tests](https://github.com/Klaus2m5/6502_65C02_functional_tests) (GPL-3.0, so downloaded at run time, not committed). The functional test exercises every documented instruction and addressing mode; the decimal test checks ADC and SBC in decimal mode for every pair of operands and both carry values, including invalid BCD. The decimal test is assembled with ca65, so it needs cc65 installed.

```sh
npx tsx src/std/__tests__/mos6502/run-dormann.ts             # both, about an hour each
npx tsx src/std/__tests__/mos6502/run-dormann.ts decimal
```

## Fault check

`fault-check.ts` breaks the core in a few small ways (decimal adjust, page-cross timing, the B flag, the read-modify-write dummy write) and confirms the Harte harness reports each one.

```sh
npx tsx src/std/__tests__/mos6502/fault-check.ts
```
