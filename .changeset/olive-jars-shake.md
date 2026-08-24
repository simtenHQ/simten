---
'@simten/core': patch
---

Stop two things that are not clock problems from failing a whole import.

A port is treated as the module's clock when every consumer of its net is a
clock pin. Two unrelated things could make that test fail:

A `$display` in a clocked block. Yosys lowers it to a `$print` cell whose
trigger hangs off the clock net. The importer already dropped those when
lifting, so counting them as data consumers first was simply inconsistent — a
debug statement should not decide what a clock is.

A submodule taking a clock it never reads. With no consumers the port never
classified, and because a parent's clock is only recognised when every consumer
is a clock pin, one unused input disqualified the clock of every module above
it. A port the child never reads argues neither way, so it no longer counts
against the parent.

Both were found by importing the NES core from `strigeus/fpganes`. Its simplest
mapper takes a `clk` it has no use for, and the PPU and several mappers log with
`$display`; between them the import failed outright. It now imports — 116
circuits, 5972 nodes — and simulates, on unmodified upstream sources.

Tested behaviourally: a register that latched every tick regardless of the clock
would satisfy a structural check just as happily.
