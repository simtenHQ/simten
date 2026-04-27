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
  in: { a: bit, b: bit },
  out: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
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
