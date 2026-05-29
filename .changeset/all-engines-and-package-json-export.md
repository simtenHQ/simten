---
"@simten/core": patch
"@simten/ui": patch
"@simten/embed": patch
"@simten/mcp": patch
---

chore(packaging): declare `engines.node: ">=20"` on all four packages and expose `./package.json` via `exports`

Two small packaging-hygiene fixes:

- **Consistent `engines.node`**: `core` and `mcp` already declared `node >=20`; `ui` and `embed` omitted the field. Added it for parity — package managers now warn consistently across all four packages when a consumer is on an older Node.
- **`./package.json` is now an explicit subpath export**: previously `require('@simten/<pkg>/package.json')` threw `ERR_PACKAGE_PATH_NOT_EXPORTED`, which trips up bundler plugins, version probes, and a few SDK auto-detection tools. Adding `"./package.json": "./package.json"` to each `publishConfig.exports` is the conventional fix.
