---
'@simten/core': patch
---

Import: drop `$display`/`$write` with a warning instead of failing the import.

yosys lifts these to `$print` cells, which have no hardware meaning, so the
importer threw `unsupported cell type $print` and took the whole design down
over a debug statement. Real RTL is full of them — one `$display` in its RAM
preload made SERV's `servant` SoC unimportable.

The cell is now skipped and reported through the existing warnings channel,
naming the module and the source line (`servant_ram: dropped 1 $display/$write
statement(s) (dut.v:4278)`), so output is visibly missing rather than silently
swallowed. Genuinely unsupported cells still throw.
