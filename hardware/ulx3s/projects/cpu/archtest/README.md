# RV32I arch-test conformance (simulation)

Drives the simten RV32I core against the official
[`riscv/riscv-arch-test`](https://github.com/riscv/riscv-arch-test) vectors and
diffs the resulting signature against a **Spike** reference, in simulation.

> **Honest claim:** *a CPU built in this HDL, evaluated on its structural
> elaborated netlist, passes the official riscv-arch-test RV32I-I suite vs
> Spike, in simulation* (all 38 tests). Not "certified"; not run on silicon.

## Result

`tsx run-suite.ts` (or the Tier-A `conformance.verify.ts`):

```
38/38 attempted pass vs Spike · 38/38 trap-free (pure RV32I) · 0 skipped
```

- **All 38 official RV32I-I tests** pass byte-for-byte vs Spike on the **unchanged**
  `{zicsr:false}` core (no hardware changes — see "Scope finding").
- **Toolchain pin:** we use gcc 13.2.0 / binutils **2.41**, which assembles the
  2022-vintage tests. binutils 2.45 (gcc 15) rejects `jalr-01`'s `la x0, 5b`
  (inst_7 uses `rd=x0`; newer gas disallows `la`/`li` to x0) — a toolchain
  issue, never a DUT one.
- **Harness validity:** `tsx fault-check.ts` injects a real `add→sub` into the
  DUT's instruction stream and asserts the signature **diverges** from Spike, so
  the green result is not vacuous.

## Local dev toolchain (not containers)

Shells out to a **local** RISC-V toolchain + ISA simulator. The product
containers are used as-is elsewhere and deliberately *not* extended for this.

| Tool | Version | Install (macOS arm64) |
|------|---------|------------------------|
| `riscv-none-elf-gcc` (+ binutils `objdump`/`nm`/`ld`/`as`) | xPack GCC **13.2.0**, binutils **2.41** (pinned — see Result) | `npm i -g xpm && xpm install --global @xpack-dev-tools/riscv-none-elf-gcc@13.2.0-2.1` → `~/Library/xPacks/@xpack-dev-tools/riscv-none-elf-gcc/13.2.0-2.1/.content/bin` (override dir via `ARCHTEST_GCC_BIN`) |
| `spike` (riscv-isa-sim) | **1.1.1-dev** | `brew tap riscv-software-src/riscv && brew install riscv-isa-sim` (override via `SPIKE`) |

Not a default CI job: per-PR CI keeps the 69-test `pnpm fpga:test` + netlist
guard; conformance-in-CI later would be a toolchain-install step, not committed
infra.

## Vendored material

`vendor/` is copied verbatim from `riscv/riscv-arch-test`, branch
**`old-framework-2.x`**, pinned at commit **`6f7f47b`** (the classic
signature-region suite; the default `act4` branch is the self-checking
framework we don't use). License: **BSD-3-Clause** (`vendor/COPYING.BSD`).

- `vendor/env/{arch_test.h,encoding.h}` — upstream macros/encodings.
- `vendor/rv32i_m/I/src/*.S` — all 38 RV32I-I tests.

`model_test.h` and `link.ld` are **ours** (the DUT target definition).

## Scope finding (settled by objdump, not assumption)

The base RV32I-**I** tests compile to **pure RV32I — zero CSR/trap
instructions** (the harness asserts this per-test; all 38 are trap-free). All of
`arch_test.h`'s CSR/trap trampoline is gated behind `#ifdef rvtest_mtrap_routine`,
a macro defined by the *target's* `model_test.h` — which we leave undefined. So
this is **outcome (a): no core changes** — no `zicsr` flag, no `rv32i-csr.ts`, no
trap unit. CSR/trap would only be needed to target the separate
**Zicsr/privileged** arch-test suite (a deliberate future capability; re-scope it
from a fresh objdump of *those* tests if pursued).

## Memory map & why the DUT and Spike use different bases

The DUT resets to **PC = 0x0**, so its ELF is linked at `0x0` (IMEM) / `0x400000`
(DMEM) — see `link.ld`. IMEM is large (4 MB) because branch/jump arch-tests emit
**megabytes** of nop padding to span displacement ranges (`jal-01` `.text` ≈
1.75 MB); DMEM starts above the largest `.text` so they never overlap. Enlarging
sim memory is netlist-neutral — the core is address-bare.

Spike **cannot** map `[0, 0x1000)` (it reserves that for its debug-module ROM
and has no flag to relocate it). We do **not** relink the DUT to suit Spike (that
would break its reset vector and the netlist golden guard). Instead Spike runs a
copy linked at `0x80000000`. The signatures still match because **arch-test
signatures are position-independent by construction** (`TEST_AUIPC`/`TEST_JAL_OP`/
`TEST_JALR_OP` subtract a local label so stored values don't depend on link
address) — empirically confirmed by all 38 passing across the two bases.

## Locked formats

- **Signature:** one 4-byte little-endian word per line, lowercase 8-hex-digit,
  `+signature-granularity=4`, region `[begin_signature, end_signature)`.
- **Spike ISA string:** `rv32i` (no `Zicsr` — none emitted for base-I).
- **Halt:** `RVMODEL_HALT` stores to HTIF `tohost` then spins. Spike stops + dumps
  on the tohost write; the DUT runner treats the same store as its done signal.

## Files

| File | Role |
|------|------|
| `conformance.verify.ts` | **Tier-A testbench** (declareOracle: Spike; loops the suite) |
| `run-suite.ts` | dev CLI — prints a per-test pass/trap-free table |
| `suite-lib.ts` | shared engine: compile → objdump trap-check → Spike → DUT → diff |
| `run-dut.ts` | loads an ELF, runs the unchanged core, dumps the signature region |
| `fault-check.ts` | harness-validity: inject `add→sub`, assert divergence |
| `model_test.h`, `link.ld` | DUT target (machine-mode-free) + 0x0-based memory map |

## Running

```sh
export PATH="$HOME/Library/xPacks/@xpack-dev-tools/riscv-none-elf-gcc/13.2.0-2.1/.content/bin:$PATH"
cd hardware/ulx3s/projects/cpu/archtest
tsx run-suite.ts        # full suite, human-readable table
tsx conformance.verify.ts   # Tier-A, emits structured verify JSON
tsx fault-check.ts      # prove the harness can fail
```

`build/` (compiled ELFs, signatures, generated Spike link script) is gitignored.
Per-test signature symbol addresses come from `riscv-none-elf-nm`.
