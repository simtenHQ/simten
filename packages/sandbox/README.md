# @simten/sandbox

Run [Simten](https://simten.dev) circuits from a web page without running their code on the page. Circuit source compiles and simulates in a worker inside a hidden cross-origin iframe; the page sends requests and gets state back. No React.

```bash
npm install @simten/sandbox @simten/core
```

```ts
import { SandboxClient } from '@simten/sandbox';

const sandbox = new SandboxClient();
const compiled = await sandbox.compile(source);
const sim = await sandbox.open({ compiled, circuit: 'Counter' }, { history: 200 });

await sim.set({ en: 1 });
await sim.tick(10);
sim.get('count'); // 10

sim.subscribe(() => render(sim.getState()));
await sim.run(1000); // 1000 cycles a second, in the worker
```

`SimulationClient` has the same methods as core's `Simulation` (`set`, `get`, `tick`, `reset`, `stepBack`, `stepForward`, `seek`), returning promises, plus:

| Method | What it does |
|---|---|
| `setInput(path, value)` | Set a Switch or Input node inside the circuit. Anything else is rejected. |
| `setInputs(values)` | Set several of those nodes, by path, before the circuit settles. If one path is rejected, none are set. |
| `run(speed)`, `pause()` | Auto-run in the worker, which pushes about 30 updates a second. |
| `sample(port, count)` | Tick `count` times and return a port's value after each tick. |
| `scan(path, port, count)` | Drive an input through `0..count-1` and read a port each time, without ticking. |
| `close()` | Free the session in the sandbox. |

Memory contents (a program for a CPU) are part of opening a session: `open(source, { memory: { imem: contents } })`. To load a different program, open a new session.

`SandboxClient.export(compiled, circuit)` returns Verilog for a circuit, exported with the compile's own behavior, the same as `exportVerilog` in Node.

Failed calls reject with a `SandboxError` whose `code` says why: `failed`, `timed-out` (user code hung and the sandbox restarted), `restarted`, `unavailable` or `closed`. After a restart each session comes back at cycle 0 with `status: 'restarted'` and a `notice`.

The sandbox defaults to `https://sandbox.simtenusercontent.dev`. Pass `{ origin }` to use another.

## License

Apache-2.0
