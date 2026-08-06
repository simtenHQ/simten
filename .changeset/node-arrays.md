---
'@simten/core': minor
---

Allow a `nodes` entry to be an array, expanded to `n0`, `n1`, … and wired as `n[i]`

Declaring eight of something no longer means eight lines:

```ts
circuit('ByteNot', {
  nodes: {
    a: Array.from({ length: 8 }, () => Switch),
    n: Array.from({ length: 8 }, () => Nand),
    out: Array.from({ length: 8 }, () => Led),
  },
  connect: ({ nodes: { a, n, out } }) =>
    a.flatMap((sw, i) => [sw.out.to(n[i].a, n[i].b), n[i].out.to(out[i].in)]),
});
```

An array entry is exactly its longhand — the expansion happens inside
`circuit()`, so elaboration, the simulator and the Verilog exporter see the same
flat node map they always did, and there is no runtime cost beyond one pass over
the node map at build time. A test pins that equivalence structurally.

Arrays specifically, rather than a dynamically keyed object, because TypeScript
keeps an array's element type: `n[i].a` autocompletes and `n[i].bogus` is still
an error, where `nodes[\`n${i}\`]` loses the type before `circuit()` can see it.

Expanded ids that collide with a hand-written node are an error rather than a
silent overwrite, and reserved names are now checked against the declared key.
