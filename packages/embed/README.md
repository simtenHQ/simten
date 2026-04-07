# @turing-incomplete/embed

Embeddable interactive circuit simulator. Drop live hardware simulations into any React app.

## Install

```bash
npm install @turing-incomplete/embed @turing-incomplete/core
```

## Usage

### CircuitEmbed — read-only interactive viewer

```tsx
import '@turing-incomplete/embed/styles.css'
import { CircuitEmbed } from '@turing-incomplete/embed'
import { circuit, bit } from '@turing-incomplete/core/circuit'
import { Xor, And } from '@turing-incomplete/core/std'

const HalfAdder = circuit('HalfAdder', {
  in:  { a: bit, b: bit },
  out: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
  ],
})

function App() {
  return <CircuitEmbed circuit={HalfAdder} height={300} />
}
```

The circuit compiles, simulates, and renders in the browser. Users can toggle switches, see values propagate, and interact with the simulation.

### useCircuitSimulator — custom layouts

```tsx
import { useCircuitSimulator } from '@turing-incomplete/embed'
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

function MyComponent() {
  const sim = useCircuitSimulator(HalfAdder)

  // sim.ready, sim.error, sim.circuit
  // sim.inputs, sim.outputs, sim.portValues
  // sim.setInput(), sim.toggleNode(), sim.tick(), sim.reset()
}
```

Build your own UI around the simulator. Each hook instance has its own isolated component library — multiple embeds on the same page won't interfere.

## Props

### CircuitEmbed

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `circuit` | `BuiltCircuit` | required | Circuit definition (result of `circuit()`) |
| `height` | `number \| string` | `300` | Component height |
| `showControls` | `boolean` | `true` | Show tick/auto/reset for sequential circuits |
| `title` | `string` | — | Header title |
| `description` | `string` | — | Header subtitle |
| `focus` | `string \| string[]` | — | Highlight specific nodes, dim others |
| `nodePositions` | `Record<string, {x,y}>` | — | Manual node positions (disables auto-layout) |
| `initialInputs` | `Record<string, number \| boolean>` | — | Set initial input values |
| `autoRunSpeed` | `number` | `500` | Auto-run interval in ms |
| `showPortLabels` | `boolean` | — | Show port labels on nodes |
| `glowUnconnected` | `boolean` | — | Highlight unconnected ports |
| `theme` | `"light" \| "dark"` | — | Force a color theme |

## How it works

1. The `BuiltCircuit` is elaborated (composites flattened to primitives)
2. A simulator engine evaluates the netlist
3. ReactFlow renders the circuit as interactive nodes and edges
4. ELK computes automatic layout (lazy-loaded, SSR-safe)

Each `useCircuitSimulator` call creates its own component library instance. Sub-circuits are registered into that instance during elaboration. No global state is shared between embeds.

## CSS

The package ships compiled CSS at `dist/styles.css`. All classes are prefixed with `ti-` to avoid collisions with host app styles.

```tsx
import '@turing-incomplete/embed/styles.css'
```

No Tailwind configuration required in the consuming app.

## Server-side rendering (SSR)

All embed components include `"use client"` directives and are compatible with React server component frameworks.

### Next.js App Router

Components work directly — the `"use client"` boundary is automatic.

### Next.js Pages Router

```tsx
import dynamic from 'next/dynamic'

const CircuitEmbed = dynamic(
  () => import('@turing-incomplete/embed').then(m => m.CircuitEmbed),
  { ssr: false }
)
```

### What happens during SSR

Components are skipped on the server and render only on the client. The ELK layout engine uses `dynamic import()` so the 1.5MB library is never loaded on the server.

## Requirements

- React 18 or 19
- A bundler that supports ESM (Vite, Next.js, etc.)

## License

Business Source License 1.1
