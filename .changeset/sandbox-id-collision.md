---
'@simten/ui': patch
---

Fix multiple sandboxes on one page answering each other's requests.

Every `<circuit-embed>` mounts its own `SandboxProvider`, so a page with several embeds has several sandbox iframes — and they all `postMessage` to the same parent window, which every `useSandbox` instance listens on. Request ids came from a per-instance counter, so each sandbox's first request was `sb-1`, and `handleMessage` resolved any pending request whose id matched without checking which iframe the message came from.

The result: the first circuit to compile resolved the pending request in *every* sandbox on the page. Three embeds in a blog post all rendered the first circuit, and an embed containing invalid code rendered a circuit instead of an error.

Two changes, either of which would fix it:

- `handleMessage` ignores messages whose `event.source` is not its own iframe. This is the real fix, and it also means another frame cannot feed a sandbox forged responses.
- Request ids come from a module-scoped counter, so they are unique per page rather than per instance.

Does not affect `simten.dev`: `CircuitEmbed` is given an already-built circuit there and never calls `sandbox.compile`, and `useCircuitSimulator` already derived a unique simulation slot per instance. This only reached consumers of the `<circuit-embed>` web component.
