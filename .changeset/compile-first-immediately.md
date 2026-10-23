---
'@simten/embed': patch
---

`useCircuitCompiler` compiles the first source immediately instead of after `debounceMs`. Later edits are still debounced.
