# Turing Incomplete

A TypeScript-native digital circuit simulator and visual editor for learning hardware design.

## What is Turing Incomplete?

Turing Incomplete is a browser-based platform for designing, simulating, and debugging digital circuits. It combines:

- **TypeScript Circuit API** — define hardware as typed code with full IDE support
- **Visual Editor** — interactive canvas with drag-and-drop, drill-down, time-travel
- **Live Simulation** — deterministic tick-based execution with cycle-accurate visibility
- **AI Tutoring** — built-in chat that designs, verifies, and explains circuits
- **Embeddable** — drop a circuit into any React app with `<CircuitEmbed />`

## Quick Start

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3001`.

## Your First Circuit

```typescript
import { circuit, bit } from '@turing-incomplete/core/circuit'
import { Xor, And } from '@turing-incomplete/core/std'

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

Embed it in a React app:

```tsx
import { CircuitEmbed } from '@turing-incomplete/embed'

<CircuitEmbed circuit={HalfAdder} />
```

The embed auto-wraps the circuit with switches for inputs and LEDs for outputs.

## Architecture

```
TypeScript circuit() → Circuit IR → Elaborate → Simulate
```

- **`circuit()`** — typed factory function that returns a `BuiltCircuit`
- **Circuit IR** — platform-independent intermediate representation
- **Simulator** — fast numeric tick-based engine with snapshot/restore

### Core Principle

Only primitive components contain executable behavior. Composite circuits are structural — they expand into primitives at elaboration time. This guarantees full transparency, deterministic execution, and the ability to drill into any composite to see its internals.

## Project Structure

```
packages/
├── core/        # Simulator, circuit() builder, stdlib, Verilog exporter
├── ui/          # Canvas, editor components, shadcn primitives
├── embed/       # CircuitEmbed React component
├── mcp/         # MCP server for AI integration
└── cli/         # turing CLI

apps/
├── tanstack/    # Main web app (TanStack Start + Vite + Cloudflare)
├── compiler/    # RISC-V compiler service
└── verifier/    # Verilog verification service
```

## Tech Stack

- **Framework:** TanStack Start, React 19, Vite
- **State:** Zustand with Immer
- **Canvas:** React Flow
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Language:** TypeScript
- **Testing:** Vitest

## Development

```bash
pnpm dev          # Start dev server
pnpm test         # Run tests
pnpm build        # Build all packages
```

## Documentation

- Architecture and component model: [`docs/`](./docs/)
- In-app documentation: navigate to `/docs/` in the running app
- Blog posts demonstrating real circuits: `/blog/`
