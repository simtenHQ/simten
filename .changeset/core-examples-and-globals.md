---
"@simten/core": minor
---

New `@simten/core/examples` subpath with the canonical SnakeAdvanced circuit (single source for the blog, FPGA project, and editor example). Also fixes the editor-globals codegen: a JSDoc regex could swallow neighboring type declarations into `declare global`, which broke Monaco overload resolution for circuits instantiating `RV32I_Core()`.
