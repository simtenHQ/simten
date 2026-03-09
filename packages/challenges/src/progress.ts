/**
 * Challenge progress checking
 *
 * Compares user DSL against solution by extracting and diffing connections.
 * Uses @turing-incomplete/core for DSL parsing only.
 */

import { parseDSL } from '@turing-incomplete/core/dsl';

export interface ProgressResult {
  totalExpected: number;
  correct: number;
  missing: number;
  extra: number;
  complete: boolean;
  feedback: string[];
}

/**
 * Normalize a connection to canonical form "nodeId.portName -> nodeId.portName"
 */
function formatConnection(
  source: { nodeId: string | null; portName: string },
  target: { nodeId: string | null; portName: string },
): string {
  const s = source.nodeId ? `${source.nodeId}.${source.portName}` : source.portName;
  const t = target.nodeId ? `${target.nodeId}.${target.portName}` : target.portName;
  return `${s} -> ${t}`;
}

/**
 * Extract normalized connection strings from DSL source
 */
export function extractConnections(source: string): string[] {
  const { ast, errors } = parseDSL(source, 'challenge');
  if (errors.length > 0 || ast.circuits.length === 0) {
    return [];
  }

  const circuit = ast.circuits[ast.circuits.length - 1];
  if (!circuit.impl) return [];

  return circuit.impl.connections.map(c =>
    formatConnection(c.source, c.target)
  );
}

/**
 * Extract node declarations from DSL source, returning a map of instanceName -> componentType
 */
function extractNodes(source: string): Map<string, string> {
  const { ast, errors } = parseDSL(source, 'challenge');
  if (errors.length > 0 || ast.circuits.length === 0) {
    return new Map();
  }

  const circuit = ast.circuits[ast.circuits.length - 1];
  if (!circuit.impl) return new Map();

  const map = new Map<string, string>();
  for (const node of circuit.impl.nodes) {
    map.set(node.instanceName, node.componentType);
  }
  return map;
}

/**
 * Check user's progress against a solution.
 * Feedback groups missing connections by target node — never reveals exact connections.
 */
export function checkProgress(userSource: string, solutionSource: string): ProgressResult {
  const userConns = new Set(extractConnections(userSource));
  const solutionConns = new Set(extractConnections(solutionSource));
  const nodes = extractNodes(solutionSource);

  const correct = [...solutionConns].filter(c => userConns.has(c)).length;
  const missingConns = [...solutionConns].filter(c => !userConns.has(c));
  const extraConns = [...userConns].filter(c => !solutionConns.has(c));

  const feedback: string[] = [];

  // Group missing connections by target node for Socratic feedback
  if (missingConns.length > 0) {
    const byTarget = new Map<string, number>();
    for (const conn of missingConns) {
      const target = conn.split(' -> ')[1];
      const nodeName = target.split('.')[0];
      const nodeType = nodes.get(nodeName) ?? nodeName;
      const label = `${nodeName} (${nodeType})`;
      byTarget.set(label, (byTarget.get(label) ?? 0) + 1);
    }
    for (const [label, count] of byTarget) {
      feedback.push(`Missing ${count} connection${count > 1 ? 's' : ''} to ${label}`);
    }

    // Also note missing by source
    const bySource = new Map<string, number>();
    for (const conn of missingConns) {
      const source = conn.split(' -> ')[0];
      const nodeName = source.split('.')[0];
      const nodeType = nodes.get(nodeName) ?? nodeName;
      const label = `${nodeName} (${nodeType})`;
      bySource.set(label, (bySource.get(label) ?? 0) + 1);
    }
    for (const [label, count] of bySource) {
      feedback.push(`Missing ${count} connection${count > 1 ? 's' : ''} from ${label}`);
    }
  }

  // Extra connections are fine to list explicitly (user already knows about them)
  for (const conn of extraConns) {
    feedback.push(`Extra connection: ${conn}`);
  }

  if (correct === solutionConns.size && extraConns.length === 0) {
    feedback.push('All connections are correct!');
  }

  return {
    totalExpected: solutionConns.size,
    correct,
    missing: missingConns.length,
    extra: extraConns.length,
    complete: correct === solutionConns.size,
    feedback,
  };
}
