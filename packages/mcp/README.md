# @simten/mcp

Let an AI assistant build [Simten](https://simten.dev) circuits. It writes them as
TypeScript files in your repo, then checks, simulates, tests and draws them with these
tools.

```
Assistant ──stdio──▸ MCP server ──WebSocket──▸ Browser tab (view only)
```

## Setup

```bash
claude mcp add --scope user simten npx @simten/mcp
```

`--scope user` makes it available in every project. Any MCP client works: the server
speaks stdio. It needs Node.js 20 or later.

Writing, simulating and drawing circuits need nothing else. Running tests needs
`@simten/core`, `fast-check` and `tsx` in the project; the assistant installs them with
`setup_project` the first time.

## What it writes

A circuit is a module that exports its top-level circuit:

```ts
import { bit, circuit } from '@simten/core'
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
```

## Tools

| Tool | |
|------|-------------|
| `get_started` | An overview and bundled examples. Can write an example to `circuits/` |
| `get_grammar` | How to write a circuit, with examples |
| `list_components` | Every standard part, with its ports and options |
| `get_verify_api` | How to write a testbench |
| `check_circuit` | Does it compile? |
| `simulate_circuit` | Run it and return signal traces |
| `show_circuit` | Draw it in a browser tab. The only tool that draws |
| `setup_project` | Install what `verify_circuit` needs. Safe to run again |
| `verify_circuit` | Run a testbench and report pass or fail |

`simulate_circuit` and `show_circuit` take `inputs` (`{ a: 1 }`, by input name or the
path of a Switch or Input node) and `memoryData` (`{ rom: { 0: 17 } }`, loaded before
cycle 0).

Inside a checkout of the Simten repo there's also `run_on_fpga`, which builds and flashes a
project to a ULX3S board.

## The browser tab

`show_circuit` starts a server on `127.0.0.1` and opens the editor in your browser. The tab
only displays what the assistant sends. Editing the file doesn't update it; the assistant
calls `show_circuit` again. The file is the source of truth, and edits in the browser
aren't saved back.

## Trust

`verify_circuit` runs the testbench on your machine with full Node access, like
`npm test`. Use it on circuits you wrote or trust. Open anything else in the
[web editor](https://simten.dev/circuit), which runs it in a sandbox.

## License

Apache-2.0
