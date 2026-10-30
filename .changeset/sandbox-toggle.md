---
'@simten/sandbox': minor
---

`SimulationClient.toggle(name)` flips one input between 0 and 1. It takes the keys `set` takes and rejects the same ones. The sandbox reads the value it holds and writes the other, so toggles sent back to back without awaiting each flip in turn, where a toggle computed from the page's last reported state could flip the same stale value twice.
