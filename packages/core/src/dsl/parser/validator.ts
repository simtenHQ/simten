/**
 * DSL Semantic Validator
 *
 * Performs semantic analysis on the AST to check for errors that cannot
 * be caught during parsing. These include:
 *
 * 1. Name conflicts (duplicate declarations)
 * 2. Undefined references (nodes, ports, parameters, state variables)
 * 3. Type mismatches (in the limited type system we have)
 * 4. Invalid port connections
 * 5. Multiple drivers on a single input
 * 6. Circular dependencies (will be checked during topological sort)
 *
 * For IDE use, the validator can optionally accept a ComponentLibrary to also
 * check component existence at validation time (normally a link-time check).
 */

import {
  Program,
  CircuitDef,
  InputDecl,
  OutputDecl,
  ClockDecl,
  StateDecl,
  NodeDecl,
  ConnectionStmt,
  PortRef,
  ImplBlock,
  formatPortRef,
  isCircuitPort,
  ParameterRef,
  BusTypeExpr,
  OnClockStmt,
  Assignment,
  ConditionalStmt,
  Statement,
  Expr,
  VariableExpr,
  BinaryExpr,
  UnaryExpr,
  IndexExpr,
} from '../types/ast.js';
import { SourceRange } from '../types/ast.js';
import type { ComponentLibrary } from '../../types/circuit.js';

// ============================================================================
// Diagnostic Types
// ============================================================================

/**
 * Diagnostic categories for error classification:
 * - syntax: Chevrotain parse errors (missing tokens, unexpected tokens)
 * - structure: AST building issues (missing child nodes, recovery artifacts)
 * - semantic: Validation errors (undefined refs, duplicate names, type mismatches)
 */
export type DiagnosticCategory = 'syntax' | 'structure' | 'semantic';

export interface ValidationError {
  message: string;
  location: SourceRange;
  severity: 'error' | 'warning';
  category?: DiagnosticCategory;
  suggestions?: string[];
}

export class ValidationException extends Error {
  constructor(
    message: string,
    public errors: ValidationError[]
  ) {
    super(message);
    this.name = 'ValidationException';
  }
}

// ============================================================================
// Validation Options
// ============================================================================

/**
 * Options for validation.
 * For IDE use, pass componentLibrary to enable component existence checking.
 */
export interface ValidateOptions {
  /**
   * Optional component library for checking component existence.
   * When provided, validates that node component types exist.
   * This is normally a link-time check, but useful for IDE diagnostics.
   */
  componentLibrary?: ComponentLibrary;
}

// ============================================================================
// Validator
// ============================================================================

export class Validator {
  private errors: ValidationError[] = [];
  private options: ValidateOptions = {};
  private circuitNames: Set<string> = new Set();

  /**
   * Validate a program
   */
  public validate(program: Program, options: ValidateOptions = {}): ValidationError[] {
    this.errors = [];
    this.options = options;

    // Collect circuit names defined in this program (for cross-circuit references)
    this.circuitNames = new Set(program.circuits.map(c => c.name));

    // Check for duplicate circuit names
    this.checkDuplicateCircuitNames(program);

    // Validate each circuit
    for (const circuit of program.circuits) {
      this.validateCircuit(circuit);
    }

    return this.errors;
  }

  // ==========================================================================
  // Program-level Validation
  // ==========================================================================

  private checkDuplicateCircuitNames(program: Program): void {
    const names = new Set<string>();
    for (const circuit of program.circuits) {
      if (names.has(circuit.name)) {
        this.addError(
          `Duplicate circuit name: '${circuit.name}'`,
          circuit.location,
          ['Each circuit must have a unique name']
        );
      }
      names.add(circuit.name);
    }
  }

  // ==========================================================================
  // Circuit Validation
  // ==========================================================================

