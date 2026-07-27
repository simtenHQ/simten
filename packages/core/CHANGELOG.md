# @simten/core

## 0.9.0

### Minor Changes

- eb6f6cd: Register gains an optional synchronous reset input (`rst`): when high, `q` clears to 0 on the next clock edge, overriding `data`/`we`. Leaving `rst` unconnected (reads 0) keeps existing registers unchanged, so the addition is backward-compatible and the synthesized FPGA netlist is byte-identical.

  The Verilog importer uses this to lift the reset/enable flip-flop family — `$adff` (async reset), `$sdff` (sync reset), and `$dffe` (clock-enable) — onto stdlib `Register` instead of throwing. Async resets are modeled synchronously, which is exact under simten's cycle-accurate simulation for any reset held across a clock edge. A reset to 0 uses `Register.rst`; a non-zero reset preset folds the value into the data path via a `Mux` + `Constant`, so presettable counters/timers import too. Verified against iverilog: an imported synchronous FIFO (reset-to-0) and a 4-bit counter (reset-to-8) each match byte-for-byte on reset, flags, and all defined data. Closes #237.

## 0.8.0

### Minor Changes

- 10d77f9: Verilog import now produces clean, editable simten source from arbitrary synthesizable single-driver Verilog. Word-level cells lift to recognizable stdlib components with no `Rtl*` in the output, backed by a single `{kind, home}` component registry, sign/zero-extension collapse, and node-id/module-name sanitization.

  New stdlib components: `Slice`, `SignExtend`, `ZeroExtend`, `DynamicSlice`, `WrappingMultiplier`, `SignedRightShifter`, `BusXnor`, `LogicAnd`/`LogicOr`/`LogicNot`, `ReduceOr`/`ReduceAnd`/`ReduceXor`. `Concat`, `BusNot`, `Comparator`, and `SignedComparator` are now width-parameterized (backward compatible). `$mem_v2` init data (`$readmemh`/ROM contents) is applied on import.

  A foreign RISC-V core imports to zero `Rtl*` and re-simulates identically, verified by a ratcheted cleanliness metric plus round-trip and editability tests.

## 0.7.0

### Minor Changes

- 40194ac: `DualPortRAM` now takes `addressWidth` and `dataWidth` options (both default 8, so existing uses are unchanged). A wider `addressWidth` grows the memory to `2 ** addressWidth` words — e.g. `DualPortRAM({ addressWidth: 9 })` for a 512-word memory. The Verilog exporter already read these arguments, so the emitted memory depth/width now match simulation.

## 0.6.1

### Patch Changes

- 2c3a92c: Fix time-travel (stepBack/stepForward/seek) not rewinding memory and text state. `restore()` left the cached sequential state in place, and since it shares a validity flag with `getPortValues()`, the session's seekTo (which reads port values before sequential state) handed back the latest state instead of the restored one. Registers rewound but RAM framebuffers and Console/UART text did not. `restore()` now invalidates the sequential-state cache like the tick and reset paths do.

## 0.6.0

### Minor Changes

- b441bf9: Rename the canonical Snake example: the `SnakeAdvanced` export (and `buildSnakeAdvanced()`) from `@simten/core/examples` is now `Snake` / `buildSnake()`, and the circuit's name is `Snake`. "Advanced" had no "Basic" counterpart — the top-level circuit is just Snake (which wraps `SnakeCore` + a `DualPortRAM` framebuffer). Update imports from `@simten/core/examples` accordingly.

## 0.5.2

### Patch Changes

- d271692: Add the nand2tetris Hack ALU as a bundled interactive example (`/circuit?example=hack-alu`).

## 0.5.1

### Patch Changes

- 62597a1: Add an npm example ("npm → ROM") to the bundled catalog: runs the figlet package at build time to render ASCII art, bakes it into a ROM, and streams it to a console. Demonstrates resolving a real npm library in a circuit (editor/canvas resolve it via esm.sh).

## 0.5.0

### Minor Changes

- dcddcf0: Bundled example catalog (`EXAMPLES`: snake, RV32I computer, systolic array, fibonacci, rule 30, ALU, half adder) moved from the web app into `@simten/core/examples`, with a data-only `@simten/core/examples/catalog` subpath. Single source of truth for the web editor and upcoming MCP examples tool.

## 0.4.0

### Minor Changes

- b32514c: New `@simten/core/examples` subpath with the canonical SnakeAdvanced circuit (single source for the blog, FPGA project, and editor example). Also fixes the editor-globals codegen: a JSDoc regex could swallow neighboring type declarations into `declare global`, which broke Monaco overload resolution for circuits instantiating `RV32I_Core()`.
- b32514c: Memory models follow the CPU data-bus contract: `RV32I_DataMem`, `RV32I_InstrMem`, and `DualPortROM` reads now return the raw word at the aligned address (`addr & ~3`); byte/half extraction and sign/zero extension happen in the CPU's WB-stage aligner, matching the FPGA memory and the riscv-arch-test harness. Previously these models pre-extracted, so unaligned byte/half loads (e.g. C string literals in compiled programs) read back 0 through RV32I_Core. Boards that placed an extra `RV32I_LoadAlign` on the ROM data path should remove it — it now double-extracts.
- b32514c: RV32I_Core is now structured as drillable stage composites (IF/IFID/ID/IDEX/EX/EXMEM/MEMWB/WB plus hazard and forwarding units) instead of a flat 100-node netlist. External ports and behavior are unchanged; the flattened netlist is isomorphic (verified on a ULX3S: fibonacci output match, 69/69 firmware suite, 38/38 riscv-arch-test vs Spike). Flattened node IDs gain stage prefixes (e.g. `EX.alu` instead of `alu`), so anything addressing internal nodes by path needs updating.

