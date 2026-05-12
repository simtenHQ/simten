/**
 * Snapshot / Restore Round-Trip Properties
 *
 * Proves that the simulator's snapshot and restore are *faithful for
 * sequential state*: if you take a snapshot at state S, run forward
 * N ticks producing trace A, then restore the snapshot and run the
 * same N ticks (re-driving any external inputs), you get a trace B
 * that is byte-identical to A.
 *
 * This is the load-bearing invariant behind the editor's time-travel
 * debugging. If snapshots leak future state, drop state, or are
 * non-deterministic to restore, the entire feature silently lies.
 *
 * Coverage:
 *   - sequential bit-level circuits (Counter2Bit, free-running)
 *   - sequential bus-level circuits (8-bit accumulator, Register + Adder)
 *   - multiple snapshots taken at different cycles, restored out of order
 *   - snapshot independence: post-snapshot mutations must not leak into
 *     the snapshot itself
 *
 * Scope notes (intentional, observed during test authoring):
 *
 *   1. Combinational-only circuits have no sequential state, so the
 *      "snapshot" is effectively empty — outputs after restore depend
 *      entirely on the inputs you drive next, not on the snapshot.
 *      We do not test pure-combinational round-trip here because the
 *      property is vacuous.
 *
 *   2. `engine.snapshot()` captures *engine state* only. It does NOT
 *      capture externally-driven input port values (those live above
 *      the engine boundary), and it does NOT revert the
 *      `SimulationSession`-level cycle counter on restore. Tests below
 *      account for both: they re-drive inputs after every restore and
 *      they assert on output traces, not on `sim.cycle`. If those
 *      semantics ever change, these tests should be tightened to assert
 *      on cycle and input restoration too.
 */

import { describe, it, expect } from 'vitest';
import { simulate } from '../../sim/simulate.js';
import { circuit, bit } from '../../circuit/index.js';
import { Xor, Not, Adder, Register, DFlipFlop } from '../../std/index.js';

// ============================================================================
// Fixtures
// ============================================================================

/** Free-running 2-bit ripple counter built from D flip-flops. */
const Counter2Bit = circuit('Counter2Bit', {
  outputs: { bit0: bit, bit1: bit },
  nodes: { dff0: DFlipFlop(), dff1: DFlipFlop(), inv: Not, xor1: Xor },
  connect: ({ outputs, nodes: { dff0, dff1, inv, xor1 } }) => [
    dff0.q.to(inv.in, xor1.b, outputs.bit0),
    inv.out.to(dff0.d),
    dff1.q.to(xor1.a, outputs.bit1),
    xor1.out.to(dff1.d),
  ],
});

/**
 * 8-bit accumulator: q ← q + addend each rising clock edge.
 * Exercises a bus-level Register feeding back through an Adder.
 */
const Accumulator = circuit('Accumulator', {
  inputs: { addend: 8, we: bit },
  outputs: { q: 8, carry: bit },
  nodes: { reg: Register(), add: Adder({ carry_in: 0 }) },
  connect: ({ inputs, outputs, nodes: { reg, add } }) => [
    reg.q.to(add.a, outputs.q),
    inputs.addend.to(add.b),
    add.sum.to(reg.data),
    inputs.we.to(reg.we),
    add.carry_out.to(outputs.carry),
  ],
});

// ============================================================================
// Helpers
// ============================================================================

interface OutputReader<T> {
  (): T;
}

function recordTrace<T>(
  sim: { tick(): void },
  ticks: number,
  read: OutputReader<T>,
): T[] {
  const trace: T[] = [];
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    trace.push(read());
  }
  return trace;
}

// ============================================================================
// Sequential — bit-level
// ============================================================================

