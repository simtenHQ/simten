---
'@simten/core': minor
'@simten/sandbox': minor
'@simten/react': minor
'@simten/mcp': patch
---

A circuit's own ports are keyed by their name in every port-value map: `portValues.get('sum')`, where it was `portValues.get('__top__.sum')`. A node's port is still keyed by path (`ha1.x.out`). `sample` and `scan` take the same keys, so `sim.scan('scan_addr', 'pixel_out', 64)` and `actions.sample('audio', n)`. The `__top__.` form is no longer accepted anywhere. A port name may not contain a dot, since dots separate node paths.

The hosted sandbox sends the new keys, so a page on `@simten/react` 0.16 or earlier no longer shows a circuit's own outputs on the canvas. Update `@simten/react` and `@simten/sandbox` together.
