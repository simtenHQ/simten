---
"@simten/core": patch
---

Fix time-travel (stepBack/stepForward/seek) not rewinding memory and text state. `restore()` left the cached sequential state in place, and since it shares a validity flag with `getPortValues()`, the session's seekTo (which reads port values before sequential state) handed back the latest state instead of the restored one. Registers rewound but RAM framebuffers and Console/UART text did not. `restore()` now invalidates the sequential-state cache like the tick and reset paths do.
