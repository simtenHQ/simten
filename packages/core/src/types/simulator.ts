/**
 * Flat Circuit Types and Simulator Engine Interface
 *
 * These types describe the elaborated (flattened) circuit representation
 * and the pure simulator engine API.
 *
 * Source: second half of src/core/simulator/types.ts (lines 194-420)
 */

import type {
  ArgumentValue,
  BitValue,
  BusValue,
  ClockInstance,
  ComponentLibrary,
  PortDescriptor,
  PortInstance,
  PortPath,
  PortType,
} from './circuit.js';

// Re-export TOP_LEVEL_NODE so consumers can import it from either file.
export { TOP_LEVEL_NODE } from './circuit.js';

// Re-export the types that simulator consumers typically need alongside the
// engine interface, so they can import everything from one place.
export type {
  ArgumentValue,
  BitValue,
  BusValue,
  ClockInstance,
  ComponentLibrary,
  PortDescriptor,
  PortInstance,
  PortPath,
  PortType,
} from './circuit.js';

// ============================================================================
// Flat Circuit Types
// ============================================================================

/**
 * Precomputed input source for O(1) lookup.
 */
export interface InputSource {
  portName: string;
  sourceNodeId: string;
  sourcePortName: string;
}

/**
 * A flattened node - always a primitive, never a composite.
 */
export interface FlatNode {
  id: string;
  primitiveType: string;
  arguments: Record<string, ArgumentValue>;
  inputs: PortInstance[];
  outputs: PortInstance[];
  clocks: ClockInstance[];
  dependents: string[];
  inputSources: InputSource[];
}

/**
 * A flattened connection with full hierarchical paths.
 */
export interface FlatConnection {
  id: string;
  source: PortPath;
  target: PortPath;
  portType: PortType;
}

/**
 * Hierarchy metadata for UI visualization.
 */
export interface HierarchyNode {
  path: string;
  componentName: string;
  children: HierarchyNode[];
  primitives: string[];
}

/**
 * The elaborated (flattened) circuit.
 */
export interface FlatCircuit {
  nodes: FlatNode[];
  connections: FlatConnection[];
  hierarchy: HierarchyNode;
  topLevelInputs: PortDescriptor[];
  topLevelOutputs: PortDescriptor[];
  nodeMap: Map<string, FlatNode>;
}

// ============================================================================
// Simulation State Types
// ============================================================================

/**
 * Port value storage using full paths.
 * Key format: "nodeId.portName"
 */
export type FlatPortValueMap = Map<string, BitValue | BusValue>;

/**
 * State value types for sequential components.
 */
export type PrimitiveState = BitValue | BusValue | Map<number, number> | string | undefined;

/**
 * Clock edge detection result.
 */
export type ClockEdge = 'rising' | 'falling' | 'none';

/**
 * Clock edge information for state updates.
 */
export interface ClockEdges {
  [clockName: string]: ClockEdge;
}

/**
 * Sequential state for flat circuits.
 */
export interface FlatSequentialState {
  currentState: Map<string, PrimitiveState>;
  nextState: Map<string, PrimitiveState>;
  clocks: Map<string, { value: boolean; edge: 'rising' | 'falling' | 'none' }>;
  cycleCount: number;
}

/**
 * Simulation result.
 */
export interface FlatSimulationResult {
  portValues: FlatPortValueMap;
  sequentialState?: FlatSequentialState;
  error?: string;
}

// ============================================================================
// Simulator Engine Interface
// ============================================================================

/**
 * Options for initializing the simulator.
 */
export interface InitOptions {
  /** Component library for resolving component definitions */
  componentLibrary: ComponentLibrary;
  /** Initial memory data for ROM/RAM components (nodeId -> address -> value) */
  initialMemory?: Map<string, Map<number, number>>;
}

/**
 * Result of a single simulation tick.
 */
export interface TickResult {
  portValues: FlatPortValueMap;
  sequentialState: FlatSequentialState;
  metrics: TickMetrics;
}

/**
 * Metrics from a single tick for performance monitoring.
 */
export interface TickMetrics {
  phase1Evals: number;
  phase2Evals: number;
  totalEvals: number;
}

/**
 * Result of combinational simulation (no clock).
 */
export interface CombinationalResult {
  portValues: FlatPortValueMap;
  metrics: { totalEvals: number };
  error?: string;
}

/**
 * Snapshot of simulator state for save/restore.
 */
export interface SimulatorSnapshot {
  portValues: FlatPortValueMap;
  sequentialState: FlatSequentialState;
  cycleCount: number;
}

/**
 * Simulator performance metrics.
 */
export interface SimulatorMetrics {
  totalTicks: number;
  totalEvaluations: number;
  avgEvalsPerTick: number;
  nodeCount: number;
}

/**
 * Pure simulator engine interface.
 *
 * This is the main API for the simulator, completely decoupled from
 * browser/UI concerns. Can be used in Node.js, workers, or tests.
 */
export interface SimulatorEngine {
  // Initialization
  initialize(circuit: FlatCircuit, options: InitOptions): void;

  // Input control
  setInput(name: string, value: BitValue | BusValue): void;
  setInputs(values: Map<string, BitValue | BusValue>): void;

  // Simulation
  tick(): TickResult;
  runCombinational(): CombinationalResult;

  // Output access
  getOutput(nodeId: string, portName: string): BitValue | BusValue | undefined;
  getPortValues(): ReadonlyMap<string, BitValue | BusValue>;
  getState(): FlatSequentialState | null;

  // State management
  snapshot(): SimulatorSnapshot;
  restore(snapshot: SimulatorSnapshot): void;
  reset(): void;

  // Metrics (for debugging)
  getMetrics(): SimulatorMetrics;
}
