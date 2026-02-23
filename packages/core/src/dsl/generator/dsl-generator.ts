/**
 * DSL Generator - Circuit IR → DSL Code
 *
 * Generates DSL source code from Circuit IR (v0.1).
 * Used for bidirectional sync: canvas edits → DSL updates.
 *
 * Design:
 * - Template-based generation (not AST serialization)
 * - Preserves structure, not formatting or comments
 * - Parameter values from circuit.arguments
 */

import type { Circuit, PortType, PortPath } from '../../types/circuit.js';

/**
 * Convert PortType to DSL type string
 */
function portTypeToString(portType: PortType): string {
  switch (portType.kind) {
    case 'bit':
      return 'Bit';
    case 'bus':
      return `Bus[${portType.width}]`;
    default:
      // Exhaustiveness check
      const _exhaustive: never = portType;
      throw new Error(`Unknown port type: ${_exhaustive}`);
  }
}

/**
 * Generate circuit header with parameters
 */
function generateHeader(circuit: Circuit): string {
  let header = `circuit ${circuit.name}`;

  // Add parameters if present
  if (circuit.parameters.length > 0) {
    const params = circuit.parameters
      .map((p) => {
        if (p.defaultValue !== undefined) {
          return `${p.name}: ${p.defaultValue}`;
        }
        return p.name;
      })
      .join(', ');
    header += `<${params}>`;
  }

  return header;
}

/**
 * Generate port declarations (inputs, outputs, clocks)
 */
function generatePorts(circuit: Circuit): string[] {
  const lines: string[] = [];

  // Inputs
  circuit.inputs.forEach((input) => {
    const type = portTypeToString(input.portType);
    lines.push(`  input ${input.name}: ${type}`);
  });

  // Outputs
  circuit.outputs.forEach((output) => {
    const type = portTypeToString(output.portType);
    lines.push(`  output ${output.name}: ${type}`);
  });

  // Clocks
  circuit.clocks.forEach((clock) => {
    lines.push(`  clock ${clock.name}`);
  });

  return lines;
}

/**
 * Generate state declarations
 */
function generateState(circuit: Circuit): string[] {
  const lines: string[] = [];

  if (circuit.state.length === 0) return lines;

  lines.push('  state {');

  circuit.state.forEach((stateBlock) => {
    let stateLine = `    ${stateBlock.name}: `;

    if (stateBlock.stateType.kind === 'bit') {
      stateLine += 'Bit';
    } else if (stateBlock.stateType.kind === 'bus') {
      stateLine += `Bus[${stateBlock.stateType.width}]`;
    } else if (stateBlock.stateType.kind === 'memory') {
      stateLine += `Memory[${stateBlock.stateType.addressWidth}, ${stateBlock.stateType.dataWidth}]`;
    }

    // Add initial value if present
    if (stateBlock.initialValue !== undefined) {
      stateLine += ` = ${stateBlock.initialValue}`;
    }

    lines.push(stateLine);
  });

  lines.push('  }');

  return lines;
}

/**
 * Generate node declarations
 */
function generateNodes(circuit: Circuit): string[] {
  const lines: string[] = [];

  circuit.nodes.forEach((node) => {
    let line = `    node ${node.label || node.id}: ${node.componentRef}`;

    // Add arguments if present
    if (Object.keys(node.arguments).length > 0) {
      const args = Object.entries(node.arguments)
        .map(([key, value]) => {
          // Format argument value based on type
          if (typeof value === 'string') {
            return `${key} = "${value}"`;
          } else {
            return `${key} = ${value}`;
          }
        })
        .join(', ');
      line += `(${args})`;
    }

    lines.push(line);
  });

  return lines;
}

/**
 * Format a port path to DSL syntax
 */
function formatPortPath(portPath: PortPath, circuit: Circuit): string {
  if (portPath.nodeId === '') {
    // Circuit-level port
    return portPath.portName;
  } else {
    // Node port: find node label
    const node = circuit.nodes.find((n) => n.id === portPath.nodeId);
    if (!node) {
      // Fallback to nodeId if node not found (shouldn't happen)
      console.warn(`Node ${portPath.nodeId} not found`);
      return `${portPath.nodeId}.${portPath.portName}`;
    }
    const label = node.label || node.id;
    return `${label}.${portPath.portName}`;
  }
}

/**
 * Generate connection statements
 */
function generateConnections(circuit: Circuit): string[] {
  const lines: string[] = [];

  circuit.connections.forEach((conn) => {
    const source = formatPortPath(conn.source, circuit);
    const target = formatPortPath(conn.target, circuit);
    lines.push(`    connect ${source} -> ${target}`);
  });

  return lines;
}

/**
 * Generate complete DSL source code from Circuit IR
 *
 * @param circuit - Circuit IR to convert to DSL
 * @returns DSL source code as string
 */
export function generateDSL(circuit: Circuit): string {
  const lines: string[] = [];

  // Header
  lines.push(generateHeader(circuit) + ' {');

  // Ports
  const portLines = generatePorts(circuit);
  if (portLines.length > 0) {
    lines.push(...portLines);
  }

  // State (if any)
  const stateLines = generateState(circuit);
  if (stateLines.length > 0) {
    lines.push('');
    lines.push(...stateLines);
  }

  // Implementation block
  if (circuit.implementation.kind === 'composite') {
    // Only composite circuits have impl blocks
    const nodeLines = generateNodes(circuit);
    const connLines = generateConnections(circuit);

    if (nodeLines.length > 0 || connLines.length > 0) {
      lines.push('');
      lines.push('  impl {');

      // Nodes
      if (nodeLines.length > 0) {
        lines.push(...nodeLines);
      }

      // Blank line between nodes and connections (if both exist)
      if (nodeLines.length > 0 && connLines.length > 0) {
        lines.push('');
      }

      // Connections
      if (connLines.length > 0) {
        lines.push(...connLines);
      }

      lines.push('  }');
    }
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate DSL for multiple circuits
 *
 * @param circuits - Array of circuits to convert
 * @returns DSL source code with all circuits
 */
export function generateDSLMultiple(circuits: Circuit[]): string {
  return circuits.map((circuit) => generateDSL(circuit)).join('\n\n');
}
