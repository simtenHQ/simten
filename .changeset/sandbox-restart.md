---
'@simten/sandbox': minor
---

A `restart` session request and `SimulationClient.restart()`: the worker builds the session's simulation again from the circuit and options it was opened with, under the same session id, and stops an auto-run first. The session is back in the state it opened in, which `reset` can't reach for a latch built from gates.
