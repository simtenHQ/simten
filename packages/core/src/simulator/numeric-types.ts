/**
 * Numeric Circuit Types for Fast Simulation
 *
 * This module defines data structures that use numeric indices and typed arrays
 * instead of string-based maps. This enables O(1) lookups without hash computation
 * and better cache locality.
 *
 * The NumericCircuit is compiled from a FlatCircuit once during initialization,
 * and then used for all simulation ticks.
 */

import type { FlatCircuit, PrimitiveState } from '../types/simulator.js';

/**
 * Primitive type index constants for fast switching.
 * Maps primitive names to numeric indices for O(1) dispatch.
 */
export const PRIMITIVE_TYPE_INDICES: Record<string, number> = {
  // Logic Gates (0-9)
  And: 0,
  Or: 1,
  Not: 2,
  Nand: 3,
  Nor: 4,
  Xor: 5,
  Xnor: 6,
  Buffer: 7,

  // I/O Components (10-19)
  Switch: 10,
  Led: 11,
  Output: 12,
  Button: 13,
  Input: 14,
  Constant: 15,

  // Utilities (20-39)
  Splitter: 20,
  Splitter8to8: 21,
  Combiner8to8: 22,
  Probe: 23,
  BitSlice: 24,
  AddressCombiner: 25,
  Concat: 26,

  // Bus Operations (40-49)
  BusAnd: 40,
  BusOr: 41,
  BusNot: 42,
  BusXor: 43,

  // Arithmetic (50-69)
  Incrementer: 50,
  Adder: 51,
  Multiplier: 52,
  Comparator: 53,
  LeftShifter: 54,
  RightShifter: 55,
  Subtractor: 56,
  SignedAdder: 57,
  SignedComparator: 58,
  SignedMultiplier: 59,

  // Plexers (70-79)
  Mux: 70,
  Decoder: 71,

  // Display (80-89)
  SevenSegment: 80,
  HexDisplay: 81,
  Screen: 82,
  RasterDisplay: 83,

  // Sequential (90-99)
  DFlipFlop: 90,
  Register: 91,

  // Memory (100-109)
  ROM: 100,
  RAM: 101,
  DualPortRAM: 102,

  // I/O Devices (110-119)
  Console: 110,
};

/**
 * Reverse mapping from index to primitive name (for debugging)
 */
export const PRIMITIVE_INDEX_TO_NAME: string[] = Object.entries(PRIMITIVE_TYPE_INDICES)
  .reduce((arr, [name, idx]) => {
    arr[idx] = name;
    return arr;
  }, [] as string[]);

/**
 * Compiled numeric circuit for fast simulation.
 * All string IDs are replaced with numeric indices.
 */
export interface NumericCircuit {
  /** Total number of nodes */
  nodeCount: number;

  /** Total number of ports across all nodes */
  portCount: number;

  // ============================================================================
  // ID Mappings (for API boundary conversion)
  // ============================================================================

  /** Map from string node ID to numeric index */
  nodeIdToIndex: Map<string, number>;

  /** Array from numeric index back to string node ID */
  indexToNodeId: string[];

  /** Map from "nodeId.portName" to port index */
  portKeyToIndex: Map<string, number>;

  /** Array from port index back to "nodeId.portName" */
  indexToPortKey: string[];

  // ============================================================================
  // Per-Node Data (indexed by nodeIndex)
  // ============================================================================

  /** Primitive type index for each node (index into PRIMITIVE_TYPE_INDICES) */
  primitiveTypeIndex: Uint16Array;

  /** First port index for this node */
  nodePortStart: Uint32Array;

  /** Number of input ports for this node */
  nodeInputCount: Uint8Array;

  /** Number of output ports for this node */
  nodeOutputCount: Uint8Array;

  // ============================================================================
  // Adjacency (numeric)
  // ============================================================================

  /** Dependent node indices for each node */
  dependents: Uint32Array[];

  // ============================================================================
  // Input Sources (numeric)
  // ============================================================================

  /** Source node index for each input port */
  inputSourceNode: Int32Array;

  /** Source port index for each input port (-1 if unconnected) */
  inputSourcePort: Int32Array;

  /** Port name for each input port (needed for evaluator) */
  inputPortNames: string[];

  // ============================================================================
  // Port Metadata
  // ============================================================================

  /** 1 if output port, 0 if input */
  portIsOutput: Uint8Array;

  /** 1 if bus, 0 if bit (for default values) */
  portIsBus: Uint8Array;

  // ============================================================================
  // Node Classification
  // ============================================================================

  /** 1 if node has no inputs (Switch, Constant, etc.) */
  isSourceNode: Uint8Array;

  /** 1 if outputs depend only on state (Register, DFlipFlop, etc.) */
  isStateOutputNode: Uint8Array;

  /** 1 if node has sequential state */
  hasState: Uint8Array;

  /** 1 if node reads from top-level input */
  readsTopLevelInput: Uint8Array;

  // ============================================================================
  // Original References
  // ============================================================================

  /** Original FlatCircuit reference (for arguments, state, etc.) */
  flatCircuit: FlatCircuit;
}

/**
 * Numeric sequential state for fast simulation.
 * Uses the same Map-based state as FlatSequentialState for memory components,
 * but with numeric node indices for lookup.
 */
export interface NumericSequentialState {
  /** Current state values indexed by node index */
  currentState: (PrimitiveState | undefined)[];

  /** Next state values indexed by node index */
  nextState: (PrimitiveState | undefined)[];

  /** Clock edge for each clock (indexed by some clock key) */
  clocks: Map<string, { value: boolean; edge: 'rising' | 'falling' | 'none' }>;

  /** Cycle count */
  cycleCount: number;
}
