---
"@simten/mcp": minor
---

Add `get_grammar` and `list_components` tools; shrink server instructions under the client truncation cap.

Clients cap an MCP server's `instructions` field — [Claude Code truncates it at 2 KB](https://code.claude.com/docs/en/mcp.md). The server's instructions were ~15 KB, so everything after the first ~2 KB — the entire component catalog, the verify/oracle contract, and the canvas policy — was silently dropped before the model ever saw it. That left agents guessing component names (and falling back to looking in `node_modules`) and skipping the verify workflow.

The instructions are now ~1.9 KB, front-loading the verify contract and a pointer to two new on-demand tools:

- `get_grammar` — the `circuit()` builder API (inputs/outputs, nodes, connect) with worked examples.
- `list_components` — the full stdlib component catalog, each with its ports and constructor options.

Tool *results* aren't capped, so the full reference is reliably available on demand even though it can't fit in the instructions. This both fixes the discovery gap and lets the verify contract survive truncation.
