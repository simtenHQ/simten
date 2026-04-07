# Architecture

## Pipeline

```
TypeScript circuit() → Circuit IR → Elaboration → Simulation
                           ↓             ↓             ↓
                       node graph    flat circuit   tick cycle
```

## Definition Layer

Circuits are defined with the `circuit()` factory function from `@turing-incomplete/core/circuit`. It takes a config object and returns a `BuiltCircuit` containing:

- The Circuit IR
- Type-level shape info for autocomplete and width checking
- A dependency map of sub-circuits used as nodes

```typescript
const HalfAdder = circuit('HalfAdder', {
  in: { a: bit, b: bit },
  out: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ in: inp, out, xor1, and1 }) => [...]
})
```

## IR Types

The `Circuit` interface is the single source of truth:

```typescript
interface Circuit {
  id: string;
  name: string;
  parameters: Parameter[];
  inputs: PortDescriptor[];
  outputs: PortDescriptor[];
  clocks: ClockDescriptor[];
  state: StateBlock[];
  nodes: Node[];
  connections: Connection[];
  implementation: { kind: 'primitive' } | { kind: 'composite' } | { kind: 'intrinsic' };
  metadata?: CircuitMetadata;
}

interface Node {
  id: string;
  componentRef: string;
  arguments: Record<string, ArgumentValue>;
  inputs: PortInstance[];
  outputs: PortInstance[];
  clocks: ClockInstance[];
}

interface Connection {
  source: PortPath;   // { nodeId: string, portName: string }
  target: PortPath;   // nodeId is "" for circuit-level ports
}

type PortType = { kind: 'bit' } | { kind: 'bus'; width: number };
```

## Elaboration

`elaborate()` recursively expands composite nodes into primitives, producing a `FlatCircuit`. This happens once per circuit load. The flat circuit is then compiled into a numeric representation (typed arrays, integer indices) for fast simulation.

## Simulation

### Combinational

1. Elaborate: flatten all composites to primitives
2. Build dependency graph (cycle detection during elaboration)
3. Propagate values from inputs through gates until quiescent
4. Return port values

### Sequential (per clock tick)

1. **Combinational phase 1** — propagate from current state
2. **Clock edge** — toggle clocks
3. **Sequential capture** — sample register inputs into next-state
4. **State commit** — registers update atomically
5. **Combinational phase 2** — propagate post-edge state to outputs

### Fast Simulator

`packages/core/src/simulator/index.ts` uses typed arrays and numeric indices for cache-friendly evaluation. The hot path has zero allocations once the circuit is compiled.

## Key Packages

| Package | Responsibility |
|---------|----------------|
| `@turing-incomplete/core` | Simulator, `circuit()` builder, stdlib, Verilog exporter |
| `@turing-incomplete/ui` | Canvas, editor components, shadcn primitives, stores |
| `@turing-incomplete/embed` | `CircuitEmbed` React component |
| `@turing-incomplete/mcp` | MCP server wrapping core handlers for Claude Code |
| `@turing-incomplete/cli` | CLI wrapper |

## Chat System

- **API route:** `apps/tanstack/src/api/chat/`
- Server-side tool_use loop with Anthropic SDK
- Streams NDJSON: `tool_call | message | done | error` chunks
- Analysis tools (simulate, testbench) run server-side
- Editor tools (write code, set inputs) deferred to client
- Supports multiple LLM providers (Anthropic, OpenRouter, OpenAI)
