---
"@simten/core": minor
---

Rename the canonical Snake example: the `SnakeAdvanced` export (and `buildSnakeAdvanced()`) from `@simten/core/examples` is now `Snake` / `buildSnake()`, and the circuit's name is `Snake`. "Advanced" had no "Basic" counterpart — the top-level circuit is just Snake (which wraps `SnakeCore` + a `DualPortRAM` framebuffer). Update imports from `@simten/core/examples` accordingly.
