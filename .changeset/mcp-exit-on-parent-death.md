---
"@simten/mcp": patch
---

The MCP server now exits when its parent (Claude Code) goes away, instead of orphaning. Because the studio WS server is started eagerly, its listening socket kept the event loop alive, so the process never terminated on its own when stdin closed — leaking instances that outlived their session and held the studio port (causing dozens of stale servers to pile up). Shutdown is now wired to stdin EOF/close, the MCP transport closing, and SIGTERM/SIGINT, each closing the studio server and exiting. Plain `kill` (SIGTERM) now terminates the server without needing `-9`.
