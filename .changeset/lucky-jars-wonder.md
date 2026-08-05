---
'@simten/core': minor
'@simten/ui': minor
'@simten/embed': minor
---

**Breaking: `Switch` is no longer a factory — write `Switch`, not `Switch()`.**

Its options parameter was never used. The config ignored `_opts` entirely; the `value` a switch holds arrives at runtime through `node.arguments`, set by the canvas or by `autoHarness`. The factory form existed only to declare an option that nothing read, at the cost of empty parentheses at every use — and next to `And`, `Led` and `Or`, which take none, the rule was "memorise which components happen to be parameterised".

`Input({ value })` stays a factory, because there the argument does real work — it's how a circuit ships with a starting value. So the rule is now the useful one: parentheses mean you are passing something.

**Breaking: `Button` is removed.**

Its documentation promised momentary behaviour — "outputs 1 only while held down, 0 otherwise" — that was never implemented. Its `eval` was character-for-character identical to `Switch`, it had no entry in the canvas node-type map so it rendered *as* a Switch, no pointer handling existed anywhere in the UI package, and no circuit in the repository used it. A component whose described behaviour cannot be observed is worse than no component: a reset built on it latches instead of pulsing, in a way the docs say is impossible.

`Switch` covers the same ground. If momentary input is wanted later it should arrive with a renderer that implements it.

Migration is mechanical: `Switch()` → `Switch`, and `Button` → `Switch`.
