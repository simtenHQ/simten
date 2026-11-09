---
'@simten/core': patch
---

`onTick` reads its inputs as `eval` does: an unconnected input is 0 instead of undefined, and a top-level input arrives masked to its width.
