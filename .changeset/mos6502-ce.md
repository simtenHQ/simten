---
"@simten/core": minor
---

MOS6502_Core takes `ce: true`, a clock enable: while `ce` is low the core holds, writes included, so it can run every Nth tick of a faster clock.
