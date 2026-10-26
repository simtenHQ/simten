---
'@simten/embed': minor
---

Follows the `@simten/core` renames (#416): the `circuit` prop takes a `Circuit` (formerly `BuiltCircuit`). `FlatPortValueMap`, the type `onPortValuesChange` receives, is now exported from `@simten/embed`, so it no longer has to come from `@simten/core/simulator`.
