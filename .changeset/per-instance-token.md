---
"@simten/mcp": patch
---

Use a per-process studio auth token instead of a persistent global one (`~/.simten/token`). Combined with the port, the token now uniquely identifies a single MCP instance, both delivered to the browser via show_circuit's URL fragment. A tab that reconnects to a different instance — a stale cached port now held by another project's MCP, or this instance after a restart — is cleanly rejected (close code 4001) instead of silently attaching to the wrong server. Trade-off: a browser tab no longer survives an MCP restart automatically; the next show_circuit re-establishes it.
