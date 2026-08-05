---
'@simten/ui': minor
---

Scaffold snippets for circuit source in the Monaco editor. Typing `circuit` expands the composite skeleton with the circuit name as a linked edit and node names propagating into the `connect` destructure; `circuit-primitive` and `circuit-sequential` cover the `eval` and `state`/`onTick` shapes. Registered automatically by `setupSimtenIntellisense` (disable with `snippets: false`), or directly via the new `registerSimtenSnippets` export. `SIMTEN_SNIPPETS` exposes the definitions.

Handles and edges stay aligned when a circuit's ports change. Handles sit at a percentage of node height, so adding a port moves every handle on that node — but they animated to their new positions, and React Flow measures handle bounds once, immediately after the DOM updates. It caught them mid-animation and never re-measured, leaving edges routed to coordinates the handles had already left. Handle position is no longer transitioned.

Nodes no longer overlap when a circuit gains or loses one. Surviving nodes kept positions from the previous layout while new nodes took the current one, so an added node could land exactly on top of an existing one and hide it. Positions now refresh when nodes are purely added or removed; a rename does both, so it still preserves positions. The viewport also refits in that case, since the diagram's extent changes.
