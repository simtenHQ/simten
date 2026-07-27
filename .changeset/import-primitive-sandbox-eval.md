---
"@simten/core": patch
---

Fix imported designs crashing in the editor when they contain a `case` (one-hot mux), a latch, or a memory. The import-home primitives `Pmux`, `Dlatch`, and `Mem` referenced their shape (`sWidth`, `enPolarity`, `rdPorts`, mask widths) from the factory closure inside `eval`/`onTick`. The editor sandbox rebuilds evals via `new Function(fn.toString())`, which drops closures — so these surfaced at runtime as e.g. "sWidth is not defined" (with no editor squiggle).

Two changes fix it: (1) the evals now read their shape from the eval inputs (`node.arguments` are merged in) and inline their masks; (2) these object-config primitives now bake `_args`, so a source-recompiled `Pmux({ width, sWidth })` node carries its shape in `node.arguments` (the factory form does this automatically; object-config did not) — without it the recompiled node had empty arguments and the reconstructed eval had nothing to read. Regression tests assert `_args` is baked and reconstruct each eval exactly as the sandbox does.
