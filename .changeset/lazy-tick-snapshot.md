---
"@simten/core": patch
---

tick() builds its port and state snapshot only when read. 30-70% more ticks/s on the bundled examples.
