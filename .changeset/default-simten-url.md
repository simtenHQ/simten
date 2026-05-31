---
"@simten/mcp": patch
---

fix(mcp): default the front-end URL to https://simten.dev and rename TI_URL → SIMTEN_URL

`show_circuit` opened the editor at the front-end base URL, which defaulted to `http://localhost:3001` — a dev-only port. Installed users of `@simten/mcp` therefore got a dead preview unless they happened to be running the web app locally. The default is now the deployed site (`https://simten.dev`); the dev build overrides it via the `SIMTEN_URL` env var. The env var itself is renamed from the leftover `TI_URL` (the project's former "Turing Incomplete" name) to `SIMTEN_URL`.
