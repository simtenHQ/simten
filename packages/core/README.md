# @simten/core

Write digital circuits in TypeScript and simulate them in any JavaScript runtime: Node,
the browser, or your test runner. Export them to Verilog.

To show circuits in a React app, see [`@simten/react`](https://www.npmjs.com/package/@simten/react).
To build them with an AI assistant, see [`@simten/mcp`](https://www.npmjs.com/package/@simten/mcp).

## Install

```bash
npm install @simten/core
```

## Write a circuit and run it

```ts
import { bit, circuit, simulate } from '@simten/core'
import { And, Xor } from '@simten/core/std'

export const HalfAdder = circuit('HalfAdder', {
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

const sim = simulate(HalfAdder)
sim.set({ a: 1, b: 1 })
sim.read() // { sum: 0, carry: 1 }
```

`@simten/core` is ESM only. Save the file as `.mts`, or set `"type": "module"` in
`package.json`, and run it with `npx tsx half-adder.mts`.

## The simulation

| | |
|---|---|
| `set({ a: 1 })` | Set inputs. Every value is written before the circuit settles |
| `get('sum')`, `read()` | Read one value, or every output |
| `tick(n)` | Advance n clock cycles. Only circuits with registers or memory need it |
| `reset()` | The reset line: back to cycle 0, inputs stay where they are |
| `stepBack()`, `stepForward()`, `seek(i)` | Move through history, with `simulate(top, { history: 100 })` |

`set` also takes the paths of Switch and Input nodes inside the circuit, such as
`{ 'cpu.kbd': 65 }`. `simulate(top, { memory: { rom: { 0: 0x11 } } })` loads memory by
node path before cycle 0, and `reset()` keeps it.

## Imports

| Import | What's in it |
|---|---|
| `@simten/core` | `circuit`, `bit`, `bus`, `simulate` |
| `@simten/core/std` | The standard parts: gates, adders, registers, RAM, ROM, an ALU and more |
| `@simten/core/verify` | Testbench helpers: `declareOracle`, `verify.check`, `verify.run` |
| `@simten/core/verilog` | `exportVerilog` |
| `@simten/core/examples` | Complete example circuits |
| `@simten/core/internal` | Used by Simten's own packages. May change in any release |

## Docs

[simten.dev/docs](https://simten.dev/docs)

## License

Apache-2.0
