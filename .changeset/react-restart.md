---
'@simten/react': minor
---

`useSimulation` has `actions.restart()`, which starts over from power-on: a new session on the same compile, at cycle 0, with the inputs back at `initialInputs`. `reset()` leaves the inputs where they are, so a latch built from gates settles on them rather than as it did when the circuit opened.
