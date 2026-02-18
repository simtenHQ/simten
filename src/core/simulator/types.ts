/**
 * Core Simulator Types
 *
 * Pure type definitions for the simulator engine.
 * These types are environment-agnostic (no browser/Zustand dependencies).
 */

// ============================================================================
// Port Types (re-exported from IR for convenience)
// ============================================================================

export interface BitType {
  kind: 'bit';
}

export interface BusType {
  kind: 'bus';
  width: number;
}

export type PortType = BitType | BusType;

export type BitValue = boolean;
export type BusValue = number;

// ============================================================================
// Component Library Interface
// ============================================================================

/**
 * Pure interface for component resolution.
 * This decouples the simulator from Zustand/React.
 *
 * The Zustand store in features/visual-editor/stores/ implements this interface
 * for UI integration, but the core simulator only depends on this interface.
 */
export interface ComponentLibrary {
  /**
   * Resolve a component by name.
   * Returns the Circuit definition or undefined if not found.
   */
  resolveComponent(name: string): Circuit | undefined;

  /**
   * Get all registered primitive names.
   */
  getAllPrimitiveNames(): string[];
}

// ============================================================================
// Circuit IR Types (subset needed for simulation)
// ============================================================================

export interface PortDescriptor {
  name: string;
  portType: PortType;
  description?: string;
  /** Default value for unconnected inputs. If specified, port is optional. */
  defaultValue?: BitValue | BusValue;
}

export interface ClockDescriptor {
  name: string;
  description?: string;
}

export interface ClockState {
  value: boolean;
  edge: 'rising' | 'falling' | 'none';
}

export interface ClockInstance {
  id: string;
  name: string;
  state?: ClockState;
}

export interface MemoryType {
  kind: 'memory';
  addressWidth: number;
  dataWidth: number;
}

export type StateType = BitType | BusType | MemoryType;

export interface MemoryValue {
  data: Map<number, number>;
  addressWidth: number;
  dataWidth: number;
}

export type StateValue = BitValue | BusValue | MemoryValue | string;

export interface StateBlock {
  id: string;
  name: string;
  stateType: StateType;
  initialValue: StateValue;
  currentValue?: StateValue;
  clockRef?: string;
  edge?: 'rising' | 'falling';
}

export interface PortPath {
  nodeId: string;
  portName: string;
}

export interface Connection {
  id: string;
  source: PortPath;
  target: PortPath;
  portType: PortType;
}

export type ArgumentValue =
  | number
  | string
  | boolean
  | number[]
  | Record<number, number>;

export interface PortInstance {
  id: string;
  name: string;
  portType: PortType;
  value?: BitValue | BusValue;
}

export interface Node {
  id: string;
  label?: string;
  componentRef: string;
  arguments: Record<string, ArgumentValue>;
  inputs: PortInstance[];
  outputs: PortInstance[];
  clocks: ClockInstance[];
}

export type ParameterType = 'int' | 'string' | 'bool';

export interface Parameter {
  name: string;
  paramType: ParameterType;
  defaultValue?: number | string | boolean;
}

export interface PrimitiveImpl {
  kind: 'primitive';
}

export interface CompositeImpl {
  kind: 'composite';
}

export interface IntrinsicImpl {
  kind: 'intrinsic';
  intrinsicType: string;
}

export type Implementation = PrimitiveImpl | CompositeImpl | IntrinsicImpl;

export type ComponentKind = 'combinational' | 'sequential' | 'sink';

export interface CircuitMetadata {
  source?: {
    filename?: string;
    lineNumber?: number;
  };
  description?: string;
  author?: string;
  version?: string;
  tags?: string[];
  kind?: ComponentKind;
  outputDependency?: 'state-only' | 'state+inputs' | 'input-dependent';
  consumes?: string[];
  provides?: string[];
}

export interface Circuit {
  id: string;
  name: string;
  parameters: Parameter[];
  inputs: PortDescriptor[];
  outputs: PortDescriptor[];
  clocks: ClockDescriptor[];
  state: StateBlock[];
  nodes: Node[];
  connections: Connection[];
  implementation: Implementation;
  metadata?: CircuitMetadata;
}

// ============================================================================
// Flat Circuit Types
// ============================================================================

/**
 * Virtual top-level node for circuit-level ports.
 */
export const TOP_LEVEL_NODE = '__top__';

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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a bit type.
 */
export function bitType(): BitType {
  return { kind: 'bit' };
}

/**
 * Create a bus type.
 */
export function busType(width: number): BusType {
  return { kind: 'bus', width };
}

/**
 * Create a memory type.
 */
export function memoryType(addressWidth: number, dataWidth: number): MemoryType {
  return { kind: 'memory', addressWidth, dataWidth };
}
