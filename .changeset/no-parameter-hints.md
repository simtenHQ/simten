---
'@simten/ui': patch
---

`SimtenCodeEditor` no longer pops up parameter hints automatically, so the signature box stops covering completions inside calls like `.to(...)`. Cmd/Ctrl+Shift+Space still shows them.
