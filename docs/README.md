# Simten

A browser-based digital logic simulator for learning hardware design. Define circuits in TypeScript, visualize them on a canvas, and simulate with time-travel debugging.

## Setup

```bash
pnpm install
pnpm dev        # starts on localhost:3001
```

## Documentation

- [Component Model](./component-model.md) — Primitives vs composites, available primitives, adding new ones
- [Architecture](./architecture.md) — System pipeline, IR types, simulation model
- [Simulator Engine](./simulator-engine.md) — Tick cycle, propagation, sequential state
- [Examples](./examples.md) — Circuits from half adder to tiny CPU

## Quick Example

```typescript
import { circuit, bit } from '@simten/core/circuit'
import { Xor, And } from '@simten/core/std'

const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
    inputs.a.to(xor1.a, and1.a),
    inputs.b.to(xor1.b, and1.b),
    xor1.out.to(outputs.sum),
    and1.out.to(outputs.carry),
  ],
})
```

## Project Structure

```
apps/tanstack/     Main web app (editor, chat tutor, blog posts)
packages/core/     Simulator, circuit() builder, stdlib, Verilog exporter
packages/ui/       React components (canvas, editor, shadcn primitives)
packages/embed/    CircuitEmbed React component for embedding circuits
packages/mcp/      MCP server (exposes tools to Claude Code)
```
