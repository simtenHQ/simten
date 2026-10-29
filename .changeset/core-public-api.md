---
'@simten/core': minor
---

Renames and a defined public API (#416). Behaviour is unchanged. The names saved circuits use (`circuit`, `bit`, `bus`, every std component and port, `@simten/core/std`) are unchanged too.

Public entry points: `@simten/core` (`circuit`, `bit`, `bus`, `reg`, `mem`, `simulate` and the builder types), `/std`, `/verify`, `/verilog` and `/examples`. Everything else moved to `@simten/core/internal`, which is for Simten's own packages and has no stability promise.

| Old | New |
|---|---|
| `BuiltCircuit` (what `circuit()` returns) | `Circuit` |
| `Circuit` (the IR) | `CircuitIR`, from `@simten/core/internal` |
| `import { simulate } from '@simten/core/sim'` | `import { simulate } from '@simten/core'` |
| `createSimulatorFromCircuit(ir, library)` | `simulate(circuit)`. For the raw engine: `createEngine(elaborate(ir, library.definitions), { library })` from `/internal` |
| `createSimulator(flat, options)` | `createEngine`, from `/internal` |
| `simulateCircuit(params)` (`/api`) | `traceSource`, from `/internal` |
| `EvalEntry`, `registerCircuitEval`, `getCircuitEval`, `getAllCircuitEvals` | removed; a built circuit carries its behavior (`internalsOf(c).behavior`, from `/internal`) |
| std components from `@simten/core` | `@simten/core/std` |
| `@simten/core/simulator`, `/api`, `/import` | `@simten/core/internal` |
| `@simten/core/examples/catalog` | `@simten/core/examples` |
| `@simten/core/rtl` | removed (Verilog-import cells, used internally) |
| `@simten/core/util/test-name` (`slugify`) | `@simten/core/internal` |
| `executeCircuitCode`, `buildFromIR`, `circuitToSource`, `isSequentialCircuit` and the other non-builder exports of `/circuit` | `@simten/core/internal` |
| `autoHarness` | removed: `@simten/react`'s canvas draws a circuit's ports itself (#531) |
| `getGrammarHandler`, `getCircuitAPISummary` | removed; the text lives in the MCP `get_grammar` tool |
| `CircuitShape`, `PortRef`, `StateFieldType` (`/circuit`) | removed; they appear in no public signature |
