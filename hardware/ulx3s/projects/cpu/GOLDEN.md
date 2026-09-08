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

## ⚠ Outstanding: the guard is currently non-blocking

The golden is **stale as of the bus-width-validation change**, and CI's netlist
step carries `continue-on-error: true` so it reports without failing the build.
It was not regenerated, because that is the one thing this file forbids.

What drifted: six `BitSlice` nodes in the CPU gained an explicit `width`
argument, and six connections now declare their true width (`bus(1)` / `bus(2)`)
instead of a fictitious `bus(8)`. Same 118 nodes, same 271 connections, same
order — the widths were always wrong, the slice just claimed 8 bits regardless
of what it covered.

What has been checked without a board: `fpga:test` 69/69, and the exported
Verilog cross-checked against the TS simulator under Icarus Verilog
(`pnpm fpga:verify --suite`) at 69/69 match, 0 divergent, 0 Verilog errors.
That exercises the changed wire widths but says nothing about synthesis or
timing, which is the whole point of the board run.

**To close this out:** run the ritual above, then in the same commit regenerate
the golden, add the log row, and delete `continue-on-error` from the
"FPGA netlist byte-identity guard" step in `.github/workflows/ci.yml`.

## Hardware-verification log

| Date | Commit | What ran on the board | Result |
|------|--------|------------------------|--------|
| 2026-06-03 | `332a4dd` (RV32I_Core consolidation) | `fpga:run --project=cpu --firmware=fibonacci.c --match=514229` on a ULX3S 85F | ✅ matched `514229` (UART pos 186); `fpga:verify --suite` 69/69 |
| 2026-06-06 | _(stage-composite refactor, this commit)_ | `fpga:run --project=cpu --firmware=fibonacci.c --match=514229` on a ULX3S 85F | ✅ matched `514229` (UART pos 163); `fpga:verify --suite` 69/69; arch-test 38/38 vs Spike; flat netlist isomorphic to previous golden (+3 folded `Constant`s, same 271 connections) |

> This golden is also **byte-identical** to the pre-consolidation FPGA netlist
> (empty `dump-netlist` diff across the refactor) and passes `fpga:test` (69/69,
> sim) — but the row above is first-hand: the pinned netlist was synthesized,
> flashed, and ran correct firmware on real silicon at that commit.
