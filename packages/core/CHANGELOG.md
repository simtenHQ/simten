# @simten/core

## 0.23.0

### Minor Changes

- 4f74855: Behavior (`eval`/`onTick`) belongs to a compile instead of a global registry keyed by name (#465). A built circuit carries its own behavior, a compile collects a library for exactly its circuit tree (the circuit definitions and their behavior), and the engine runs that library. Two compiles with same-named circuits no longer affect each other, a user circuit named like a std one no longer changes std in other designs, and importing the package registers nothing (`sideEffects: false`).

  Two different circuits under one name in one design are now a compile error naming the circuit, for primitives as well as composites. Before, a primitive got a console warning and one silently ran as the other.

  `simulate()` no longer takes a second `{ library }` argument, since the circuit you pass already carries everything it needs.

  `@simten/core/internal`:

  - removed: `getCircuitBehavior`, `registerCircuitBehavior`, `getAllCircuitBehaviors`, `BehaviorEntry`, `ensureEvaluatorRegistered`, `PRIMITIVE_TYPE_INDICES`, `PRIMITIVE_INDEX_TO_NAME`, `createCircuitLibrary` (use `createDefinitions`)
  - renamed: `CircuitLibrary` and `MutableCircuitLibrary` are now `CircuitDefinitions` and `MutableCircuitDefinitions`. A library is now definitions plus behavior.
  - added: `Library` and `MutableLibrary` (`{ definitions, behaviors }`), `libraryOf` (the library for a circuit tree), `addToLibrary`, `emptyLibrary`, `getStdLibrary`, `createDefinitions`, `Behavior`, `BehaviorTable`, `behaviorOf` (a built circuit's behavior)
  - `createEngine` options take a `library` in place of `componentLibrary`; `compileForSimulation` and `tracePropagation` take a library in place of the definitions
  - `executeCircuitCode`/`executeJsCode` results and `compileSource` carry a `library` of definitions and behavior; `importNetlist` returns `definitions` (was `library`) and `behaviors`; `buildFromIR` takes an optional behavior table to attach to primitives

  `@simten/core/verilog`: `exportVerilog` options take an optional `behaviors` table for eval-synth, defaulting to the standard library's.

- d730bbf: `circuit()` fixes from #428:

  - A factory's default state is kept: `circuit('C', ({ value = 7 } = {}) => ({ state: { value }, ... }))` now starts `C()` at 7, not 0. The resolved initial is recorded in the instance's arguments. `simulate()` on a bare factory primitive now honours its arguments too.
  - A connection that runs the wrong way (`outputs.q.to(...)`, or a node output as a `.to` target) is a build error naming both ends. The types already rejected these; untyped editor code built them silently.
  - A `connect` that returns something other than a flat array of connections is reported in the validation error list instead of throwing a bare TypeError.
  - Two different composites under one name in the same design (for example a factory whose options change its insides) are a build error. Before, both simulated as whichever was seen first.
  - Registering a different primitive under a name already used in the same run logs a warning. The editor starts a new run on each recompile.
  - Documented that plain number state is always `bus(32)` and plain Map state a 16/8-bit memory.

- c7e5768: `Simulation.get(name)` reads inputs as well as outputs: an input port by name, or a Switch or Input node by path, the same keys `set` takes. You can read back anything you can write. A name that is neither throws, listing the circuit's inputs, its Switches and Inputs, and its outputs. `get`'s parameter type takes the output names and `set`'s keys.

  A name that is both a port (input or output) and a Switch or Input is ambiguous for `get` and `set` alike, and throws. Before, `set` wrote the Switch while `get` would have read the output.

  `@simten/core/internal` adds `resolveKey`, `isControlType` and `primitivePaths`, so the sandbox's client resolves names exactly as `Simulation` does, and `nodesOf(sim).resolve(name)`, which says what `get` reads for a name and how many bits wide it is.

- 90126f4: `@simten/core/internal` no longer exports the MCP tool handlers (`traceSource`, `checkCircuit`, `getPrimitivesHandler`, `exportVCD` and their types); they now live in `@simten/mcp`, the only package that used them.

  `simulate_circuit` now loads `memoryData`. Contents are `{ node: { address: value } }`, the node named by its ID or its path inside the circuit, and a name that matches no node is an error. Before this fix the contents were silently dropped, so every memory read 0.

- 6052ee8: `Node` no longer has `harness`. It marked the switches and lamps the canvas draws for a circuit's ports, and the canvas now keeps that to itself.
- f5c8869: `circuit`, `bit` and `bus` come from `@simten/core` only: the `@simten/core/circuit` entry is removed (decision 0010, which replaces decision 0003's freeze of that path). A script that builds and simulates needs one import.

  Saved circuits keep working. The browser never resolved the path: the sandbox strips import lines before running source, so share links and game drafts that use it still run, and the code editor keeps `@simten/core/circuit` as an alias of `@simten/core`, so they still type-check. The MCP's `check_circuit` and `simulate_circuit` still load a file that uses it. A Node project that runs circuit files with `tsx` changes one import.

  The MCP teaches the new path: its instructions, `get_grammar`, and the files `get_started` writes.

  | Before                                                     | After                                              |
  | ---------------------------------------------------------- | -------------------------------------------------- |
  | `import { circuit, bit, bus } from '@simten/core/circuit'` | `import { circuit, bit, bus } from '@simten/core'` |

- f4c5153: Renames and a defined public API (#416). Behaviour is unchanged. The names saved circuits use (`circuit`, `bit`, `bus`, every std component and port, `@simten/core/std`) are unchanged too.

  Public entry points: `@simten/core` (`circuit`, `bit`, `bus`, `reg`, `mem`, `simulate` and the builder types), `/std`, `/verify`, `/verilog` and `/examples`. Everything else moved to `@simten/core/internal`, which is for Simten's own packages and has no stability promise.

  | Old                                                                                                                           | New                                                                                                                       |
  | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
  | `BuiltCircuit` (what `circuit()` returns)                                                                                     | `Circuit`                                                                                                                 |
  | `Circuit` (the IR)                                                                                                            | `CircuitIR`, from `@simten/core/internal`                                                                                 |
  | `import { simulate } from '@simten/core/sim'`                                                                                 | `import { simulate } from '@simten/core'`                                                                                 |
  | `createSimulatorFromCircuit(ir, library)`                                                                                     | `simulate(circuit)`. For the raw engine: `createEngine(elaborate(ir, library.definitions), { library })` from `/internal` |
  | `createSimulator(flat, options)`                                                                                              | `createEngine`, from `/internal`                                                                                          |
  | `simulateCircuit(params)` (`/api`)                                                                                            | `traceSource`, from `/internal`                                                                                           |
  | `EvalEntry`, `registerCircuitEval`, `getCircuitEval`, `getAllCircuitEvals`                                                    | removed; a built circuit carries its behavior (`internalsOf(c).behavior`, from `/internal`)                               |
  | std components from `@simten/core`                                                                                            | `@simten/core/std`                                                                                                        |
  | `@simten/core/simulator`, `/api`, `/import`                                                                                   | `@simten/core/internal`                                                                                                   |
  | `@simten/core/examples/catalog`                                                                                               | `@simten/core/examples`                                                                                                   |
  | `@simten/core/rtl`                                                                                                            | removed (Verilog-import cells, used internally)                                                                           |
  | `@simten/core/util/test-name` (`slugify`)                                                                                     | `@simten/core/internal`                                                                                                   |
  | `executeCircuitCode`, `buildFromIR`, `circuitToSource`, `isSequentialCircuit` and the other non-builder exports of `/circuit` | `@simten/core/internal`                                                                                                   |
  | `autoHarness`                                                                                                                 | removed: `@simten/react`'s canvas draws a circuit's ports itself (#531)                                                   |
  | `getGrammarHandler`, `getCircuitAPISummary`                                                                                   | removed; the text lives in the MCP `get_grammar` tool                                                                     |
  | `CircuitShape`, `PortRef`, `StateFieldType` (`/circuit`)                                                                      | removed; they appear in no public signature                                                                               |

- 38feb78: `Simulation.get` and `set` take only the circuit's own top-level port names, and unknown port names now throw instead of reading 0. Node writes through `nodesOf(sim).set` need the exact node path.

  `simulate_circuit` reports an `inputs` name that isn't a top-level input as an error, and `memoryData` keys must be exact node paths.

- 1377bd3: Top-level input names and node paths no longer share one write on the node level. `nodesOf(sim).set` takes node paths only, so a top-level input name passed to it now throws instead of driving the input. (`sim.set` takes input names and Switch and Input paths, resolved exactly; see the `set` changeset.) On the engine (`@simten/core/internal`), `setInput(name, value)` drives a top-level input and `setNode(path, value)` writes a node; `setNode` no longer accepts input names.

  `nodesOf(sim).primitiveOf(path)` returns the primitive type of the node at a path, or undefined when there is none.

- d3031cb: Memory contents have one format, a plain object `{ address: value }`, and contents that don't fit the memory are compile errors (#474). The new `MemoryContents` type names it.

  | Old                                                                 | New                                                                                            |
  | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
  | `mem(depth, width, new Map([[0, 7]]))`                              | `mem(depth, width, { 0: 7 })`                                                                  |
  | `ROM({ memory: [7, 9] })` (and `RAM`, `DualPortRAM`, `DualPortROM`) | `ROM({ memory: romFromBytes([7, 9]) })`, or `romFromWords(words, width)` for wider words       |
  | `sim.setNode('rom', new Map([[0, 7]]))`                             | `sim.setNode('rom', { 0: 7 })`. `setNode` is typed `number \| MemoryContents` instead of `any` |
  | `RegState`                                                          | `RegDecl`                                                                                      |
  | `MemState`                                                          | `MemDecl`                                                                                      |
  | `ConnectArg`                                                        | `ConnectContext`                                                                               |
  | `MemoryValue.data` in the IR (`/internal`) is a `Map`               | a `MemoryContents` object, so the IR stays plain JSON                                          |
  | `ArgumentValue` (`/internal`) includes `number[]`                   | it doesn't; memory arguments are `MemoryContents`                                              |

  New compile errors, each naming the circuit, the state field and the address:

  - a value that doesn't fit the memory's width (`{ 0: 300 }` at 8 bits used to be masked to 44), or one that isn't an integer
  - an address at or past the memory's depth (it used to be ignored), or one that isn't a non-negative integer
  - an array or a `Map` where contents are expected, with a pointer at `romFromBytes`/`romFromWords` (an array used to crash with a raw `TypeError` in `mem()` and was silently dropped by the Verilog exporter)

- 25966b0: A built `Circuit` is now just `{ name, inputs, outputs }`, frozen (#480). `inputs` and `outputs` map each port name to its type (`bit` or `bus(n)`). The netlist, dependencies, factory options and behavior are internal, so the IR types are no longer reachable from the public API. Circuit source doesn't change.

  | Old                                                                                                                                                     | New                                                                 |
  | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
  | `c.circuit` (the IR)                                                                                                                                    | `internalsOf(c).ir`, from `@simten/core/internal`                   |
  | `c.circuit.name`                                                                                                                                        | `c.name`                                                            |
  | `c.inputs.a` (a `PortDescriptor`)                                                                                                                       | `c.inputs.a` (a `PortType`)                                         |
  | `c.nodes`                                                                                                                                               | `internalsOf(c).ir.nodes`                                           |
  | `c._dependencies`                                                                                                                                       | `internalsOf(c).dependencies`                                       |
  | `c._args`                                                                                                                                               | `internalsOf(c).args`                                               |
  | `c._shape`                                                                                                                                              | removed                                                             |
  | `behaviorOf(c)`                                                                                                                                         | `internalsOf(c).behavior`                                           |
  | `exportVerilog(ir, definitions, options)`                                                                                                               | `exportVerilog(c, options)`                                         |
  | `exportVerilogFlat(ir, definitions, options)`                                                                                                           | `exportVerilogFlat(c, options)`                                     |
  | `checkSynthesizable(evalFn, inputNames, outputNames)`                                                                                                   | `checkSynthesizable(c)`, which checks every primitive in the design |
  | `generateTestbench(ir, vectors, options)`                                                                                                               | `generateTestbench(c, vectors, options)`                            |
  | `generateExhaustiveVectors(ir, maxBits)`                                                                                                                | `generateExhaustiveVectors(c, maxBits)`                             |
  | `VerilogExportOptions.behaviors`                                                                                                                        | removed; the exporter reads the circuit's own behavior              |
  | `tryEmitFromEval`, `emitPrimitive`, `ParsedEval`, `VerificationResult`, `VerificationTestResult`, `VerificationCycle`, `VerilogLintResult` (`/verilog`) | removed from the public API                                         |
  | `simulate(c).snapshot()` returns `SimulatorSnapshot`                                                                                                    | returns an opaque `Snapshot` that `restore()` takes                 |
  | `buildSnake()` returns `{ circuit, definitions, built, core }`                                                                                          | returns `{ built, core }`                                           |

  `exportVerilog` used the standard library's behavior unless you passed your own, so a design with its own `eval` primitive exported it as unsupported. It now uses the behavior of the circuit you pass.

  Newly exported types: `Snapshot` (from `@simten/core`), `ArgumentValue` and `NodeEntry` (from `/circuit`), `ExportResult` (from `/verilog`) and `CheckOpts` (from `/verify`). A test checks that every type a public signature reaches is exported, and that every exported type is used.

  `@simten/core/internal` adds `internalsOf`, `isCircuit` and `CircuitInternals`, plus `exportVerilogFromIR(ir, library, options)` for callers that only have IR. It takes the behavior explicitly and reports a primitive with none as unsupported rather than falling back to the standard library.

- fdf488d: `sim.set` takes a circuit's inputs as a person at the board sees them: input ports by name, and Switch and Input nodes by path (decision 0010). A testbench drives a circuit made of switches the same way as one with ports, so the game's d-latch level is `sim.set({ d: 0, en: 0 })`. Every key in one call is written before the circuit settles. A key that names any other node, that names nothing, or that names both an input port and a Switch throws, and nothing is written.

  `simulate(top, { memory })` loads memory contents by node path before cycle 0, the same option as the sandbox's `open` and `useSimulation`. `reset()` keeps them.

  `simulate(circuit)` types `set`'s keys from the circuit: its input ports, plus its Switch and Input nodes and their paths up to five levels down. A typo is a compile error.

  | Before                                                    | After                                              |
  | --------------------------------------------------------- | -------------------------------------------------- |
  | `nodesOf(sim).set('d', 1)` for a Switch                   | `sim.set({ d: 1 })`                                |
  | two `nodesOf(sim).set` calls for two switches             | `sim.set({ d: 0, en: 0 })`, settled once           |
  | `nodesOf(sim).set('rom', contents)` before the first tick | `simulate(top, { memory: { rom: contents } })`     |
  | `sim.set({ reg: 1 })` with a register named `reg`         | still throws; registers and memories aren't inputs |

- 4f74855: `simulate()` returns a handle without `.session`, so the public API no longer exposes the simulation engine.
- 5dc1429: The simulator now follows the simulation model in decision 0002.

  - Every output is masked to its port width, so an eval that returns `a + b` on an 8-bit port stores the low 8 bits. Values are unsigned: a 32-bit all-ones value reads back as `0xFFFFFFFF`, not `-1`.
  - A bus wider than 32 bits is a compile error when the circuit is compiled for simulation.
  - A state block on a falling edge, on a clock other than its component's own, or a component with more than one clock is a compile error naming the node. These used to run on the rising edge without a word. `updateClockStates` is gone from `@simten/core/simulator`.
  - `bit` counts as `bus(1)` in the width check: `bus(n)` into `bit` is a "truncates" error that suggests `Slice`, and `bit` into `bus(n)` widens with a warning.
  - `Constant` throws when its `value` does not fit its `width` (`Constant({ value: 255 })` needs `width: 8`).
  - `restore()` puts back top-level inputs and the values `setNode` wrote into Switch/Input nodes, and snapshots no longer share the clocks map. A memory field in a multi-block state is copy-on-write in `onTick`, like a lone memory.
  - The propagation cap scales with the circuit (64 evaluations per node, at least 10 000), and the error names the nodes still changing.

- 2dbad6f: `simulate(top, options?)` returns a `Simulation`, which replaces `SimulationHandle` and `SimulationSession` (#417). It is synchronous, has no timers and nothing to dispose, and keeps history when you ask for it: `simulate(top, { history: 200 })` records one step per `tick` call, and `stepBack()`, `stepForward()` and `seek(index)` move through it. History is off by default, and then those three return `false`.

  | Old                                                                 | New                                                                                                                |
  | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
  | `sim.tickN(n)`                                                      | `sim.tick(n)`                                                                                                      |
  | `sim.dispose()`                                                     | nothing to call; delete the line                                                                                   |
  | `sim.setNode(path, value)`                                          | `nodesOf(sim).set(path, value)` from `@simten/core/internal`. For memory loaded at build time, `ROM({ memory })`   |
  | `sim.run({ speed })`, `sim.stop()`, `sim.isRunning`                 | removed from core. In Node, call `tick` in a loop                                                                  |
  | `sim.watch(fn)`, `sim.watchPort(name, fn)`                          | removed. You know when state changes, because you called `tick`                                                    |
  | `SimulationSession`, `SessionSnapshot`, `getEngine()` (`/internal`) | `createSimulation(ir, library, options)` and `nodesOf(sim)` (`ports()`, `peripherals()`, `advance(n)`, `record()`) |

  `get` and `read` after `set` on a sequential circuit now return settled values. They used to return the value from before the write until the next `tick`. Clocked results are unchanged: `tick` already propagated from the new inputs.

  On a combinational circuit, `tick(n)` settles the logic and leaves `cycle` at 0. `tickN(n)` used to count n cycles there.

- 4f74855: `buildSnake()` from `@simten/core/examples` returns `definitions` in place of `lib`.

### Patch Changes

- f7a6a51: `executeCircuitCode` and `executeJsCode` (in `@simten/core/internal`) return `{ circuits, exported, library, error }`. `circuits` holds the built `Circuit`s in build order and `exported` every circuit the source exports, built there or not. `circuit`, `exportedCircuits` and `builtCircuits` are gone, and nothing is picked as a main circuit: callers choose one by name or take the last. IR comes from `internalsOf(circuit).ir`.

## 0.22.1

### Patch Changes

- c8a9c97: `Splitter({ width })` and `Combiner({ width })` now type exactly the ports their width has. `Splitter({ width: 4 })` autocompletes `bit0` to `bit3`, and `bit4` is a type error. A width that isn't a literal still accepts any `bitN`.

## 0.22.0

### Minor Changes

- 5dd1c45: Add `Splitter({ width })` and `Combiner({ width })`, which split a bus of any width into `bit0`…`bitN-1` and join bits back into a bus.

  Breaking: the old `Splitter`, which split a byte into two 4-bit halves, is now `NibbleSplitter`. Its ports are unchanged. `Splitter8to8` and `Combiner8to8` still work and match `Splitter({ width: 8 })` and `Combiner({ width: 8 })`.

### Patch Changes

- 5dd1c45: A circuit with inputs and outputs but no nodes and no `eval` is now an empty composite rather than a primitive. Its outputs are simply undriven, and a pass-through built this way now carries its signal (#147) and exports as a plain `assign`.

## 0.21.0

### Minor Changes

- 71c8e4b: Add `MOS6502_Core`, a cycle-accurate NMOS 6502 built from the chip's block diagram (decode PLA, ALU with decimal mode, registers, DB/SB/ADL/ADH buses), and `MOS6502_ALU`. It passes Tom Harte's SingleStepTests for all 151 documented opcodes and Klaus Dormann's functional and decimal tests. Adds a `6502-computer` example: the core with 2 KB RAM, ROM and a console.

## 0.20.1

### Patch Changes

- bc1b755: Using `.out` or `.in` on something that is already a port (such as a circuit input `a.out.to(...)`) now fails with an error naming the port and how to wire it, instead of "Cannot read properties of undefined".

## 0.20.0

### Minor Changes

- 83b6105: Look at a component without wrapping it in a circuit.

  `export default FullAdder` used to report "No circuits found in source" at
  someone who could see a component in front of them. The collector only watches
  `circuit()` calls, and a re-export builds nothing, so the source read as empty.

  `ExecuteResult` gains `exportedCircuits` for components the code exported
  without defining. `circuits` still means "constructed here" and is what the MCP
  tools report, so nothing starts claiming a stdlib gate was written locally; a
  renderer falls back to the export only when the source defined nothing.
  Parameterised components are exported as factories, so a bare function is
  called with no arguments for its default instance, matching what
  `nodes: { r: Register }` gives you.

  The message for a genuinely empty source now says what to do: "Nothing to show.
  Define a circuit with circuit('Name', { ... }), or export a component to look
  at." Previously three call sites had three different wordings.

  Also fixes the harness for eval-only primitives. It skips ports nothing inside
  the circuit wires up, which is right for a composite and wrong for an `Or`,
  whose ports are used by its `eval` rather than by connections — so a rendered
  primitive had no switches to click.

## 0.19.0

### Minor Changes

- 142ad20: Mark the nodes `autoHarness` generates, and stop labelling their ports.

  A harnessed circuit is not the circuit you wrote: the harness wraps it, adds a
  switch per input and a led per output, and names each after the port it drives.
  Drawn with port labels on, that produces a switch labelled `a` with a port
  labelled `out`, sitting next to source where `a` is the port itself and has no
  `out`. The canvas was teaching a spelling the compiler rejects.

  `Node` now carries an optional `harness` flag, set on the switches and leds
  `autoHarness` creates, and `CircuitCanvas` leaves those ports unlabelled when
  `showPortLabels` is on. A switch the author wrote keeps its label, because
  there `a.out.to(...)` is exactly right.

  The flag is additive and optional, so existing IR stays valid. Anything
  rendering circuits can use it to tell scaffolding from the design.

## 0.18.0

### Minor Changes

- 8ec39e3: Harness only the ports a circuit actually uses.

  `autoHarness` gave every declared port a switch or a led, whether or not
  anything inside the circuit touched it. The result was a diagram that claimed
  connections the circuit did not have: a switch wired into an input that goes
  nowhere, a led hanging off an output nothing drives. It looked finished before
  a single wire had been written, and drilling into the box showed none of the
  edges the outside implied.

  An input is now harnessed once something inside reads it, and an output once
  something inside drives it. The `dut` still declares every port, so the
  interface stays visible as bare handles, and each switch or led appears as its
  port is wired up.

  Worth knowing if you drive a harnessed circuit by node id: a port that is not
  used inside no longer has a node to set. Ports still resolve by name through
  the simulator, which tries a top-level port before falling back to a node id,
  so anything driving inputs that way is unaffected.

## 0.17.0

### Minor Changes

- 08b8ef6: Reject bus connections that silently drop bits.

  `circuit()` now throws when a wider bus drives a narrower one, naming both
  widths: `truncates alu.result bus(32) into display.in bus(8)`. Elaboration
  propagates the source type, so before this the high bits were simply gone with
  nothing recording that they had been dropped.

  Widening is allowed and warns. A port here is uninterpreted `Bits`: `PortType`
  is `bit | bus(n)`, with signedness carried by the component (`SignedAdder`,
  `SignedComparator`) rather than the type. With no sign in the type a widening
  has one meaning, so requiring it to be spelled out states nothing the type does
  not already fix. It stays a warning because the widths still disagree. Verilog
  and Amaranth widen implicitly off declared signedness; SpinalHDL's `Bits.resize`
  zero-extends for the same reason. If signedness moves into `PortType` this
  should become an error, or disappear because the type resolves it.

  `bit` to `bus` is untouched. That is a kind change rather than a width mismatch
  and stays the documented affordance it was.

  Three primitives were lying about their widths, which is what let the truncations
  hide:

  - `BitSlice`'s `out` was hardcoded `bus(8)` whatever the slice covered, so a
    2-bit slice claimed 8 bits. It is now `high - low + 1`. A bare `BitSlice` is
    unchanged at 8 bits.
  - `HexDisplay` was fixed at `bus(8)`, so a 16-bit accumulator wired into one lost
    its high byte. It takes `width` now, which makes it a factory: write
    `HexDisplay()` where you wrote `HexDisplay`.
  - `Input` was fixed at `bus(8)` while happily carrying `Input({ value: 0x11111111 })`.
    It takes `width`. Already a factory, so no call sites change.

  `ZeroExtend` and `SignExtend` had no entry in the Verilog primitive map, so any
  circuit using either exported `// WARNING: Unsupported primitive` in place of the
  extension: output that parses, synthesizes, and does not do what the circuit
  does. The importer emits both routinely from yosys netlists, so this was
  reachable without writing one by hand. Both map to plain wiring now,
  `{5'b0, x}` and `{{5{x[2]}}, x}`, which yosys folds into the net.

  Fixes the truncations this found across the shipped designs: the systolic array's
  nine result registers and its per-column pipeline registers were 8 bits between a
  16-bit partial sum and a 16-bit output port, the RV32I forwarding slices and
  byte-offset slice read the wrong widths, and several displays showed the low byte
  of a 32-bit value.

- 08b8ef6: Make the value domain numeric. `BitValue` is `0 | 1`, not `boolean`.

  Booleans are gone from `FieldValue`, `PrimitiveState`, primitive options and
  `@simten/embed` props. A bit and a bus are now the same kind of thing at
  runtime, so nothing has to infer a width from a JS type. The one deliberate
  exception is `PortOutputValues`, which still widens bit outputs to
  `number | boolean` so `{ out: !(a | b) }` reads naturally in an `eval`. That is
  pinned by a test; it is not an oversight.

  Test files were never type-checked. Every package excluded them from its build
  tsconfig so `tsc -b` would not emit them into `dist`, and Vitest strips types
  with esbuild without checking them, so no test in the repo had ever been through
  the compiler. Each package now has a `tsconfig.check.json` and a
  `typecheck:tests` script, and the root `typecheck` runs both passes. That
  surfaced 206 errors, and behind them these bugs:

  - `sim.set()` ran `Boolean(value)` on bit ports, so the public testbench API
    converted every bit it was handed.
  - `DFlipFlop` stored boolean state through `onTick: () => ({ value: Boolean(d) })`.
  - `circuit()`'s factory path wrote `initialValue: false` into the serialized IR.
  - `Register` and `DFlipFlop` took their state width from the JS type of the
    initial value, so `Register({ width: 16 })` could still declare 8 bits of state.
  - Declarative `reg()` / `mem()` leaked their declaration types into `eval` and
    `onTick`, so the API could not be used without casts that did not compile.
  - `simulateCircuit` and the `simulate_circuit` MCP schema still accepted booleans.

## 0.16.0

### Minor Changes

- 34d7481: Make eval-only stdlib primitives drillable on the canvas.

  All 51 stdlib primitives are eval-only, so `Adder(16)`, `Mux(16)` and
  `Comparator(16)` were dead ends: double-clicking one did nothing. That
  contradicts the README — "any component can be opened up and shown as what it is
  made of" — and a reader following the drill-down hit a wall at the first piece of
  arithmetic.

  The fix is not to make them composites. The synth voice is 18 nodes at ~78k
  ticks/s; all-gates it is ~2,000 nodes at ~700 ticks/s, too slow for the audio
  demo to run at all. Verilog export would degrade from `assign sum = a + b + c` to
  a thousand structural assigns, which is worse for Verilator and denies Yosys the
  chance to infer an adder and map it to the target's carry chain.

  Instead `MADE_OF` holds a gate-level build per primitive, keyed by name, built
  from the node's own arguments so `Adder({width: 16})` opens 16 stages and
  `Adder({width: 8})` opens 8. It is display only — constructed on demand for a
  dialog that runs its own simulator, never elaborated into the running netlist, so
  it costs nothing until someone drills. Covers Adder, Subtractor, Incrementer, Mux
  and Comparator; skips Multiplier/Divider (a 256-adder array teaches nothing) and
  memory (ROM/RAM map to hardened blocks, so a gate build would misrepresent them).

  Each level stays small because it is hierarchical: `Adder(16)` is 16 FullAdders,
  and a FullAdder is five gates. `FullAdder` is new to the stdlib.

  Two descriptions of addition maintained by hand can drift, so they are proven not
  to: `made-of.verify.ts` walks every entry, reads its primitive's port widths, and
  sweeps the whole input space — exhaustive at widths 1, 2 and 8 (2^17 cases for an
  adder), sampled at 16. Every diagram is proven to compute what the primitive it
  explains computes.

  The builds stop at Xor/And/Or/Not. The game already teaches NAND to gates level
  by level; this covers gates to arithmetic.

## 0.15.4

### Patch Changes

- 04cb50e: Stop two things that are not clock problems from failing a whole import.

  A port is treated as the module's clock when every consumer of its net is a
  clock pin. Two unrelated things could make that test fail:

  A `$display` in a clocked block. Yosys lowers it to a `$print` cell whose
  trigger hangs off the clock net. The importer already dropped those when
  lifting, so counting them as data consumers first was simply inconsistent — a
  debug statement should not decide what a clock is.

  A submodule taking a clock it never reads. With no consumers the port never
  classified, and because a parent's clock is only recognised when every consumer
  is a clock pin, one unused input disqualified the clock of every module above
  it. A port the child never reads argues neither way, so it no longer counts
  against the parent.

  Both were found by importing the NES core from `strigeus/fpganes`. Its simplest
  mapper takes a `clk` it has no use for, and the PPU and several mappers log with
  `$display`; between them the import failed outright. It now imports — 116
  circuits, 5972 nodes — and simulates, on unmodified upstream sources.

  Tested behaviourally: a register that latched every tick regardless of the clock
  would satisfy a structural check just as happily.

## 0.15.3

### Patch Changes

- 55b3226: Stop copying memory contents on every clock tick.

  Committing sequential state cloned every memory `Map` twice per tick, and the
  onTick wrapper cloned it a third time before handing it over. None of those three
  copies asked whether anything had been written. `ROM` declares
  `onTick: ({ memory }) => ({ memory })`, so a read-only wavetable was copied three
  times per cycle in order to return itself unchanged.

  The cost scaled with the size of the memory, which is the wrong axis: a larger ROM
  is not more work to read from.

  Copy-on-write instead. `onTick` is handed the committed Map directly and the first
  write clones it, so a tick that writes nothing costs nothing. Commit adopts the Map
  it is given rather than copying it a second and third time.

  | ROM entries | before      | after |
  | ----------- | ----------- | ----- |
  | 256         | 25k ticks/s | 342k  |
  | 1024        | 7k          | 292k  |
  | 4096        | 1.7k        | 306k  |

  The size dependence is gone, so memory can be sized for what the design needs
  rather than for what the simulator can afford. A memory node still costs more per
  tick than a plain register, but it is now a constant rather than a slope.

  Snapshots alias the committed Map by reference (`toFlatSequentialState`), so the
  old per-tick clone was load-bearing for time travel without anything recording
  that it was. A write still produces a fresh Map, which preserves the invariant,
  and `snapshot-roundtrip.test.ts` now covers memory state directly — including that
  a held snapshot survives later writes, and that a read-only memory is handed
  through untouched across ticks.

## 0.15.2

### Patch Changes

- 0218875: Imported nodes are named after the RTL signals they drive.

  Drilling into an imported design landed on `add_45`, `or_32`, `mux_92` — names
  built from the operator and the source line, which say what a node is and
  nothing about what it means. The netlist already carried better ones: yosys
  records each net's source name in `netnames` with `hide_name: 0`, and `serv_alu`
  has 24 of those against 17 it invented, including every label in SERV's own
  block diagram — `result_add`, `result_lt`, `add_cy`, `cmp_r`, `rs1_sx`.

  A cell yosys named itself takes the name of the net it drives, so long as every
  signal that net touches is driven by that cell in full. `{add_cy, result_add} =
x + y` is one adder over a value and its carry, and takes the name on bit 0;
  two cells each producing half of one signal keep their operator names, because
  neither of them is that signal. An instance the author named keeps its own name.

  Across the corpus this moves 0% of semantic nodes to 23% (SERV `serv_rf_top`),
  24% (`servant`) and 15% (picorv32).

- 0218875: Import no longer emits a fresh node every time it needs the same one.

  Every bit vector was rebuilt from scratch, so a module reading bit 0 of the same
  register in nine places got nine identical `Slice` nodes, and one needing a zero
  got a fresh `Constant` each time. picorv32 emitted 1270 constants, 1158 of them
  repeats.

  These nodes are pure and take the same inputs, so they are the same node.
  Sharing them is fan-out, which the IR already expresses. Nodes are keyed on what
  they are, their shape, and where their inputs come from — anything short of all
  three still gets its own node.

  | design             | nodes       | largest module | recon ÷ semantic |
  | ------------------ | ----------- | -------------- | ---------------- |
  | RV32I_CPU_Core     | 1076 → 656  | 1076 → 656     | 0.333 → 0.304    |
  | SERV `serv_rf_top` | 1011 → 887  | 262 → 183      | 0.414 → 0.263    |
  | picorv32           | 4154 → 2892 | 2077 → 1446    | 0.374 → 0.365    |

  `cleanliness.test.ts` bounds are ratcheted down to match, and SERV joins it as a
  second fixture — the bound had only ever been measured against a design written
  for this importer, and unmodified upstream Verilog was over it.

## 0.15.1

### Patch Changes

- 1402425: Verilog export now reports primitives it has no mapping for.

  `emitPrimitive`'s default case emits `// WARNING: Unsupported primitive` in
  place of logic and lets the export succeed, so the result parses, synthesizes,
  and does not do what the circuit does. It was found with a yosys miter/sat
  equivalence check: round-tripping `RV32I_ALU` through import and back produced a
  module whose `result` matched but whose `zero` did not, and nothing in the file
  looked wrong to a reader.

  `ExportResult` gains an optional `unsupported` map of primitive type to node
  ids, populated during the real emit rather than by probing, and left absent on a
  clean export so existing consumers are unaffected. Imported designs hit this
  routinely — `Slice`, `ZeroExtend`, `SignExtend` and `Pmux_*` are all products of
  yosys elaboration with no exporter mapping.

- 1402425: `Mem` now keeps its initial contents through the source round trip.

  The importer lifts a `$mem_v2` INIT (a `$readmemh` image, or a ROM table) into
  the node's `store` argument, and `circuitToSource` emits it — but the `Mem`
  factory dropped `store` on the floor, so the generated source compiled to an
  empty memory. The IR the importer produced ran the program; the source the
  editor showed for the same design fetched zeros.

  SERV's `servant` SoC is the case that surfaced it: imported from the IR it
  prints `Hi, I'm Servant!` on its serial pin, and re-compiled from its own
  generated source it stalled at the first instruction.

- 1402425: Import: drop `$display`/`$write` with a warning instead of failing the import.

  yosys lifts these to `$print` cells, which have no hardware meaning, so the
  importer threw `unsupported cell type $print` and took the whole design down
  over a debug statement. Real RTL is full of them — one `$display` in its RAM
  preload made SERV's `servant` SoC unimportable.

  The cell is now skipped and reported through the existing warnings channel,
  naming the module and the source line (`servant_ram: dropped 1 $display/$write
statement(s) (dut.v:4278)`), so output is visibly missing rather than silently
  swallowed. Genuinely unsupported cells still throw.

- 1402425: New `UART_RX({ cyclesPerBit })` in the standard library.

  Imported SoCs talk over one bit-banged pin — SERV's `servant`, picosoc and most
  soft cores expose a serial output and nothing else. Wiring that pin here and
  `data`/`valid` into a `Console` prints what the program prints, with no glue
  written per design.

  Standard 8-N-1 framing, one sample per bit taken at the middle of the bit.
  `cyclesPerBit` is clock rate over baud rate and is worth setting explicitly;
  `servant` bit-bangs at 279 cycles per bit.

  The receiver waits for the line to rest high before accepting a start bit.
  Simulation is 2-state, so a pin that is undriven until the design boots reads 0,
  which is indistinguishable from a start bit — without that wait it locks to the
  power-on low and garbles the first several characters.

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
