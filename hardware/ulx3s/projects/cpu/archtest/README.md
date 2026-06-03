# RV32I arch-test conformance (simulation)

Drives the simten RV32I core against the official
[`riscv/riscv-arch-test`](https://github.com/riscv/riscv-arch-test) vectors and
diffs the resulting signature against a **Spike** reference, in simulation.

> **Honest claim:** *a CPU built in this HDL, evaluated on its structural
> elaborated netlist, passes the official riscv-arch-test RV32I suite vs Spike,
> in simulation.* Not "certified"; not run on silicon.

## Local dev toolchain (not containers)

This harness shells out to a **local** RISC-V toolchain + ISA simulator. The
existing product containers are used as-is elsewhere and are deliberately *not*
extended for this (the compiler service has no `-T`/`-I`/ELF-return mode, and
Spike has no container at all). Install locally:

| Tool | Version used | Install (macOS arm64) |
|------|--------------|------------------------|
| `riscv-none-elf-gcc` (+ binutils `objdump`/`nm`/`ld`/`as`) | xPack GCC **15.2.0**, binutils **2.45** | `npm i -g xpm && xpm install --global @xpack-dev-tools/riscv-none-elf-gcc@latest` → `~/Library/xPacks/@xpack-dev-tools/riscv-none-elf-gcc/<ver>/.content/bin` |
| `spike` (riscv-isa-sim) | **1.1.1-dev** | `brew tap riscv-software-src/riscv && brew install riscv-isa-sim` |

Not a default CI job: per-PR CI keeps the 69-test `pnpm fpga:test` + netlist
guard; conformance-in-CI later would be a toolchain-install step, not committed
infra.

## Vendored material

`vendor/` is copied verbatim from `riscv/riscv-arch-test`, branch
**`old-framework-2.x`**, pinned at commit **`6f7f47b`** (the classic
signature-region suite; the default `act4` branch is the self-checking
framework we don't use). License: **BSD-3-Clause** (see upstream `LICENSE`).

- `vendor/env/arch_test.h`, `vendor/env/encoding.h` — upstream macros/encodings.
- `vendor/rv32i_m/I/src/add-01.S` — one test (the 3.0 vertical slice).

`model_test.h` and `link.ld` are **ours** (the DUT target definition).

## Scope finding (settled by objdump, not assumption)

The base RV32I-**I** tests compile to **pure RV32I — zero CSR/trap
instructions**. All of `arch_test.h`'s CSR/trap trampoline (`csrrw mscratch`,
`mtvec`, `mcause`/`mepc`/`mtval`…) is gated behind `#ifdef rvtest_mtrap_routine`,
a macro defined by the *target's* `model_test.h` — which we leave undefined.
`objdump -d add-01.elf` shows 0 `csr*`/`ecall`/`ebreak`/`mret`. So this is
**outcome (a): no core changes** — no `zicsr` flag, no `rv32i-csr.ts`, no trap
unit. The existing `{zicsr:false}` core passes the suite unchanged.

(CSR/trap would only be needed to target the separate **Zicsr/privileged**
arch-test suite — a deliberate future capability, not something the base-I suite
forces. Re-scope it from a fresh objdump of *those* tests if/when pursued.)

## Memory map & why the DUT and Spike use different bases

The DUT resets to **PC = 0x0**, so its ELF is linked at `0x0` (IMEM) / `0x10000`
(DMEM) — see `link.ld`, mirroring the production CPU map, just enlarged
(netlist-neutral: the core is address-bare, the old `& 0x1ff` mask lived only in
`sim.ts`).

Spike **cannot** map `[0, 0x1000)` — it reserves that range for its debug
module ROM (`devices at [0,…) overlap`), and has no flag to relocate it. We do
**not** relink the DUT to suit Spike (that would break its reset vector and the
netlist golden guard). Instead Spike runs a copy linked at its comfortable
`0x80000000`. The signatures still match because **arch-test signatures are
position-independent by construction** (`TEST_AUIPC`/`TEST_JAL_OP`/
`TEST_JALR_OP` subtract a local label so stored values don't depend on link
address). The DUT artifact is never bent to the reference; only the reference's
own copy is rebased.

## Locked formats (3.0)

- **Signature:** one 4-byte little-endian word per line, lowercase 8-hex-digit,
  `+signature-granularity=4`. Region `[begin_signature, end_signature)`.
- **Spike ISA string:** `rv32i` (no `Zicsr` — none emitted for base-I).
- **Halt:** `RVMODEL_HALT` stores to HTIF `tohost` then spins. Spike stops +
  dumps on the tohost write; the DUT runner treats the same store as its done
  signal.

## Running the slice

```sh
export PATH="$HOME/Library/xPacks/@xpack-dev-tools/riscv-none-elf-gcc/15.2.0-1.1/.content/bin:$PATH"
cd hardware/ulx3s/projects/cpu/archtest && mkdir -p build

# DUT ELF (0x0 base) + Spike ELF (0x80000000 base) from the same source.
GCC="riscv-none-elf-gcc -march=rv32i -mabi=ilp32 -static -nostdlib -nostartfiles -DXLEN=32 -I . -I vendor/env"
$GCC -T link.ld vendor/rv32i_m/I/src/add-01.S -o build/add-01.elf
sed -e 's/0x00000000/0x80000000/' -e 's/0x00010000/0x80010000/' link.ld > build/link.spike.ld
$GCC -T build/link.spike.ld vendor/rv32i_m/I/src/add-01.S -o build/add-01.spike.elf

# Reference signature (Spike) and DUT signature, then diff.
spike --isa=rv32i -m0x80000000:0x50000 +signature=build/spike.sig +signature-granularity=4 build/add-01.spike.elf
tsx run-dut.ts build/add-01.elf 0x10010 0x10940 0x10a00 > build/dut.sig   # sig addrs via `nm`
diff build/dut.sig build/spike.sig && echo PASS
```

Signature symbol addresses (`begin_signature`/`end_signature`/`tohost`) come
from `riscv-none-elf-nm <elf>`. A Tier-A `conformance.verify.ts` (Phase 3b) will
orchestrate compile → Spike → DUT → diff over the whole `rv32i_m/I` suite.
