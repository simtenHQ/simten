---
'@simten/core': patch
---

A circuit validation error about a connection points at the line of its `.to(...)` call, not at `circuit(...)`, both in its stack and as `(line:column)` on errors from `executeCircuitCode`.
