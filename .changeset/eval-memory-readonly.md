---
'@simten/core': patch
---

Memory state is read-only in `eval`: a write throws and says memory writes belong in `onTick`, instead of changing memory with no clock edge.
