# @simten/core

## 0.15.0

### Minor Changes

- 68f48a1: Allow a `nodes` entry to be an array, expanded to `n0`, `n1`, … and wired as `n[i]`

  Declaring eight of something no longer means eight lines:

  ```ts
  circuit("ByteNot", {
    nodes: {
      a: Array.from({ length: 8 }, () => Switch),
      n: Array.from({ length: 8 }, () => Nand),
      out: Array.from({ length: 8 }, () => Led),
    },
    connect: ({ nodes: { a, n, out } }) =>
      a.flatMap((sw, i) => [sw.out.to(n[i].a, n[i].b), n[i].out.to(out[i].in)]),
  });
  ```

  An array entry is exactly its longhand — the expansion happens inside
  `circuit()`, so elaboration, the simulator and the Verilog exporter see the same
  flat node map they always did, and there is no runtime cost beyond one pass over
  the node map at build time. A test pins that equivalence structurally.

  Arrays specifically, rather than a dynamically keyed object, because TypeScript
  keeps an array's element type: `n[i].a` autocompletes and `n[i].bogus` is still
  an error, where `nodes[\`n${i}\`]`loses the type before`circuit()` can see it.

  Expanded ids that collide with a hand-written node are an error rather than a
  silent overwrite, and reserved names are now checked against the declared key.

## 0.14.0

### Minor Changes

- 10994f0: Add `circuitNameSites` and `firstCircuitName` to `@simten/core/circuit`, for finding `circuit('Name', …)` declarations in source text.

  Both sit alongside `stripTypes`/`stripImports`/`stripExports` — text utilities that run before, or instead of, executing circuit source. Two callers had grown near-identical regexes for this: share links in the web app, which title a page from the circuit it contains, and the challenge game, which warns when the circuit you have written is not the one a level grades.

  `circuitNameSites` returns every declaration with 1-based line and column bounding the name, so an editor can place a marker on it. `firstCircuitName` is the common "just give me a label" case.

  Best-effort by contract: it is a regex, so it is brittle on template literals, escaped quotes and names split across lines. Callers must have a fallback for the misses. Use `executeCircuitCode` when the answer has to be right.

## 0.13.2

### Patch Changes

- 7146f9b: Restore port-name autocomplete on components that declare no inputs or outputs.

  `inputs`/`outputs` are optional on a circuit config, so a component that omits one — `Switch` has no inputs, `Led` no outputs — gave TypeScript nothing to infer that side from. Without a generic default it substituted the constraint, `Record<string, PortType | number>`, which is an open index signature: every key was valid.

  The effect inside a `connect` callback was that a node had no known members, so `sw.` offered no completions at all, while `sw.anything` type-checked happily and only failed later at runtime with "Port 'anything' does not exist". Typos went uncaught precisely where the type system was supposed to help most.

  `Ins` and `Outs` now default to `{}`. Port names autocomplete on every component, and a misspelled port is a compile error.

  `Nodes` and `S` deliberately still fall back to their own constraints: eval functions read structural arguments such as `width` and `offset` out of the input bag, and closing those would reject working code.

## 0.13.1

### Patch Changes

- 41f9beb: Fix bare stdlib components picking up the width of an unrelated instance. The eval registry keys behaviour by component name and the last definition wins, so nineteen components whose eval read a width default out of their factory closure — `width: w = width` — handed every bare `Adder()`, `Slice()`, `Concat()` and friends the width of whichever instance was defined last. `@simten/core/std` defines `Adder({ width: 32 })` at module scope, so in a bundle that ordered the stdlib after the app, `Adder()` stopped being 8 bits: `6 + 255` read as 261 instead of wrapping to 5. Module evaluation order differs between bundlers and node, which is why this showed up in the browser and not in tests.

  The defaults are now literals matching each factory's own default, and the mask and sign-extend arithmetic those evals used to call out to is inlined, so no stdlib eval reads its factory scope any more.

## 0.13.0

### Minor Changes

- 6081386: **Breaking: `Switch` is no longer a factory — write `Switch`, not `Switch()`.**

  Its options parameter was never used. The config ignored `_opts` entirely; the `value` a switch holds arrives at runtime through `node.arguments`, set by the canvas or by `autoHarness`. The factory form existed only to declare an option that nothing read, at the cost of empty parentheses at every use — and next to `And`, `Led` and `Or`, which take none, the rule was "memorise which components happen to be parameterised".

  `Input({ value })` stays a factory, because there the argument does real work — it's how a circuit ships with a starting value. So the rule is now the useful one: parentheses mean you are passing something.

  **Breaking: `Button` is removed.**

  Its documentation promised momentary behaviour — "outputs 1 only while held down, 0 otherwise" — that was never implemented. Its `eval` was character-for-character identical to `Switch`, it had no entry in the canvas node-type map so it rendered _as_ a Switch, no pointer handling existed anywhere in the UI package, and no circuit in the repository used it. A component whose described behaviour cannot be observed is worse than no component: a reset built on it latches instead of pulsing, in a way the docs say is impossible.

  `Switch` covers the same ground. If momentary input is wanted later it should arrive with a renderer that implements it.

  Migration is mechanical: `Switch()` → `Switch`, and `Button` → `Switch`.

