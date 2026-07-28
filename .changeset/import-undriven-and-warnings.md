---
"@simten/core": minor
---

The Verilog importer now tolerates undriven nets instead of aborting. An unassigned or misspelled signal (yosys keeps it as a floating wire) previously threw `net N has no driver` and failed the whole import. It's now tied to 0 — simten's 2-state analog of how yosys/iverilog tolerate a floating wire — so the design still imports and the user sees the (broken) result.

`ImportResult` gains a `warnings: string[]` field carrying these non-fatal notes (e.g. "an undriven net was tied to 0"), deduped per module. Callers (like the web import route) can surface them alongside yosys's own warnings.
