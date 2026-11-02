---
'@simten/mcp': patch
---

`show_circuit` draws a circuit file that imports other local files, such as a top file using `HalfAdder` from `./half-adder.circuit`. The MCP bundles the file and its local imports into one source before sending it to the browser, whose sandbox has no file system; package imports are left for the sandbox as before. Its result now names the circuit the canvas draws (the last one built), not the first in the source.
