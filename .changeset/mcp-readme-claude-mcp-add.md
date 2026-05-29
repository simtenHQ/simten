---
"@simten/mcp": patch
---

docs(readme): use `claude mcp add` for setup, document the hardcoded WS port

Replaced the incorrect setup snippet that told users to paste JSON into `~/.claude/settings.json` (which Claude Code ignores for MCP registration). The right entry point is the `claude mcp add` CLI, which writes to the correct config file automatically. Also added a brief note about the WebSocket bridge port (`127.0.0.1:19847`) being hardcoded — running two MCP instances simultaneously fails the second on `EADDRINUSE`. A configurable port + retry-on-bind is tracked as a follow-up.
