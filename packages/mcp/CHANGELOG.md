# @simten/mcp

## 0.11.0

### Minor Changes

- c61c0fe: One way to do each thing, the 0010 API, and MCP SDK v2 (#532, #514). Breaking for clients that pass the old parameters.

  The server moves to `@modelcontextprotocol/server` 2.x. It serves protocol revision 2026-07-28 to clients that ask for it, with cache hints on `tools/list`, and the 2025 revisions to everything else. Node 20 or later.

  Tools reject parameters they don't have, so a call with an old name fails with an error naming it instead of being ignored.

  Migration:

  | Before                                                                                   | After                                                                |
  | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
  | `simulate_circuit({ show: true, reason })`                                               | `show_circuit({ filePath })`. `simulate_circuit` never paints        |
  | `show_circuit` `memoryData` keys as glob or substring patterns (`"imem"`, `"cpu0*imem"`) | exact node paths (`"imem"`, `"cpu0.imem"`), as in `simulate_circuit` |
  | `show_circuit` `inputs` values `true` / `false`                                          | `1` / `0`                                                            |
  | `run_on_fpga` `timeout_ms`, `no_flash`, `wifi_host`, `full_rebuild`                      | `timeoutMs`, `noFlash`, `wifiHost`, `fullRebuild`                    |
  | `read_waveform`                                                                          | not listed for now                                                   |
  | `import ... from '@simten/mcp/schemas'`                                                  | removed; nothing used it                                             |

  `inputs` in `simulate_circuit` and `show_circuit` takes what `simulate(top).set()` takes: input port names and the paths of Switch and `Input` nodes, resolved exactly. A key that names anything else, or both a port and a Switch, is an error. `show_circuit` now applies its `inputs` and `memoryData` on the canvas; before, it accepted them and the page ignored them.

  `run_on_fpga` is listed only when the server runs inside a checkout of the Simten repo, where `hardware/ulx3s` exists. Set `SIMTEN_REPO_ROOT` to point at one from elsewhere. `read_waveform` is hidden for now, until the waveform work in #539 settles.

  `get_grammar`'s examples import everything they use and export every circuit, `get_verify_api` covers `set` for switches and `simulate(top, { memory })`, and the server instructions list `get_verify_api` with the other reference tools.

### Patch Changes

- 90126f4: `@simten/core/internal` no longer exports the MCP tool handlers (`traceSource`, `checkCircuit`, `getPrimitivesHandler`, `exportVCD` and their types); they now live in `@simten/mcp`, the only package that used them.

  `simulate_circuit` now loads `memoryData`. Contents are `{ node: { address: value } }`, the node named by its ID or its path inside the circuit, and a name that matches no node is an error. Before this fix the contents were silently dropped, so every memory read 0.

- f5c8869: `circuit`, `bit` and `bus` come from `@simten/core` only: the `@simten/core/circuit` entry is removed (decision 0010, which replaces decision 0003's freeze of that path). A script that builds and simulates needs one import.

  Saved circuits keep working. The browser never resolved the path: the sandbox strips import lines before running source, so share links and game drafts that use it still run, and the code editor keeps `@simten/core/circuit` as an alias of `@simten/core`, so they still type-check. The MCP's `check_circuit` and `simulate_circuit` still load a file that uses it. A Node project that runs circuit files with `tsx` changes one import.

  The MCP teaches the new path: its instructions, `get_grammar`, and the files `get_started` writes.

  | Before                                                     | After                                              |
  | ---------------------------------------------------------- | -------------------------------------------------- |
  | `import { circuit, bit, bus } from '@simten/core/circuit'` | `import { circuit, bit, bus } from '@simten/core'` |

- 43115fb: Drop the unused `zod-to-json-schema` dependency.
- 38feb78: `Simulation.get` and `set` take only the circuit's own top-level port names, and unknown port names now throw instead of reading 0. Node writes through `nodesOf(sim).set` need the exact node path.

  `simulate_circuit` reports an `inputs` name that isn't a top-level input as an error, and `memoryData` keys must be exact node paths.

- f4c5153: Follows the `@simten/core` renames (#416). The `get_grammar` text now lives in this package, and the verify guide imports `simulate` from `@simten/core` instead of `@simten/core/sim`.
- 3cb6ede: check_circuit and simulate_circuit now load a circuit file as a real module, the same way verify_circuit loads a testbench, so a file that imports a sub-circuit or a helper from a sibling file works in all three tools. Before, those two tools stripped the imports and failed with errors like "HalfAdder is not defined". A file still needs no project setup for these tools, and an error in it now comes back with its file, line and column. Source text passed as `source`, and a file with no imports at all, still run in-process as before.
- f2c1ec7: Update `@modelcontextprotocol/sdk` to 1.32 and `zod` to 4.6 to pick up security fixes, and drop the unused `zod-to-json-schema` dependency. Tool schemas and validation are unchanged.
- Updated dependencies [4f74855]
- Updated dependencies [d730bbf]
- Updated dependencies [c7e5768]
- Updated dependencies [90126f4]
- Updated dependencies [6052ee8]
- Updated dependencies [f5c8869]
- Updated dependencies [f4c5153]
- Updated dependencies [38feb78]
- Updated dependencies [f7a6a51]
- Updated dependencies [1377bd3]
- Updated dependencies [d3031cb]
- Updated dependencies [25966b0]
- Updated dependencies [fdf488d]
- Updated dependencies [4f74855]
- Updated dependencies [5dc1429]
- Updated dependencies [2dbad6f]
- Updated dependencies [4f74855]
  - @simten/core@0.23.0

## 0.10.0

### Minor Changes

- 0b41a64: `run_on_fpga` takes an optional `wifi_host` to flash over Wi-Fi through the ULX3S's onboard ESP32 instead of USB-JTAG. With a compressed bitstream a load takes about 2s, against 5-8s over USB.

### Patch Changes

- Updated dependencies [c8a9c97]
  - @simten/core@0.22.1

## 0.9.5

### Patch Changes

- Updated dependencies [5dd1c45]
- Updated dependencies [5dd1c45]
  - @simten/core@0.22.0

## 0.9.4

### Patch Changes

- Updated dependencies [71c8e4b]
  - @simten/core@0.21.0

## 0.9.3

### Patch Changes

- Updated dependencies [83b6105]
  - @simten/core@0.20.0

## 0.9.2

### Patch Changes

- Updated dependencies [142ad20]
  - @simten/core@0.19.0

## 0.9.1

### Patch Changes

- Updated dependencies [8ec39e3]
  - @simten/core@0.18.0

## 0.9.0

### Minor Changes

- 08b8ef6: Make the value domain numeric. `BitValue` is `0 | 1`, not `boolean`.

  Booleans are gone from `FieldValue`, `PrimitiveState`, primitive options and
  `@simten/embed` props. A bit and a bus are now the same kind of thing at
  runtime, so nothing has to infer a width from a JS type. The one deliberate
  exception is `PortOutputValues`, which still widens bit outputs to
  `number | boolean` so `{ out: !(a | b) }` reads naturally in an `eval`. That is
  pinned by a test; it is not an oversight.

  Test files were never type-checked. Every package excluded them from its build
  tsconfig so `tsc -b` would not emit them into `dist`, and Vitest strips types
  with esbuild without checking them, so no test in the repo had ever been through
  the compiler. Each package now has a `tsconfig.check.json` and a
  `typecheck:tests` script, and the root `typecheck` runs both passes. That
  surfaced 206 errors, and behind them these bugs:

  - `sim.set()` ran `Boolean(value)` on bit ports, so the public testbench API
    converted every bit it was handed.
  - `DFlipFlop` stored boolean state through `onTick: () => ({ value: Boolean(d) })`.
  - `circuit()`'s factory path wrote `initialValue: false` into the serialized IR.
  - `Register` and `DFlipFlop` took their state width from the JS type of the
    initial value, so `Register({ width: 16 })` could still declare 8 bits of state.
  - Declarative `reg()` / `mem()` leaked their declaration types into `eval` and
    `onTick`, so the API could not be used without casts that did not compile.
  - `simulateCircuit` and the `simulate_circuit` MCP schema still accepted booleans.

### Patch Changes

- Updated dependencies [08b8ef6]
- Updated dependencies [08b8ef6]
  - @simten/core@0.17.0

## 0.8.16

### Patch Changes

- Updated dependencies [34d7481]
  - @simten/core@0.16.0

## 0.8.15

### Patch Changes

- Updated dependencies [68f48a1]
  - @simten/core@0.15.0

## 0.8.14

### Patch Changes

- Updated dependencies [10994f0]
  - @simten/core@0.14.0

## 0.8.13

### Patch Changes

- Updated dependencies [6081386]
  - @simten/core@0.13.0

## 0.8.12

### Patch Changes

- Updated dependencies [5aa06b2]
  - @simten/core@0.12.0

## 0.8.11

### Patch Changes

- Updated dependencies [28ae7b0]
  - @simten/core@0.11.0

## 0.8.10

### Patch Changes

- Updated dependencies [cbbd9c3]
  - @simten/core@0.10.0

## 0.8.9

### Patch Changes

- Updated dependencies [eb6f6cd]
  - @simten/core@0.9.0

## 0.8.8

### Patch Changes

- Updated dependencies [10d77f9]
  - @simten/core@0.8.0

## 0.8.7

### Patch Changes

- 36ed723: Depend on sibling `@simten/*` packages with a caret range rather than an exact version.

  The workspace deps were declared `workspace:*`, which pnpm rewrites to the **exact** version at publish time — so e.g. published `@simten/embed@0.1.15` pinned `@simten/ui` to exactly `0.1.14`. When a consumer bumped `@simten/ui` ahead (to get a new feature) but kept an older `@simten/embed`, the exact pin forced pnpm to install **two** copies of `@simten/ui`. Two copies don't share module identity, so objects minted by one (a sim from `useCircuitSimulator`) weren't recognized by the other (`CircuitCanvas`), silently breaking rendering.

  Switching to `workspace:^` publishes a caret range, letting a single compatible copy satisfy both packages. No behavior change for anyone already on matching versions.

## 0.8.6

### Patch Changes

- Updated dependencies [40194ac]
  - @simten/core@0.7.0

## 0.8.5

### Patch Changes

- Updated dependencies [2c3a92c]
  - @simten/core@0.6.1

## 0.8.4

### Patch Changes

- Updated dependencies [b441bf9]
  - @simten/core@0.6.0

## 0.8.3

### Patch Changes

- Updated dependencies [d271692]
  - @simten/core@0.5.2

## 0.8.2

### Patch Changes

- 3d0a301: Bump ws from ^8.19.0 to ^8.21.0 to clear a security advisory affecting ws < 8.20.1.

## 0.8.1

### Patch Changes

- Updated dependencies [62597a1]
  - @simten/core@0.5.1

## 0.8.0

### Minor Changes

- ae1dcca: New `get_started` tool: orientation plus the bundled example catalog. Bare call returns "simten in 30 seconds" and the example menu; `example:"<id>"` writes that example to `circuits/<id>.circuit.ts` (imports and exports added) ready for `show_circuit`, with no project setup. Server instructions route demo/orientation intents to it; `setup_project` is now described as a pre-verify step only.

## 0.7.1

### Patch Changes

- Updated dependencies [dcddcf0]
  - @simten/core@0.5.0

## 0.7.0

### Minor Changes

- b32514c: The preview server now proxies `POST /api/compile` to the deployed compiler endpoint (override with `SIMTEN_COMPILE_URL`), so the IMEM node's Compile & Load button works on the MCP canvas with no local services running.

### Patch Changes

- Updated dependencies [b32514c]
- Updated dependencies [b32514c]
- Updated dependencies [b32514c]
  - @simten/core@0.4.0

## 0.6.0

### Minor Changes

- cd3865a: Add `setup_project` so a new/empty folder is one call away from running `verify_circuit`. Designing and simulating already need no setup; verify runs the testbench on the host via `tsx` and resolves `@simten/core` + `fast-check` from the project, so an empty folder previously failed with a cryptic module-not-found that led to a manual `npm init` / `type: module` dance. `setup_project` does it proactively: writes an ESM `package.json` (never clobbering an explicit CommonJS one — falls back to `.mts` there), a NodeNext `tsconfig` for editor IntelliSense, a `circuits/` dir, and installs the deps with the detected package manager. `verify_circuit` now preflights and returns a `setup_required` signal pointing at it instead of failing obscurely.

## 0.5.1

### Patch Changes

- 642c00a: Docs: clarify that `show_circuit` is the sole canvas trigger (editing the circuit file no longer auto-updates the browser — re-call `show_circuit` to repaint) and that the web editor is a sandbox view of the file (the file is the source of truth; in-browser edits are local experiments). Updates the server instructions + README and removes a stale file-watching note. No functional change.

## 0.5.0

### Minor Changes

- 671ccc3: `show_circuit` no longer watches the file or auto-updates the canvas on edits. It is now the **sole** trigger for painting the browser canvas — re-call `show_circuit` to repaint after editing a circuit. This removes the file-watcher that caused unverified/intermediate states to appear on the canvas and clobbered unsaved in-browser edits.

## 0.4.1

### Patch Changes

- Updated dependencies [d51b424]
  - @simten/core@0.3.0

## 0.4.0

### Minor Changes

- 61dab8c: Add a `get_verify_api` tool and move the testbench-writing reference out of `verify_circuit`'s description.

  Clients cap each MCP tool description at 2 KB ([Claude Code does](https://code.claude.com/docs/en/mcp.md)) — the same per-field cap that truncated the server instructions. `verify_circuit`'s description was ~2.5 KB, so the `simulate()` testbench API at the end (`s.set` / `s.tick` / `s.get` / `s.dispose`) was cut off mid-example. Agents couldn't see how to write a `.verify.ts` and fell back to digging through library source.

  - New `get_verify_api` tool returns the full testbench reference: the `simulate()` stepper API, `verify.exhaustive` vs `verify.check`, `declareOracle`, and the Tier-A npm-oracle pattern.
  - `verify_circuit`'s description is slimmed to ~1.6 KB (the oracle tiers + a pointer to `get_verify_api`), back under the cap. All tool descriptions are now under 2 KB.

## 0.3.0

### Minor Changes

- 01d7299: Add `get_grammar` and `list_components` tools; shrink server instructions under the client truncation cap.

  Clients cap an MCP server's `instructions` field — [Claude Code truncates it at 2 KB](https://code.claude.com/docs/en/mcp.md). The server's instructions were ~15 KB, so everything after the first ~2 KB — the entire component catalog, the verify/oracle contract, and the canvas policy — was silently dropped before the model ever saw it. That left agents guessing component names (and falling back to looking in `node_modules`) and skipping the verify workflow.

  The instructions are now ~1.9 KB, front-loading the verify contract and a pointer to two new on-demand tools:

  - `get_grammar` — the `circuit()` builder API (inputs/outputs, nodes, connect) with worked examples.
  - `list_components` — the full stdlib component catalog, each with its ports and constructor options.

  Tool _results_ aren't capped, so the full reference is reliably available on demand even though it can't fit in the instructions. This both fixes the discovery gap and lets the verify contract survive truncation.

## 0.2.0

### Minor Changes

- 9b8e583: Serve a standalone editor from localhost (viewer-only), fixing the Chrome Local Network Access block.

  The MCP now bundles a **standalone, client-only build of the editor** (a plain Vite SPA — no SSR, no prerender, no per-build token) and serves it on the **same localhost origin** as its studio WebSocket, so the page and the socket are same-origin — no Local Network Access prompt, no mixed content, works in every browser (including Safari). The bundled viewer is the pinned, provenance-attested npm build (not live CDN code), and circuits never leave the machine (loopback). It's also much smaller (~1.2 MB / ~0.4 MB gzipped vs the old ~4.5 MB full-site build) and carries no marketing chrome.

  The local studio is **viewer-only, enforced server-side**: the MCP pushes circuits to the browser for display/simulation and accepts nothing actionable back (untrusted browser data is never surfaced to a tool result). The browser→Claude chat bridge (`push_chat_response` / `send-to-claude`) and the `get_circuit_state` read-back are removed. The viewer has no Share or chat by construction (rather than the previous flag-gated hide), so the hosted `/circuit` keeps its full web/sharing role unchanged. Set `SIMTEN_URL` to override the frontend origin for local web dev (`http://localhost:3001`).

  Hardening:

  - **WebSocket origin allowlist** — handshakes whose `Origin` isn't localhost are refused (`4003`), so a cross-site page you visit can't open a studio socket even on the right port; non-browser clients (no `Origin`) stay token-gated.
  - **Malformed request paths return `400`** instead of throwing an uncaught `URIError` that would crash the studio process (e.g. `GET /%`).
  - **Closing the last browser tab no longer strands the studio** — the "browser opened" latch resets when the session count hits zero, so a later `show_circuit` reopens a tab without restarting the MCP.

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
