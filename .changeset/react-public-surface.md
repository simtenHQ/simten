---
'@simten/react': minor
---

The public surface of decision 0010: the library gives you data, input and output, and your app arranges them.

```tsx
import '@simten/react/styles.css'
import { CircuitCanvas, ClockControls, useSimulation } from '@simten/react'

const sim = useSimulation(HalfAdder)
sim.actions.set({ a: 1, b: 1 })
// <CircuitCanvas simulation={sim} />  <ClockControls simulation={sim} />
```

- **`useSimulation(circuitOrSource, { initialInputs, memory, history })` returns `{ state, actions }`.** `state` has `outputs` by name, `portValues`, `cycle`, `isRunning`, `speed`, `ready`, `error`, `compileError` and `history`. `actions` is `set`, `toggle`, `tick`, `run`, `pause`, `reset`, `stepBack`, `stepForward`, `seek`, `scan`, `sample`, `exportVerilog` and `recompile`, with one identity for the life of the hook.
- **One `set` for every input.** It takes input port names and the paths of Switch and Input nodes, writes them all before the circuit settles, and reports an error, writing nothing, for a key that names anything else or both a port and a Switch. `scan` takes the same keys. For a circuit built on the page, the keys of `set` and `toggle` and the names in `state.outputs` are typed from the circuit.
- **Circuits on a page share one sandbox**, created in the browser by the first `useSimulation` that needs it. `SandboxProvider` is optional: with `client` it uses that client (an `inProcessSandbox()` in tests); without one its subtree gets a sandbox of its own. The nearest provider wins.
- **`CircuitCanvas` and `ClockControls` take `simulation`.** The canvas shows its own loading and error states and calls the simulation's actions when you click; drill-down is built in. A circuit with ports is drawn with a switch or number input on each input port and a lamp or display on each output, around the circuit as one box (#531). The simulation runs the circuit itself, so `state.portValues` has its own paths: `__top__.sum` for a port, `ha1.x.out` for a node. `ClockControls` renders nothing for a circuit without a clock. `WaveformViewer` isn't exported in this release; it returns once it can pick which signals to show (#539).
- **Entry points:** `@simten/react`, `@simten/react/code-editor` and `@simten/react/styles.css`.
- Recompiling source text waits 50 ms after the last change; the first compile is immediate.

How to migrate:

| Before | After |
|---|---|
| `import … from '@simten/react/sandbox'`, `'@simten/react/canvas'` | `import … from '@simten/react'` |
| `@simten/react/monaco`, `SimtenCodeEditor`, `SimtenCodeEditorHandle`, `SimtenDiagnostic` | `@simten/react/code-editor`, `CodeEditor`, `CodeEditorHandle`, `CodeEditorDiagnostic` |
| `<CircuitEmbed circuit={C} />` or `<CircuitViewer circuit={C} />` | `const sim = useSimulation(C)`, then `<CircuitCanvas simulation={sim} />` and `<ClockControls simulation={sim} />`; put your own card around them |
| `useSimulation(src)` + `<SimulationView simulation={sim} />` | `<CircuitCanvas simulation={sim} />` + `<ClockControls simulation={sim} />` |
| `<CircuitCanvas circuit={…} definitions={…} portValues={…} onToggleNode={…} … />` | `<CircuitCanvas simulation={sim} />` |
| `<ClockControls cycle={…} onStep={…} … />` | `<ClockControls simulation={sim} showSpeed showScrubber />` |
| `<WaveformViewer vcd={…} />` | not exported for now (#539). The editor no longer replays the MCP's traces |
| `actions.setInput('d', 1)`, `actions.setInputs({ d: 0, en: 0 })` | `actions.set({ d: 1 })`, `actions.set({ d: 0, en: 0 })` |
| `actions.toggleNode('a')` | `actions.toggle('a')` |
| `actions.setSpeed(n)`, `{ speed: n }` | `actions.run(n)` |
| `{ harness: true }` | nothing: the canvas draws a circuit's ports itself |
| `layout={{ dut: … }}` for a circuit with ports | `layout={{ circuit: … }}`: the box shows the circuit's name, not `dut` |
| `portValues.get('sum.in')`, `'a.out'`, `'dut.ha1.x.out'` for a circuit with ports | `portValues.get('__top__.sum')`, `'__top__.a'`, `'ha1.x.out'`, or `state.outputs.sum` |
| `{ debounceMs }` | nothing: 50 ms |
| `result.compileError`, `result.history` | `result.state.compileError`, `result.state.history` |
| `result.client` | `useSandboxClient()` |
| `onPortValuesChange` | read `sim.state` in the same component |
| a `ref` with `setNodeValue`, `startAutoRun` | `sim.actions.set`, `sim.actions.run` |
| `memory: { 'dut.imem': … }` for a circuit with ports | `memory: { imem: … }`, the circuit's own path |
| `@simten/react/styles/theme.css` | `@simten/react/styles.css` |
| `@simten/react/embed`, `/nodes`, `/share`, `/primitives/*` | removed: no longer part of the library |
