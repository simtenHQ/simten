---
'@simten/core': patch
---

Fix the `@simten/core/rtl` and `@simten/core/import` subpaths on the published package. Both were declared in `exports` but missing from `publishConfig.exports`, so they resolved in-repo and failed for anyone installing from npm — which put the Verilog importer out of reach of the published build.
