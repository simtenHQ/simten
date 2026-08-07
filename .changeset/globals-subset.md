---
'@simten/ui': minor
---

Add `buildGlobalsFor(names)` — an ambient-globals shim carrying only the named components

`SIMTEN_CORE_GLOBALS` declares every stdlib component at once, which is right
for an open editor and wrong for a teaching context that hands components out
gradually. `buildGlobalsFor(['Nand', 'Switch', 'Led'])` returns the same shim
with only those, JSDoc intact, for use via `setupSimtenIntellisense`'s
`extraLibs`:

```ts
setupSimtenIntellisense(monaco, {
  globals: false,
  extraLibs: { 'file:///simten-globals.d.ts': buildGlobalsFor(allowed) },
});
```

A component left out does not autocomplete and does not typecheck, rather than
being offered and then rejected downstream.

It filters the existing generated blob rather than adding a second generated
artifact, because a second file crossing package boundaries is what previously
let Monaco report errors on valid code after `@simten/core` was rebuilt alone.
`knownGlobalNames()` and a drift test pin the parse against the generator's
format, so a change there fails loudly instead of silently dropping components.

Also shrinks what Monaco holds: a three-component subset is ~4KB against ~52KB
for the full shim.
