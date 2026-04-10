/**
 * Port type constructors for the circuit() API.
 *
 * These produce PortType values compatible with the existing Circuit IR.
 */

import type { BitType, BusType, PortType } from '../types/circuit.js';

// ============================================================================
// Port type constructors
// ============================================================================

/**
 * Single-wire port type (0 or 1).
 *
 * Usage:
 *   circuit('And').in('a', bit).in('b', bit).out('out', bit)
 */
export const bit: BitType = { kind: 'bit' } as const;

/**
 * Multi-wire bus port type.
 *
 * Usage:
 *   circuit('Adder').in('a', bus(8)).out('sum', bus(8))
 *
 * Also accepts a raw number as shorthand:
 *   circuit('Adder').in('a', 8)  // same as bus(8)
 */
export function bus(width: number): BusType {
  if (width < 1 || !Number.isInteger(width)) {
    throw new Error(`Bus width must be a positive integer, got ${width}`);
  }
  return { kind: 'bus', width };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normalize a port type input — accepts bit, bus(n), or a raw number (shorthand for bus).
 */
export function normalizePortType(input: PortType | number): PortType {
  if (typeof input === 'number') {
    return input === 1 ? bit : bus(input);
  }
  return input;
}
