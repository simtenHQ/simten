# @simten/sandbox

Run [Simten](https://simten.dev) circuits from any web page, without React. The circuit's
code compiles and runs in a worker inside a hidden iframe on another domain, so it can't
touch your page. The page sends requests and gets the state back.

Using React? [`@simten/react`](https://www.npmjs.com/package/@simten/react) wraps this for
you.

## Install

```bash
npm install @simten/sandbox @simten/core
```

## Run a circuit

```ts
import { SandboxClient } from '@simten/sandbox'
import { HalfAdder } from './half-adder'

const sandbox = new SandboxClient()
const sim = await sandbox.open({ circuit: HalfAdder })

await sim.set({ a: 1, b: 1 })
sim.get('sum')   // 0
sim.get('carry') // 1
```

`open` takes a circuit built on the page, as here, or a compiled source string:

```ts
const compiled = await sandbox.compile(source)
const sim = await sandbox.open({ compiled, circuit: 'Counter' }, { history: 200 })
```

The second argument sets how it starts: `initialInputs`, `memory` (contents by node path,
loaded before cycle 0) and `history`.

## The simulation

`get` reads the latest state the page has, so it returns a number straight away. Every
other method sends a request and returns a promise.

| Method | |
|---|---|
| `set({ a: 1 })`, `toggle('a')` | Set inputs, or flip a 1-bit one. If any key is wrong, nothing is written |
| `tick(n)`, `reset()` | The clock. `reset` leaves inputs where they are |
| `run(speed)`, `pause()` | Run in the worker, which sends about 30 updates a second |
| `restart()` | Back to how the session started |
| `stepBack()`, `stepForward()`, `seek(i)` | History |
| `sample(port, count)` | Tick `count` times and return a port's value after each |
| `scan(input, port, count)` | Drive an input through `0` to `count - 1` and read a port each time |
| `close()` | Free the session |

To redraw when anything changes: `sim.subscribe(() => render(sim.getState()))`.

`sandbox.export(compiled, circuit)` returns Verilog.

## Errors

A failed call rejects with a `SandboxError`. Its `code` is `failed`, `timed-out` (the
circuit's code hung, so the sandbox restarted), `restarted`, `unavailable` or `closed`.
After a restart, each session comes back at cycle 0.

## Tests

`inProcessSandbox()` from `@simten/sandbox/host` is a `SandboxClient` that runs circuits in
the same process. Use it only for circuits you trust.

## Hosting your own

The sandbox is `https://sandbox.simtenusercontent.dev` by default. Pass
`new SandboxClient({ origin })` to use another.

## License

Apache-2.0
