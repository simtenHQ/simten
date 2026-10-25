---
'@simten/ui': minor
---

New `@simten/ui/sandbox/protocol` entry point with the message types shared by the page and the sandbox. `useSandbox` now type-checks what it sends. The `set-node` and `snapshot` responses are renamed `node-set` and `snapshotted`; nothing outside `useSandbox` reads response names.
