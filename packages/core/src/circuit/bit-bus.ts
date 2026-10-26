/**
 * Port type constructors and state type constructors for the circuit() API.
 *
 * Port types: bit, bus(n) — describe port widths.
 * State types: reg(n), mem(depth, width) — describe stateful storage.
 */

import type { BitType, BusType, MemoryContents, PortType } from '../ir/circuit-ir.js';

// ============================================================================
// State type constructors
// ============================================================================

/** Declaration of a register state field: its width and starting value. */
export interface RegDecl {
  readonly __stateKind: 'reg';
  readonly width: number;
  /** Initial value (defaults to 0) */
  readonly initial: number;
}

/** Declaration of a memory state field: its depth, width and starting contents.
 *  Has index signature [addr: number] → number so eval/onTick can use mem[addr] syntax.
 *  At runtime, mem() state is wrapped in a Proxy that supports this indexing. */
export interface MemDecl {
  readonly __stateKind: 'mem';
  readonly depth: number;
  readonly width: number;
  /** Starting contents, `{ address: value }` (sparse, defaults to empty) */
  readonly initial: MemoryContents;
  /** Runtime index signature — Proxy provides this at runtime */
  [addr: number]: number;
}

/** Any state field type */
export type StateFieldType = RegDecl | MemDecl;

/**
 * Declare a scalar register state field.
 *
 * Usage:
 *   state: { value: reg(8) }           // 8-bit register, initial 0
 *   state: { counter: reg(32, 100) }   // 32-bit register, initial 100
 */
export function reg(width: number, initial: number = 0): RegDecl {
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
 *   state: { lut: mem(4, 8, { 0: 0x3e, 3: 0x07 }) }  // starting contents
 *
 * Starting contents are `{ address: value }`; build dense ones with
 * `romFromBytes` / `romFromWords`. An address outside `0..depth-1` or a value
 * wider than `width` is a compile error.
 */
export function mem(depth: number, width: number, initial?: MemoryContents): MemDecl {
  if (depth < 1 || !Number.isInteger(depth)) {
    throw new Error(`Memory depth must be a positive integer, got ${depth}`);
  }
  if (width < 1 || !Number.isInteger(width)) {
    throw new Error(`Memory width must be a positive integer, got ${width}`);
  }
  return { __stateKind: 'mem', depth, width, initial: initial ?? {} };
}

/** Check if a value is a RegDecl */
export function isRegDecl(v: unknown): v is RegDecl {
  return (
    v != null && typeof v === 'object' && (v as { __stateKind?: unknown }).__stateKind === 'reg'
  );
}

/** Check if a value is a MemDecl */
export function isMemDecl(v: unknown): v is MemDecl {
  return (
    v != null && typeof v === 'object' && (v as { __stateKind?: unknown }).__stateKind === 'mem'
  );
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
