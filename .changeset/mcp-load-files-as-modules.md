---
"@simten/mcp": patch
---

check_circuit and simulate_circuit now load a circuit file as a real module, the same way verify_circuit loads a testbench, so a file that imports a sub-circuit or a helper from a sibling file works in all three tools. Before, those two tools stripped the imports and failed with errors like "HalfAdder is not defined". A file still needs no project setup for these tools, and an error in it now comes back with its file, line and column. Source text passed as `source`, and a file with no imports at all, still run in-process as before.
