---
"@simten/embed": patch
---

`useCircuitSimulator` now waits for the sandbox to be ready before its first `compileIR`. Previously it compiled the moment it received a circuit, so a consumer that mounted a circuit before the sandbox iframe finished loading got a "Sandbox not ready" error with no retry. Callers no longer need to gate on `isReady()` themselves.
