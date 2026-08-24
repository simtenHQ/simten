---
'@simten/core': minor
'@simten/ui': minor
---

Make eval-only stdlib primitives drillable on the canvas.

All 51 stdlib primitives are eval-only, so `Adder(16)`, `Mux(16)` and
`Comparator(16)` were dead ends: double-clicking one did nothing. That
contradicts the README — "any component can be opened up and shown as what it is
made of" — and a reader following the drill-down hit a wall at the first piece of
arithmetic.

The fix is not to make them composites. The synth voice is 18 nodes at ~78k
ticks/s; all-gates it is ~2,000 nodes at ~700 ticks/s, too slow for the audio
demo to run at all. Verilog export would degrade from `assign sum = a + b + c` to
a thousand structural assigns, which is worse for Verilator and denies Yosys the
chance to infer an adder and map it to the target's carry chain.

Instead `MADE_OF` holds a gate-level build per primitive, keyed by name, built
from the node's own arguments so `Adder({width: 16})` opens 16 stages and
`Adder({width: 8})` opens 8. It is display only — constructed on demand for a
dialog that runs its own simulator, never elaborated into the running netlist, so
it costs nothing until someone drills. Covers Adder, Subtractor, Incrementer, Mux
and Comparator; skips Multiplier/Divider (a 256-adder array teaches nothing) and
memory (ROM/RAM map to hardened blocks, so a gate build would misrepresent them).

Each level stays small because it is hierarchical: `Adder(16)` is 16 FullAdders,
and a FullAdder is five gates. `FullAdder` is new to the stdlib.

Two descriptions of addition maintained by hand can drift, so they are proven not
to: `made-of.verify.ts` walks every entry, reads its primitive's port widths, and
sweeps the whole input space — exhaustive at widths 1, 2 and 8 (2^17 cases for an
adder), sampled at 16. Every diagram is proven to compute what the primitive it
explains computes.

The builds stop at Xor/And/Or/Not. The game already teaches NAND to gates level
by level; this covers gates to arithmetic.
