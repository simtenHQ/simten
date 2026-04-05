# @turing-incomplete/embed

Embeddable interactive circuit simulator. Drop live hardware simulations into any React app or HTML page.

## Quick start (no framework)

```html
<!-- Pin to exact version for production -->
<link rel="stylesheet" href="https://unpkg.com/@turing-incomplete/embed@0.1.0/dist/styles.css">
<script src="https://unpkg.com/@turing-incomplete/embed@0.1.0/dist/circuit-embed.js"></script>

<circuit-embed dsl="circuit HalfAdder {
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
}" height="300"></circuit-embed>
```

Works in any HTML page, any docs site, any CMS. No bundler needed.

### Web component attributes

| Element | Attribute | Type | Description |
|---------|-----------|------|-------------|
| `circuit-embed` | `dsl` | string | Circuit DSL source code |
| | `height` | number | Component height in pixels |
| | `title` | string | Header title |
| | `description` | string | Header subtitle |
| | `display-dsl` | string | DSL shown in "View DSL" panel |
| | `show-controls` | boolean | Show tick/auto/reset for sequential circuits |
| `circuit-editor` | `initial-dsl` | string | Starting DSL code |
| | `height` | number | Component height in pixels |
| | `title` | string | Header title |

## Install (React)

```bash
npm install @turing-incomplete/embed @turing-incomplete/core
```

## Usage (React)

### CircuitEmbed — read-only interactive viewer

```tsx
import '@turing-incomplete/embed/styles.css'
import { CircuitEmbed } from '@turing-incomplete/embed'

const dsl = `circuit HalfAdder {
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
}`

function App() {
  return <CircuitEmbed dsl={dsl} height={300} />
}
```

The circuit compiles, simulates, and renders in the browser. Users can toggle switches, see values propagate, and interact with the simulation.

### ComponentEditor — editable playground

```tsx
import '@turing-incomplete/embed/styles.css'
import { ComponentEditor } from '@turing-incomplete/embed/editor'

function App() {
  return <ComponentEditor initialDsl={myDsl} height={500} />
}
```

Split-pane editor with code on the left and live circuit on the right. Ctrl+Enter to compile, Tab inserts spaces.

### useCircuitSimulator — custom layouts

```tsx
import { useCircuitSimulator } from '@turing-incomplete/embed'

function MyComponent() {
  const sim = useCircuitSimulator(dslCode)

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
| `dsl` | `string` | required | Circuit DSL source code |
| `height` | `number \| string` | `300` | Component height |
| `showControls` | `boolean` | `true` | Show tick/auto/reset for sequential circuits |
| `title` | `string` | — | Header title |
| `description` | `string` | — | Header subtitle |
| `displayDsl` | `string` | — | DSL shown in "View DSL" panel (can differ from runtime DSL) |
| `initialMemory` | `Map` | — | Pre-load ROM/RAM data |
| `focus` | `string \| string[]` | — | Highlight specific nodes, dim others |
| `nodePositions` | `Record<string, {x,y}>` | — | Manual node positions (disables auto-layout) |
| `autoHarness` | `boolean` | `false` | Auto-append test harness wiring |

## How it works

1. DSL is compiled to an intermediate representation using `@turing-incomplete/core`
2. The circuit is elaborated (composites flattened to primitives)
3. A simulator engine evaluates the netlist
4. ReactFlow renders the circuit as interactive nodes and edges
5. ELK computes automatic layout (lazy-loaded, SSR-safe)

Each `useCircuitSimulator` call creates its own component library instance. Sub-circuits defined in the DSL are registered into that instance during compilation. No global state is shared between embeds.

## CSS

The package ships compiled CSS at `dist/styles.css`. All classes are prefixed with `ti-` to avoid collisions with host app styles.

```tsx
import '@turing-incomplete/embed/styles.css'
```

No Tailwind configuration required in the consuming app.

## CDN usage

### Pinned version (recommended for production)

```html
<link rel="stylesheet" href="https://unpkg.com/@turing-incomplete/embed@0.1.0/dist/styles.css">
<script src="https://unpkg.com/@turing-incomplete/embed@0.1.0/dist/circuit-embed.js"></script>
```

### Alternative CDN (jsDelivr)

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@turing-incomplete/embed@0.1.0/dist/styles.css">
<script src="https://cdn.jsdelivr.net/npm/@turing-incomplete/embed@0.1.0/dist/circuit-embed.js"></script>
```

### Subresource integrity

For maximum security, add SRI hashes:

```html
<script src="https://unpkg.com/@turing-incomplete/embed@0.1.0/dist/circuit-embed.js"
        integrity="sha384-..." crossorigin="anonymous"></script>
```

Generate hashes with:
```bash
cat dist/circuit-embed.js | openssl dgst -sha384 -binary | openssl base64 -A
```

### Version policy

- **Patch** (0.1.x): bug fixes, no API changes
- **Minor** (0.x.0): new features, backward compatible
- **Major** (x.0.0): breaking changes to props, DSL, or behavior

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

### Astro

```astro
<CircuitEmbed client:only="react" dsl={dsl} height={300} />
```

### What happens during SSR

Components are skipped on the server and render only on the client. The ELK layout engine uses `dynamic import()` so the 1.5MB library is never loaded on the server.

## Requirements

- React 18 or 19
- A bundler that supports ESM (Vite, Next.js, etc.) — or use the web component via CDN

## License

Business Source License 1.1
