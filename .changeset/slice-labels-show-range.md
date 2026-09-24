---
'@simten/ui': patch
---

Slices show the bits they take.

A row of `BitSlice` nodes all read `BitSlice(4)`, which said nothing about
which bits each one carried, and the number was the *input* width, so a
one-bit slice of a four-bit bus announced itself as 4. They now read `[0]` and
`[3:1]`, the notation Verilog uses for the same thing, under the node name
that already says why the slice is there.

`Slice`, which the Verilog importer emits with an offset and a width rather
than a range, is converted to the same notation.
