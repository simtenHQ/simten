---
'@simten/core': minor
---

Breaking: instances of a factory that differ in an option their `eval` or `onTick` reads from the factory's closure are now a compile error naming the variable; before, every instance silently ran with one instance's value. `UART_RX` instances with different `cyclesPerBit` now each keep their own rate.
