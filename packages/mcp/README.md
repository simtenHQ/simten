# @simten/mcp

MCP server for [Simten](https://simten.dev) — a live circuit simulator you talk to.

The only MCP server with real-time browser push. Your LLM calls a tool, the user sees it happen live in a visual editor. No polling, no refresh.

## What makes this different

Most MCP servers are request-response: tool in, result out. This one maintains a persistent WebSocket session to the browser, so tool calls produce **live visual updates** — circuits appear, waveforms animate, test results highlight — all in real time.

```
Claude Code ──stdio──▸ MCP Server ──WebSocket──▸ Browser
                              ◂── channel notifications ──
```

The browser can also talk back. Channel notifications let the visual editor send messages to the LLM — error reports, user questions, circuit context — creating a bidirectional loop between AI and interactive UI.

## Setup

Register the server with Claude Code:

```bash
claude mcp add --scope user simten npx @simten/mcp
```

That's it. `--scope user` makes simten available across every project; drop the flag for a project-local install. Verify with `claude mcp list`.

`verify_circuit`'s testbench runs in your project's `node_modules` context, so the project needs `@simten/core` and `fast-check` installed (the tool tells you the exact command if you forget).

(If you prefer global installs over `npx`: `npm install -g @simten/mcp`, then `claude mcp add --scope user simten simten-mcp`.)

### Port

The server listens on `127.0.0.1:19847` for the browser WebSocket bridge. The port is currently hardcoded — running two MCP instances simultaneously will fail the second one on `EADDRINUSE`. Tracked as a follow-up; for now, only run one instance at a time.

## Tools

| Tool | Description |
|------|-------------|
| `check_circuit` | Validate circuit well-formedness (syntax, semantic, type, structural) |
| `simulate_circuit` | Compile and simulate, return signal traces (observation only; does not establish correctness) |
| `verify_circuit` | Run a self-checking testbench *file* (`.verify.ts`) on the host via `tsx`; reports pass/fail + counterexample at a declared oracle tier |
| `read_waveform` | Query VCD waveform files (iverilog cross-validation, ILA captures) over a cycle window |
| `run_on_fpga` | Build, flash, and UART-capture a project on a connected ULX3S FPGA |
| `show_circuit` | Paint/update the live canvas (no args = list tabs; `close: true` = close). The only tool that draws |
| `get_circuit_state` | Inspect the live tab the user is watching (current port values) |
| `push_chat_response` | Send a reply to the in-app chat panel |

## Trust model

`verify_circuit` runs the testbench on the host via `tsx` — full Node + npm resolution, **no sandbox**, under the same trust model as the agent running `npm test`. This is intentional: sandboxing one tool while the coding agent freely runs your build, tests, and arbitrary Bash is incoherent. It's appropriate for circuits you authored or trust.

**Unfamiliar or shared circuits should be opened in the web `/circuit` editor**, which runs them in a sandboxed worker (esm.sh, isolated) built for untrusted browser-user code — not run locally via `tsx`.

## How it works

1. `show_circuit` starts a WebSocket server on `localhost:19847` and opens the browser
2. The browser connects with a one-time auth token (passed via URL fragment, never sent to server)
3. Tool calls like `simulate_circuit` and `show_traces` push results to the browser via WebSocket
4. `get_circuit_state` pulls live state from the browser (request-response over WebSocket)
5. Channel notifications enable browser-to-LLM communication for interactive tutoring

Multiple browser tabs can connect simultaneously. State is cached for late-joining clients.

**`show_circuit` is the sole canvas trigger.** Editing the `.circuit.ts` does *not* auto-update the browser — re-call `show_circuit` to repaint. The web editor mirrors the file as a **sandbox view**: the file you (or Claude) edit is the source of truth; edits made directly in the browser editor are local experiments, not written back to the file.

## Example session

```
You: show me a half adder

Claude: [writes circuit file, calls show_circuit]
        → Browser opens, circuit appears live

Claude: [calls simulate_circuit, then show_traces]
        → Waveforms animate in the browser

You: the XOR gate output looks wrong

Claude: [calls get_circuit_state to read live values]
        → Diagnoses the issue from actual port values
```

## Requirements

- Node.js 20+
- A browser (for the visual editor)
- An MCP-compatible client (Claude Code, etc.)

## License

Apache-2.0
