---
'@simten/ui': patch
---

`WorkerRequest` and `WorkerResponse` in `@simten/ui/sandbox/protocol` are now the same as `SandboxRequest` and `SandboxResponse`: the sandbox iframe relays every request to its worker, which runs the simulator. Page-facing messages are unchanged.
