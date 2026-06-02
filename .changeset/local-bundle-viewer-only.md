---
"@simten/mcp": minor
---

Serve the editor from localhost (viewer-only), fixing the Chrome Local Network Access block.

The MCP now bundles the web editor and serves it on the **same localhost origin** as its studio WebSocket, so the page and the socket are same-origin — no Local Network Access prompt, no mixed content, works in every browser (including Safari). The bundled editor is the pinned, provenance-attested npm build (not live CDN code), and circuits never leave the machine (loopback).

The local studio is **viewer-only, enforced server-side**: the MCP pushes circuits to the browser for display/simulation and accepts nothing actionable back (untrusted browser data is never surfaced to a tool result). As a result the browser→Claude chat bridge (`push_chat_response` / `send-to-claude`) and the `get_circuit_state` read-back are removed. Deliberate sharing remains the hosted-link path, and the hosted `/circuit` keeps its web/sharing role. Set `SIMTEN_URL` to override the frontend origin for local web dev (`http://localhost:3001`).
