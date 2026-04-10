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

Add to your Claude Code MCP config (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "simten": {
      "command": "npx",
      "args": ["@simten/mcp"]
    }
  }
}
```

Or install globally:

```bash
npm install -g @simten/mcp
```

## Tools

| Tool | Description |
|------|-------------|
| `show_circuit` | Push circuit file to browser, open live visual editor |
| `hide_circuit` | Close preview, stop WebSocket server |
| `simulate_circuit` | Compile and simulate, return signal traces |
| `check_circuit` | Validate circuit (semantic, type, structural) |
| `run_testbench` | Run testbench assertions against circuit |
| `get_circuit_state` | Pull current port values from browser (live read) |
| `get_primitives` | List available primitive components |
| `get_grammar` | Return component reference and builder API |
| `show_traces` | Push simulation waveforms to browser |
| `show_test_results` | Push test results to browser |
| `list_sessions` | List connected browser tabs |
| `push_chat_response` | Send message to in-app chat panel |

## How it works

1. `show_circuit` starts a WebSocket server on `localhost:19847` and opens the browser
2. The browser connects with a one-time auth token (passed via URL fragment, never sent to server)
3. Tool calls like `simulate_circuit` and `show_traces` push results to the browser via WebSocket
4. `get_circuit_state` pulls live state from the browser (request-response over WebSocket)
5. Channel notifications enable browser-to-LLM communication for interactive tutoring

Multiple browser tabs can connect simultaneously. State is cached for late-joining clients.

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

Business Source License 1.1 — free to use, cannot be offered as a competing commercial service. Converts to Apache 2.0 after 4 years.