## 0.12.0

### Minor Changes

- 5aa06b2: Redefining a primitive now replaces its behaviour. Component behaviour was cached by name and kept the first registration, so editing a primitive's `eval` (or `onTick`) left the old function running — the source said one thing and the simulation did another. Affects any host that re-executes circuit source in one realm, which is what the browser editor does.

  `eval` may now return a boolean for a 1-bit output, so `({ a, b }) => ({ out: !(a | b) })` type-checks instead of needing `(a | b) ? 0 : 1`. Widened only for `bit`: the Verilog exporter emits JS `!` as `~`, which agrees at one bit and diverges above it, so `bus` outputs still require a number. Adds the `PortOutputValues` type.

  `setDebugStateUpdate` is now exported from `@simten/core/simulator`. It gates propagation tracing — seed counts and per-pass eval/changed totals — which is the only view into a circuit once elaboration has flattened it to typed arrays. The tracing existed but nothing could switch it on.

  **Verilog import now rejects derived clocks.** A flip-flop clocked by anything other than the module's clock port (a clock divider's `div[15]`, a ripple counter's previous stage, a gated clock) used to import cleanly and simulate as a different circuit — a 4-bit ripple counter came out as four flip-flops toggling together, counting 0, 15, 0. simten models a single synchronous clock domain and cannot represent those, so they now throw with a message naming the signal and pointing at the clock-enable rewrite. Designs that previously imported and behaved incorrectly will now fail loudly.

  `autoHarness` keeps its library entry in step with the circuit it wraps, so editing a circuit's ports no longer leaves the harness's `dut` node describing a different interface from the circuit the canvas resolves.

## 0.11.2

### Patch Changes

- 104f97f: Fix the `@simten/core/rtl` and `@simten/core/import` subpaths on the published package. Both were declared in `exports` but missing from `publishConfig.exports`, so they resolved in-repo and failed for anyone installing from npm — which put the Verilog importer out of reach of the published build.

## 0.11.1

### Patch Changes

- 79472ec: fix(import): drop clock-only ports when importing Verilog

  Imported sequential designs no longer carry a dangling `clk` port. simten registers share a single implicit clock (`$dff` CLK is never lifted), so an imported top-level clock port drove nothing — it showed as a dead input on the canvas and duplicated the `clk` the Verilog exporter re-adds, breaking re-export. Any input whose net feeds only clock pins is now dropped, computed to a fixpoint so it applies at every level of the hierarchy. Reset ports are kept (their nets feed `Register.rst`, not a clock pin).

## 0.11.0

### Minor Changes

- 28ae7b0: The Verilog importer now handles integer divide and remainder (`$div`, `$mod`), signed and unsigned, plus reduction XNOR (`$reduce_xnor`). Adds five stdlib components — `Divider`, `Modulo`, `SignedDivider`, `SignedModulo`, `ReduceXnor` — and lifts the cells onto them (signed div/mod variant when both operands are signed). Signed division truncates toward zero and remainder takes the sign of the dividend (Verilog semantics); division/modulo by zero returns all-ones / the dividend respectively (Verilog leaves it undefined). Verified against iverilog across a grid of unsigned and signed cases. With these, the whole `snbk001/Verilog-Design-Examples` ALU imports clean. Closes the `$div`/`$mod`/`$reduce_xnor` items in #249.

  (Verilog _export_ of these components — a `primitive-map` entry — is not included yet; the import + simulate path is complete.)

## 0.10.0

### Minor Changes

- cbbd9c3: The Verilog importer now tolerates undriven nets instead of aborting. An unassigned or misspelled signal (yosys keeps it as a floating wire) previously threw `net N has no driver` and failed the whole import. It's now tied to 0 — simten's 2-state analog of how yosys/iverilog tolerate a floating wire — so the design still imports and the user sees the (broken) result.

  `ImportResult` gains a `warnings: string[]` field carrying these non-fatal notes (e.g. "an undriven net was tied to 0"), deduped per module. Callers (like the web import route) can surface them alongside yosys's own warnings.

## 0.9.1

### Patch Changes

- acb4871: Fix imported designs crashing in the editor when they contain a `case` (one-hot mux), a latch, or a memory. The import-home primitives `Pmux`, `Dlatch`, and `Mem` referenced their shape (`sWidth`, `enPolarity`, `rdPorts`, mask widths) from the factory closure inside `eval`/`onTick`. The editor sandbox rebuilds evals via `new Function(fn.toString())`, which drops closures — so these surfaced at runtime as e.g. "sWidth is not defined" (with no editor squiggle).

  Two changes fix it: (1) the evals now read their shape from the eval inputs (`node.arguments` are merged in) and inline their masks; (2) these object-config primitives now bake `_args`, so a source-recompiled `Pmux({ width, sWidth })` node carries its shape in `node.arguments` (the factory form does this automatically; object-config did not) — without it the recompiled node had empty arguments and the reconstructed eval had nothing to read. Regression tests assert `_args` is baked and reconstruct each eval exactly as the sandbox does.

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
