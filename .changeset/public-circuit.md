---
'@simten/core': minor
---

A built `Circuit` is now just `{ name, inputs, outputs }`, frozen (#480). `inputs` and `outputs` map each port name to its type (`bit` or `bus(n)`). The netlist, dependencies, factory options and behavior are internal, so the IR types are no longer reachable from the public API. Circuit source doesn't change.

| Old | New |
|---|---|
| `c.circuit` (the IR) | `internalsOf(c).ir`, from `@simten/core/internal` |
| `c.circuit.name` | `c.name` |
| `c.inputs.a` (a `PortDescriptor`) | `c.inputs.a` (a `PortType`) |
| `c.nodes` | `internalsOf(c).ir.nodes` |
| `c._dependencies` | `internalsOf(c).dependencies` |
| `c._args` | `internalsOf(c).args` |
| `c._shape` | removed |
| `behaviorOf(c)` | `internalsOf(c).behavior` |
| `exportVerilog(ir, definitions, options)` | `exportVerilog(c, options)` |
| `exportVerilogFlat(ir, definitions, options)` | `exportVerilogFlat(c, options)` |
| `checkSynthesizable(evalFn, inputNames, outputNames)` | `checkSynthesizable(c)`, which checks every primitive in the design |
| `generateTestbench(ir, vectors, options)` | `generateTestbench(c, vectors, options)` |
| `generateExhaustiveVectors(ir, maxBits)` | `generateExhaustiveVectors(c, maxBits)` |
| `VerilogExportOptions.behaviors` | removed; the exporter reads the circuit's own behavior |
| `tryEmitFromEval`, `emitPrimitive`, `ParsedEval`, `VerificationResult`, `VerificationTestResult`, `VerificationCycle`, `VerilogLintResult` (`/verilog`) | removed from the public API |
| `simulate(c).snapshot()` returns `SimulatorSnapshot` | returns an opaque `Snapshot` that `restore()` takes |
| `buildSnake()` returns `{ circuit, definitions, built, core }` | returns `{ built, core }` |

`exportVerilog` used the standard library's behavior unless you passed your own, so a design with its own `eval` primitive exported it as unsupported. It now uses the behavior of the circuit you pass.

Newly exported types: `Snapshot` (from `@simten/core`), `ArgumentValue` and `NodeEntry` (from `/circuit`), `ExportResult` (from `/verilog`) and `CheckOpts` (from `/verify`). A test checks that every type a public signature reaches is exported, and that every exported type is used.

`@simten/core/internal` adds `internalsOf`, `isCircuit` and `CircuitInternals`, plus `exportVerilogFromIR(ir, library, options)` for callers that only have IR. It takes the behavior explicitly and reports a primitive with none as unsupported rather than falling back to the standard library. `stdBehaviorsFor(definitions, userNames)` gives std behavior to the primitives that are std's own.
