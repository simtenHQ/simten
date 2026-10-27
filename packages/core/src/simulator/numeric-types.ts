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

import type { OnTickEntry } from './eval-bridge.js';
import type { NumericEvaluator } from './evaluators/types.js';
import type { FlatCircuit, PrimitiveState } from './types.js';

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

  /** Type index for each node, into this compile's dispatch tables below */
  primitiveTypeIndex: Uint16Array;

  /** Primitive type name for each type index */
  primitiveTypeNames: string[];

  /** Evaluator for each type index, built from this compile's behavior table.
   *  Null when the table has no behavior for the type. */
  evaluators: (NumericEvaluator | null)[];

  /** onTick for each type index, when the type has one */
  onTicks: (OnTickEntry | undefined)[];

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

  /** Bit mask for each port's declared width (1 for a bit, 2^n - 1 for bus(n)).
   *  Every value written to a port is ANDed with this. */
  portMask: Uint32Array;

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
