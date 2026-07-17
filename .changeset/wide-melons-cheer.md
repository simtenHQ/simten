---
"@simten/embed": patch
"@simten/ui": patch
"@simten/mcp": patch
---

Depend on sibling `@simten/*` packages with a caret range rather than an exact version.

The workspace deps were declared `workspace:*`, which pnpm rewrites to the **exact** version at publish time — so e.g. published `@simten/embed@0.1.15` pinned `@simten/ui` to exactly `0.1.14`. When a consumer bumped `@simten/ui` ahead (to get a new feature) but kept an older `@simten/embed`, the exact pin forced pnpm to install **two** copies of `@simten/ui`. Two copies don't share module identity, so objects minted by one (a sim from `useCircuitSimulator`) weren't recognized by the other (`CircuitCanvas`), silently breaking rendering.

Switching to `workspace:^` publishes a caret range, letting a single compatible copy satisfy both packages. No behavior change for anyone already on matching versions.
