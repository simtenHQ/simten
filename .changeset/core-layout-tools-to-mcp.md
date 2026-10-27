---
'@simten/core': minor
'@simten/mcp': patch
---

`@simten/core/internal` no longer exports the MCP tool handlers (`traceSource`, `checkCircuit`, `getPrimitivesHandler`, `exportVCD` and their types); they now live in `@simten/mcp`, the only package that used them.

`simulate_circuit` now loads `memoryData`. Contents are `{ node: { address: value } }`, the node named by its ID or its path inside the circuit, and a name that matches no node is an error. Before this fix the contents were silently dropped, so every memory read 0.
