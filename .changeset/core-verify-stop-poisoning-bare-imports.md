---
"@simten/core": patch
---

fix(verify): stop poisoning stdout on bare imports of `@simten/core/verify`

`@simten/core/verify` previously armed a `process.on('beforeExit')` safety net at module load — it was meant to catch testbenches that forgot to call `verify.run()`, but it fired for **any** importer that didn't engage the harness, even when they only wanted `declareOracle`, types, or constants. The side effect was a JSON contract-error blob on stdout and `process.exitCode = 1`.

Two consequences:
- Any script that imported the module for helpers/types got junk on stdout + a non-zero exit, breaking CI steps that parse stdout.
- The MCP server speaks JSON-RPC over stdout — any unsolicited JSON corrupts the protocol stream, and a forced exit-1 would kill the server. This is the source of the stray JSON observed in earlier cold-test rounds of `mcp initialize` responses.

Fix: arm the `beforeExit` hook lazily on first call to `declareOracle()`, `verify.check()`, or `verify.exhaustive()` — i.e. only when the harness is genuinely engaged. Real testbenches still get the "forgot `verify.run()`" safety net (they always call `declareOracle` first); bare-import consumers exit cleanly with no stdout pollution.

Verified empirically: bare `import '@simten/core/verify'` now produces zero stdout and exits 0. The existing 6 verify tests (including the explicit "forgot `verify.run()` → contract error" test) all still pass.