  private validateCircuit(circuit: CircuitDef): void {
    // Skip validation for incomplete circuits
    if (circuit.isIncomplete) return;

    // Check for duplicate parameter names (filter incomplete params)
    this.checkDuplicateNames(
      circuit.parameters
        .filter((p) => !p.isIncomplete && p.name)
        .map((p) => ({ name: p.name, location: p.location })),
      'parameter'
    );

    // Check for duplicate port names (filter incomplete ports)
    const portNames = [
      ...circuit.inputs.filter((p) => !p.isIncomplete && p.name).map((p) => ({ name: p.name, location: p.location })),
      ...circuit.outputs.filter((p) => !p.isIncomplete && p.name).map((p) => ({ name: p.name, location: p.location })),
      ...circuit.clocks.filter((p) => !p.isIncomplete && p.name).map((p) => ({ name: p.name, location: p.location })),
    ];
    this.checkDuplicateNames(portNames, 'port');

    // Check for duplicate state variable names (filter incomplete state)
    this.checkDuplicateNames(
      circuit.state
        .filter((s) => !s.isIncomplete && s.name)
        .map((s) => ({ name: s.name, location: s.location })),
      'state variable'
    );

    // Validate port types (check for parameter references)
    this.validatePortTypes(circuit);

    // Validate state types
    this.validateStateTypes(circuit);

    // Validate implementation block
    if (circuit.impl && !circuit.impl.isIncomplete) {
      this.validateImplBlock(circuit, circuit.impl);
    }
  }

  private validatePortTypes(circuit: CircuitDef): void {
    const paramNames = new Set(circuit.parameters.map((p) => p.name));

    for (const input of circuit.inputs) {
      // Skip incomplete inputs
      if (input.isIncomplete || !input.portType) continue;
      if (input.portType.kind === 'bus' && !input.portType.isIncomplete) {
        this.validateWidthParameter(input.portType, paramNames, input.location);
      }
    }

    for (const output of circuit.outputs) {
      // Skip incomplete outputs
      if (output.isIncomplete || !output.portType) continue;
      if (output.portType.kind === 'bus' && !output.portType.isIncomplete) {
        this.validateWidthParameter(output.portType, paramNames, output.location);
      }
    }
  }

  private validateStateTypes(circuit: CircuitDef): void {
    const paramNames = new Set(circuit.parameters.map((p) => p.name));

    for (const state of circuit.state) {
      // Skip incomplete state declarations
      if (state.isIncomplete || !state.stateType) continue;
      if (state.stateType.isIncomplete) continue;

      if (state.stateType.kind === 'bus') {
        this.validateWidthParameter(state.stateType, paramNames, state.location);
      } else if (state.stateType.kind === 'memory') {
        // Check address and data widths
        if (typeof state.stateType.addressWidth !== 'number') {
          this.validateParameterRef(state.stateType.addressWidth, paramNames, state.location);
        }
        if (typeof state.stateType.dataWidth !== 'number') {
          this.validateParameterRef(state.stateType.dataWidth, paramNames, state.location);
        }
      }
    }
  }

  private validateWidthParameter(
    busType: BusTypeExpr,
    paramNames: Set<string>,
    location: SourceRange
  ): void {
    if (typeof busType.width !== 'number') {
      this.validateParameterRef(busType.width, paramNames, location);
    }
  }

  private validateParameterRef(
    paramRef: ParameterRef,
    paramNames: Set<string>,
    location: SourceRange
  ): void {
    if (!paramNames.has(paramRef.name)) {
      this.addError(
        `Undefined parameter: '${paramRef.name}'`,
        location,
        ['Check parameter spelling', 'Ensure parameter is declared in circuit signature']
      );
    }
  }

  // ==========================================================================
  // Implementation Block Validation
  // ==========================================================================

