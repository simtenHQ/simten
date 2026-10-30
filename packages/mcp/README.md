# @simten/mcp

MCP server for [Simten](https://simten.dev). Your assistant writes circuits as TypeScript files and calls these tools to check, simulate, verify and draw them. The design lives in your repo, not in a chat log.

```
Assistant ──stdio──▸ MCP server ──WebSocket──▸ Browser canvas (view only)
```

## Setup

Register the server with Claude Code:

```bash
claude mcp add --scope user simten npx @simten/mcp
```

`--scope user` makes simten available in every project; drop the flag for a project-local install. Check it with `claude mcp list`. Any MCP client works the same way: the server speaks stdio.

Designing and simulating need nothing else. `verify_circuit` runs the testbench on the host with `tsx`, so the project needs `@simten/core`, `fast-check` and `tsx` installed. The assistant calls `setup_project` on first use to write a `package.json` and install them (it's safe to run again). Projects that already have those dependencies work as they are.

`check_circuit` and `simulate_circuit` load circuit files with the MCP's own copy of `@simten/core`, while `verify_circuit` uses the copy installed in the project, so a project that pins a different core version can see the tools disagree.

If you prefer a global install to `npx`: `npm install -g @simten/mcp`, then `claude mcp add --scope user simten simten-mcp`.

The server needs Node.js 20 or later. It serves MCP protocol revision 2026-07-28 to clients that ask for it and the 2025 revisions to everything else.

## Tools

| Tool | What it does |
|------|-------------|
| `get_started` | Orientation and the bundled examples. With `example`, writes one to `circuits/<id>.circuit.ts`. No setup needed |
| `get_grammar` | The `circuit()` API (inputs, outputs, nodes, connect) with worked examples |
| `list_components` | Every standard component with its ports and constructor options |
| `get_verify_api` | How to write a `.verify.ts` testbench: `simulate(top, { memory })`, `set`, `tick`, oracles |
| `check_circuit` | Compile a circuit and report whether it builds |
| `simulate_circuit` | Compile and simulate, return signal traces. Shows what a circuit does, not that it's correct. Never touches the canvas |
| `show_circuit` | Paint the circuit on the browser canvas, the only tool that draws. No circuit counts the open tabs; `close: true` closes the preview |
| `setup_project` | Make a folder ready for `verify_circuit`: an ESM `package.json`, a tsconfig, and the dependencies installed |
| `verify_circuit` | Run a self-checking testbench file on the host with `tsx`, and report pass or fail at a declared oracle tier |

`simulate_circuit` and `show_circuit` start a run the same way:

- `inputs`: `{ key: number }`. A key is an input port name or the path of a Switch or `Input` node (`"d"`, `"cpu.kbd"`), as `simulate(top).set()` takes it. Keys resolve exactly; a key that names anything else, or both a port and a Switch, is an error.
- `memoryData`: `{ nodePath: { address: value } }`, loaded before cycle 0 as `simulate(top, { memory })` does. A path that names no node is an error.

Inside a checkout of the Simten repo the server also registers `run_on_fpga`, which builds, flashes and captures a project on a ULX3S board, and `read_waveform`, which queries an iverilog VCD over a cycle window. Both work on files under `hardware/ulx3s`, so the server leaves them out anywhere else. It counts as inside the repo when the working directory, or a folder above it, holds `hardware/ulx3s/run_on_fpga.ts` and a `package.json` named `simten`. `SIMTEN_REPO_ROOT` points it at a checkout explicitly.

## Writing circuits

A circuit is a standalone module that imports the builder from `@simten/core` and exports its top-level circuit, so a testbench can import it:

```ts
import { bit, circuit } from '@simten/core';
import { And, Xor } from '@simten/core/std';

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
});
```

Files written for earlier releases import the builder from `@simten/core/circuit`. `check_circuit` and `simulate_circuit` still load them; `verify_circuit` runs plain `tsx`, so change that import to `@simten/core`.

## The canvas

`show_circuit` starts a local server on `127.0.0.1` (port 19847, or a free port if that one is taken), serves a bundled copy of the editor from it, and opens it in your browser with a one-time token in the URL fragment. The page and its WebSocket share one localhost origin, so there's no Local Network Access prompt.

The canvas is a viewer. The server pushes the circuit, with the inputs and memory its run starts from, and the page sends back only whether it rendered. Editing the `.circuit.ts` file does not update the browser: the assistant calls `show_circuit` again to repaint. The file is the source of truth; edits made in the browser editor are local experiments and aren't written back.

## Trust model

`verify_circuit` runs the testbench on the host with `tsx`: full Node and npm, no sandbox, the same trust as running `npm test`. Sandboxing one tool while the assistant can already run your build, your tests and any shell command wouldn't protect anything. Use it on circuits you wrote or trust.

Open unfamiliar or shared circuits in the web `/circuit` editor, which runs them in a sandboxed worker, not locally.

## License

Apache-2.0
