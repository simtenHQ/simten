---
'@simten/core': patch
---

Verilog export: `MemBusMux` reads its `baseN`/`endN` range arguments and offsets `local_addr` by the matched range's base, and `UART_TX.read_data` is driven.