  private validateImplBlock(circuit: CircuitDef, impl: ImplBlock): void {
    // Check for duplicate node instance names (filter incomplete nodes)
    this.checkDuplicateNames(
      impl.nodes
        .filter((n) => !n.isIncomplete && n.instanceName)
        .map((n) => ({ name: n.instanceName, location: n.location })),
      'node instance'
    );

    // Validate node declarations (component existence if library provided)
    for (const node of impl.nodes) {
      if (node.isIncomplete) continue;
      this.validateNodeDecl(node);
    }

    // Validate connections (skip incomplete ones)
    for (const connection of impl.connections) {
      if (connection.isIncomplete) continue;
      this.validateConnection(circuit, impl, connection);
    }

    // Check for multiple drivers on the same port
    this.checkMultipleDrivers(impl);

    // Validate behavioral statements (skip incomplete ones)
    for (const stmt of impl.statements) {
      if ('isIncomplete' in stmt && stmt.isIncomplete) continue;
      this.validateStatement(circuit, impl, stmt);
    }
  }

  private validateNodeDecl(node: NodeDecl): void {
    // Skip if no component type specified
    if (!node.componentType) return;

    // Check if component exists (only if library provided)
    if (this.options.componentLibrary) {
      const component = this.options.componentLibrary.resolveComponent(node.componentType);

      // Also check if it's a circuit defined in this program
      const isLocalCircuit = this.circuitNames.has(node.componentType);

      if (!component && !isLocalCircuit) {
        const allPrimitives = this.options.componentLibrary.getAllPrimitiveNames();
        this.addError(
          `Unknown component: '${node.componentType}'`,
          node.location,
          this.suggestSimilar(node.componentType, [...allPrimitives, ...this.circuitNames])
        );
      }
    }
  }

  private validateConnection(
    circuit: CircuitDef,
    impl: ImplBlock,
    connection: ConnectionStmt
  ): void {
    // Skip if source or target port refs are incomplete
    if (!connection.source || !connection.target) return;
    if (connection.source.portName === '' || connection.target.portName === '') return;

    // Validate source exists
    this.validatePortRefExists(
      circuit,
      impl,
      connection.source
    );

    // Validate target exists
    this.validatePortRefExists(
      circuit,
      impl,
      connection.target
    );

    // TODO: Type checking would go here (requires component library access)
    // For now, we just check that the ports exist
  }

  private validatePortRefExists(
    circuit: CircuitDef,
    impl: ImplBlock,
    portRef: PortRef
  ): boolean {
    if (isCircuitPort(portRef)) {
      // Circuit-level port
      const allPorts = [
        ...circuit.inputs.map((p) => p.name),
        ...circuit.outputs.map((p) => p.name),
        ...circuit.clocks.map((p) => p.name),
      ];

      if (!allPorts.includes(portRef.portName)) {
        this.addError(
          `Undefined circuit port: '${portRef.portName}'`,
          portRef.location,
          this.suggestSimilar(portRef.portName, allPorts)
        );
        return false;
      }
    } else {
      // Node port
      const node = impl.nodes.find((n) => n.instanceName === portRef.nodeId);
      if (!node) {
        this.addError(
          `Undefined node: '${portRef.nodeId}'`,
          portRef.location,
          this.suggestSimilar(
            portRef.nodeId!,
            impl.nodes.map((n) => n.instanceName)
          )
        );
        return false;
      }

      // NOTE: We cannot validate the port name here because we don't have
      // access to the component library. This will be checked during IR
      // compilation when component definitions are available.
    }

    return true;
  }

  private checkMultipleDrivers(impl: ImplBlock): void {
    const drivers = new Map<string, SourceRange[]>();

    for (const connection of impl.connections) {
      const targetKey = formatPortRef(connection.target);
      if (!drivers.has(targetKey)) {
        drivers.set(targetKey, []);
      }
      drivers.get(targetKey)!.push(connection.location);
    }

    for (const [target, locations] of drivers) {
      if (locations.length > 1) {
        this.addError(
          `Multiple drivers on port: '${target}'`,
          locations[0],
          [
            'Each input port can only have one connection',
            'Remove duplicate connections',
          ]
        );
      }
    }
  }

