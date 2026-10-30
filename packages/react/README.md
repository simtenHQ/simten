# @simten/react

React for Simten circuits: `useSimulation` runs a circuit, and `CircuitCanvas` and `ClockControls` show it. Every circuit runs in Simten's cross-origin sandbox, never on your page.

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
import { CircuitCanvas, ClockControls, useSimulation } from '@simten/react'
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
  const sim = useSimulation(HalfAdder)
  return (
    <>
      <CircuitCanvas simulation={sim} height={300} />
      <ClockControls simulation={sim} />
    </>
  )
}
```

The circuit is sent to a sandbox (a hidden iframe on another origin), which simulates it in a Web Worker. The canvas draws it with a switch for each input and a light for each output, and shows its own loading and error states. `ClockControls` renders nothing for a circuit without a clock, so it's safe next to any canvas. Every circuit on a page shares one sandbox, created when the first one needs it.

## useSimulation

```tsx
const { state, actions } = useSimulation(HalfAdder, { initialInputs: { a: 1 }, history: 200 })
```

It takes a circuit built on the page, or source text: `useSimulation({ source })`, which compiles in the sandbox. The options say how the simulation starts: `initialInputs` (where the switches sit at power-on; `reset` is the reset line and leaves them where they are), `memory` (contents by node path, loaded before cycle 0) and `history` (entries kept, 0 for none). Changing one starts a new run at cycle 0.

`state` is what the simulation is doing now: `outputs` by name, `cycle`, `isRunning`, `speed`, `ready`, `error`, `compileError`, `history`, and `portValues` for tooling.

`actions` is what you can tell it to do:

| Action | What it does |
|---|---|
| `set({ a: 1, d: 0 })` | Set inputs: input ports by name, Switch and Input nodes by path. All are written before the circuit settles |
| `toggle(name)` | Flip one 1-bit input or switch |
| `tick(n)`, `run(speed)`, `pause()`, `reset()` | The clock |
| `restart()` | Start over from power-on: a new session at cycle 0, inputs back at `initialInputs` |
| `stepBack()`, `stepForward()`, `seek(i)` | History |
| `scan(input, port, count)`, `sample(port, count)` | Bulk reads that save round trips |
| `exportVerilog()`, `recompile()` | Verilog from the same compile; compile source text now |

With a circuit built on the page, the keys of `set` and `toggle` and the names in `state.outputs` are typed from the circuit, so a typo is a compile error. With source text they are strings, checked when the call reaches the sandbox.

To build your own UI, read `state` and call `actions` from your components. See [Building custom UIs](https://simten.dev/docs/building-custom-uis).

## Components

| Component | Props |
|---|---|
| `CircuitCanvas` | `simulation`, and how it looks: `height`, `theme`, `layout`, `focus`, `draggable`, `autoLayout`, `onLoadMemory` |
| `ClockControls` | `simulation`, `showSpeed`, `showScrubber`, `floating`, `chromeless`, `pulseRun` |

Double-clicking a component on the canvas opens its insides as a live view of the same simulation, with breadcrumbs.

## Choosing the sandbox

`SandboxProvider` is optional. The nearest one above a `useSimulation` wins:

- `<SandboxProvider client={client}>` uses that client: `inProcessSandbox()` from `@simten/sandbox/host` in tests, or `new SandboxClient({ origin })` for a sandbox you host yourself.
- `<SandboxProvider>` with no client gives its subtree a sandbox of its own, for a heavy demo that should get its own core.

`useSandboxClient()` returns the client in use, for code that compiles or exports without simulating.

## CSS

Import the stylesheet once:

```tsx
import '@simten/react/styles.css'
```

It carries the theme as CSS variables. Its resets apply only inside the components (under `[data-embed-theme]`), so it doesn't restyle the rest of your page.

## The code editor

`@simten/react/code-editor` gives you Monaco set up for circuit source: typed completions and hovers for the Simten stdlib, and type acquisition so third-party imports (`react`, `zod`) resolve to real types. It knows nothing about simulations; wire it to one with `diagnostics`:

```bash
npm install @simten/react @monaco-editor/react
```

```tsx
import { CodeEditor } from '@simten/react/code-editor'

const sim = useSimulation({ source })
const { compileError } = sim.state

<CodeEditor value={source} onChange={setSource} diagnostics={compileError ? [compileError] : []} />
```

If you already own a Monaco instance (a collaborative editor with a Yjs binding, say), use the headless setup and keep your own `<Editor>`:

```tsx
import { setupSimtenIntellisense, useTypeAcquisition } from '@simten/react/code-editor'

useTypeAcquisition(source, monaco)

<Editor path="file:///circuit.ts" beforeMount={setupSimtenIntellisense} onMount={bindYjs} />
```

The model needs a real `file:///` URI: TypeScript resolves modules by walking up from the file looking for `node_modules`, and Monaco's default `inmemory://` scheme has nothing to walk. `CodeEditor` sets this for you. Without it every import resolves to `any`.

This entry handles types only. Circuit source runs in the sandbox, which resolves imports from esm.sh on its own, so code can run while its types are still downloading. That's why module-not-found diagnostics are suppressed while semantic checks stay on.

Type acquisition fetches from jsDelivr at runtime. Pass `typeAcquisition={{ enabled: false }}` to turn it off, or `{ typescriptCdn }` to self-host. A failure means no completions, not a broken editor.

## Server-side rendering

The components render on the client, and the sandbox is only created in the browser. The layout engine loads with a dynamic `import()`, so it never loads on the server, and with a `layout` prop it doesn't load at all.

## Peer dependencies

- React 19
- `@monaco-editor/react`: optional, needed only by `@simten/react/code-editor`

Monaco is an optional peer, so it is never installed unless you ask for it, and `@simten/react` itself stays free of it. `monaco-editor` follows as a peer of `@monaco-editor/react`, and `@monaco-editor/react` loads Monaco itself from a CDN at runtime.

## Docs

<https://simten.dev/docs>. Source: <https://github.com/simtenHQ/simten>.

## License

Apache-2.0
