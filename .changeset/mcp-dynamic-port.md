---
"@simten/mcp": patch
---

Studio server now falls back to an OS-assigned free port when the preferred port (19847) is already in use, instead of failing with "port already in use". This lets a second project's MCP instance start its preview. The real port is advertised to the browser via the existing URL fragment, so any port works end-to-end.
