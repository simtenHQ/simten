---
'@simten/core': patch
---

A combinational loop that no input, source or register reaches is now evaluated, so one that never settles reports the loop error instead of reading 0.