describe('snapshot/restore — sequential bit', () => {
  it('Counter2Bit: identical trajectory after restore', () => {
    const sim = simulate(Counter2Bit);
    try {
      // Run forward to mid-cycle so the state we capture is non-trivial.
      sim.tickN(5);
      const snap = sim.snapshot();
      // Sanity: counter is in some non-initial state we can disturb.
      const stateAtSnap = { b0: sim.get('bit0'), b1: sim.get('bit1') };

      const read = () => ({
        b0: sim.get('bit0'),
        b1: sim.get('bit1'),
      });

      const traceA = recordTrace(sim, 12, read);

      // Restore and re-run the same number of ticks. Trace must match.
      sim.restore(snap);
      // The flip-flop outputs after restore must equal what they were
      // when the snapshot was taken.
      expect(read()).toEqual(stateAtSnap);

      const traceB = recordTrace(sim, 12, read);
      expect(traceB).toEqual(traceA);
    } finally {
      sim.dispose();
    }
  });

  it('multiple snapshots can be restored out of order', () => {
    const sim = simulate(Counter2Bit);
    try {
      // Capture snapshots at three distinct points and remember
      // the next-output-after-snapshot at each.
      sim.tickN(2);
      const snapEarly = sim.snapshot();
      sim.tick();
      const earlyNext = { b0: sim.get('bit0'), b1: sim.get('bit1') };

      sim.tickN(3);
      const snapMid = sim.snapshot();
      sim.tick();
      const midNext = { b0: sim.get('bit0'), b1: sim.get('bit1') };

      sim.tickN(5);
      const snapLate = sim.snapshot();
      sim.tick();
      const lateNext = { b0: sim.get('bit0'), b1: sim.get('bit1') };

      // Restore in reverse order. Each restore must reproduce its
      // own next-output exactly — proving snapshots are independent
      // and restoration does not depend on history order.
      sim.restore(snapMid);
      sim.tick();
      expect({ b0: sim.get('bit0'), b1: sim.get('bit1') }).toEqual(midNext);

      sim.restore(snapLate);
      sim.tick();
      expect({ b0: sim.get('bit0'), b1: sim.get('bit1') }).toEqual(lateNext);

      sim.restore(snapEarly);
      sim.tick();
      expect({ b0: sim.get('bit0'), b1: sim.get('bit1') }).toEqual(earlyNext);
    } finally {
      sim.dispose();
    }
  });
});

// ============================================================================
// Sequential — bus-level
// ============================================================================

describe('snapshot/restore — sequential bus', () => {
  it('Accumulator: bus state survives the round-trip', () => {
    const sim = simulate(Accumulator);
    try {
      // Accumulate some value, then snapshot.
      sim.set({ addend: 7, we: 1 });
      sim.tickN(6); // q should be 42 (7 * 6)
      const snap = sim.snapshot();
      const qAtSnap = sim.get('q');
      expect(qAtSnap).toBe(42);

      // Run further with a different addend.
      sim.set({ addend: 3, we: 1 });
      const traceA = recordTrace(sim, 8, () => sim.get('q'));

      // Restore — q must be back to 42 — and the same input sequence
      // must reproduce the same trace.
      sim.restore(snap);
      expect(sim.get('q')).toBe(qAtSnap);

      sim.set({ addend: 3, we: 1 });
      const traceB = recordTrace(sim, 8, () => sim.get('q'));

      expect(traceB).toEqual(traceA);
    } finally {
      sim.dispose();
    }
  });

  it('snapshots are not aliased — mutating the simulator does not mutate the snapshot', () => {
    const sim = simulate(Accumulator);
    try {
      sim.set({ addend: 5, we: 1 });
      sim.tickN(4); // q = 20
      const snap = sim.snapshot();

      // Run a long destructive sequence after snapshotting.
      sim.set({ addend: 100, we: 1 });
      sim.tickN(50);

      // Restoring must still land us at q = 20, not at the mutated value.
      sim.restore(snap);
      expect(sim.get('q')).toBe(20);
    } finally {
      sim.dispose();
    }
  });
});
