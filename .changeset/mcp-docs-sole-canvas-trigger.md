---
"@simten/mcp": patch
---

Docs: clarify that `show_circuit` is the sole canvas trigger (editing the circuit file no longer auto-updates the browser — re-call `show_circuit` to repaint) and that the web editor is a sandbox view of the file (the file is the source of truth; in-browser edits are local experiments). Updates the server instructions + README and removes a stale file-watching note. No functional change.
