---
'@simten/core': patch
'@simten/mcp': patch
---

`CircuitDefinitions` (from `@simten/core/internal`) is just `resolveCircuit` now: `getAllPrimitiveNames` is gone. Its one reader, the MCP's `list_components`, builds its list from the new `getStdCircuits()` instead, with the same output.
