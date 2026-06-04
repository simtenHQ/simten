---
"@simten/mcp": minor
---

`show_circuit` no longer watches the file or auto-updates the canvas on edits. It is now the **sole** trigger for painting the browser canvas — re-call `show_circuit` to repaint after editing a circuit. This removes the file-watcher that caused unverified/intermediate states to appear on the canvas and clobbered unsaved in-browser edits.
