# @simten/react

React components and hooks for Simten: `<CircuitEmbed>`, `useSimulation`, the circuit canvas, the code editor and the waveform viewer. Every circuit runs in Simten's cross-origin sandbox, never on your page.

This package replaces `@simten/ui` and `@simten/embed`.

Not using React? Show a circuit with the iframe embed (open it on simten.dev, then Share > Embed), drive your own UI with `SimulationClient` from [`@simten/sandbox`](https://www.npmjs.com/package/@simten/sandbox), or simulate trusted circuits headless with `simulate()` from [`@simten/core`](https://www.npmjs.com/package/@simten/core). See [Using Simten without React](https://simten.dev/docs/without-react).

## Install

```bash
npm install @simten/react @simten/core react react-dom
npm install -D @types/react @types/react-dom    # if you use TypeScript
```

## Show a circuit

```tsx
import '@simten/react/styles.css'
import { CircuitEmbed } from '@simten/react/embed'
import { circuit, bit } from '@simten/core'
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

The circuit is sent to a sandbox (a hidden iframe on another origin), which simulates it in a Web Worker. The canvas draws it with a switch for each input and a light for each output. Each embed opens its own simulation, so circuits on one page don't share state.

### Your own UI

`useSimulation` runs a circuit in the same sandbox and gives you its state and actions. Render whatever you want with them:

```tsx
import { useSimulation } from '@simten/react/sandbox'

function MyComponent() {
  const { state, actions } = useSimulation(HalfAdder, { harness: true })
  // state.portValues, state.cycle, state.error
  // actions.setInput(), actions.tick(), actions.reset()
}
```

It also takes source text, `useSimulation({ source })`, which compiles in the sandbox too. `SimulationView` from `@simten/react/embed` draws the canvas and clock controls for any `useSimulation` result. See [Building custom UIs](https://simten.dev/docs/building-custom-uis).

## Subpaths

| Subpath | What it has |
|---|---|
| `@simten/react/embed` | `CircuitEmbed`, `CircuitViewer`, `SimulationView`, `ErrorDisplay`, `ShareCircuitProvider` |
| `@simten/react/sandbox` | `useSimulation`, `useSandboxClient`, `SandboxProvider` |
| `@simten/react/canvas` | `CircuitCanvas`, `ClockControls`, `CircuitLayout`, the inspector dialog |
| `@simten/react/nodes` | Node renderers for primitives (gates, registers, memories, peripherals) |
| `@simten/react/monaco` | `SimtenCodeEditor`: Monaco with IntelliSense for circuit source ([below](#the-code-editor)) |
| `@simten/react/waveform` | `WaveformViewer` for VCD playback |
| `@simten/react/share` | Encode and decode share links |
| `@simten/react/primitives/*` | `button`, `dialog`, `resizable`, `sheet`, `tooltip` |
| `@simten/react/styles.css` | Every class the components use, compiled, for apps without Tailwind |
| `@simten/react/styles/theme.css` | The design tokens, for apps that use Tailwind v4 |

## CircuitEmbed props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `circuit` | `Circuit` | required | The circuit (what `circuit()` returns) |
| `height` | `number \| string` | responsive | Height. Without it the embed sizes itself to its width, at a ratio from `layout` (3:2 without one) |
| `showControls` | `boolean` | `true` | Clock controls for sequential circuits |
| `title` | `string` | | Title in the info bar |
| `description` | `string` | | Shown below the title |
| `layout` | `CircuitLayout` | | Node positions, keyed by input, output and node names. Skips the layout engine |
| `initialInputs` | `Record<string, number>` | | Starting values for the inputs |
| `autoRunSpeed` | `number` | `500` | Auto-run interval in ms |
| `onPortValuesChange` | `(values) => void` | | Called when the simulation settles on new values |

A `ref` gives you `tick`, `reset`, `setNodeValue`, `startAutoRun` and `stopAutoRun`.

### Type-safe layouts

`CircuitLayout<C>` limits the keys to the circuit's own names at compile time:

```tsx
import type { CircuitLayout } from '@simten/react/canvas'

// a | b | sum | carry | xor1 | and1
const layout: CircuitLayout<typeof HalfAdder> = {
  a:    { x: 0,   y: 0   },
  b:    { x: 0,   y: 80  },
  xor1: { x: 200, y: 0   },
  and1: { x: 200, y: 100 },
}
```

## CSS

Apps without Tailwind import the compiled stylesheet once:

```tsx
import '@simten/react/styles.css'
```

Its resets apply only inside the components (under `[data-embed-theme]`), so it doesn't restyle the rest of your page.

Apps on Tailwind v4 import the tokens instead and point Tailwind at the package, since Tailwind doesn't scan dependencies:

```css
@import "tailwindcss";
@import "@simten/react/styles/theme.css";
@source "../node_modules/@simten/react/dist";
```

## The code editor

`@simten/react/monaco` gives you Monaco set up for circuit source: typed completions and hovers for the Simten stdlib, and type acquisition so third-party imports (`react`, `zod`) resolve to real types.

```bash
npm install @simten/react @monaco-editor/react
```

```tsx
import { SimtenCodeEditor } from '@simten/react/monaco'

<SimtenCodeEditor value={source} onChange={setSource} />
```

If you already own a Monaco instance (a collaborative editor with a Yjs binding, say), use the headless setup and keep your own `<Editor>`:

```tsx
import { setupSimtenIntellisense, useTypeAcquisition } from '@simten/react/monaco'

useTypeAcquisition(source, monaco)

<Editor path="file:///circuit.ts" beforeMount={setupSimtenIntellisense} onMount={bindYjs} />
```

The model needs a real `file:///` URI: TypeScript resolves modules by walking up from the file looking for `node_modules`, and Monaco's default `inmemory://` scheme has nothing to walk. `SimtenCodeEditor` sets this for you. Without it every import resolves to `any`.

This subpath handles types only. Circuit source runs in the sandbox, which resolves imports from esm.sh on its own, so code can run while its types are still downloading. That's why module-not-found diagnostics are suppressed while semantic checks stay on.

Type acquisition fetches from jsDelivr at runtime. Pass `typeAcquisition={{ enabled: false }}` to turn it off, or `{ typescriptCdn }` to self-host. A failure means no completions, not a broken editor.

## Server-side rendering

The components render on the client. The layout engine loads with a dynamic `import()`, so it never loads on the server, and with a `layout` prop it doesn't load at all. In the Next.js Pages Router, load `CircuitEmbed` with `dynamic(..., { ssr: false })`.

## Peer dependencies

- React 19
- `@monaco-editor/react`: optional, needed only by `@simten/react/monaco`

Monaco is an optional peer, so it is never installed unless you ask for it, and every other subpath stays free of it. `monaco-editor` follows as a peer of `@monaco-editor/react`, and `@monaco-editor/react` loads Monaco itself from a CDN at runtime.

## Docs

<https://simten.dev/docs>. Source: <https://github.com/simtenHQ/simten>.

## License

Apache-2.0
