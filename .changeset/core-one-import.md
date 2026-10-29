---
'@simten/core': minor
'@simten/mcp': patch
---

`circuit`, `bit` and `bus` come from `@simten/core` only: the `@simten/core/circuit` entry is removed (decision 0010, which replaces decision 0003's freeze of that path). A script that builds and simulates needs one import.

Saved circuits keep working. The browser never resolved the path: the sandbox strips import lines before running source, so share links and game drafts that use it still run, and the code editor keeps `@simten/core/circuit` as an alias of `@simten/core`, so they still type-check. The MCP's `check_circuit` and `simulate_circuit` still load a file that uses it. A Node project that runs circuit files with `tsx` changes one import.

The MCP teaches the new path: its instructions, `get_grammar`, and the files `get_started` writes.

| Before | After |
|---|---|
| `import { circuit, bit, bus } from '@simten/core/circuit'` | `import { circuit, bit, bus } from '@simten/core'` |
