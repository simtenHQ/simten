---
"@simten/mcp": patch
---

fix: read server version from `package.json` instead of a hardcoded `0.1.0` constant

The MCP `initialize` response advertises the server's name and version; the version was hand-typed as `0.1.0` and drifted as the package was bumped (consumers were seeing `simten 0.1.0` from the actual `0.1.3` server). Replaced the literal with a runtime read of `pkg.version` via `import pkg from '../package.json' with { type: 'json' }`, so the published version is always reported correctly without a coupled manual edit.
