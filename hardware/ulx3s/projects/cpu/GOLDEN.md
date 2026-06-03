# `netlist.golden.json` — FPGA byte-identity guard

`netlist.golden.json` pins the **flattened `RV32I_CPU_Core` netlist** — the circuit
IR after elaboration, *before* the Verilog exporter. CI regenerates it
(`dump-netlist.ts --check`) and fails on any difference, so an edit to the shared
`@simten/core` `RV32I_Core` can't silently change what gets synthesized to the board.

It's the **pre-codegen** invariant on purpose: stable against exporter/toolchain
version changes (those would move `combined.v` without the circuit changing), so a
failure here means *the circuit changed*, full stop.

## The golden is only as trustworthy as the last flash behind it

Its authority comes entirely from **the pinned netlist having run correctly on a
real ULX3S** — not from "the test is green." So the update procedure is a ritual,
not a `--write`:

**To intentionally change the FPGA netlist (e.g. Phase 3 Zicsr):**
1. Make the change; let CI fail on this guard (expected).
2. On a real ULX3S, run firmware and match real output — not a bare flash/boot:
   ```
   pnpm fpga:run --project=cpu --firmware=hardware/ulx3s/projects/cpu/firmware/fibonacci.c --match='514229'
   ```
   (and `pnpm fpga:verify --suite` for the iverilog cross-check).
3. Only then regenerate: `bun hardware/ulx3s/projects/cpu/dump-netlist.ts --write`
4. In the **same commit**, add a row to the log below stating the firmware, match,
   commit, and date you verified on hardware.

Do **not** regenerate the golden just to make CI green — that throws away the one
thing it certifies. A red guard with no hardware re-verify behind it stays red.

## Hardware-verification log

| Date | Commit | What ran on the board | Result |
|------|--------|------------------------|--------|
| _pending_ | _this branch (RV32I_Core consolidation)_ | `fpga:run --firmware=fibonacci.c --match=514229` + `fpga:verify --suite` | **pending board flash** |

> Provenance note: this golden is **byte-identical** to the pre-consolidation FPGA
> netlist (verified by an empty `dump-netlist` diff across the refactor) and passes
> `fpga:test` (69/69, sim). Its hardware authority therefore *inherits* from
> whatever last flashed `main` — but the fresh board re-verify above is still
> pending and should be recorded here once done. Until then, treat the hardware
> guarantee as "byte-identical to the previously-shipped netlist," not "re-flashed
> on this commit."
