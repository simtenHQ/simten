---
"@simten/mcp": patch
---

fix(verify_circuit): detect missing project deps before spawning tsx; return actionable install command

Previously, if a user invoked `verify_circuit` from a project that didn't have `@simten/core` and `fast-check` installed, the testbench's tsx subprocess would crash with a cryptic `ERR_MODULE_NOT_FOUND` deep in Node's loader. The MCP bundles those deps for its own use, but Node's resolver only walks up from the testbench file — it never reaches the MCP's install location. Cold-test feedback observed an agent walk into this exact wall and have to recover by trial.

Three changes:

- **Pre-flight check.** `verify_circuit` now calls `checkDepsResolvable()` against the testbench's directory before spawning tsx. If `@simten/core` or `fast-check` aren't reachable, the tool returns a structured error with the exact install command, the auto-detected package manager (pnpm / yarn / bun / npm based on the nearest lockfile), and the project directory that needs the install. Agents can install and re-try in one round-trip.
- **MCP instructions updated.** The session-level instructions string now mentions the first-time project-setup requirement so agents anticipate it instead of discovering it at verify-time.
- **README updated.** Setup section has a "Project setup for `verify_circuit`" subsection explaining the one-time install — and notes that the tool will tell the agent the command if they forget.
