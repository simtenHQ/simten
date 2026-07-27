---
"@simten/core": patch
---

Fix imported designs crashing in the editor when they contain a `case` (one-hot mux), a latch, or a memory. The import-home primitives `Pmux`, `Dlatch`, and `Mem` referenced their shape (`sWidth`, `enPolarity`, `rdPorts`, mask widths) from the factory closure inside `eval`/`onTick`. The editor sandbox rebuilds evals via `new Function(fn.toString())`, which drops closures — so these surfaced at runtime as e.g. "sWidth is not defined" (with no editor squiggle). The evals now read their shape from the eval inputs (`node.arguments` are merged in), falling back to the factory value for direct use, and inline their masks. A regression test reconstructs each eval exactly as the sandbox does and asserts it still computes correctly.