  // ==========================================================================
  // Statement Validation
  // ==========================================================================

  private validateStatement(
    circuit: CircuitDef,
    impl: ImplBlock,
    stmt: Statement
  ): void {
    if ('clockEdge' in stmt) {
      this.validateOnClockStmt(circuit, impl, stmt);
    } else if ('condition' in stmt) {
      this.validateConditionalStmt(circuit, impl, stmt);
    } else if ('target' in stmt) {
      this.validateAssignment(circuit, impl, stmt);
    }
  }

  private validateOnClockStmt(
    circuit: CircuitDef,
    impl: ImplBlock,
    stmt: OnClockStmt
  ): void {
    // Skip validation if incomplete or missing clock edge
    if (stmt.isIncomplete || !stmt.clockEdge || !stmt.clockEdge.clockRef) return;

    // Check that clock exists
    const clockNames = circuit.clocks.map((c) => c.name);
    if (!clockNames.includes(stmt.clockEdge.clockRef)) {
      this.addError(
        `Undefined clock: '${stmt.clockEdge.clockRef}'`,
        stmt.location,
        this.suggestSimilar(stmt.clockEdge.clockRef, clockNames)
      );
    }

    // Validate body statements
    for (const bodyStmt of stmt.body) {
      if ('isIncomplete' in bodyStmt && bodyStmt.isIncomplete) continue;
      this.validateStatement(circuit, impl, bodyStmt);
    }
  }

  private validateAssignment(
    circuit: CircuitDef,
    impl: ImplBlock,
    stmt: Assignment
  ): void {
    // Skip validation if incomplete or missing target
    if (stmt.isIncomplete || !stmt.target) return;

    // Check that target variable exists (state or output)
    const stateNames = circuit.state.map((s) => s.name);
    const outputNames = circuit.outputs.map((o) => o.name);
    const allVars = [...stateNames, ...outputNames];

    if (!allVars.includes(stmt.target)) {
      this.addError(
        `Undefined variable: '${stmt.target}'`,
        stmt.location,
        this.suggestSimilar(stmt.target, allVars)
      );
    }

    // Validate expression
    if (stmt.value) {
      this.validateExpression(circuit, impl, stmt.value);
    }
  }

  private validateConditionalStmt(
    circuit: CircuitDef,
    impl: ImplBlock,
    stmt: ConditionalStmt
  ): void {
    // Skip validation if incomplete
    if (stmt.isIncomplete) return;

    // Validate condition
    if (stmt.condition) {
      this.validateExpression(circuit, impl, stmt.condition);
    }

    // Validate then body
    for (const bodyStmt of stmt.thenBody) {
      if ('isIncomplete' in bodyStmt && bodyStmt.isIncomplete) continue;
      this.validateStatement(circuit, impl, bodyStmt);
    }

    // Validate else body
    if (stmt.elseBody) {
      for (const bodyStmt of stmt.elseBody) {
        if ('isIncomplete' in bodyStmt && bodyStmt.isIncomplete) continue;
        this.validateStatement(circuit, impl, bodyStmt);
      }
    }
  }

  // ==========================================================================
  // Expression Validation
  // ==========================================================================

  private validateExpression(
    circuit: CircuitDef,
    impl: ImplBlock,
    expr: Expr
  ): void {
    if ('name' in expr) {
      this.validateVariableExpr(circuit, impl, expr);
    } else if ('operator' in expr && 'left' in expr) {
      this.validateBinaryExpr(circuit, impl, expr);
    } else if ('operator' in expr && 'operand' in expr) {
      this.validateUnaryExpr(circuit, impl, expr);
    } else if ('base' in expr) {
      this.validateIndexExpr(circuit, impl, expr);
    }
    // Literals don't need validation
  }

