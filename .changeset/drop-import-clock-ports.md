---
"@simten/core": patch
---

fix(import): drop clock-only ports when importing Verilog

Imported sequential designs no longer carry a dangling `clk` port. simten registers share a single implicit clock (`$dff` CLK is never lifted), so an imported top-level clock port drove nothing — it showed as a dead input on the canvas and duplicated the `clk` the Verilog exporter re-adds, breaking re-export. Any input whose net feeds only clock pins is now dropped, computed to a fixpoint so it applies at every level of the hierarchy. Reset ports are kept (their nets feed `Register.rst`, not a clock pin).
