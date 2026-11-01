---
'@simten/core': minor
---

`circuit()` rejects a top-level port and a Switch or Input node with the same name, such as output `y` and node `y: Switch`. `get` and `set` take both kinds of name, so the key would mean two things. Before, the circuit built and the error only showed up at the first `get` or `set` of that name; now it is a validation error naming the port and the node and suggesting a rename. Other nodes named like a port (a Nand called `y`) are still allowed, since `get` and `set` never take their names.
