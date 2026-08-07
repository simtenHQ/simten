---
'@simten/ui': patch
---

Fix wire colour across composite boundaries on the canvas

A wire running between two composite components rendered as undefined — grey
rather than green — even while the simulation carried a 1 along it. Elaboration
and simulation were correct throughout; only the styling was wrong.

Edges are projected from the *unelaborated* circuit, where a composite is one
node with ports. `portValues` comes from the *flattened* netlist, where that
boundary has been dissolved: a `HalfAdder` named `h1` contributes `h1.x1.out`
and `h1.a1.out`, and no `h1.carry` at all. The lookup tried the connection's
source and then its target, so a wire touching a primitive still resolved on
that side — which is why only *some* composite wires looked dead, and why the
bug was easy to miss.

`resolvePortValue` now walks inward when a port is not in the flat map: for an
output, it follows the internal connection that drives it; for an input, one it
feeds; and it repeats until the path reaches something the map knows about. The
path prefix is rebuilt as it descends (`m1` → `m1.i1` → `m1.i1.g`), which
reconstructs exactly the naming the simulator produces, so arbitrary nesting
depth resolves — verified against a real three-level elaboration.

Strictly additive: the direct key is tried first, so every lookup that already
worked takes the identical path.
