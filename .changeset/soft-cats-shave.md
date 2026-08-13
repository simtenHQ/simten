---
'@simten/ui': minor
'@simten/embed': patch
---

Report a sandbox that never loads instead of hanging forever. Requests made before the iframe's ready handshake used to queue indefinitely if the handshake never arrived, so a blocked or unreachable sandbox left every promise unsettled and the canvas frozen with no error. `useSandbox` now gives up after 10s, fails everything waiting with a real error, and exposes a `status` of `loading | ready | unavailable`. `useCircuitSimulator` surfaces that through `SimulatorState.error`, so `CircuitViewer` shows a message rather than an empty canvas.
