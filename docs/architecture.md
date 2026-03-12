# Architecture

## Pipeline

```
DSL text → Lexer → Tokens → Parser → AST → Validator → IR Compiler → Circuit[]
                                                                         ↓
                                                                    Elaboration (flatten composites → primitives)
                                                                         ↓
                                                                    Simulator (topological evaluation)
```

### Validation (4 phases)

1. **Syntax** — Chevrotain parser produces CST, converted to AST
2. **Semantic** — reference checks, duplicate names, self-references
3. **Type** — width matching, parameter validation (during IR compilation)
4. **Structural** — cycle detection (Tarjan's SCC), floating ports (during elaboration)

Later phases skip if earlier phases have blocking errors.

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
  from: PortPath;   // { nodeId: string, portName: string }
  to: PortPath;     // nodeId is "" for circuit-level ports
}

type PortType = { kind: 'bit' } | { kind: 'bus'; width: number };
```

## Simulation

### Combinational

1. Elaborate: flatten all composites to primitives
2. Topological sort (detects combinational loops)
3. Evaluate each primitive in order: read inputs → evaluate → write outputs
4. Return circuit outputs

### Sequential (per clock tick)

1. **Combinational phase** — evaluate all logic with current state
2. **Sequential update** — detect clock edges, compute next state
3. **State commit** — atomically update all state (current ← next)
4. **Re-evaluate** — propagate new state through combinational logic

### Fast Simulator

`packages/core/src/simulator/fast-simulator.ts` uses typed arrays for 2-5x speedup. Compiles flat circuits to a numeric representation for cache-friendly evaluation.

## Key Packages

| Package | Entry | Responsibility |
|---------|-------|---------------|
| `@turing-incomplete/core` | `src/dsl/`, `src/simulator/`, `src/api/` | Parser, compiler, validator, simulator, API handlers |
| `@turing-incomplete/ui` | `src/editor/` | Monaco editor, ReactFlow canvas, Zustand stores, clock controls |
| `@turing-incomplete/mcp` | `src/tools/`, `src/schemas/` | MCP server wrapping core handlers for Claude Code |
| `@turing-incomplete/challenges` | `src/` | Challenge definitions (ALU stages, Snake) |

## Chat System

- **API route:** `apps/web/src/app/api/chat/route.ts`
- Server-side tool_use loop with Anthropic SDK (max 10 iterations)
- Streams NDJSON: `tool_call | message | done | error` chunks
- Analysis tools (simulate, validate, testbench) run server-side
- Editor tools (write code, set inputs) deferred to client in `done` chunk
- Model: `claude-sonnet-4-20250514`
