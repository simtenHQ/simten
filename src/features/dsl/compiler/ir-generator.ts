/**
 * IR Generator (AST → IR Compiler)
 *
 * Converts a validated AST into executable IR.
 *
 * This is where component resolution happens:
 * - String component references in the AST ("Xor", "HalfAdder") are resolved
 *   to actual component definitions from the library
 * - Parameters are evaluated and substituted
 * - Connections are converted to IR connection format
 * - Port paths are converted to runtime identifiers
 *
 * The IR generator requires access to a component library to resolve references.
 */

import {
  Program,
  CircuitDef,
  StateDecl,
  NodeDecl,
  ConnectionStmt,
  PortRef,
  TypeExpr,
  BusTypeExpr,
  ParameterRef,
  Argument,
  ArgumentValue,
  ArrayLiteral,
  ObjectLiteral,
  StateTypeExpr,
  isCircuitPort,
  formatPortRef,
} from '../types/ast';

import {
  Circuit,
  PortDescriptor,
  ClockDescriptor,
  StateBlock,
  Node,
  Connection,
  PortPath,
  PortType,
  StateType,
  Implementation,
  Parameter,
  ParameterType,
  StateValue,
  bitType,
  busType,
  memoryType,
  createPortPath,
} from '../../visual-editor/types/ir-v0.1';

// ============================================================================
// Compiler Error
// ============================================================================

export class CompilerError extends Error {
  constructor(
    message: string,
    public circuitName?: string,
    public location?: { line: number; column: number }
  ) {
    super(message);
    this.name = 'CompilerError';
  }
}

// ============================================================================
// Component Library Interface
// ============================================================================

/**
 * Interface for looking up component definitions during compilation
 */
export interface ComponentLibrary {
  getCircuit(name: string): Circuit | undefined;
  hasCircuit(name: string): boolean;
  getAllComponentNames?(): string[]; // Optional for backward compatibility
}

// ============================================================================
// IR Generator
// ============================================================================

export class IRGenerator {
  private library: ComponentLibrary;
  private currentCircuit?: CircuitDef;

  constructor(library: ComponentLibrary) {
    this.library = library;
  }

  /**
   * Compile a program (multiple circuits) into IR circuits
   */
  public compileProgram(program: Program): Circuit[] {
    const circuits: Circuit[] = [];

    for (const circuitDef of program.circuits) {
      try {
        circuits.push(this.compileCircuit(circuitDef));
      } catch (error) {
        if (error instanceof CompilerError) {
          throw error;
        }
        throw new CompilerError(
          `Failed to compile circuit '${circuitDef.name}': ${error}`,
          circuitDef.name
        );
      }
    }

    return circuits;
  }

  /**
   * Compile a single circuit definition into IR
   */
  public compileCircuit(circuitDef: CircuitDef): Circuit {
    this.currentCircuit = circuitDef;

    // Generate unique ID for this circuit
    const id = this.generateId(circuitDef.name);

    // Compile parameters
    const parameters = this.compileParameters(circuitDef);

    // Compile ports
    const inputs = this.compileInputs(circuitDef);
    const outputs = this.compileOutputs(circuitDef);
    const clocks = this.compileClocks(circuitDef);

    // Compile state
    const state = this.compileState(circuitDef);

    // Determine implementation type
    const implementation = this.determineImplementation(circuitDef);

    // Compile nodes and connections (if composite)
    let nodes: Node[] = [];
    let connections: Connection[] = [];

    if (circuitDef.impl) {
      nodes = this.compileNodes(circuitDef, circuitDef.impl.nodes);
      connections = this.compileConnections(circuitDef, circuitDef.impl.connections, nodes);
    }

    // Build metadata
    const metadata = {
      description: circuitDef.description,
      source: {
        lineNumber: circuitDef.location.start.line,
      },
    };

    return {
      id,
      name: circuitDef.name,
      parameters,
      inputs,
      outputs,
      clocks,
      state,
      nodes,
      connections,
      implementation,
      metadata,
    };
  }

  // ==========================================================================
  // Parameters
  // ==========================================================================

  private compileParameters(circuitDef: CircuitDef): Parameter[] {
    return circuitDef.parameters.map((param) => ({
      name: param.name,
      paramType: param.paramType as ParameterType,
      defaultValue: param.defaultValue,
    }));
  }

  // ==========================================================================
  // Ports
  // ==========================================================================

