/**
 * Numeric Port Value Storage for Fast Simulation
 *
 * Typed array storage for port values with change tracking.
 * Uses Int32Array which is sufficient for all bus widths up to 32 bits.
 */

/**
 * Typed array storage for port values.
 * All ports stored as numbers (bits: 0/1, buses: full value).
 */
export interface NumericPortValues {
  /**
   * Port values indexed by port index.
   * - Bits stored as 0 or 1
   * - Buses stored as their numeric value
   */
  values: Int32Array;

  /**
   * Change tracking for event-driven propagation.
   * 1 if value changed during current propagation wave, 0 otherwise.
   * Reset per-wave by `resetChangeFlags`.
   */
  changed: Uint8Array;

  /**
   * Tracks whether each port has ever been written by an evaluator.
   * Persistent across propagation waves; only reset on full simulator reset
   * (via a fresh `createNumericPortValues` call). Used to:
   *   1. Force change detection to fire on the *first* eval of every node,
   *      even when the canonical output happens to equal the zero default.
   *   2. Let `getPortValues` report "uninitialized" without a magic sentinel
   *      value that could collide with a legitimate circuit output.
   *
   * The old approach was to fill `values` with INT32_MIN (-2147483648) as a
   * sentinel, but that's the signed-32 representation of 0x80000000 — a
   * perfectly valid bus value (e.g. the immediate from `lui rX, 0x80000`).
   * The collision silently swallowed the first eval whose output landed
   * exactly there, since change detection saw "no change" against the
   * sentinel. A separate Uint8Array flag avoids the collision entirely.
   */
  initialized: Uint8Array;
}

/**
 * Create a new numeric port values container. `values` defaults to 0
 * (Int32Array's standard zero-init); `initialized` starts all zeros so
 * the first write to each port is correctly detected as a change.
 *
 * @param portCount - Total number of ports
 */
export function createNumericPortValues(portCount: number): NumericPortValues {
  return {
    values: new Int32Array(portCount),
    changed: new Uint8Array(portCount),
    initialized: new Uint8Array(portCount),
  };
}

/**
 * Reset change flags for a new propagation wave.
 * @param values - The port values container
 */
export function resetChangeFlags(values: NumericPortValues): void {
  values.changed.fill(0);
}

/**
 * Copy port values from source to destination.
 * Used for snapshotting or resetting.
 * @param dest - Destination container
 * @param src - Source container
 */
export function copyPortValues(dest: NumericPortValues, src: NumericPortValues): void {
  dest.values.set(src.values);
  dest.changed.set(src.changed);
  dest.initialized.set(src.initialized);
}
