/**
 * The circuit IR: `CircuitIR` and the types it is built from.
 *
 * Plain JSON with no behaviour and no browser, Zustand or React dependencies.
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

/**
 * A single-bit value. Bits are 0 or 1, matching the simulator's numeric
 * storage (`Uint32Array`, masked to the port width) and what stdlib `eval` functions already return
 * (`out: a && b ? 1 : 0`). Booleans are accepted at API boundaries and
 * coerced, but are not part of the value domain.
 */
export type BitValue = 0 | 1;
export type BusValue = number;

// ============================================================================
// Circuit Definitions Interface
// ============================================================================

/**
 * Circuit definitions by name: the IR half of a library, without behavior.
 * This decouples the simulator from Zustand/React.
 *
 * The Zustand store in features/visual-editor/stores/ implements this interface
 * for UI integration, but the core simulator only depends on this interface.
 */
export interface CircuitDefinitions {
  /**
   * Resolve a circuit by name.
   * Returns the Circuit definition or undefined if not found.
   */
  resolveCircuit(name: string): CircuitIR | undefined;

  /**
   * Get all registered primitive names.
   */
  getAllPrimitiveNames(): string[];
}

export interface MutableCircuitDefinitions extends CircuitDefinitions {
  addCircuit(circuit: CircuitIR): void;
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

/**
 * Memory contents: a plain object from address to stored value, e.g.
 * `{ 0: 0x3e, 1: 0x07 }`. Addresses left out read 0. This is the one format
 * memory contents take everywhere: `mem(depth, width, contents)`, the std
 * memories' `memory` option, `romFromBytes`/`romFromWords`, the IR and
 * `nodesOf(sim).set`. It is plain JSON, so it survives the IR's trips
 * through `JSON.stringify` and `postMessage`. Arrays are rejected (`length`
 * is `never`): build dense contents with `romFromBytes` or `romFromWords`.
 */
export type MemoryContents = { [address: number]: number; length?: never };

export interface MemoryValue {
  /** Sparse contents: only non-zero addresses need an entry. */
  data: MemoryContents;
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

export type ArgumentValue = number | string | boolean | MemoryContents; // Memory contents (ROM data, RAM init)

export interface Node {
  id: string;
  label?: string;
  componentRef: string; // Reference to component by name
  arguments: Record<string, ArgumentValue>;
  inputs: PortInstance[];
  outputs: PortInstance[];
  clocks: ClockInstance[];
  /**
   * A control or indicator the canvas draws for one of the circuit's own
   * ports, not a node the author wrote. It is named after the port, so a
   * switch labelled `a` with a pin labelled `out` would read as `a.out` when
   * `a` in the source is the port itself. Marked so the renderer can leave its
   * pins unlabelled.
   */
  harness?: boolean;
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
export type CircuitTiming = 'combinational' | 'sequential' | 'sink';

export interface CircuitMetadata {
  source?: {
    filename?: string;
    lineNumber?: number;
  };
  description?: string;
  category?: string;
  icon?: string;
  author?: string;
  version?: string;
  testCases?: TestCase[];
  tags?: string[];
  /** Timing classification: combinational, sequential, or sink. Distinct from `implementation.kind` (primitive vs composite). */
  timing?: CircuitTiming;
  /** Key in node.arguments that holds the user-interactive value (Switch, Input) */
  interactiveArg?: string;
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
  /** Whether this circuit's eval/onTick can be synthesized to Verilog */
  synthesizable?: boolean;
}

// ============================================================================
// Circuit (Top Level)
// ============================================================================

export interface CircuitIR {
  /** Schema version for the Circuit IR. Bumped on breaking shape changes. */
  version: 1;
  name: string;
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
 *
 * Bits and buses both rest at 0. The parameter is kept so callers do not
 * have to change, and so a future port type can differ.
 */
export function getDefaultValue(_portType: PortType): BitValue | BusValue {
  return 0;
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
