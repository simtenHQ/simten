---
'@simten/core': patch
---

`simulate(C, { memory })` loads each key into the one memory node at exactly that path, instead of every node whose path contains it or whose type matches it. A key with no memory node throws.
