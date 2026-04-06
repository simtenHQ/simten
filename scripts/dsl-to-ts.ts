#!/usr/bin/env npx tsx
/**
 * DSL-to-TypeScript Conversion Script
 *
 * Parses .dsl files using the existing Chevrotain parser and generates
 * equivalent TypeScript builder code using the component() API.
 *
 * Usage:
 *   npx tsx scripts/dsl-to-ts.ts dsl-files/Counter.dsl
 *   npx tsx scripts/dsl-to-ts.ts dsl-files/          # convert all in directory
 *   npx tsx scripts/dsl-to-ts.ts --dry-run dsl-files/Counter.dsl  # print without writing
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, basename, dirname } from 'path';
import { parseDSL } from '../packages/core/src/dsl/parser/index.js';
import type {
  Program,
  CircuitDef,
  NodeDecl,
  ConnectionStmt,
  InputDecl,
  OutputDecl,
  TypeExpr,
  Argument,
} from '../packages/core/src/dsl/types/ast.js';

// ============================================================================
// Code generation
// ============================================================================

function generateTS(program: Program): string {
  const lines: string[] = [];

  // Collect all component names defined in this file for cross-references
  const definedNames = new Set(program.circuits.map(c => c.name));

  // Determine which stdlib components are used
  const usedStdlib = new Set<string>();
  for (const circuit of program.circuits) {
    if (circuit.impl) {
      for (const node of circuit.impl.nodes) {
        if (!definedNames.has(node.componentType)) {
          usedStdlib.add(node.componentType);
        }
      }
    }
  }

  // Generate imports
  lines.push(`import { circuit, bit, bus } from '@turing-incomplete/core/circuit'`);
  if (usedStdlib.size > 0) {
    const sorted = Array.from(usedStdlib).sort();
    lines.push(`import { ${sorted.join(', ')} } from '@turing-incomplete/core/std'`);
  }
  lines.push('');

  // Generate each circuit
  for (const circuit of program.circuits) {
    lines.push(...generateCircuit(circuit, definedNames));
    lines.push('');
  }

  return lines.join('\n');
}

function generateCircuit(circuit: CircuitDef, definedNames: Set<string>): string[] {
  const lines: string[] = [];
  const indent = '  ';

  // Description comment
  if (circuit.description) {
    lines.push(`// ${circuit.description}`);
  }

  lines.push(`export const ${circuit.name} = circuit('${circuit.name}')`);

  // Inputs
  for (const input of circuit.inputs) {
    lines.push(`${indent}.in('${input.name}', ${typeExprToTS(input.portType)})`);
  }

  // Outputs
  for (const output of circuit.outputs) {
    lines.push(`${indent}.out('${output.name}', ${typeExprToTS(output.portType)})`);
  }

  // Metadata
  if (circuit.description) {
    lines.push(`${indent}.meta({ description: ${JSON.stringify(circuit.description)} })`);
  }

  // Nodes and connections (from impl block)
  if (circuit.impl && (circuit.impl.nodes.length > 0 || circuit.impl.connections.length > 0)) {
    // Nodes
    for (const node of circuit.impl.nodes) {
      lines.push(`${indent}.node('${node.instanceName}', ${nodeRef(node, definedNames)})`);
    }

    // Connections
    if (circuit.impl.connections.length > 0) {
      lines.push(`${indent}.connect(({ in: inp, out, ${getNodeNames(circuit.impl.nodes)} }) => [`);
      const grouped = groupConnections(circuit.impl.connections);
      for (const conn of grouped) {
        lines.push(`${indent}${indent}${formatConnection(conn, circuit)},`);
      }
      lines.push(`${indent}])`);
    }
  }

  lines.push(`${indent}.build()`);

  return lines;
}

// ============================================================================
// Type conversion
// ============================================================================

function typeExprToTS(type: TypeExpr): string {
  if (type.kind === 'bit') return 'bit';
  if (type.kind === 'bus') {
    const width = typeof type.width === 'number' ? type.width : type.width.name;
    return `bus(${width})`;
  }
  return 'bit';
}

// ============================================================================
// Node reference
// ============================================================================

function nodeRef(node: NodeDecl, definedNames: Set<string>): string {
  // If this references a user-defined circuit in the same file, use the variable name
  // If it references a stdlib component, use the imported name
  const name = node.componentType;
  const args = formatArguments(node.arguments);
  if (args) {
    // Parameterized: circuit('Mux', { inputs: 4 }) — but in the builder API
    // we don't have parameterized stdlib yet, so we'll pass args differently
    // For now, just reference the component name
    return name;
  }
  return name;
}

function formatArguments(args: Argument[]): string | null {
  if (args.length === 0) return null;
  const pairs = args.map(a => `${a.name}=${JSON.stringify(a.value)}`);
  return pairs.join(', ');
}

// ============================================================================
// Connection formatting
// ============================================================================

interface GroupedConnection {
  source: { nodeId: string | null; portName: string };
  targets: { nodeId: string | null; portName: string }[];
}

function groupConnections(connections: ConnectionStmt[]): GroupedConnection[] {
  // Group connections by source to enable fan-out: source.to(target1, target2)
  const groups = new Map<string, GroupedConnection>();
  for (const conn of connections) {
    const key = portRefKey(conn.source);
    if (!groups.has(key)) {
      groups.set(key, { source: conn.source, targets: [] });
    }
    groups.get(key)!.targets.push(conn.target);
  }
  return Array.from(groups.values());
}

function portRefKey(ref: { nodeId: string | null; portName: string }): string {
  return ref.nodeId ? `${ref.nodeId}.${ref.portName}` : ref.portName;
}

function formatConnection(conn: GroupedConnection, circuit: CircuitDef): string {
  const src = formatPortRef(conn.source, circuit);
  const targets = conn.targets.map(t => formatPortRef(t, circuit));
  return `${src}.to(${targets.join(', ')})`;
}

function formatPortRef(
  ref: { nodeId: string | null; portName: string },
  circuit: CircuitDef,
): string {
  if (ref.nodeId === null || ref.nodeId === '') {
    // Circuit-level port — is it an input or output?
    const isInput = circuit.inputs.some(i => i.name === ref.portName);
    const isOutput = circuit.outputs.some(o => o.name === ref.portName);
    // Clock refs
    const isClock = circuit.clocks.some(c => c.name === ref.portName);

    if (isInput) return `inp.${ref.portName}`;
    if (isOutput) return `out.${ref.portName}`;
    if (isClock) return `inp.${ref.portName}`; // clocks act as inputs
    // Fallback
    return `inp.${ref.portName}`;
  }
  return `${ref.nodeId}.${ref.portName}`;
}

function getNodeNames(nodes: NodeDecl[]): string {
  return nodes.map(n => n.instanceName).join(', ');
}

// ============================================================================
// File processing
// ============================================================================

function convertFile(inputPath: string, dryRun: boolean): { success: boolean; error?: string } {
  try {
    const source = readFileSync(inputPath, 'utf-8');
    const { ast, errors } = parseDSL(source, inputPath);

    if (errors.length > 0) {
      const msgs = errors.map(e => e.message).join('; ');
      return { success: false, error: `Parse errors: ${msgs}` };
    }

    if (ast.circuits.length === 0) {
      return { success: false, error: 'No circuits found' };
    }

    const tsCode = generateTS(ast);
    const outputPath = inputPath.replace(/\.dsl$/, '.circuit.ts');

    if (dryRun) {
      console.log(`\n=== ${basename(inputPath)} → ${basename(outputPath)} ===`);
      console.log(tsCode);
    } else {
      writeFileSync(outputPath, tsCode, 'utf-8');
      console.log(`✓ ${basename(inputPath)} → ${basename(outputPath)}`);
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function processPath(path: string, dryRun: boolean): void {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    const files = readdirSync(path).filter(f => f.endsWith('.dsl') && !f.endsWith('.tb.dsl'));
    let success = 0;
    let failed = 0;
    for (const file of files) {
      const result = convertFile(join(path, file), dryRun);
      if (result.success) {
        success++;
      } else {
        console.error(`✗ ${file}: ${result.error}`);
        failed++;
      }
    }
    console.log(`\nConverted: ${success}, Failed: ${failed}`);
  } else {
    const result = convertFile(path, dryRun);
    if (!result.success) {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
  }
}

// ============================================================================
// CLI
// ============================================================================

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const paths = args.filter(a => !a.startsWith('--'));

if (paths.length === 0) {
  console.log('Usage: npx tsx scripts/dsl-to-ts.ts [--dry-run] <path-or-directory>');
  process.exit(1);
}

for (const p of paths) {
  processPath(p, dryRun);
}