  private compileInputs(circuitDef: CircuitDef): PortDescriptor[] {
    return circuitDef.inputs.map((input) => ({
      name: input.name,
      portType: this.compilePortType(input.portType, circuitDef),
      description: input.description,
    }));
  }

  private compileOutputs(circuitDef: CircuitDef): PortDescriptor[] {
    return circuitDef.outputs.map((output) => ({
      name: output.name,
      portType: this.compilePortType(output.portType, circuitDef),
      description: output.description,
    }));
  }

  private compileClocks(circuitDef: CircuitDef): ClockDescriptor[] {
    return circuitDef.clocks.map((clock) => ({
      name: clock.name,
      description: clock.description,
    }));
  }

  private compilePortType(typeExpr: TypeExpr, circuitDef: CircuitDef): PortType {
    if (typeExpr.kind === 'bit') {
      return bitType();
    } else if (typeExpr.kind === 'bus') {
      const width = this.evaluateWidth(typeExpr.width, circuitDef);
      return busType(width);
    }
    throw new CompilerError(`Unknown port type: ${(typeExpr as { kind: string }).kind}`);
  }

  private evaluateWidth(
    width: number | ParameterRef,
    circuitDef: CircuitDef
  ): number {
    if (typeof width === 'number') {
      return width;
    }

    // Parameter reference - look up default value
    const param = circuitDef.parameters.find((p) => p.name === width.name);
    if (!param) {
      let errorMsg = `Undefined parameter reference: '${width.name}'`;

      // Suggest similar parameter names
      const paramNames = circuitDef.parameters.map((p) => p.name);
      if (paramNames.length > 0) {
        const similar = this.findSimilarNames(width.name, paramNames);
        if (similar.length > 0) {
          errorMsg += `\n\nDid you mean: ${similar.join(', ')}?`;
        } else {
          errorMsg += `\n\nAvailable parameters: ${paramNames.join(', ')}`;
        }
      } else {
        errorMsg += `\n\nNo parameters defined for this circuit. Add parameters to the circuit signature.`;
      }

      throw new CompilerError(
        errorMsg,
        circuitDef.name,
        { line: width.location.start.line, column: width.location.start.column }
      );
    }

    if (param.defaultValue === undefined) {
      throw new CompilerError(
        `Parameter '${width.name}' has no default value\n\nAdd a default value in the circuit signature, e.g., circuit ${circuitDef.name}<${width.name}: 8>`,
        circuitDef.name,
        { line: width.location.start.line, column: width.location.start.column }
      );
    }

    if (typeof param.defaultValue !== 'number') {
      throw new CompilerError(
        `Parameter '${width.name}' must be a number for width, but got ${typeof param.defaultValue}\n\nWidth parameters must be numeric values.`,
        circuitDef.name,
        { line: width.location.start.line, column: width.location.start.column }
      );
    }

    return param.defaultValue;
  }

  // ==========================================================================
  // State
  // ==========================================================================

  private compileState(circuitDef: CircuitDef): StateBlock[] {
    return circuitDef.state.map((stateDef) => {
      const stateType = this.compileStateType(stateDef.stateType, circuitDef);
      const initialValue = this.getInitialValue(stateDef, stateType);

      return {
        id: this.generateId(`${circuitDef.name}_state_${stateDef.name}`),
        name: stateDef.name,
        stateType,
        initialValue,
      };
    });
  }

  private compileStateType(typeExpr: StateTypeExpr, circuitDef: CircuitDef): StateType {
    if (typeExpr.kind === 'bit') {
      return bitType();
    } else if (typeExpr.kind === 'bus') {
      const width = this.evaluateWidth(typeExpr.width, circuitDef);
      return busType(width);
    } else if (typeExpr.kind === 'memory') {
      const addressWidth =
        typeof typeExpr.addressWidth === 'number'
          ? typeExpr.addressWidth
          : this.evaluateWidth(typeExpr.addressWidth, circuitDef);
      const dataWidth =
        typeof typeExpr.dataWidth === 'number'
          ? typeExpr.dataWidth
          : this.evaluateWidth(typeExpr.dataWidth, circuitDef);
      return memoryType(addressWidth, dataWidth);
    }
    throw new CompilerError(`Unknown state type: ${(typeExpr as { kind: string }).kind}`);
  }

