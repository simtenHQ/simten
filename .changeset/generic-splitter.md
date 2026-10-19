---
"@simten/core": minor
---

Add `Splitter({ width })` and `Combiner({ width })`, which split a bus of any width into `bit0`…`bitN-1` and join bits back into a bus.

Breaking: the old `Splitter`, which split a byte into two 4-bit halves, is now `NibbleSplitter`. Its ports are unchanged. `Splitter8to8` and `Combiner8to8` still work and match `Splitter({ width: 8 })` and `Combiner({ width: 8 })`.
