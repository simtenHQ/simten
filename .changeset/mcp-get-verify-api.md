---
"@simten/mcp": minor
---

Add a `get_verify_api` tool and move the testbench-writing reference out of `verify_circuit`'s description.

Clients cap each MCP tool description at 2 KB ([Claude Code does](https://code.claude.com/docs/en/mcp.md)) — the same per-field cap that truncated the server instructions. `verify_circuit`'s description was ~2.5 KB, so the `simulate()` testbench API at the end (`s.set` / `s.tick` / `s.get` / `s.dispose`) was cut off mid-example. Agents couldn't see how to write a `.verify.ts` and fell back to digging through library source.

- New `get_verify_api` tool returns the full testbench reference: the `simulate()` stepper API, `verify.exhaustive` vs `verify.check`, `declareOracle`, and the Tier-A npm-oracle pattern.
- `verify_circuit`'s description is slimmed to ~1.6 KB (the oracle tiers + a pointer to `get_verify_api`), back under the cap. All tool descriptions are now under 2 KB.
