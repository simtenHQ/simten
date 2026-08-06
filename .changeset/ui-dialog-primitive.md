---
'@simten/ui': minor
---

Add `@simten/ui/primitives/dialog` — the shadcn Dialog wrapper.

Built on `@radix-ui/react-dialog`, which `Sheet` already depends on, so this adds no new dependency; a Sheet is a Dialog pinned to an edge. Use `Dialog` when the content is a moment with one obvious next action, and `Sheet` when it is a surface the page keeps working behind.
