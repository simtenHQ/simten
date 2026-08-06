---
'@simten/ui': minor
---

Add `autoLayout` to `CircuitCanvas`, for canvases where nobody drags nodes.

The layout engine only re-runs when nodes are added or removed. That is right for the editor — people drag nodes there, and a rename should leave them where they were — but the check keys on node ids alone, so adding a *wire* between two existing nodes counts as no change at all. The nodes stay in a layout computed before that wire existed, and the new edge takes a long detour to reach a node that should have moved.

A read-only canvas has no hand-placed positions worth keeping. `autoLayout` re-runs the layout on every structural change, so the diagram always reflects the circuit as it is now.

Defaults to `false`; the editor's behaviour is unchanged.
