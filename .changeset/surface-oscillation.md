---
'@simten/core': patch
---

`Simulation.get`, `read` and `tick` on a combinational circuit now throw when a loop oscillates, instead of reading whatever value it stopped on.