  private validateVariableExpr(
    circuit: CircuitDef,
    _impl: ImplBlock,
    expr: VariableExpr
  ): void {
    // Skip validation if variable name is empty (from incomplete node)
    if (!expr.name) return;

    // Check that variable exists (input, output, state, or clock)
    const inputNames = circuit.inputs.map((i) => i.name);
    const outputNames = circuit.outputs.map((o) => o.name);
    const stateNames = circuit.state.map((s) => s.name);
    const clockNames = circuit.clocks.map((c) => c.name);
    const allVars = [...inputNames, ...outputNames, ...stateNames, ...clockNames];

    if (!allVars.includes(expr.name)) {
      this.addError(
        `Undefined variable: '${expr.name}'`,
        expr.location,
        this.suggestSimilar(expr.name, allVars)
      );
    }
  }

  private validateBinaryExpr(
    circuit: CircuitDef,
    impl: ImplBlock,
    expr: BinaryExpr
  ): void {
    this.validateExpression(circuit, impl, expr.left);
    this.validateExpression(circuit, impl, expr.right);
  }

  private validateUnaryExpr(
    circuit: CircuitDef,
    impl: ImplBlock,
    expr: UnaryExpr
  ): void {
    this.validateExpression(circuit, impl, expr.operand);
  }

  private validateIndexExpr(
    circuit: CircuitDef,
    impl: ImplBlock,
    expr: IndexExpr
  ): void {
    this.validateExpression(circuit, impl, expr.base);
    this.validateExpression(circuit, impl, expr.index);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private checkDuplicateNames(
    items: { name: string; location: SourceRange }[],
    kind: string
  ): void {
    const seen = new Map<string, SourceRange>();
    for (const item of items) {
      if (seen.has(item.name)) {
        this.addError(
          `Duplicate ${kind} name: '${item.name}'`,
          item.location,
          [`First declared at ${this.formatLocation(seen.get(item.name)!)}`]
        );
      }
      seen.set(item.name, item.location);
    }
  }

  private addError(
    message: string,
    location: SourceRange,
    suggestions?: string[]
  ): void {
    this.errors.push({
      message,
      location,
      severity: 'error',
      category: 'semantic',
      suggestions,
    });
  }

  private addWarning(
    message: string,
    location: SourceRange,
    suggestions?: string[]
  ): void {
    this.errors.push({
      message,
      location,
      severity: 'warning',
      category: 'semantic',
      suggestions,
    });
  }

  private formatLocation(location: SourceRange): string {
    return `line ${location.start.line}, column ${location.start.column}`;
  }

  private suggestSimilar(name: string, candidates: string[]): string[] {
    // Simple edit distance based suggestions
    const suggestions: { name: string; distance: number }[] = [];

    for (const candidate of candidates) {
      const distance = this.levenshteinDistance(name.toLowerCase(), candidate.toLowerCase());
      if (distance <= 3) {
        suggestions.push({ name: candidate, distance });
      }
    }

    suggestions.sort((a, b) => a.distance - b.distance);
    const suggested = suggestions.slice(0, 3).map((s) => `Did you mean '${s.name}'?`);

    return suggested.length > 0 ? suggested : ['Check spelling and case sensitivity'];
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Validate a DSL program
 *
 * @param program - The parsed AST
 * @param options - Optional validation options (e.g., componentLibrary for IDE use)
 */
export function validate(program: Program, options?: ValidateOptions): ValidationError[] {
  const validator = new Validator();
  return validator.validate(program, options);
}

/**
 * Validate and throw if there are errors
 */
export function validateOrThrow(program: Program, options?: ValidateOptions): void {
  const errors = validate(program, options);
  if (errors.length > 0) {
    const errorMessages = errors
      .map(
        (e) =>
          `${e.severity.toUpperCase()}: ${e.message} at line ${e.location.start.line}`
      )
      .join('\n');
    throw new ValidationException(`Validation failed:\n${errorMessages}`, errors);
  }
}
