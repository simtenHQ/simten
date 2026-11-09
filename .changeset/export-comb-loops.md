---
'@simten/core': patch
---

Verilog export throws on a combinational loop, naming the nodes on it; `checkSynthesizable` reports it. The simulator still settles loops.
