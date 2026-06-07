---
"@simten/mcp": minor
---

New `get_started` tool: orientation plus the bundled example catalog. Bare call returns "simten in 30 seconds" and the example menu; `example:"<id>"` writes that example to `circuits/<id>.circuit.ts` (imports and exports added) ready for `show_circuit`, with no project setup. Server instructions route demo/orientation intents to it; `setup_project` is now described as a pre-verify step only.
