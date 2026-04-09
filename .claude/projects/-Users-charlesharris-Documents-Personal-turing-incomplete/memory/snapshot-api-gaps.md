---
name: Snapshot API gaps
description: SimulationHandle.snapshot/restore does not capture input port values or revert session cycle counter — not user-facing (editor time-travel uses SimulationSession history which handles both), but the raw API is incomplete
type: project
---

Two latent gaps in `SimulationHandle.snapshot()/restore()` (in `packages/core/src/sim/simulate.ts:228-234`):

1. **Input port values not captured.** `engine.snapshot()` only saves sequential circuit state (flip-flop values, register contents, memory). Externally-driven input port values are not part of the snapshot. Restoring after changing inputs gives you the *new* inputs' outputs, not the old ones. For pure-combinational circuits, snapshot is effectively a no-op.

2. **Session cycle counter not reverted.** `engine.restore(snap)` resets engine state but `sim.cycle` reads from `session.getState().cycle`, which is a session-level counter that `engine.restore()` doesn't sync back. After restore, the cycle number keeps its post-restore value.

**Why:** These aren't user-facing bugs. The editor's time-travel uses `SimulationSession`'s history system (`stepBack`/`stepForward`/`seek` at `simulation-session.ts:287-416`), which manages its own snapshot ring buffer and correctly syncs cycle count on restore. The gaps only affect the raw `SimulationHandle` API, which nothing in the app calls directly.

**How to apply:** If you build anything that uses `simulate(circuit).snapshot()/restore()` programmatically (e.g., a test harness, a headless batch simulator, or an MCP tool), you'll hit these. Fix path: sync `session.cycle` from `snap.cycleCount` in `restore()`, and optionally capture/restore input port values alongside engine state.

**Discovered:** 2026-04-08 via round-trip property tests. Documented in `packages/core/src/simulator/__tests__/snapshot-roundtrip.test.ts:25-46`.
