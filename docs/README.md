# Turing Incomplete

A browser-based digital logic simulator for learning hardware design. Write circuits in a DSL, visualize them on a canvas, and simulate with time-travel debugging.

## Setup

```bash
pnpm install
pnpm dev        # starts on localhost:3001
```

## Documentation

- [DSL Reference](./dsl-reference.md) — Language syntax, types, and examples
- [Component Model](./component-model.md) — Primitives vs composites, available primitives, adding new ones
- [Architecture](./architecture.md) — System pipeline, IR types, simulation model
- [Examples](./examples.md) — Circuits from half adder to tiny CPU

## Quick DSL Example

```dsl
circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit

  impl {
    node xor1: Xor
    node and1: And

    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum

    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}
```

## Project Structure

```
apps/web/          Next.js app (editor, chat tutor, challenges)
packages/core/     DSL parser, compiler, validator, simulator
packages/ui/       React components (Monaco editor, ReactFlow canvas, stores)
packages/mcp/      MCP server (exposes tools to Claude Code)
packages/challenges/  Challenge definitions (ALU, Snake)
packages/cli/      CLI wrapper
```
