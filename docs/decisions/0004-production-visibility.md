# 0004. Production visibility: errors, alerts, deploys

**Status:** Deferred. Research and options in #464; this draft is superseded there.

## Context

Production has Cloudflare Web Analytics and nothing else. A broken level, a failing sandbox or a container that's down is invisible until someone reports it. Every deploy is run by hand.

## Decision

Stay on Cloudflare and avoid a third-party service for now.

- **Client errors:** web and game send unhandled errors, sandbox errors and failed compiles (with the level id) to a small `/api/errors` endpoint, which writes them to Workers Analytics Engine. No user source code, no personal data. Query with the same GraphQL API as the traffic numbers.
- **Alerts:** Cloudflare notifications on Worker error rates for web, game, sandbox and the three container gateways, plus a health check on each container's `/health`.
- **Deploys:** GitHub Actions deploys sandbox, then web and game, on every merge to `main`. Containers stay manual (the existing "Deploy container" workflow), since a rebuild is slow and they rarely change.
- **Previews:** each PR uploads a Workers version of web and game and comments the preview URLs, so changes can be clicked through before merging.

## Rejected

- **Sentry or a similar service.** Better grouping and stack traces, but another account and another place user data goes. Worth revisiting if the error volume makes Analytics Engine queries painful.
- **Automatic container deploys.** Slow image builds on every merge for code that changes a few times a year.
