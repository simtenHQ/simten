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
   */
  changed: Uint8Array;
}

/**
 * Sentinel value used to initialize port values.
 * This ensures the first evaluation always detects a change,
 * triggering proper propagation to all dependents.
 * Using -2147483648 (MIN_INT32) as it's an invalid circuit value.
 */
export const UNINITIALIZED_VALUE = -2147483648;

/**
 * Create a new numeric port values container.
 * @param portCount - Total number of ports
 */
export function createNumericPortValues(portCount: number): NumericPortValues {
  const values = new Int32Array(portCount);
  // Initialize to sentinel value so first evaluation always triggers change detection
  values.fill(UNINITIALIZED_VALUE);
  return {
    values,
    changed: new Uint8Array(portCount),
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
}
