/**
 * Port type constructors and state type constructors for the circuit() API.
 *
 * Port types: bit, bus(n) — describe port widths.
 * State types: reg(n), mem(depth, width) — describe stateful storage.
 */

import type { BitType, BusType, PortType } from '../types/circuit.js';

// ============================================================================
// State type constructors
// ============================================================================

/** Marker for a scalar register state field */
export interface RegState {
  readonly __stateKind: 'reg';
  readonly width: number;
  /** Initial value (defaults to 0) */
  readonly initial: number;
}

/** Marker for an addressable memory state field.
 *  Has index signature [addr: number] → number so eval/onTick can use mem[addr] syntax.
 *  At runtime, mem() state is wrapped in a Proxy that supports this indexing. */
export interface MemState {
  readonly __stateKind: 'mem';
  readonly depth: number;
  readonly width: number;
  /** Initial data (sparse, defaults to empty) */
  readonly initial: Map<number, number>;
  /** Runtime index signature — Proxy provides this at runtime */
  [addr: number]: number;
}

/** Any state field type */
export type StateFieldType = RegState | MemState;

/**
 * Declare a scalar register state field.
 *
 * Usage:
 *   state: { value: reg(8) }           // 8-bit register, initial 0
 *   state: { counter: reg(32, 100) }   // 32-bit register, initial 100
 */
export function reg(width: number, initial: number = 0): RegState {
  if (width < 1 || !Number.isInteger(width)) {
    throw new Error(`Register width must be a positive integer, got ${width}`);
  }
  return { __stateKind: 'reg', width, initial };
}

/**
 * Declare an addressable memory state field.
 *
 * Usage:
 *   state: { mem: mem(256, 8) }     // 256 entries x 8-bit
 *   state: { regs: mem(32, 32) }    // 32 entries x 32-bit (register file)
 */
export function mem(depth: number, width: number, initial?: Map<number, number>): MemState {
  if (depth < 1 || !Number.isInteger(depth)) {
    throw new Error(`Memory depth must be a positive integer, got ${depth}`);
  }
  if (width < 1 || !Number.isInteger(width)) {
    throw new Error(`Memory width must be a positive integer, got ${width}`);
  }
  return { __stateKind: 'mem', depth, width, initial: initial ?? new Map() };
}

/** Check if a value is a RegState */
export function isRegState(v: unknown): v is RegState {
  return v != null && typeof v === 'object' && (v as any).__stateKind === 'reg';
}

/** Check if a value is a MemState */
export function isMemState(v: unknown): v is MemState {
  return v != null && typeof v === 'object' && (v as any).__stateKind === 'mem';
}

// ============================================================================
// Port type constructors
// ============================================================================

/**
 * Single-wire port type (0 or 1).
 *
 * **Example:**
 * ```ts
 * circuit('And', {
 *   inputs:  { a: bit, b: bit },
 *   outputs: { out: bit },
 *   eval:    ({ a, b }) => ({ out: a & b }),
 * })
 * ```
 */
export const bit: BitType = { kind: 'bit' } as const;

/**
 * Multi-wire bus port type. Pass a width in bits.
 *
 * As shorthand, port maps accept a raw number — `{ a: 8 }` is equivalent
 * to `{ a: bus(8) }`.
 *
 * **Example:**
 * ```ts
 * circuit('Adder', {
 *   inputs:  { a: bus(8), b: bus(8) },
 *   outputs: { sum: bus(8) },
 *   eval:    ({ a, b }) => ({ sum: (a + b) & 0xFF }),
 * })
 * ```
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
