---
'@simten/core': patch
---

The NES example's console is grouped like the real board: the 2A03 (6502 core, APU, OAM DMA and its registers), the 74LS139 address decoder, and controller ports driven by the 2A03's OUT0, /OE1 and /OE2 pins.
