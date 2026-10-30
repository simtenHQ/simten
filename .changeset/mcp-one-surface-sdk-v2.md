---
'@simten/mcp': minor
---

One way to do each thing, the 0010 API, and MCP SDK v2 (#532, #514). Breaking for clients that pass the old parameters.

The server moves to `@modelcontextprotocol/server` 2.x. It serves protocol revision 2026-07-28 to clients that ask for it, with cache hints on `tools/list`, and the 2025 revisions to everything else. Node 20 or later.

Tools reject parameters they don't have, so a call with an old name fails with an error naming it instead of being ignored.

Migration:

| Before | After |
|---|---|
| `simulate_circuit({ show: true, reason })` | `show_circuit({ filePath })`. `simulate_circuit` never paints |
| `show_circuit` `memoryData` keys as glob or substring patterns (`"imem"`, `"cpu0*imem"`) | exact node paths (`"imem"`, `"cpu0.imem"`), as in `simulate_circuit` |
| `show_circuit` `inputs` values `true` / `false` | `1` / `0` |
| `run_on_fpga` `timeout_ms`, `no_flash`, `wifi_host`, `full_rebuild` | `timeoutMs`, `noFlash`, `wifiHost`, `fullRebuild` |
| `read_waveform` | not listed for now |
| `import ... from '@simten/mcp/schemas'` | removed; nothing used it |

`inputs` in `simulate_circuit` and `show_circuit` takes what `simulate(top).set()` takes: input port names and the paths of Switch and `Input` nodes, resolved exactly. A key that names anything else, or both a port and a Switch, is an error. `show_circuit` now applies its `inputs` and `memoryData` on the canvas; before, it accepted them and the page ignored them.

`run_on_fpga` is listed only when the server runs inside a checkout of the Simten repo, where `hardware/ulx3s` exists. Set `SIMTEN_REPO_ROOT` to point at one from elsewhere. `read_waveform` is hidden for now, until the waveform work in #539 settles.

`get_grammar`'s examples import everything they use and export every circuit, `get_verify_api` covers `set` for switches and `simulate(top, { memory })`, and the server instructions list `get_verify_api` with the other reference tools.
