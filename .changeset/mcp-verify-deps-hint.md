---
"@simten/mcp": patch
---

fix(verify_circuit): hint at the install command when the testbench fails with a missing-module error

If the tsx subprocess fails and its stderr matches `Cannot find module`, `Cannot find package`, or `ERR_MODULE_NOT_FOUND`, the tool now appends a one-line hint to the existing "Testbench produced no verify result" error: try `pnpm add -D @simten/core fast-check` (or your package manager's equivalent). No detection plumbing, no project-state inspection — just a single conditional on stderr text. Cheap and unobtrusive.
