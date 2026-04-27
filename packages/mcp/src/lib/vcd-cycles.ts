/**
 * Clock detection + cycle/time mapping for parsed VCDs.
 *
 * Cycle 0 is defined as the *first rising edge* of the detected clock signal.
 * cycleTimes[n] === simulation time (in VCD timescale units, i.e. picoseconds
 * after `parseVcd` has normalized the timescale) of the n-th rising edge.
 *
 * Detection priority (per plan):
 *   1. explicit clock_signal arg (full path or unique leaf)
 *   2. 1-bit signal whose leaf matches /^clk$|^clock$/i at the shallowest scope;
 *      tiebreak `tb.clk`
 *   3. fail with no_clock error listing all 1-bit signals as candidates
 */

import type { ParsedVcd, SignalInfo } from './vcd-parser.js';

export interface CycleMap {
  clock: SignalInfo;
  /** Simulation times of rising edges (one per cycle). cycleTimes[0] is cycle 0. */
  cycleTimes: number[];
  timeAtCycle: (n: number) => number;
  cycleAtTime: (t: number) => number;
  windowToTimeRange: (range: [number, number]) => [number, number];
}

export type ClockDetectionError = {
  type: 'no_clock';
  candidates: string[]; // full paths of all 1-bit signals
};

export interface DetectClockOptions {
  clockSignal?: string;
}

/**
 * Detect the clock signal in a parsed VCD.
 * Returns either the detected SignalInfo or a no_clock error payload.
 */
export function detectClock(
  parsed: Pick<ParsedVcd, 'signals' | 'byFullPath' | 'byLeaf'>,
  opts: DetectClockOptions = {},
): { clock: SignalInfo } | { error: ClockDetectionError } {
  // 1. Explicit override
  if (opts.clockSignal) {
    const exact = parsed.byFullPath.get(opts.clockSignal);
    if (exact && exact.length > 0) return { clock: exact[0] };
    const leaf = parsed.byLeaf.get(opts.clockSignal);
    if (leaf && leaf.length === 1) return { clock: leaf[0] };
    // Override didn't resolve cleanly — fall through to error so the caller
    // sees the candidate list and can disambiguate.
  }

  // 2. Auto-detect: 1-bit signals whose leaf matches /^clk$|^clock$/i,
  //    pick the shallowest scope. Tiebreak `tb.clk`.
  const candidates1bit = parsed.signals.filter((s) => s.width === 1);
  const clockLike = candidates1bit.filter((s) => /^(clk|clock)$/i.test(s.leaf));
  if (clockLike.length === 1) return { clock: clockLike[0] };
  if (clockLike.length > 1) {
    // Shallowest scope first (fewest dots in fullPath).
    let best = clockLike[0];
    let bestDepth = best.fullPath.split('.').length;
    for (const s of clockLike) {
      const depth = s.fullPath.split('.').length;
      if (depth < bestDepth || (depth === bestDepth && s.fullPath === 'tb.clk')) {
        best = s;
        bestDepth = depth;
      }
    }
    return { clock: best };
  }

  // 3. Fail.
  return {
    error: {
      type: 'no_clock',
      candidates: candidates1bit.map((s) => s.fullPath),
    },
  };
}

/**
 * Build a CycleMap from a parsed VCD and its detected clock signal.
 * Cycle 0 = first rising edge. Rising edges only — falling edges not counted.
 */
export function buildCycleMap(parsed: ParsedVcd, clock: SignalInfo): CycleMap {
  const changes = parsed.changes.get(clock.id) ?? [];
  const cycleTimes: number[] = [];
  let prev = 'x';
  for (const c of changes) {
    const v = c.value;
    if (v === '1' && prev !== '1') {
      cycleTimes.push(c.time);
    }
    prev = v;
  }

  function timeAtCycle(n: number): number {
    if (n < 0 || n >= cycleTimes.length) {
      throw new RangeError(`cycle ${n} out of range [0, ${cycleTimes.length})`);
    }
    return cycleTimes[n];
  }

  /**
   * Inverse of timeAtCycle: largest n such that cycleTimes[n] <= t.
   * Returns -1 if t is before cycle 0.
   */
  function cycleAtTime(t: number): number {
    if (cycleTimes.length === 0 || t < cycleTimes[0]) return -1;
    // Binary search for largest n with cycleTimes[n] <= t.
    let lo = 0;
    let hi = cycleTimes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (cycleTimes[mid] <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  function windowToTimeRange([from, to]: [number, number]): [number, number] {
    return [timeAtCycle(from), timeAtCycle(to)];
  }

  return { clock, cycleTimes, timeAtCycle, cycleAtTime, windowToTimeRange };
}
