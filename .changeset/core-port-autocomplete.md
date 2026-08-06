---
'@simten/core': patch
---

Restore port-name autocomplete on components that declare no inputs or outputs.

`inputs`/`outputs` are optional on a circuit config, so a component that omits one — `Switch` has no inputs, `Led` no outputs — gave TypeScript nothing to infer that side from. Without a generic default it substituted the constraint, `Record<string, PortType | number>`, which is an open index signature: every key was valid.

The effect inside a `connect` callback was that a node had no known members, so `sw.` offered no completions at all, while `sw.anything` type-checked happily and only failed later at runtime with "Port 'anything' does not exist". Typos went uncaught precisely where the type system was supposed to help most.

`Ins` and `Outs` now default to `{}`. Port names autocomplete on every component, and a misspelled port is a compile error.

`Nodes` and `S` deliberately still fall back to their own constraints: eval functions read structural arguments such as `width` and `offset` out of the input bag, and closing those would reject working code.
