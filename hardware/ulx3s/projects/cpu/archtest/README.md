# RV32I arch-test conformance (simulation)

This runs the Simten RV32I core against the official
[riscv-arch-test](https://github.com/riscv/riscv-arch-test) suite and compares
its signature against [Spike](https://github.com/riscv-software-src/riscv-isa-sim),
the reference RISC-V simulator. Everything here runs in simulation.

What that lets us claim: a CPU built in this HDL, run as its elaborated
gate-level netlist, passes all 38 of the official RV32I-I conformance tests
against Spike. It is not certified, and it has not been run through this suite
on silicon.

## Result

`tsx run-suite.ts` (or the Tier-A `conformance.verify.ts`):

```
38/38 attempted pass vs Spike · 38/38 trap-free (pure RV32I) · 0 skipped
```

All 38 tests pass byte-for-byte against Spike on the unchanged `{zicsr:false}`
core. No hardware changes were needed (see [Scope](#scope-why-no-csrtrap-support-was-needed)).

The harness can actually fail. `tsx fault-check.ts` patches an `add` into a
`sub` in the DUT's instruction stream and checks that the signature then
diverges from Spike, so a green run isn't vacuous.

One toolchain caveat: we pin gcc 13.2.0 / binutils 2.41, which assemble the
2022-era test sources. binutils 2.45 (gcc 15) rejects `jalr-01`'s `la x0, 5b`,
because newer gas disallows `la`/`li` into `x0`. That's a toolchain quirk, not a
core bug.

## Toolchain

The harness shells out to a local RISC-V toolchain and ISA simulator. The
product's container services aren't involved.

| Tool | Version | Install (macOS arm64) |
|------|---------|------------------------|
| `riscv-none-elf-gcc` (+ binutils `objdump`/`nm`/`ld`/`as`) | xPack GCC 13.2.0, binutils 2.41 (pinned, see Result) | `npm i -g xpm && xpm install --global @xpack-dev-tools/riscv-none-elf-gcc@13.2.0-2.1`, then add `~/Library/xPacks/@xpack-dev-tools/riscv-none-elf-gcc/13.2.0-2.1/.content/bin` to PATH (or set `ARCHTEST_GCC_BIN`) |
| `spike` (riscv-isa-sim) | 1.1.1-dev | `brew tap riscv-software-src/riscv && brew install riscv-isa-sim` (or set `SPIKE`) |

This isn't a default CI job. Per-PR CI runs the 69-test `pnpm fpga:test` plus the
netlist guard; wiring conformance into CI would mean installing the toolchain
there, which we haven't done yet.

## What's vendored

`vendor/` is a verbatim copy of
[riscv-arch-test](https://github.com/riscv/riscv-arch-test) at branch
`old-framework-2.x`, commit `6f7f47b`. That's the classic signature-region
suite, not the newer self-checking `act4` framework. License: BSD-3-Clause
(`vendor/COPYING.BSD`).

- `vendor/env/{arch_test.h,encoding.h}`: upstream macros and encodings.
- `vendor/rv32i_m/I/src/*.S`: all 38 RV32I-I tests.

`model_test.h` and `link.ld` are ours; they define the DUT target.

## Scope: why no CSR/trap support was needed

The base RV32I-I tests assemble to pure RV32I, with no CSR or trap instructions.
The harness verifies this per test, and all 38 come out trap-free. The CSR/trap
trampoline in `arch_test.h` is gated behind `rvtest_mtrap_routine`, a macro the
target's `model_test.h` defines, and we leave it undefined. So the core needs no
changes: no `zicsr` flag, no `rv32i-csr.ts`, no trap unit. Those would only matter
for the separate Zicsr/privileged suite, which is a possible later step.

## Memory map

The DUT resets to PC `0x0`, so its ELF links at `0x0` (IMEM) and `0x400000`
(DMEM); see `link.ld`. IMEM is 4 MB because the branch and jump tests emit
megabytes of nop padding to cover their displacement ranges (`jal-01`'s `.text`
is about 1.75 MB), and DMEM sits above the largest `.text` so the two never
overlap. Growing simulated memory doesn't touch the netlist; the core is
address-agnostic.

Spike can't map `[0, 0x1000)`: it reserves that range for its debug-module ROM
and has no flag to relocate it. Rather than relink the DUT (which would break its
reset vector and the netlist golden guard), Spike runs a copy linked at
`0x80000000`. The signatures still match because arch-test signatures are
position-independent by construction. `TEST_AUIPC`, `TEST_JAL_OP`, and
`TEST_JALR_OP` subtract a local label, so the stored values don't depend on link
address. All 38 passing across the two base addresses confirms it.

## Formats

- Signature: one 4-byte little-endian word per line, lowercase 8-hex-digit,
  `+signature-granularity=4`, over `[begin_signature, end_signature)`.
- Spike ISA string: `rv32i` (no Zicsr, since base-I emits none).
- Halt: `RVMODEL_HALT` stores to HTIF `tohost` and spins. Spike stops and dumps
  on that write; the DUT runner treats the same store as its done signal.

## Files

| File | Role |
|------|------|
| `conformance.verify.ts` | Tier-A testbench (declares Spike as the oracle, loops the suite) |
| `run-suite.ts` | dev CLI; prints a per-test pass/trap-free table |
| `suite-lib.ts` | the engine: compile, objdump trap-check, run Spike, run the DUT, diff |
| `run-dut.ts` | loads an ELF, runs the unchanged core, dumps the signature region |
| `fault-check.ts` | harness check: inject `add`→`sub`, assert the signature diverges |
| `model_test.h`, `link.ld` | DUT target (machine-mode-free) and the `0x0`-based memory map |

## Running

```sh
export PATH="$HOME/Library/xPacks/@xpack-dev-tools/riscv-none-elf-gcc/13.2.0-2.1/.content/bin:$PATH"
cd hardware/ulx3s/projects/cpu/archtest
tsx run-suite.ts          # full suite, human-readable table
tsx conformance.verify.ts # Tier-A, emits structured verify JSON
tsx fault-check.ts        # prove the harness can fail
```

Per-test signature addresses come from `riscv-none-elf-nm`. `build/` (compiled
ELFs, signatures, the generated Spike link script) is gitignored.
