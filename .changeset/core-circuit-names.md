---
'@simten/core': minor
---

Add `circuitNameSites` and `firstCircuitName` to `@simten/core/circuit`, for finding `circuit('Name', …)` declarations in source text.

Both sit alongside `stripTypes`/`stripImports`/`stripExports` — text utilities that run before, or instead of, executing circuit source. Two callers had grown near-identical regexes for this: share links in the web app, which title a page from the circuit it contains, and the challenge game, which warns when the circuit you have written is not the one a level grades.

`circuitNameSites` returns every declaration with 1-based line and column bounding the name, so an editor can place a marker on it. `firstCircuitName` is the common "just give me a label" case.

Best-effort by contract: it is a regex, so it is brittle on template literals, escaped quotes and names split across lines. Callers must have a fallback for the misses. Use `executeCircuitCode` when the answer has to be right.
