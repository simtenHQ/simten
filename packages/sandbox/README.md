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
| `run(speed)`, `pause()` | Auto-run in the worker, which pushes about 30 updates a second. |
| `restart()` | The power cycle: back to the state the session opened in, with the inputs and memory it opened with. `reset` is the reset line and leaves the inputs where they are. |
| `sample(port, count)` | Tick `count` times and return a port's value after each tick. |
| `scan(input, port, count)` | Drive an input through `0..count-1` and read a port each time, without ticking. |
| `close()` | Free the session in the sandbox. |

`set` takes input port names and the paths of Switch and Input nodes (`{ d: 0, en: 0 }`), and writes them all before the circuit settles. A key that names anything else, or both a port and a Switch, rejects, and nothing is written. `scan` takes the same keys.

For tests, `inProcessSandbox()` from `@simten/sandbox/host` is a `SandboxClient` whose sandbox runs in the same process. It runs circuit code in that process, so use it for circuits you trust.

Memory contents (a program for a CPU) are part of opening a session: `open(source, { memory: { imem: contents } })`. To load a different program, open a new session.

`SandboxClient.export(compiled, circuit)` returns Verilog for a circuit, exported with the compile's own behavior, the same as `exportVerilog` in Node.

Failed calls reject with a `SandboxError` whose `code` says why: `failed`, `timed-out` (user code hung and the sandbox restarted), `restarted`, `unavailable` or `closed`. After a restart each session comes back at cycle 0 with `status: 'restarted'` and a `notice`.

The sandbox defaults to `https://sandbox.simtenusercontent.dev`. Pass `{ origin }` to use another.

## License

Apache-2.0
