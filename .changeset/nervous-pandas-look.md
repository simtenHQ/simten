---
'@simten/core': patch
---

Imported nodes are named after the RTL signals they drive.

Drilling into an imported design landed on `add_45`, `or_32`, `mux_92` — names
built from the operator and the source line, which say what a node is and
nothing about what it means. The netlist already carried better ones: yosys
records each net's source name in `netnames` with `hide_name: 0`, and `serv_alu`
has 24 of those against 17 it invented, including every label in SERV's own
block diagram — `result_add`, `result_lt`, `add_cy`, `cmp_r`, `rs1_sx`.

A cell yosys named itself takes the name of the net it drives, so long as every
signal that net touches is driven by that cell in full. `{add_cy, result_add} =
x + y` is one adder over a value and its carry, and takes the name on bit 0;
two cells each producing half of one signal keep their operator names, because
neither of them is that signal. An instance the author named keeps its own name.

Across the corpus this moves 0% of semantic nodes to 23% (SERV `serv_rf_top`),
24% (`servant`) and 15% (picorv32).
