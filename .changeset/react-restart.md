---
'@simten/react': minor
---

`useSimulation` has `actions.restart()`, the power cycle: the session goes back to the state it opened in, at cycle 0, with the inputs at `initialInputs`. `reset()` leaves the inputs where they are, so a latch built from gates settles on them rather than as it did when the circuit opened.
