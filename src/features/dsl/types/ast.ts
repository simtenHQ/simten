/**
 * Abstract Syntax Tree (AST) Type Definitions for DSL v0.1
 *
 * This AST represents the parsed structure of DSL code before it is
 * compiled to IR. It preserves source location information for error
 * reporting and maintains the hierarchical structure of the DSL.
 *
 * Design Principles:
 * 1. Each node has location information for precise error messages
 * 2. References to components are stored as strings (resolved during linking)
 * 3. The AST is purely structural - no execution semantics
 * 4. Clear separation between declarations, implementations, and connections
 */

// ============================================================================
// Source Location
// ============================================================================

export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

export interface SourceRange {
  start: SourceLocation;
  end: SourceLocation;
  source?: string; // Optional source filename
}

// ============================================================================
// Base AST Node
// ============================================================================

export interface ASTNode {
  location: SourceRange;
  /**
   * Marks nodes that are incomplete due to parse errors.
   * Validators should skip validation for incomplete nodes.
   */
  isIncomplete?: boolean;
}

// ============================================================================
// Type Expressions
// ============================================================================

export interface BitTypeExpr extends ASTNode {
  kind: 'bit';
}

export interface BusTypeExpr extends ASTNode {
  kind: 'bus';
  width: number | ParameterRef; // Can reference a parameter
}

export type TypeExpr = BitTypeExpr | BusTypeExpr;

// ============================================================================
// Parameters
// ============================================================================

export type ParameterType = 'int' | 'string' | 'bool';

export interface ParameterDecl extends ASTNode {
  name: string;
  paramType: ParameterType;
  defaultValue?: number | string | boolean;
}

export interface ParameterRef extends ASTNode {
  name: string;
}

// ============================================================================
// Arguments (for node instantiation)
// ============================================================================

// Array literal: [1, 2, 3]
export interface ArrayLiteral extends ASTNode {
  kind: 'array';
  elements: ArgumentValue[];
}

// Object literal: {64: 3, 65: 4}
export interface ObjectLiteral extends ASTNode {
  kind: 'object';
  entries: Array<{ key: number; value: ArgumentValue }>;
}

export type ArgumentValue = number | string | boolean | ParameterRef | ArrayLiteral | ObjectLiteral;

export interface Argument extends ASTNode {
  name: string;
  value: ArgumentValue;
}

// ============================================================================
// Port Declarations
// ============================================================================

export interface InputDecl extends ASTNode {
  name: string;
  portType: TypeExpr;
  description?: string;
}

export interface OutputDecl extends ASTNode {
  name: string;
  portType: TypeExpr;
  description?: string;
}

export interface ClockDecl extends ASTNode {
  name: string;
  description?: string;
}

// ============================================================================
// State Declarations
// ============================================================================

export interface MemoryTypeExpr extends ASTNode {
  kind: 'memory';
  addressWidth: number | ParameterRef;
  dataWidth: number | ParameterRef;
}

export type StateTypeExpr = BitTypeExpr | BusTypeExpr | MemoryTypeExpr;

export interface StateDecl extends ASTNode {
  name: string;
  stateType: StateTypeExpr;
  initialValue?: number | string | boolean;
  description?: string;
}

// ============================================================================
// Port References (for connections)
// ============================================================================

export interface PortRef extends ASTNode {
  // For circuit-level ports: nodeId is null, portName is the port name
  // For node ports: nodeId is the instance name, portName is the port name
  nodeId: string | null;
  portName: string;
}

// ============================================================================
// Connections
// ============================================================================

export interface ConnectionStmt extends ASTNode {
  source: PortRef;
  target: PortRef;
}

// ============================================================================
// Node Instantiation
// ============================================================================

export interface NodeDecl extends ASTNode {
  instanceName: string;
  componentType: string; // Component name as string (resolved later)
  arguments: Argument[];
  description?: string;
}

// ============================================================================
// Behavioral Statements (for primitives with state)
// ============================================================================

export interface ClockEdge extends ASTNode {
  clockRef: string;
  edge: 'rising' | 'falling';
}

export interface Assignment extends ASTNode {
  target: string; // Variable name (state or port)
  value: Expr;
}

