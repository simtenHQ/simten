# Decisions

Short records of choices that shape the codebase: what was decided, what was rejected, and what would change it. One file per decision, numbered in the order they were made. A record marked **Proposed** is a draft waiting for sign-off.

| # | Decision | Status |
|---|---|---|
| [0001](0001-behaviour-representation.md) | How component behaviour is represented | Accepted |
| [0002](0002-simulation-model.md) | Simulation model: 2-state, 32-bit, one clock, loops | Accepted |
| [0003](0003-saved-circuit-compatibility.md) | Compatibility policy for saved circuits | Accepted |
| [0004](0004-production-visibility.md) | Production visibility: errors, alerts, deploys | Deferred (#464) |
| [0005](0005-typescript-dsl.md) | A TypeScript DSL, not Verilog, Chisel or Amaranth | Accepted |
| [0006](0006-own-simulator.md) | Our own simulator, not Verilator or iverilog | Accepted |
| [0007](0007-server-side-toolchains.md) | Yosys, iverilog, nextpnr and gcc in containers | Accepted |
| [0008](0008-sandbox-domain.md) | A separate domain for the sandbox before accounts | Accepted |