  private getInitialValue(stateDef: StateDecl, stateType: StateType): StateValue {
    if (stateDef.initialValue !== undefined) {
      // Use provided initial value
      if (stateType.kind === 'bit') {
        return Boolean(stateDef.initialValue);
      } else if (stateType.kind === 'bus') {
        return Number(stateDef.initialValue);
      }
    }

    // Default values
    if (stateType.kind === 'bit') {
      return false;
    } else if (stateType.kind === 'bus') {
      return 0;
    } else if (stateType.kind === 'memory') {
      return {
        data: new Map(),
        addressWidth: stateType.addressWidth,
        dataWidth: stateType.dataWidth,
      };
    }

    throw new CompilerError(`Cannot determine initial value for state type`);
  }

  // ==========================================================================
  // Implementation
  // ==========================================================================

  private determineImplementation(circuitDef: CircuitDef): Implementation {
    if (!circuitDef.impl) {
      // No impl block = primitive component
      return { kind: 'primitive' };
    }

    // Has impl block = composite component
    return { kind: 'composite' };
  }

  // ==========================================================================
  // Nodes
  // ==========================================================================

  private compileNodes(circuitDef: CircuitDef, nodeDefs: NodeDecl[]): Node[] {
    return nodeDefs.map((nodeDef) => this.compileNode(circuitDef, nodeDef));
  }

  private compileNode(circuitDef: CircuitDef, nodeDef: NodeDecl): Node {
    // Resolve component reference
    const componentCircuit = this.library.getCircuit(nodeDef.componentType);
    if (!componentCircuit) {
      // Build helpful error message with suggestions
      let errorMsg = `Cannot resolve component: '${nodeDef.componentType}'`;

      // Check for common typos/similar names
      const availableComponents = this.getAvailableComponentNames();
      const similar = this.findSimilarNames(nodeDef.componentType, availableComponents);

      if (similar.length > 0) {
        errorMsg += `\n\nDid you mean: ${similar.join(', ')}?`;
      } else if (availableComponents.length > 0) {
        errorMsg += `\n\nAvailable components: ${availableComponents.slice(0, 10).join(', ')}${availableComponents.length > 10 ? '...' : ''}`;
      }

      throw new CompilerError(
        errorMsg,
        circuitDef.name,
        { line: nodeDef.location.start.line, column: nodeDef.location.start.column }
      );
    }

    // Compile arguments
    const args = this.compileArguments(nodeDef.arguments, circuitDef);

    // Create port instances from component definition
    const inputs = componentCircuit.inputs.map((portDesc) => ({
      id: this.generateId(`${nodeDef.instanceName}_${portDesc.name}`),
      name: portDesc.name,
      portType: this.instantiatePortType(portDesc.portType, args),
    }));

    const outputs = componentCircuit.outputs.map((portDesc) => ({
      id: this.generateId(`${nodeDef.instanceName}_${portDesc.name}`),
      name: portDesc.name,
      portType: this.instantiatePortType(portDesc.portType, args),
    }));

    const clockInstances = componentCircuit.clocks.map((clockDesc) => ({
      id: this.generateId(`${nodeDef.instanceName}_${clockDesc.name}`),
      name: clockDesc.name,
    }));

    return {
      id: this.generateId(`${circuitDef.name}_${nodeDef.instanceName}`),
      label: nodeDef.instanceName,
      componentRef: nodeDef.componentType,
      arguments: args,
      inputs,
      outputs,
      clocks: clockInstances,
    };
  }

  private compileArguments(
    args: Argument[],
    circuitDef: CircuitDef
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const arg of args) {
      const value = this.evaluateArgument(arg.value, circuitDef);
      result[arg.name] = value;
    }

