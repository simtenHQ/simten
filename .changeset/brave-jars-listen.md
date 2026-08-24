---
'@simten/embed': minor
'@simten/ui': minor
---

Read a port's value on every tick, not just the last one.

`tickN` reports where the circuit ended up, which is all a canvas needs. Anything
consuming the output *stream* needs every intermediate value — a second of audio
at 22 kHz is 22,050 of them — and one `tick` call per sample would be that many
sandbox round trips a second.

`renderSamples(portName, count, inputs?)` advances the simulator `count` times
and returns the port's value after each tick, in one round trip. Inputs are
applied once and held for the run, so anything that has to change mid-run is
sequenced across several calls; that keeps the sandbox side knowing nothing about
what the samples are for.

It runs in the sandbox like every other simulation, so a circuit built from
reader-supplied source is no more trusted than it was before.
