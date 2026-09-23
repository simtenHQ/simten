---
'@simten/core': minor
'@simten/ui': minor
---

Mark the nodes `autoHarness` generates, and stop labelling their ports.

A harnessed circuit is not the circuit you wrote: the harness wraps it, adds a
switch per input and a led per output, and names each after the port it drives.
Drawn with port labels on, that produces a switch labelled `a` with a port
labelled `out`, sitting next to source where `a` is the port itself and has no
`out`. The canvas was teaching a spelling the compiler rejects.

`Node` now carries an optional `harness` flag, set on the switches and leds
`autoHarness` creates, and `CircuitCanvas` leaves those ports unlabelled when
`showPortLabels` is on. A switch the author wrote keeps its label, because
there `a.out.to(...)` is exactly right.

The flag is additive and optional, so existing IR stays valid. Anything
rendering circuits can use it to tell scaffolding from the design.
