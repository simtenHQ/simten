/**
 * Core Circuit IR Types
 *
 * Consolidated from:
 * - src/core/simulator/types.ts (canonical simulator types)
 * - src/features/visual-editor/types/circuit.ts (IR types with helpers)
 *
 * These types are environment-agnostic (no browser/Zustand/React dependencies).
 */

// ============================================================================
// Port Types
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
// Circuit Library Interface
// ============================================================================

/**
 * Pure interface for circuit resolution.
 * This decouples the simulator from Zustand/React.
 *
 * The Zustand store in features/visual-editor/stores/ implements this interface
 * for UI integration, but the core simulator only depends on this interface.
 */
export interface CircuitLibrary {
  /**
   * Resolve a circuit by name.
   * Returns the Circuit definition or undefined if not found.
   */
  resolveCircuit(name: string): Circuit | undefined;

  /**
   * Get all registered primitive names.
   */
  getAllPrimitiveNames(): string[];
}

export interface MutableCircuitLibrary extends CircuitLibrary {
  addCircuit(circuit: Circuit): void;
  getAllCircuitNames(): string[];
}

// ============================================================================
// Port Descriptors (Component Definition)
// ============================================================================

export interface PortDescriptor {
  name: string;
  portType: PortType;
  description?: string;
  /** Default value for unconnected inputs. If specified, port is optional. */
  defaultValue?: BitValue | BusValue;
  /** Port width comes from this component argument (e.g. 'width') */
  widthParam?: string;
  /** Multiply the param value to get actual width (e.g. 2 for Multiplier output) */
  widthMultiplier?: number;
}

// ============================================================================
// Port Instances (Runtime)
// ============================================================================

export interface PortInstance {
  id: string;
  name: string;
  portType: PortType;
  value?: BitValue | BusValue;
}

// ============================================================================
// Clock
// ============================================================================

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

// ============================================================================
// State
// ============================================================================

export interface MemoryType {
  kind: 'memory';
  addressWidth: number;
  dataWidth: number;
}

export type StateType = BitType | BusType | MemoryType;

export interface MemoryValue {
  /** Sparse storage: only store non-default values */
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

// ============================================================================
// Connections
// ============================================================================

export interface PortPath {
  nodeId: string; // Empty string for circuit-level ports
  portName: string;
}

export interface Connection {
  id: string;
  source: PortPath;
  target: PortPath;
  portType: PortType;
}

// ============================================================================
// Nodes (Component Instances)
// ============================================================================

export type ArgumentValue =
  | number
  | string
  | boolean
  | number[] // For array initialization (ROM data, RAM init)
  | Record<number, number>; // For sparse initialization (ROM data, RAM init)

export interface Node {
  id: string;
  label?: string;
  componentRef: string; // Reference to component by name
  arguments: Record<string, ArgumentValue>;
  inputs: PortInstance[];
  outputs: PortInstance[];
  clocks: ClockInstance[];
}

// ============================================================================
// Implementation Types
// ============================================================================

export interface PrimitiveImpl {
  kind: 'primitive';
  // Primitive components are provided by simulator kernel
}

export interface CompositeImpl {
  kind: 'composite';
  // Implementation is defined by nodes and connections
}

export interface IntrinsicImpl {
  kind: 'intrinsic';
  intrinsicType: string; // e.g., 'Display', 'DebugProbe'
}

export type Implementation = PrimitiveImpl | CompositeImpl | IntrinsicImpl;

// ============================================================================
// Parameters
// ============================================================================

export type ParameterType = 'int' | 'string' | 'bool';

export interface Parameter {
  name: string;
  paramType: ParameterType;
  defaultValue?: number | string | boolean;
  /** Valid choices for this parameter (UI can show a dropdown) */
  options?: (number | string | boolean)[];
}

// ============================================================================
// Metadata
// ============================================================================

export interface TestCase {
  name: string;
  inputs: Record<string, BitValue | BusValue>;
  expectedOutputs: Record<string, BitValue | BusValue>;
}

/**
 * Circuit Kind - determines evaluation order and cycle detection
 *
 * - combinational: Pure logic, no state, must be acyclic
 * - sequential: Has state (registers, RAM), updates on clock edges
 * - sink: Consumes signals but outputs don't feed back (Screen, audio, UART)
 */
export type CircuitKind = 'combinational' | 'sequential' | 'sink';

export interface CircuitMetadata {
  source?: {
    filename?: string;
    lineNumber?: number;
  };
  description?: string;
  author?: string;
  version?: string;
  testCases?: TestCase[];
  tags?: string[];
  kind?: CircuitKind;
  /**
   * For sequential circuits: how outputs are computed
   * - 'state-only': Outputs come purely from state (DFlipFlop, Register)
   * - 'state+inputs': Outputs depend on state AND combinational inputs (RAM/ROM - address-based read)
   * - 'input-dependent': Outputs depend only on current inputs (pure combinational)
   *
   * Used for topological sorting. Evaluation order:
   * 1. state-only nodes (registers output .q)
   * 2. combinational logic (address calc, muxes, ALU)
   * 3. state+inputs nodes (RAM/ROM read using computed address)
   * 4. sinks
   */
  outputDependency?: 'state-only' | 'state+inputs' | 'input-dependent';
}

// ============================================================================
// Circuit (Top Level)
// ============================================================================

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
// Constants
// ============================================================================

/**
 * Virtual top-level node for circuit-level ports.
 */
export const TOP_LEVEL_NODE = '__top__';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a port path from components.
 */
export function createPortPath(nodeId: string, portName: string): PortPath {
  return { nodeId, portName };
}

/**
 * Create a port path key for Map lookups.
 */
export function portPathKey(path: PortPath): string {
  return path.nodeId === '' ? `circuit.${path.portName}` : `${path.nodeId}.${path.portName}`;
}

/**
 * Check if two port types are compatible.
 */
export function isPortTypeCompatible(a: PortType, b: PortType): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'bus' && b.kind === 'bus') {
    return a.width === b.width;
  }
  return true;
}

/**
 * Get default value for a port type.
 */
export function getDefaultValue(portType: PortType): BitValue | BusValue {
  if (portType.kind === 'bit') {
    return false;
  } else {
    return 0;
  }
}

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
