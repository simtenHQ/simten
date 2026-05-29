---
"@simten/core": patch
"@simten/ui": patch
"@simten/embed": patch
"@simten/mcp": patch
---

build: inline `.ts` source content into sourcemaps (`tsconfig.compilerOptions.inlineSources: true`)

Previously each `.js.map` referenced `../src/**/*.ts` files that aren't in the published tarball, and `sourcesContent` was empty — so consumers' debuggers could never resolve to actual source. The maps were dead weight. Adding `inlineSources` embeds the source text directly in each map. Tarballs grow ~50% but debuggers now work end-to-end: consumers can step into `@simten/*` code with real line numbers and identifiers.
