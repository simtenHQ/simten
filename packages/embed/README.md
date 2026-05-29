# @simten/embed

Embeddable interactive hardware circuits. Drop live, cycle-accurate simulations into any React app.

## Install

```bash
npm install @simten/embed @simten/core react react-dom
npm install -D @types/react @types/react-dom    # if you're using TypeScript
```

## Usage

### CircuitEmbed — read-only interactive viewer

```tsx
import '@simten/embed/styles.css'
import { CircuitEmbed } from '@simten/embed'
import { circuit, bit } from '@simten/core/circuit'
import { Xor, And } from '@simten/core/std'

const HalfAdder = circuit('HalfAdder', {
  inputs:  { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
    inputs.a.to(xor1.a, and1.a),
    inputs.b.to(xor1.b, and1.b),
    xor1.out.to(outputs.sum),
    and1.out.to(outputs.carry),
  ],
})

function App() {
  return <CircuitEmbed circuit={HalfAdder} height={300} />
}
```

The circuit compiles, simulates, and renders in the browser. Users can toggle switches, see values propagate, and interact with the simulation.

### useCircuitSimulator — custom layouts

```tsx
import { useCircuitSimulator } from '@simten/embed'
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

function MyComponent() {
  const sim = useCircuitSimulator(HalfAdder)

  // sim.ready, sim.error, sim.circuit
  // sim.inputs, sim.outputs, sim.portValues
  // sim.setNode(), sim.toggleNode(), sim.tick(), sim.reset()
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
| `layout` | `CircuitLayout<C>` | — | Pre-computed positions, keyed by node label or id. Bypasses the runtime layout engine. Keys are constrained at compile time to the circuit's input/output/node names. |
| `initialInputs` | `Record<string, number \| boolean>` | — | Set initial input values |
| `autoRunSpeed` | `number` | `500` | Auto-run interval in ms |
| `showPortLabels` | `boolean` | — | Show port labels on nodes |
| `glowUnconnected` | `boolean` | — | Highlight unconnected ports |
| `theme` | `"light" \| "dark"` | — | Force a color theme |

## How it works

1. The `BuiltCircuit` is elaborated (composites flattened to primitives)
2. A simulator engine evaluates the netlist
3. ReactFlow renders the circuit as interactive nodes and edges
4. The layout engine computes positions when no `layout` prop is provided (lazy-loaded, SSR-safe)

Each `useCircuitSimulator` call creates its own component library instance. Sub-circuits are registered into that instance during elaboration. No global state is shared between embeds.

## Type-safe layouts

`CircuitLayout<C>` constrains keys to the circuit's actual port/node names at compile time:

```tsx
import { circuit, bit } from '@simten/core/circuit'
import { CircuitEmbed, type CircuitLayout } from '@simten/embed'

const HalfAdder = circuit('HalfAdder', {
  inputs:  { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes:   { xor1: Xor, and1: And },
  connect: /* ... */
})

// TS infers the valid keys: a | b | sum | carry | xor1 | and1
const halfAdderLayout: CircuitLayout<typeof HalfAdder> = {
  a:    { x: 0,   y: 0   },
  b:    { x: 0,   y: 80  },
  xor1: { x: 200, y: 0   },
  and1: { x: 200, y: 100 },
  // typo: { x: 1, y: 1 }  // TS error: not a valid key
}

<CircuitEmbed circuit={HalfAdder} layout={halfAdderLayout} />
```

In dev mode, a runtime warning also fires if `layout` keys don't match the circuit's nodes — useful for circuits compiled at runtime via the web component path where TS can't help.

## CSS

The package ships compiled CSS at `dist/styles.css`. All classes are prefixed with `ti-` to avoid collisions with host app styles.

```tsx
import '@simten/embed/styles.css'
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
  () => import('@simten/embed').then(m => m.CircuitEmbed),
  { ssr: false }
)
```

### What happens during SSR

Components are skipped on the server and render only on the client. The layout engine uses `dynamic import()` so it is never loaded on the server. If you pass a `layout` prop, the engine isn't loaded at all — positions are applied directly.

## Requirements

- React 18 or 19
- A bundler that supports ESM (Vite, Next.js, etc.)

## License

Apache-2.0