## 0.3.0

### Minor Changes

- d51b424: Add canonical `RV32I_Core` to `@simten/core/std` as the single source of truth for the 5-stage pipelined RV32I CPU datapath (previously hand-wired and drifting across three copies). The FPGA build now imports it instead of an inline copy — verified byte-identical at the flattened-netlist level and locked by a CI guard (`dump-netlist --check` against a hardware-provenanced golden). An optional `debug` flag exposes a register scan port and the five pipeline-stage PCs as outputs.

## 0.2.4

### Patch Changes

- e87c2a5: fix(verify): stop poisoning stdout on bare imports of `@simten/core/verify`

  `@simten/core/verify` previously armed a `process.on('beforeExit')` safety net at module load — it was meant to catch testbenches that forgot to call `verify.run()`, but it fired for **any** importer that didn't engage the harness, even when they only wanted `declareOracle`, types, or constants. The side effect was a JSON contract-error blob on stdout and `process.exitCode = 1`.

  Two consequences:

  - Any script that imported the module for helpers/types got junk on stdout + a non-zero exit, breaking CI steps that parse stdout.
  - The MCP server speaks JSON-RPC over stdout — any unsolicited JSON corrupts the protocol stream, and a forced exit-1 would kill the server. This is the source of the stray JSON observed in earlier cold-test rounds of `mcp initialize` responses.

  Fix: arm the `beforeExit` hook lazily on first call to `declareOracle()`, `verify.check()`, or `verify.exhaustive()` — i.e. only when the harness is genuinely engaged. Real testbenches still get the "forgot `verify.run()`" safety net (they always call `declareOracle` first); bare-import consumers exit cleanly with no stdout pollution.

  Verified empirically: bare `import '@simten/core/verify'` now produces zero stdout and exits 0. The existing 6 verify tests (including the explicit "forgot `verify.run()` → contract error" test) all still pass.

## 0.2.3

### Patch Changes

- 3e4aaeb: chore(packaging): declare `engines.node: ">=20"` on all four packages and expose `./package.json` via `exports`

  Two small packaging-hygiene fixes:

  - **Consistent `engines.node`**: `core` and `mcp` already declared `node >=20`; `ui` and `embed` omitted the field. Added it for parity — package managers now warn consistently across all four packages when a consumer is on an older Node.
  - **`./package.json` is now an explicit subpath export**: previously `require('@simten/<pkg>/package.json')` threw `ERR_PACKAGE_PATH_NOT_EXPORTED`, which trips up bundler plugins, version probes, and a few SDK auto-detection tools. Adding `"./package.json": "./package.json"` to each `publishConfig.exports` is the conventional fix.

- 3e4aaeb: build: inline `.ts` source content into sourcemaps (`tsconfig.compilerOptions.inlineSources: true`)

  Previously each `.js.map` referenced `../src/**/*.ts` files that aren't in the published tarball, and `sourcesContent` was empty — so consumers' debuggers could never resolve to actual source. The maps were dead weight. Adding `inlineSources` embeds the source text directly in each map. Tarballs grow ~50% but debuggers now work end-to-end: consumers can step into `@simten/*` code with real line numbers and identifiers.

## 0.2.2

### Patch Changes

- c7c5e67: docs(readme): correct the "Running it" instructions — `@simten/core` is ESM-only, consumer must opt into ESM

  The previous note claimed `tsx` would skip the need for `"type": "module"`. That's wrong: `@simten/core`'s exports only define the `import` condition, so a default CJS-mode consumer hits `ERR_PACKAGE_PATH_NOT_EXPORTED` on the subpath import (e.g. `@simten/core/circuit`) regardless of whether tsx is doing the transform. Updated the instructions to make the ESM requirement explicit — either add `"type": "module"` to `package.json` or save the file with the `.mts` extension.

## 0.2.1

### Patch Changes

- 2649b7c: docs(readme): correct quickstart example to match shipped `SimulationHandle` API

  The original quickstart used `using sim = simulate(...)`, `sim.setInput(...)`, and `sim.getOutput(...)` — none of which exist on the shipped type. The actual API is `const sim = simulate(...)`, `sim.set({ a: 1 })`, and `sim.get('sum')`. Updated the example to match the real API and noted that `using` is not currently supported (the handle exposes a plain `dispose()` method).

## 0.2.0

### Minor Changes

- fix(elaboration): chained-composite feedthrough wires now propagate via transitive closure (#138)

  Previously, composite circuits that chained feedthrough wires through multiple nested composites could silently produce wrong netlists — signals that should have reached downstream nodes were dropped at elaboration time. The fix computes the full transitive closure of feedthrough connections so multi-level chains stitch correctly.

### Patch Changes

- test: structural invariants helper for FlatCircuit + 17 targeted elaboration patterns (#140)

  Adds an internal invariants checker used by the test suite to catch malformed flat netlists earlier, plus 17 targeted elaboration test patterns covering edge cases surfaced during the audit. No public API change; ships as a patch so consumers picking up `@simten/core@0.2.0` get the additional safety net.
