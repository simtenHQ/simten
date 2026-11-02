# @simten/react

Show [Simten](https://simten.dev) circuits in a React app. `useSimulation` runs a circuit,
and `CircuitCanvas` draws it so visitors can click its inputs. The circuit's code runs
in Simten's sandbox, never on your page.

Replaces `@simten/ui` and `@simten/embed`.

## Install

```bash
npm install @simten/react @simten/core react react-dom
```

## Show a circuit

```tsx
import '@simten/react/styles.css'
import { CircuitCanvas, useSimulation } from '@simten/react'
import { bit, circuit } from '@simten/core'
import { And, Xor } from '@simten/core/std'

const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { xor: Xor, and: And },
  connect: ({ inputs, outputs, nodes: { xor, and } }) => [
    inputs.a.to(xor.a, and.a),
    inputs.b.to(xor.b, and.b),
    xor.out.to(outputs.sum),
    and.out.to(outputs.carry),
  ],
})

export function Demo() {
  const sim = useSimulation(HalfAdder)
  return <CircuitCanvas simulation={sim} height={300} />
}
```

The canvas draws a switch on each input and a light on each output, and shows its own
loading and error states. Double-click a part to see inside it.

For a circuit with a clock, add `<ClockControls simulation={sim} />` for play, pause, step
and speed. It draws nothing for a circuit without one.

## useSimulation

```tsx
const { state, actions } = useSimulation(HalfAdder, { initialInputs: { a: 1 }, history: 200 })
```

Pass a circuit, or source text with `useSimulation({ source })`.

Options set how the simulation starts. Changing one starts it again from cycle 0.

| Option | |
|---|---|
| `initialInputs` | Where the inputs start |
| `memory` | Memory contents by node path, loaded before cycle 0 |
| `history` | How many steps to keep for stepping back. 0 for none |

`state` has `outputs`, `cycle`, `isRunning`, `speed`, `ready`, `error`, `compileError` and
`history`.

`actions`:

| Action | |
|---|---|
| `set({ a: 1 })`, `toggle('a')` | Set inputs, or flip a 1-bit one |
| `tick(n)`, `run(speed)`, `pause()`, `reset()` | The clock. `reset` leaves inputs where they are |
| `restart()` | Back to how it started: cycle 0, inputs at `initialInputs` |
| `stepBack()`, `stepForward()`, `seek(i)` | History |
| `exportVerilog()` | Verilog for the circuit |
| `scan(input, port, count)`, `sample(port, count)` | Many reads in one round trip |
| `recompile()` | Compile source text again now |

With a circuit, input and output names are typed, so a typo doesn't compile. With source
text they are checked when the call runs.

To build your own controls, read `state` and call `actions`. See
[Building custom UIs](https://simten.dev/docs/building-custom-uis).

## Components

| Component | Props |
|---|---|
| `CircuitCanvas` | `simulation`, `height`, `theme`, `layout`, `focus`, `draggable`, `autoLayout`, `onLoadMemory` |
| `ClockControls` | `simulation`, `showSpeed`, `showScrubber`, `floating`, `chromeless`, `pulseRun` |

The stylesheet only styles Simten's components, not the rest of your page.

## The sandbox

Every circuit on a page shares one sandbox, created when the first one needs it. To change
that, wrap part of the tree in `SandboxProvider`:

- `<SandboxProvider client={inProcessSandbox()}>` runs circuits in the same process, for
  tests. `inProcessSandbox` comes from `@simten/sandbox/host`.
- `<SandboxProvider client={new SandboxClient({ origin })}>` uses a sandbox you host.
- `<SandboxProvider>` with no client gives that part of the page its own sandbox.

`useSandboxClient()` returns the sandbox in use, for compiling or exporting without a
simulation.

## Code editor

`@simten/react/code-editor` is Monaco set up for circuit code, with completions for the
standard parts and types for packages you import. It needs `@monaco-editor/react`.

```tsx
import { CodeEditor } from '@simten/react/code-editor'

const sim = useSimulation({ source })
const { compileError } = sim.state

<CodeEditor value={source} onChange={setSource} diagnostics={compileError ? [compileError] : []} />
```

Already have your own Monaco editor? Use `setupSimtenIntellisense` as its `beforeMount`,
call `useTypeAcquisition(source, monaco)`, and give the model a `file:///` path so imports
resolve. Types for imported packages are fetched from jsDelivr; pass
`typeAcquisition={{ enabled: false }}` to turn that off.

## Requirements

React 19. The components render on the client; server rendering is fine, and the sandbox
is only created in the browser.

## Docs

[simten.dev/docs](https://simten.dev/docs)

## License

Apache-2.0
