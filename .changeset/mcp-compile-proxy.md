---
"@simten/mcp": minor
---

The preview server now proxies `POST /api/compile` to the deployed compiler endpoint (override with `SIMTEN_COMPILE_URL`), so the IMEM node's Compile & Load button works on the MCP canvas with no local services running.
