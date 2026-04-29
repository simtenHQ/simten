# Simten

A TypeScript-native digital circuit simulator and visual editor for learning hardware design.

[![CI](https://github.com/simtenjs/simten/actions/workflows/ci.yml/badge.svg)](https://github.com/simtenjs/simten/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/deployed_on-Cloudflare-F38020?logo=cloudflare)](https://developers.cloudflare.com/workers/)

<!-- TODO: replace with your deployed URL -->
**[Live Demo →](<!-- DEPLOYED_URL -->)**

<!-- TODO: add a GIF showing build → simulate → drill-down → export Verilog -->
<!-- ![Demo](docs/assets/demo.gif) -->

## Why?

Existing tools for learning digital logic fall into two camps: visual-only simulators like Logisim that don't scale past a handful of gates, and industrial HDLs like Verilog that require a full toolchain and offer no interactive feedback. Simten sits in the middle:

- **Circuits are typed TypeScript.** You get IDE autocomplete, compile-time port checks, and refactoring tools — none of which exist in Verilog or visual drag-and-drop editors.
- **An IR makes everything possible.** The `circuit()` factory produces a platform-independent intermediate representation. That single IR powers the visual editor, Verilog export, snapshot/restore (time-travel debugging), and the AI tutor — all from one source of truth.
- **The simulator runs in the browser.** No backend round-trip for simulation; the edge stays stateless. The only server-side work is the AI chat loop and the two Cloudflare Container services described below.

## Architecture

```
TypeScript circuit() ──→ Circuit IR ──→ Elaborate ──→ Fast Simulator ──→ Trace
       │                     │                              │
       │                     ├── Verilog Export              ├── Snapshot / Restore
       │                     └── Visual Editor               └── Time-Travel Debugging
       │
   Typed API: IDE autocomplete, compile-time port checks
```

**Core principle:** only primitive components contain executable behavior. Composite circuits are structural — they expand into primitives at elaboration time. This guarantees full transparency, deterministic execution, and the ability to drill into any composite to see its internals.

### What runs where

| Layer | Runtime | What it does |
|---|---|---|
| Visual editor + simulator | Browser | Circuit canvas, tick-based simulation, time-travel, drill-down |
| Chat API (`/api/chat`) | Cloudflare Workers (edge) | Server-side Anthropic `tool_use` loop — streams NDJSON back to the client |
| `apps/compiler` | Cloudflare Container | RISC-V cross-compiler (GCC + Rust). Compiles C/C++/Rust/asm → rv32i machine code for the simulated CPU |
| `apps/verifier` | Cloudflare Container | Icarus Verilog runner. Cross-validates exported Verilog against our simulator's trace |

Both containers are addressed via Durable Objects and sleep after 2 minutes idle.

## Your First Circuit

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

Embed it in a React app:

```tsx
import { CircuitEmbed } from '@simten/embed'

<CircuitEmbed circuit={HalfAdder} />
```

The embed auto-wraps the circuit with switches for inputs and LEDs for outputs.

## Project Structure

```
packages/
├── core/        # Simulator engine, circuit() builder, stdlib, Verilog exporter
├── ui/          # Canvas components, editor, shadcn primitives
├── embed/       # <CircuitEmbed /> React component + web component
└── mcp/         # MCP server for AI integration (WebSocket bridge)

apps/
├── tanstack/    # Main web app (TanStack Start + Vite + Cloudflare Workers)
├── compiler/    # RISC-V cross-compiler service (Cloudflare Container)
└── verifier/    # Verilog verification service (Cloudflare Container + Icarus Verilog)
```

## Tech Stack

- **Framework:** TanStack Start, React 19, Vite
- **State:** Zustand with Immer
- **Canvas:** React Flow
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Language:** TypeScript 5
- **Testing:** Vitest (398 tests across simulator, circuit IR, stdlib, Verilog exporter)
- **AI:** Anthropic SDK with server-side `tool_use` loop
- **Infrastructure:** Cloudflare Workers, Cloudflare Containers, Durable Objects, Hono
- **Verification:** Icarus Verilog (via Go container service)

## Quick Start

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3001`.

## Development

```bash
pnpm dev          # Start dev server
pnpm test         # Run all tests
pnpm build        # Build all packages
```

## Documentation

- Architecture and component model: [`docs/`](./docs/)
- In-app documentation: navigate to `/docs/` in the running app
- Blog posts demonstrating real circuits: `/blog/`
