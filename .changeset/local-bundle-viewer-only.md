---
"@simten/mcp": minor
---

Serve a standalone editor from localhost (viewer-only), fixing the Chrome Local Network Access block.

The MCP now bundles a **standalone, client-only build of the editor** (a plain Vite SPA — no SSR, no prerender, no per-build token) and serves it on the **same localhost origin** as its studio WebSocket, so the page and the socket are same-origin — no Local Network Access prompt, no mixed content, works in every browser (including Safari). The bundled viewer is the pinned, provenance-attested npm build (not live CDN code), and circuits never leave the machine (loopback). It's also much smaller (~1.2 MB / ~0.4 MB gzipped vs the old ~4.5 MB full-site build) and carries no marketing chrome.

The local studio is **viewer-only, enforced server-side**: the MCP pushes circuits to the browser for display/simulation and accepts nothing actionable back (untrusted browser data is never surfaced to a tool result). The browser→Claude chat bridge (`push_chat_response` / `send-to-claude`) and the `get_circuit_state` read-back are removed. The viewer has no Share or chat by construction (rather than the previous flag-gated hide), so the hosted `/circuit` keeps its full web/sharing role unchanged. Set `SIMTEN_URL` to override the frontend origin for local web dev (`http://localhost:3001`).

Hardening:

- **WebSocket origin allowlist** — handshakes whose `Origin` isn't localhost are refused (`4003`), so a cross-site page you visit can't open a studio socket even on the right port; non-browser clients (no `Origin`) stay token-gated.
- **Malformed request paths return `400`** instead of throwing an uncaught `URIError` that would crash the studio process (e.g. `GET /%`).
- **Closing the last browser tab no longer strands the studio** — the "browser opened" latch resets when the session count hits zero, so a later `show_circuit` reopens a tab without restarting the MCP.
