---
'@simten/core': patch
---

`Mem` now keeps its initial contents through the source round trip.

The importer lifts a `$mem_v2` INIT (a `$readmemh` image, or a ROM table) into
the node's `store` argument, and `circuitToSource` emits it — but the `Mem`
factory dropped `store` on the floor, so the generated source compiled to an
empty memory. The IR the importer produced ran the program; the source the
editor showed for the same design fetched zeros.

SERV's `servant` SoC is the case that surfaced it: imported from the IR it
prints `Hi, I'm Servant!` on its serial pin, and re-compiled from its own
generated source it stalled at the first instruction.
