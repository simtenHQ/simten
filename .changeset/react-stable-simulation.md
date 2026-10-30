---
'@simten/react': patch
---

`useSimulation` returns the same `{ state, actions }` object, and the same `state`, until something in the state changes, so a `useMemo` or `memo` component that depends on the simulation no longer recomputes on every render. `actions.toggle` flips the value the sandbox holds instead of one the page remembered, so a double click lands where it started even when the state shown hasn't caught up.
