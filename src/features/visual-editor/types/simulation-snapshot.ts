/**
 * Simulation Snapshot Types for Time-Travel Debugging
 *
 * This module defines the contract for deterministic time-travel debugging.
 * The core principle: "Sequential state is deterministic given (previous sequential state + environmental state)"
 */

import type { FlatSequentialState } from '../lib/flat-simulator';

/**
 * Contract for environmental state values
 *
 * REQUIREMENTS:
 * - Must be deterministic (same value = same behavior)
 * - Must be cloneable (structuredClone-safe)
 * - Must be replay-safe (no side effects)
 *
 * ALLOWED:
 * - Primitives (number, string, boolean)
 * - Plain objects and arrays
 * - Cloneable structures (not functions, not live objects)
 *
 * FORBIDDEN:
 * - Functions
 * - DOM references
 * - File handles
 * - Network connections
 * - Any mutable external references
 *
 * Examples:
 * - Switch position: boolean
 * - Button state: boolean
 * - Input value: number
 * - Random seed (future): number
 * - UART buffer (future): number[] (cloned array, not live connection)
 */
export type EnvironmentalStateValue =
  | number
  | string
  | boolean
  | null
  | { [key: string]: EnvironmentalStateValue }
  | EnvironmentalStateValue[];

/**
 * Complete snapshot of simulation state at a specific clock cycle
 *
 * This captures everything needed to deterministically replay the simulation:
 * 1. Sequential state (registers, RAM, counters)
 * 2. Environmental state (user inputs, external sources)
 * 3. Metadata (cycle number, timestamp)
 */
export interface SimulationSnapshot {
  // Sequential state (registers, RAM, counters)
  sequentialState: FlatSequentialState;

  // Environmental state (user inputs, external sources)
  // Using Map for consistency with SequentialState and performance at scale
  // Guaranteed O(1) lookups, efficient at thousands/millions of nodes
  // JSON export: trivial conversion via Object.fromEntries()
  environmentalState: Map<string, EnvironmentalStateValue>;

  // Metadata
  cycleNumber: number;
  timestamp: number; // Date.now() for analysis
}
