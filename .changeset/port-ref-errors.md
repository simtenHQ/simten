---
"@simten/core": patch
---

Using `.out` or `.in` on something that is already a port (such as a circuit input `a.out.to(...)`) now fails with an error naming the port and how to wire it, instead of "Cannot read properties of undefined".
