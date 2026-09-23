---
'@simten/core': minor
---

Harness only the ports a circuit actually uses.

`autoHarness` gave every declared port a switch or a led, whether or not
anything inside the circuit touched it. The result was a diagram that claimed
connections the circuit did not have: a switch wired into an input that goes
nowhere, a led hanging off an output nothing drives. It looked finished before
a single wire had been written, and drilling into the box showed none of the
edges the outside implied.

An input is now harnessed once something inside reads it, and an output once
something inside drives it. The `dut` still declares every port, so the
interface stays visible as bare handles, and each switch or led appears as its
port is wired up.

Worth knowing if you drive a harnessed circuit by node id: a port that is not
used inside no longer has a node to set. Ports still resolve by name through
the simulator, which tries a top-level port before falling back to a node id,
so anything driving inputs that way is unaffected.
