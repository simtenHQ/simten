---
'@simten/sandbox': minor
---

`SimulationClient.toggle(name)` flips one input between 0 and 1. It takes the keys `set` takes. The sandbox reads the value it holds and writes the other, so toggles sent back to back without awaiting each flip in turn, where a toggle computed from the page's last reported state could flip the same stale value twice.

`SimulationClient.get(name)` takes the same names as core's `Simulation.get`: outputs, input ports, and Switch and Input nodes by path, read from the last state. Names resolve exactly as core resolves them, and a name that is none of these throws with core's message.
