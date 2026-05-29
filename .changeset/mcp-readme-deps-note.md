---
"@simten/mcp": patch
---

docs(readme): note the verify_circuit project-deps requirement in the Setup section

One sentence in the Setup section explaining that `verify_circuit`'s testbench runs in the consumer project's `node_modules` context, so `@simten/core` and `fast-check` need to be installed there. Pairs with the in-tool hint (from a separate patch) that surfaces the exact install command when the user forgets. No-friction first read, no surprise at first use.
