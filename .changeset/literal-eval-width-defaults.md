---
'@simten/core': patch
---

Fix bare stdlib components picking up the width of an unrelated instance. The eval registry keys behaviour by component name and the last definition wins, so nineteen components whose eval read a width default out of their factory closure — `width: w = width` — handed every bare `Adder()`, `Slice()`, `Concat()` and friends the width of whichever instance was defined last. `@simten/core/std` defines `Adder({ width: 32 })` at module scope, so in a bundle that ordered the stdlib after the app, `Adder()` stopped being 8 bits: `6 + 255` read as 261 instead of wrapping to 5. Module evaluation order differs between bundlers and node, which is why this showed up in the browser and not in tests.

The defaults are now literals matching each factory's own default, and the mask and sign-extend arithmetic those evals used to call out to is inlined, so no stdlib eval reads its factory scope any more.
