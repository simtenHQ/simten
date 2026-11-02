---
'@simten/sandbox': patch
'@simten/react': patch
---

`sample` and `scan` take one of the circuit's own ports by its plain name, such as `sim.scan('scan_addr', 'pixel_out', 64)` or `actions.sample('audio', n)`, as well as a node's port by path (`ha1.x.out`). Before, a circuit's own port had to be written with the sandbox's internal prefix, `'__top__.pixel_out'`. That still works, and an unknown name fails naming it.