    return result;
  }

  private evaluateArgument(
    value: ArgumentValue,
    circuitDef: CircuitDef
  ): any {
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
      return value;
    }

    // Array literal: [1, 2, 3]
    if (typeof value === 'object' && 'kind' in value && value.kind === 'array') {
      return value.elements.map((elem) => this.evaluateArgument(elem, circuitDef));
    }

    // Object literal: {64: 3, 65: 4}
    if (typeof value === 'object' && 'kind' in value && value.kind === 'object') {
      const result: Record<number, any> = {};
      for (const entry of value.entries) {
        result[entry.key] = this.evaluateArgument(entry.value, circuitDef);
      }
      return result;
    }

    // Parameter reference
    if (typeof value === 'object' && 'name' in value) {
      const param = circuitDef.parameters.find((p) => p.name === value.name);
      if (!param || param.defaultValue === undefined) {
        throw new CompilerError(
          `Cannot resolve parameter: '${value.name}'`,
          circuitDef.name,
          { line: value.location.start.line, column: value.location.start.column }
        );
      }
      return param.defaultValue;
    }

    throw new CompilerError(
      `Unknown argument value type: ${JSON.stringify(value)}`,
      circuitDef.name
    );
  }

  private instantiatePortType(
    portType: PortType,
    _args: Record<string, number | string | boolean>
  ): PortType {
    // TODO: Handle parameterized port types
    // For now, just return the port type as-is
    return portType;
  }

  // ==========================================================================
  // Connections
  // ==========================================================================

  private compileConnections(
    circuitDef: CircuitDef,
    connectionDefs: ConnectionStmt[],
    nodes: Node[]
  ): Connection[] {
    return connectionDefs.map((conn) =>
      this.compileConnection(circuitDef, conn, nodes)
    );
  }

  private compileConnection(
    circuitDef: CircuitDef,
    conn: ConnectionStmt,
    nodes: Node[]
  ): Connection {
    const source = this.compilePortPath(circuitDef, conn.source, nodes);
    const target = this.compilePortPath(circuitDef, conn.target, nodes);

    // Get port type from source (for now, assume compatible)
    const portType = this.getPortType(circuitDef, conn.source, nodes);

    return {
      id: this.generateId(`conn_${formatPortRef(conn.source)}_${formatPortRef(conn.target)}`),
      source,
      target,
      portType,
    };
  }

  private compilePortPath(
    circuitDef: CircuitDef,
    portRef: PortRef,
    nodes: Node[]
  ): PortPath {
    if (isCircuitPort(portRef)) {
      // Circuit-level port
      return createPortPath('', portRef.portName);
    } else {
      // Node port
      const node = nodes.find((n) => n.label === portRef.nodeId);
      if (!node) {
        const nodeId = portRef.nodeId!; // Safe because we're in else branch of isCircuitPort
        let errorMsg = `Cannot find node: '${nodeId}'`;

        // Suggest similar node names
        const nodeNames = nodes.map((n) => n.label).filter((label): label is string => label !== undefined);
        if (nodeNames.length > 0) {
          const similar = this.findSimilarNames(nodeId, nodeNames);
          if (similar.length > 0) {
            errorMsg += `\n\nDid you mean: ${similar.join(', ')}?`;
          } else {
            errorMsg += `\n\nAvailable nodes: ${nodeNames.join(', ')}`;
          }
        } else {
          errorMsg += `\n\nNo nodes defined in this circuit. Add node declarations in the impl block.`;
        }

        throw new CompilerError(
          errorMsg,
          circuitDef.name,
          { line: portRef.location.start.line, column: portRef.location.start.column }
        );
      }

      return createPortPath(node.id, portRef.portName);
    }
  }

  private getPortType(
    circuitDef: CircuitDef,
    portRef: PortRef,
    nodes: Node[]
  ): PortType {
    if (isCircuitPort(portRef)) {
      // Circuit-level port
      const input = circuitDef.inputs.find((i) => i.name === portRef.portName);
      if (input) {
        return this.compilePortType(input.portType, circuitDef);
      }

      const output = circuitDef.outputs.find((o) => o.name === portRef.portName);
      if (output) {
        return this.compilePortType(output.portType, circuitDef);
      }

      // Build helpful error message
      let errorMsg = `Cannot find circuit port: '${portRef.portName}'`;

      const inputNames = circuitDef.inputs.map((i) => i.name);
      const outputNames = circuitDef.outputs.map((o) => o.name);
      const clockNames = circuitDef.clocks.map((c) => c.name);
      const allPortNames = [...inputNames, ...outputNames, ...clockNames];

      // Check for similar port names
      if (allPortNames.length > 0) {
        const similar = this.findSimilarNames(portRef.portName, allPortNames);
        if (similar.length > 0) {
          errorMsg += `\n\nDid you mean: ${similar.join(', ')}?`;
        }

        // Show available ports
        errorMsg += `\n\nAvailable ports:`;
        if (inputNames.length > 0) {
          errorMsg += `\n  Inputs: ${inputNames.join(', ')}`;
        }
        if (outputNames.length > 0) {
          errorMsg += `\n  Outputs: ${outputNames.join(', ')}`;
        }
        if (clockNames.length > 0) {
          errorMsg += `\n  Clocks: ${clockNames.join(', ')}`;
        }
      } else {
        errorMsg += `\n\nNo ports defined for this circuit. Add port declarations to the circuit signature.`;
      }

      throw new CompilerError(
        errorMsg,
        circuitDef.name,
        { line: portRef.location.start.line, column: portRef.location.start.column }
      );
    } else {
      // Node port
      const node = nodes.find((n) => n.label === portRef.nodeId);
      if (!node) {
        const nodeId = portRef.nodeId!; // Safe because we're in else branch of isCircuitPort
        let errorMsg = `Cannot find node: '${nodeId}'`;

        // Suggest similar node names
        const nodeNames = nodes.map((n) => n.label).filter((label): label is string => label !== undefined);
        if (nodeNames.length > 0) {
          const similar = this.findSimilarNames(nodeId, nodeNames);
          if (similar.length > 0) {
            errorMsg += `\n\nDid you mean: ${similar.join(', ')}?`;
          } else {
            errorMsg += `\n\nAvailable nodes: ${nodeNames.join(', ')}`;
          }
        } else {
          errorMsg += `\n\nNo nodes defined in this circuit. Add node declarations in the impl block.`;
        }

        throw new CompilerError(
          errorMsg,
          circuitDef.name,
          { line: portRef.location.start.line, column: portRef.location.start.column }
        );
      }

      const port = [...node.inputs, ...node.outputs].find((p) => p.name === portRef.portName);
      if (!port) {
        // Build helpful error message with available ports
        const allPorts = [...node.inputs, ...node.outputs];
        const portNames = allPorts.map((p) => p.name);
        const inputNames = node.inputs.map((p) => p.name);
        const outputNames = node.outputs.map((p) => p.name);

        let errorMsg = `Cannot find port '${portRef.portName}' on node '${portRef.nodeId}' (type: ${node.componentRef})`;

        // Check for similar port names
        const similar = this.findSimilarNames(portRef.portName, portNames);
        if (similar.length > 0) {
          errorMsg += `\n\nDid you mean: ${similar.join(', ')}?`;
        }

        // Show available ports
        errorMsg += `\n\nAvailable ports:`;
        if (inputNames.length > 0) {
          errorMsg += `\n  Inputs: ${inputNames.join(', ')}`;
        }
        if (outputNames.length > 0) {
          errorMsg += `\n  Outputs: ${outputNames.join(', ')}`;
        }

        throw new CompilerError(
          errorMsg,
          circuitDef.name,
          { line: portRef.location.start.line, column: portRef.location.start.column }
        );
      }

      return port.portType;
    }
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private generateId(base: string): string {
    // Simple ID generation (in production, use UUIDs or proper unique IDs)
    return `${base}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get list of available component names from the library
   * Note: This is a best-effort method - ComponentLibrary interface doesn't expose a list method,
   * so we can't reliably get all available components. Return empty array for now.
   */
  private getAvailableComponentNames(): string[] {
    // Use getAllComponentNames if available (provided by the library store)
    if (this.library.getAllComponentNames) {
      return this.library.getAllComponentNames();
    }
    // Fallback to empty array if not available (backward compatibility)
    return [];
  }

  /**
   * Find similar names using Levenshtein distance
   */
  private findSimilarNames(target: string, candidates: string[], threshold: number = 3): string[] {
    const similar: Array<{ name: string; distance: number }> = [];

    for (const candidate of candidates) {
      const distance = this.levenshteinDistance(target.toLowerCase(), candidate.toLowerCase());
      if (distance <= threshold) {
        similar.push({ name: candidate, distance });
      }
    }

    // Sort by distance (closest first) and return names
    return similar
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map((s) => s.name);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[len1][len2];
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Compile a DSL program to IR circuits
 */
export function compileToIR(program: Program, library: ComponentLibrary): Circuit[] {
  const generator = new IRGenerator(library);
  return generator.compileProgram(program);
}

/**
 * Compile a single circuit to IR
 */
export function compileCircuitToIR(
  circuitDef: CircuitDef,
  library: ComponentLibrary
): Circuit {
  const generator = new IRGenerator(library);
  return generator.compileCircuit(circuitDef);
}
