---
"@simten/ui": patch
"@simten/embed": patch
---

IMEM node code templates define `main()` instead of `_start()` (the compiler links a crt0 that provides `_start`; the old templates failed with a duplicate-symbol link error). Default simulation speed raised from 5 to 15 ticks/s in the embed viewer.
