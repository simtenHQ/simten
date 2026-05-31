# @simten/mcp

## 0.1.11

### Patch Changes

- f9e72d7: The MCP server now exits when its parent (Claude Code) goes away, instead of orphaning. Because the studio WS server is started eagerly, its listening socket kept the event loop alive, so the process never terminated on its own when stdin closed — leaking instances that outlived their session and held the studio port (causing dozens of stale servers to pile up). Shutdown is now wired to stdin EOF/close, the MCP transport closing, and SIGTERM/SIGINT, each closing the studio server and exiting. Plain `kill` (SIGTERM) now terminates the server without needing `-9`.

## 0.1.10

### Patch Changes

- f8fdef0: Use a per-process studio auth token instead of a persistent global one (`~/.simten/token`). Combined with the port, the token now uniquely identifies a single MCP instance, both delivered to the browser via show_circuit's URL fragment. A tab that reconnects to a different instance — a stale cached port now held by another project's MCP, or this instance after a restart — is cleanly rejected (close code 4001) instead of silently attaching to the wrong server. Trade-off: a browser tab no longer survives an MCP restart automatically; the next show_circuit re-establishes it.

## 0.1.9

### Patch Changes

- d3bfceb: Studio server now falls back to an OS-assigned free port when the preferred port (19847) is already in use, instead of failing with "port already in use". This lets a second project's MCP instance start its preview. The real port is advertised to the browser via the existing URL fragment, so any port works end-to-end.

## 0.1.8

### Patch Changes

- 0426cad: fix(mcp): default the front-end URL to https://simten.dev and rename TI_URL → SIMTEN_URL

  `show_circuit` opened the editor at the front-end base URL, which defaulted to `http://localhost:3001` — a dev-only port. Installed users of `@simten/mcp` therefore got a dead preview unless they happened to be running the web app locally. The default is now the deployed site (`https://simten.dev`); the dev build overrides it via the `SIMTEN_URL` env var. The env var itself is renamed from the leftover `TI_URL` (the project's former "Turing Incomplete" name) to `SIMTEN_URL`.

## 0.1.7

### Patch Changes

- 8e2c1bc: docs(readme): note the verify_circuit project-deps requirement in the Setup section

  One sentence in the Setup section explaining that `verify_circuit`'s testbench runs in the consumer project's `node_modules` context, so `@simten/core` and `fast-check` need to be installed there. Pairs with the in-tool hint (from a separate patch) that surfaces the exact install command when the user forgets. No-friction first read, no surprise at first use.

## 0.1.6

### Patch Changes

- 640d018: fix(verify_circuit): hint at the install command when the testbench fails with a missing-module error

  If the tsx subprocess fails and its stderr matches `Cannot find module`, `Cannot find package`, or `ERR_MODULE_NOT_FOUND`, the tool now appends a one-line hint to the existing "Testbench produced no verify result" error: try `pnpm add -D @simten/core fast-check` (or your package manager's equivalent). No detection plumbing, no project-state inspection — just a single conditional on stderr text. Cheap and unobtrusive.

## 0.1.5

### Patch Changes

- Updated dependencies [e87c2a5]
  - @simten/core@0.2.4

## 0.1.4

### Patch Changes

- 3e4aaeb: chore(packaging): declare `engines.node: ">=20"` on all four packages and expose `./package.json` via `exports`

  Two small packaging-hygiene fixes:

  - **Consistent `engines.node`**: `core` and `mcp` already declared `node >=20`; `ui` and `embed` omitted the field. Added it for parity — package managers now warn consistently across all four packages when a consumer is on an older Node.
  - **`./package.json` is now an explicit subpath export**: previously `require('@simten/<pkg>/package.json')` threw `ERR_PACKAGE_PATH_NOT_EXPORTED`, which trips up bundler plugins, version probes, and a few SDK auto-detection tools. Adding `"./package.json": "./package.json"` to each `publishConfig.exports` is the conventional fix.

- 3e4aaeb: build: inline `.ts` source content into sourcemaps (`tsconfig.compilerOptions.inlineSources: true`)

  Previously each `.js.map` referenced `../src/**/*.ts` files that aren't in the published tarball, and `sourcesContent` was empty — so consumers' debuggers could never resolve to actual source. The maps were dead weight. Adding `inlineSources` embeds the source text directly in each map. Tarballs grow ~50% but debuggers now work end-to-end: consumers can step into `@simten/*` code with real line numbers and identifiers.

- 3e4aaeb: docs(readme): correct license text — was BUSL 1.1, all machine-readable signals (package.json + LICENSE file) are Apache-2.0

  The README License section claimed Business Source License 1.1 while the package's `license` field, shipped LICENSE file, and SPDX identifier are all Apache-2.0. The machine-readable signals are what npmjs.com, license scanners, and Dependabot trust — a court would side with the LICENSE file. Updated the README prose to match: Apache-2.0.

- 3e4aaeb: fix: read server version from `package.json` instead of a hardcoded `0.1.0` constant

  The MCP `initialize` response advertises the server's name and version; the version was hand-typed as `0.1.0` and drifted as the package was bumped (consumers were seeing `simten 0.1.0` from the actual `0.1.3` server). Replaced the literal with a runtime read of `pkg.version` via `import pkg from '../package.json' with { type: 'json' }`, so the published version is always reported correctly without a coupled manual edit.

- Updated dependencies [3e4aaeb]
- Updated dependencies [3e4aaeb]
  - @simten/core@0.2.3

## 0.1.3

### Patch Changes

- cc6b76e: docs(readme): use `claude mcp add` for setup, document the hardcoded WS port

  Replaced the incorrect setup snippet that told users to paste JSON into `~/.claude/settings.json` (which Claude Code ignores for MCP registration). The right entry point is the `claude mcp add` CLI, which writes to the correct config file automatically. Also added a brief note about the WebSocket bridge port (`127.0.0.1:19847`) being hardcoded — running two MCP instances simultaneously fails the second on `EADDRINUSE`. A configurable port + retry-on-bind is tracked as a follow-up.

- Updated dependencies [c7c5e67]
  - @simten/core@0.2.2

## 0.1.2

### Patch Changes

- Updated dependencies [2649b7c]
  - @simten/core@0.2.1

## 0.1.1

### Patch Changes

- fix(show_circuit): drop server-side execution pre-flight, always await render-ack including fresh-open connect (#139)

  `show_circuit` previously ran a server-side execution pre-flight that rejected circuits using npm imports (because the MCP process can't resolve `esm.sh`). Removed the pre-flight; the tool now always awaits the browser's render acknowledgement, which is the real source of truth for whether a circuit rendered. Fresh-open connections (no tab yet → browser launches → first render) now go through the same await path as warm reconnects.

- Updated dependencies
- Updated dependencies
  - @simten/core@0.2.0
