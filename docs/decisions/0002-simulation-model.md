# 0002. Simulation model: 2-state, 32-bit, one clock, loops

**Status:** Accepted. Tracked in #436; enforcement in #427 and #430.

## Context

The simulator's model is implicit. Values live in an `Int32Array`, there is no unknown (X) value, every clock is treated as one global rising edge whatever the circuit says, and outputs aren't masked to their declared width. A wide bus can also be wired into a `bit` with no check at all: an 8-bit 200 shows as 200 on a 1-bit port, and an `And` fed 2 outputs 1 where Verilog, which keeps only the low bit, outputs 0. A circuit can therefore simulate one way and behave another way as Verilog, and nothing says so.

## Decision

The model is small on purpose. It's a teaching and design tool, and every rule below is checked when a circuit is compiled, with an error that names the node.

- **Values are 2-state.** A `bit` carries 0 or 1; a `bus(n)` carries a number of up to n bits. There is no X or Z. An unconnected input reads 0 (or its declared default). This differs from Verilog, where an undriven wire is X; the differential test (#431) only compares circuits with every input driven.
- **Buses are at most 32 bits.** Wider ports are a compile error that suggests splitting the bus. Every output is masked to its declared width, so an 8-bit adder wraps at 256 in simulation exactly as it does in Verilog.
- **A `bit` is a `bus(1)` for width checks.** `bit` and `bus(1)` connect to each other freely. `bit` into `bus(n)` zero-extends, with the same warning as any widening. `bus(n)` into `bit` for n > 1 is a compile error, like `bus(n)` into `bus(1)` already is; pick the bit with a `Slice`. Checked against every game level's stub and reference solution and the FPGA designs: none are affected. Five blog posts (CORDIC, network switches, TPUs, Snake, sorting networks), the Snake and TPU examples and three core tests rely on the old behaviour, through a `Mux` or `Register` left at its default 1-bit width, and are fixed in the same change.
- **One clock, rising edge.** `Register`, `DFlipFlop` and memories have no clock port: they all update together on one global rising edge, and there is no way to write a falling-edge register in TypeScript. A flip-flop built from gates and driven by an ordinary signal is just logic and is unaffected. Verilog import rejects falling-edge registers, more than one clock and clocks derived from logic with a clear error, instead of turning them into rising-edge registers.
- **Combinational loops are allowed in simulation, and rejected by the Verilog exporter.** The game teaches SR and D latches built from gates, so the simulator must settle loops; a loop that never settles stops at the iteration cap with an error naming it. The exporter detects combinational loops and refuses with an error pointing at `Register`/`DFlipFlop` for storage that synthesises cleanly.

## Rejected

- **4-state (X/Z) values.** Closer to Verilog, but doubles the value storage, slows every gate, and is confusing for beginners.
- **64-bit buses now.** Needs a second value array or BigInt on the hot path; nothing in the stdlib or the examples needs it yet.
- **Keeping `bit` and `bus` as unrelated kinds.** It's what let wide values flow through 1-bit parts unnoticed.
- **Multiple clock domains.** Real designs have them, but clock-domain crossing is out of scope for the audience.

## What would change it

A real need for wide datapaths (64-bit CPU, Ethernet) would justify a split representation for wide buses. Users building multi-clock FPGA designs would justify clock domains.
