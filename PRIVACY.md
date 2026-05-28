# Privacy Policy

**Effective:** 2026-05-28

## TL;DR

Simten is a developer tool. We don't have accounts, don't collect your email, don't run third-party analytics, and don't sell anything. The only personal data that touches our servers is what every web service necessarily sees (your IP address, in Cloudflare's access logs) and circuit source you explicitly choose to share via the "Share" button. Everything else stays on your machine.

This document explains the details so you don't have to take that on faith.

## What we collect

**Cloudflare access logs (IP address, user agent, URL).** Standard web-server logs. Retained by Cloudflare per their default retention; we don't export, aggregate, or sell them. We use them only to debug outages and abuse.

**Cloudflare Analytics Engine, share events only.** When you create or load a shared circuit, we increment two counters in Cloudflare's first-party analytics product: `share_create` (with the hash and source byte length) and `share_read` (with the hash). No IP, no user agent, no personal data is logged here — we use it to size capacity and spot abuse patterns. There is no tracker on any page, no Google Analytics, no PostHog, no Sentry, no Plausible. We considered them and chose not to ship them.

**Shared circuit source (Cloudflare KV).** If you press the "Share" button in the editor, the circuit source code is stored verbatim in Cloudflare KV under a content hash, so anyone with the link can load it. Source ≤ 100 KB. TTL is 2 years and refreshes on every read (active links don't expire). Sharing is rate-limited (30 shares per IP per 60 seconds).

## What we don't collect

- No accounts, logins, emails, OAuth, or user records.
- No cookies.
- No third-party analytics, tracking pixels, advertising scripts, or session replay.
- No telemetry from the MCP server (`@simten/mcp`) — it runs entirely on your machine and does not phone home.
- No telemetry from the embed library (`@simten/embed` / `<CircuitEmbed />`) — it does not call back to simten.dev when loaded on third-party sites.
- No telemetry from the FPGA pipeline (`apps/synth`, `apps/verifier`) beyond Cloudflare's standard logs; circuit source and Verilog passed through these services are processed and returned, not persisted.

## What's stored on your device

Browser `localStorage` only:

- `theme` — light/dark preference.
- `simten:mcp-connection` — the connection token + port for reconnecting to your local MCP server. Local-only; never leaves your machine.
- `simten-ts-code` (and similar editor keys) — your current editor buffer, so it survives page reload.

No cookies of any kind.

## Third parties that may see your IP

- **Cloudflare** — hosts simten.dev and serves every request. See [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/).
- **jsDelivr (`cdn.jsdelivr.net`)** — the editor loads the TypeScript compiler from jsDelivr for in-browser type checking. Loaded only when you open the editor. See [jsDelivr's privacy policy](https://www.jsdelivr.com/privacy-policy-jsdelivr-net).
- **esm.sh** — the in-browser sandbox loads any npm packages your circuit imports from esm.sh. Loaded only if your circuit has `import` statements. See [esm.sh](https://esm.sh).

We don't load Google Fonts, Google Analytics, or any other Google service. Fonts are self-hosted.

## LLM data flow

The chat panel in the editor is a passive view over a connection to your **local Claude Code** (or other MCP client) instance. Your messages and circuit code go from the panel to your local MCP client, which decides what to send to its configured LLM provider (Anthropic, OpenRouter, etc.) under credentials *you* control. Simten has no servers in this loop, no shared API key, and no access to that traffic.

## Data retention

- Cloudflare access logs: per Cloudflare's defaults (typically days, not months).
- Cloudflare Analytics Engine share counters: indefinite, but contain no personal data.
- Shared circuits in KV: 2 years, refreshed on every read. Email [privacy@simten.dev](mailto:privacy@simten.dev) to request deletion of a specific hash.

## Your rights (GDPR / CCPA)

Because we collect no personal identifiers tied to you, most data-subject requests don't apply meaningfully. The exception is shared circuits — if you shared a circuit and want it deleted, email [privacy@simten.dev](mailto:privacy@simten.dev) with the hash (the part after `/circuit/s/` in the URL) and we'll delete the KV entry.

If you believe we're holding data about you that we haven't disclosed here, email us and we'll investigate.

## Children

The service is not directed at children under 13. We don't knowingly collect data from them.

## Changes

We'll update the "Effective" date at the top when this changes. Material changes to data practices will also be noted in the repository changelog.

## Contact

[privacy@simten.dev](mailto:privacy@simten.dev)

For source of truth: this file lives at [`PRIVACY.md`](https://github.com/simtenHQ/simten/blob/main/PRIVACY.md) in the simten repository. The version served at <https://simten.dev/privacy> is rendered from the same source.
