/**
 * Test helpers for sim/Verilog parity tests that cross a reset boundary.
 *
 * Lives in test infrastructure (not exported from the package) because the
 * bridge encodes a deliberate semantic difference between two callers that
 * tests need to reconcile.
 */

import type { SimulatorEngine } from '../../simulator/index.js';

/**
 * Build a JS-simulator output trace that lines up cycle-by-cycle with a
 * Verilog testbench observing a mid-execution `rst_n` pulse.
 *
 * ─────────────────────────────────────────────────────────────────────
 * DO NOT remove this bridge without first landing cycle-accurate sim
 * reset — tracked in issue #132.
 *
 * Why this exists:
 *   `sim.reset()` is **instant** — it restores state without advancing
 *   the cycle counter. The UI reset button and snapshot-restore both
 *   rely on this "fresh start" semantics.
 *
 *   Synchronous Verilog `rst_n` **consumes a clock cycle** — `rst_n`
 *   low gates the next posedge to load reset values. The testbench
 *   observes a count of 0 *during* the reset cycle itself.
 *
 *   A naive comparison (`for i in 0..N: tick(); push`) across a mid-
 *   execution reset would mismatch by exactly one element at the reset
 *   cycle, because the sim doesn't observe the reset cycle the same way
 *   hardware does.
 *
 * What this does:
 *   After `sim.reset()`, sample state immediately (no tick). That sample
 *   mirrors the Verilog observation of the reset cycle itself. Then
 *   resume ticking. The resulting trace lines up element-for-element
 *   with the Verilog `RESULT|...` lines.
 *
 * What removing this hides:
 *   Any bug where a sequential primitive's reset arm forgets a state
 *   field or restores the wrong initial value. These would surface as
 *   trace mismatches *after* the reset cycle — but only if the bridge
 *   is in place to align cycle counts in the first place. Without the
 *   bridge, every reset-crossing test mismatches by one and someone
 *   spends an afternoon thinking the test is wrong before finding the
 *   real bug.
 *
 * When this can go:
 *   When issue #132 lands (sim gains `assertReset`/`deassertReset` and
 *   a per-primitive `onReset` lifecycle), the parity test compares
 *   traces straight and drops this helper. The "bridge invariant" test
 *   in `reset.verify.test.ts` is the tripwire: it explicitly asserts
 *   the bridge is *necessary today*, and starts failing the moment
 *   #132 lands — telling the implementer the bridge can be removed.
 * ─────────────────────────────────────────────────────────────────────
 *
 * @param sim         An initialized simulator with the design under test.
 * @param preCycles   Number of ticks to run before resetting.
 * @param postCycles  Number of ticks to run after resetting (in addition
 *                    to the post-reset state observation, which is
 *                    always included to match Verilog cycle counting).
 * @param readPort    Reader that returns the observable value at the
 *                    current sim state (e.g., `() => sim.getPortValues().get('__top__.count')`).
 *
 * @returns A trace of length `preCycles + 1 + postCycles` that aligns
 *          with a Verilog testbench whose vectors run `preCycles` normal
 *          cycles, one `setRstN: 0` cycle, then `postCycles` normal
 *          cycles.
 */
export function buildParityTraceAcrossReset(
  sim: SimulatorEngine,
  preCycles: number,
  postCycles: number,
  readPort: () => number,
): number[] {
  const trace: number[] = [];

  for (let i = 0; i < preCycles; i++) {
    sim.tick();
    trace.push(readPort());
  }

  sim.reset();
  // Sample immediately, no tick: this is the bridge. The sample lines up
  // with the Verilog observation of the synchronous-reset cycle itself.
  trace.push(readPort());

  for (let i = 0; i < postCycles; i++) {
    sim.tick();
    trace.push(readPort());
  }

  return trace;
}

/**
 * Build a JS-simulator output trace WITHOUT the cycle-bridge — i.e.,
 * the trace you'd get from a naive `tick → record → reset → tick →
 * record` loop with no special sample at the reset boundary.
 *
 * Used by the bridge-invariant test (`reset.verify.test.ts`) to prove
 * that the bridge is load-bearing: this naive trace MUST mismatch the
 * Verilog trace, and the mismatch MUST occur at the reset cycle. When
 * #132 lands and sim reset becomes cycle-accurate, this naive trace
 * starts matching the Verilog — and the bridge-invariant test fails,
 * which is the signal to clean up `buildParityTraceAcrossReset` and
 * this helper.
 */
export function buildNaiveTraceAcrossReset(
  sim: SimulatorEngine,
  preCycles: number,
  postCycles: number,
  readPort: () => number,
): number[] {
  const trace: number[] = [];

  for (let i = 0; i < preCycles; i++) {
    sim.tick();
    trace.push(readPort());
  }

  sim.reset();
  // No bridge sample — the asymmetry the parity helper accounts for.

  for (let i = 0; i < postCycles; i++) {
    sim.tick();
    trace.push(readPort());
  }

  return trace;
}
