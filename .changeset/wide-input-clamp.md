---
"@simten/ui": patch
---

Fix wide (≥31-bit) editor inputs being stuck at 0. The input nodes clamped values to `(1 << Math.min(width, 31)) - 1`, but JavaScript's `<<` is signed 32-bit: `1 << 31` is negative, so `maxValue` went negative and `Math.min(maxValue, value)` forced every entered value to 0. A 32-bit input (e.g. an imported ALU's operands) could never be set to anything but 0, while narrow inputs worked. Now uses `2 ** Math.min(width, 32) - 1`, allowing the full unsigned range up to 2^32-1.
