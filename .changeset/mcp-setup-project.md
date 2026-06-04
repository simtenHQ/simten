---
"@simten/mcp": minor
---

Add `setup_project` so a new/empty folder is one call away from running `verify_circuit`. Designing and simulating already need no setup; verify runs the testbench on the host via `tsx` and resolves `@simten/core` + `fast-check` from the project, so an empty folder previously failed with a cryptic module-not-found that led to a manual `npm init` / `type: module` dance. `setup_project` does it proactively: writes an ESM `package.json` (never clobbering an explicit CommonJS one — falls back to `.mts` there), a NodeNext `tsconfig` for editor IntelliSense, a `circuits/` dir, and installs the deps with the detected package manager. `verify_circuit` now preflights and returns a `setup_required` signal pointing at it instead of failing obscurely.
