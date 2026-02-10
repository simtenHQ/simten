/**
 * Intermediate Representation (IR) v0.1 - TypeScript Type Definitions
 *
 * This is the formal IR specification in TypeScript.
 * See /docs/ir-v0.1-spec.md for detailed documentation.
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

// ============================================================================
// Port Descriptors (Component Definition)
// ============================================================================

export interface PortDescriptor {
  name: string;
  portType: PortType;
  description?: string;
}

// ============================================================================
// Port Instances (Runtime)
// ============================================================================

export type BitValue = boolean;
export type BusValue = number; // Stored as integer for efficiency

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
  // Sparse storage: only store non-default values
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
 * Component Kind - determines evaluation order and cycle detection
 *
 * - combinational: Pure logic, no state, must be acyclic
 * - sequential: Has state (registers, RAM), updates on clock edges
 * - sink: Consumes signals but outputs don't feed back (Screen, audio, UART)
 */
export type ComponentKind = 'combinational' | 'sequential' | 'sink';

/**
 * FrameSnapshotSource - Capability interface for components that provide
 * burst-readable memory snapshots (framebuffers, audio buffers, etc.)
 *
 * This represents DMA-style burst reads that happen once per evaluation,
 * separate from combinational logic timing.
 */
export interface FrameSnapshotSource {
  /**
   * Returns an immutable snapshot of the framebuffer/buffer contents.
   * Called once per frame during projection phase.
   */
  snapshot(): Readonly<Uint8Array>;
}

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
  kind?: ComponentKind; // Component classification for evaluation
  /**
   * For sequential components: how outputs are computed
   * - 'state-only': Outputs come purely from state (DFlipFlop, Register, RasterDisplay)
   * - 'input-dependent': Outputs depend on current inputs (RAM - read is combinational)
   * Used for topological sorting to prevent false cycle detection.
   */
  outputDependency?: 'state-only' | 'input-dependent';
  consumes?: string[]; // Capabilities this component requires (e.g., ['FrameSnapshotSource'])
  provides?: string[]; // Capabilities this component implements (e.g., ['FrameSnapshotSource'])
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
// Library and System
// ============================================================================

export interface ComponentLibrary {
  name: string;
  version: string;
  circuits: Circuit[];
}

export interface CircuitFile {
  version: string;
  circuit: Circuit;
}

// ============================================================================
// Validation Errors
// ============================================================================

export type ValidationErrorType =
  | 'type_mismatch'
  | 'multiple_drivers'
  | 'combinational_loop'
  | 'undefined_component'
  | 'undefined_port'
  | 'invalid_clock_ref'
  | 'parameter_mismatch'
  | 'missing_required_connection';

export interface ValidationError {
  type: ValidationErrorType;
  location: {
    circuitId: string;
    nodeId?: string;
    connectionId?: string;
    portPath?: PortPath;
  };
  message: string;
  suggestions?: string[];
}

// ============================================================================
// Simulation State
// ============================================================================

export interface SimulationState {
  // Current port values
  portValues: Map<string, BitValue | BusValue>;

  // Current state values
  stateValues: Map<string, StateValue>;

  // Clock states
  clockStates: Map<string, ClockState>;

  // Simulation cycle counter
  cycle: number;

  // Evaluation order (topologically sorted node IDs)
  evaluationOrder: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a port path from components
 */
export function createPortPath(nodeId: string, portName: string): PortPath {
  return { nodeId, portName };
}

/**
 * Create a port path key for Map lookups
 */
export function portPathKey(path: PortPath): string {
  return path.nodeId === '' ? `circuit.${path.portName}` : `${path.nodeId}.${path.portName}`;
}

/**
 * Check if two port types are compatible
 */
export function isPortTypeCompatible(a: PortType, b: PortType): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'bus' && b.kind === 'bus') {
    return a.width === b.width;
  }
  return true;
}

/**
 * Get default value for a port type
 */
export function getDefaultValue(portType: PortType): BitValue | BusValue {
  if (portType.kind === 'bit') {
    return false;
  } else {
    return 0;
  }
}

/**
 * Create a bit type
 */
export function bitType(): BitType {
  return { kind: 'bit' };
}

/**
 * Create a bus type
 */
export function busType(width: number): BusType {
  return { kind: 'bus', width };
}

/**
 * Create a memory type
 */
export function memoryType(addressWidth: number, dataWidth: number): MemoryType {
  return { kind: 'memory', addressWidth, dataWidth };
}
