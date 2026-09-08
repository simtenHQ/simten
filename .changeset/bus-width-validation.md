---
'@simten/core': minor
'@simten/ui': minor
'@simten/embed': minor
---

Reject bus connections that silently drop bits.

`circuit()` now throws when a wider bus drives a narrower one, naming both
widths: `truncates alu.result bus(32) into display.in bus(8)`. Elaboration
propagates the source type, so before this the high bits were simply gone with
nothing recording that they had been dropped.

Widening is allowed and warns. A port here is uninterpreted `Bits`: `PortType`
is `bit | bus(n)`, with signedness carried by the component (`SignedAdder`,
`SignedComparator`) rather than the type. With no sign in the type a widening
has one meaning, so requiring it to be spelled out states nothing the type does
not already fix. It stays a warning because the widths still disagree. Verilog
and Amaranth widen implicitly off declared signedness; SpinalHDL's `Bits.resize`
zero-extends for the same reason. If signedness moves into `PortType` this
should become an error, or disappear because the type resolves it.

`bit` to `bus` is untouched. That is a kind change rather than a width mismatch
and stays the documented affordance it was.

Three primitives were lying about their widths, which is what let the truncations
hide:

- `BitSlice`'s `out` was hardcoded `bus(8)` whatever the slice covered, so a
  2-bit slice claimed 8 bits. It is now `high - low + 1`. A bare `BitSlice` is
  unchanged at 8 bits.
- `HexDisplay` was fixed at `bus(8)`, so a 16-bit accumulator wired into one lost
  its high byte. It takes `width` now, which makes it a factory: write
  `HexDisplay()` where you wrote `HexDisplay`.
- `Input` was fixed at `bus(8)` while happily carrying `Input({ value: 0x11111111 })`.
  It takes `width`. Already a factory, so no call sites change.

`ZeroExtend` and `SignExtend` had no entry in the Verilog primitive map, so any
circuit using either exported `// WARNING: Unsupported primitive` in place of the
extension: output that parses, synthesizes, and does not do what the circuit
does. The importer emits both routinely from yosys netlists, so this was
reachable without writing one by hand. Both map to plain wiring now,
`{5'b0, x}` and `{{5{x[2]}}, x}`, which yosys folds into the net.

Fixes the truncations this found across the shipped designs: the systolic array's
nine result registers and its per-column pipeline registers were 8 bits between a
16-bit partial sum and a 16-bit output port, the RV32I forwarding slices and
byte-offset slice read the wrong widths, and several displays showed the low byte
of a 32-bit value.
