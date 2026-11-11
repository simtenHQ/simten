---
'@simten/core': patch
---

Verilog export: an output nothing reads gets its own declared net. Before, every such output shared one undeclared `__unused_<port>` net, so two RAMs with an unused B port drove the same implicit 1-bit wire.
