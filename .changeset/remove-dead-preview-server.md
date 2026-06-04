---
---

Remove the unused `preview-server.ts` (legacy SSE server superseded by `ws-server.ts`; `createPreviewServer` was never imported). Internal-only dead-code removal — no public API or behavior change, so no release.
