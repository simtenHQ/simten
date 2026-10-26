# 0006. Our own simulator, not Verilator or iverilog

**Status:** Accepted. Tracked in #442.

## Context

The usual way to simulate is to compile to Verilog and run Verilator or Icarus Verilog. Both are fast and well tested, and both are batch tools: you run a testbench and read the output.

## Decision

Simten has its own event-driven simulator in TypeScript. The editor and the game need things batch simulators don't do:

- step one tick at a time, and rewind
- show every wire's value live on the canvas, and change inputs mid-run
- start instantly in the browser, with no compile step and no download

Correctness is checked against iverilog anyway: the differential test (#431) runs the same circuits and inputs through both and compares every cycle in CI, so we get interactivity and an outside oracle.

## Rejected

- **Verilator compiled to WASM.** Fast once built, but every edit needs a C++ compile, and it doesn't support stepping or rewinding a live design.
- **iverilog in WASM.** Interpreted and slow, and still batch-oriented.

## What would change it

Designs too big for an interpreted simulator in the browser (millions of gates) would justify a compiled back end, likely Verilator on a server, with our simulator kept for interactive use.