export interface ConditionalStmt extends ASTNode {
  condition: Expr;
  thenBody: Statement[];
  elseBody?: Statement[];
}

export interface OnClockStmt extends ASTNode {
  clockEdge: ClockEdge;
  body: Statement[];
}

export type Statement = Assignment | ConditionalStmt | OnClockStmt;

// ============================================================================
// Expressions (for assignments and conditionals)
// ============================================================================

export interface LiteralExpr extends ASTNode {
  value: number | string | boolean;
}

export interface VariableExpr extends ASTNode {
  name: string;
}

export interface BinaryExpr extends ASTNode {
  operator: '+' | '-' | '*' | '/' | '&' | '|' | '^' | '==' | '!=' | '<' | '>' | '<=' | '>=';
  left: Expr;
  right: Expr;
}

export interface UnaryExpr extends ASTNode {
  operator: '!' | '~' | '-';
  operand: Expr;
}

export interface IndexExpr extends ASTNode {
  base: Expr;
  index: Expr;
}

export type Expr =
  | LiteralExpr
  | VariableExpr
  | BinaryExpr
  | UnaryExpr
  | IndexExpr;

// ============================================================================
// Implementation Block
// ============================================================================

export interface ImplBlock extends ASTNode {
  nodes: NodeDecl[];
  connections: ConnectionStmt[];
  statements: Statement[]; // For primitive components with behavior
}

// ============================================================================
// Circuit Definition
// ============================================================================

export interface CircuitDef extends ASTNode {
  name: string;
  parameters: ParameterDecl[];
  inputs: InputDecl[];
  outputs: OutputDecl[];
  clocks: ClockDecl[];
  state: StateDecl[];
  impl?: ImplBlock; // Composite components have impl, primitives don't
  description?: string;
}

// ============================================================================
// Program (Top Level)
// ============================================================================

export interface Program extends ASTNode {
  circuits: CircuitDef[];
  testbenches?: import('./testbench-ast').TestbenchDef[]; // Optional testbenches
  comments?: Comment[];
}

export interface Comment {
  text: string;
  location: SourceRange;
  isMultiline: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a source location
 */
export function createLocation(
  line: number,
  column: number,
  offset: number,
  source?: string
): SourceLocation {
  return { line, column, offset };
}

/**
 * Create a source range
 */
export function createRange(
  start: SourceLocation,
  end: SourceLocation,
  source?: string
): SourceRange {
  return { start, end, source };
}

/**
 * Create a dummy location (for programmatically generated AST nodes)
 */
export function dummyLocation(): SourceLocation {
  return { line: 0, column: 0, offset: 0 };
}

/**
 * Create a dummy range (for programmatically generated AST nodes)
 */
export function dummyRange(): SourceRange {
  return {
    start: dummyLocation(),
    end: dummyLocation(),
  };
}

/**
 * Check if a port reference is a circuit-level port
 */
export function isCircuitPort(portRef: PortRef): boolean {
  return portRef.nodeId === null;
}

/**
 * Format port reference as string (for debugging)
 */
export function formatPortRef(portRef: PortRef): string {
  return portRef.nodeId === null
    ? portRef.portName
    : `${portRef.nodeId}.${portRef.portName}`;
}

/**
 * Check if a circuit is primitive (no impl block)
 */
export function isPrimitiveCircuit(circuit: CircuitDef): boolean {
  return circuit.impl === undefined;
}

/**
 * Check if a circuit is composite (has impl block)
 */
export function isCompositeCircuit(circuit: CircuitDef): boolean {
  return circuit.impl !== undefined;
}

/**
 * Extract all node instance names from a circuit
 */
export function getNodeNames(circuit: CircuitDef): string[] {
  if (!circuit.impl) return [];
  return circuit.impl.nodes.map((node) => node.instanceName);
}

/**
 * Extract all port names (inputs + outputs + clocks) from a circuit
 */
export function getPortNames(circuit: CircuitDef): {
  inputs: string[];
  outputs: string[];
  clocks: string[];
} {
  return {
    inputs: circuit.inputs.map((input) => input.name),
    outputs: circuit.outputs.map((output) => output.name),
    clocks: circuit.clocks.map((clock) => clock.name),
  };
}
