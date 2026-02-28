/**
 * Structural Validation Checks
 *
 * Performs structural validation on elaborated (flattened) circuits:
 * - Combinational cycle detection using Tarjan's SCC algorithm
 * - Floating input detection
 * - Floating output detection
 *
 * Design Principles:
 * - Two-pass cycle detection: quick check, then precise reporting
 * - Sequential elements (registers) break cycles - they are legal feedback paths
 * - Use component metadata, NOT hardcoded names, for classification
 * - Each SCC generates ONE atomic diagnostic for LLM fixing
 * - Deterministic output ordering (sorted alphabetically)
 */

import type {
  FlatCircuit,
  FlatNode,
  ComponentLibrary,
} from '../../types/simulator.js';
import { TOP_LEVEL_NODE } from '../../types/simulator.js';
import type {
  Diagnostic,
  CycleCheckResult,
  StructuralCheckResult,
} from './types.js';

// ============================================================================
// Combinational Graph Building
// ============================================================================

/**
 * Graph representation for cycle detection.
 * Maps node ID to set of dependent node IDs.
 */
type CombinationalGraph = Map<string, Set<string>>;

/**
 * Build a graph of COMBINATIONAL nodes only.
 * Skip edges FROM sequential outputs (Register.q, DFlipFlop.q)
 * Skip edges TO sequential inputs (Register.d, DFlipFlop.d)
 * These BREAK cycles - they are legal feedback paths.
 */
export function buildCombinationalGraph(
  flat: FlatCircuit,
  library: ComponentLibrary
): CombinationalGraph {
  const graph: CombinationalGraph = new Map();

  // Initialize all nodes in the graph
  for (const node of flat.nodes) {
    graph.set(node.id, new Set());
  }

  // Build maps for quick lookup
  const sequentialNodes = new Set<string>();  // Outputs don't depend on inputs
  const clockedNodes = new Set<string>();     // Has clocked state (may have combinational reads)
  const sinkNodes = new Set<string>();        // Terminal nodes (displays, etc.)
  for (const node of flat.nodes) {
    if (isSequentialComponent(node, library)) {
      sequentialNodes.add(node.id);
    }
    if (hasClockedState(node, library)) {
      clockedNodes.add(node.id);
    }
    if (isSinkComponent(node, library)) {
      sinkNodes.add(node.id);
    }
  }

  // Add edges for combinational connections only
  for (const conn of flat.connections) {
    const sourceId = conn.source.nodeId;
    const targetId = conn.target.nodeId;

    // Skip top-level connections
    if (sourceId === TOP_LEVEL_NODE || targetId === TOP_LEVEL_NODE) {
      continue;
    }

    // Skip if source is not in graph (shouldn't happen, but defensive)
    if (!graph.has(sourceId)) {
      continue;
    }

    // Skip edges FROM sequential nodes (their outputs don't depend on current inputs)
    if (sequentialNodes.has(sourceId)) {
      continue;
    }

    // Skip edges FROM sink nodes (displays, audio, etc.)
    // Their outputs are for DMA/display purposes, not combinational feedback
    if (sinkNodes.has(sourceId)) {
      continue;
    }

    // Skip edges TO clocked input ports (d, data_in, we, etc.)
    // These break cycles because writes happen on clock edges
    // This applies to ANY clocked component (including RAM with combinational reads)
    if (clockedNodes.has(targetId)) {
      const targetPort = conn.target.portName;
      if (isSequentialInputPort(targetPort)) {
        continue;
      }
    }

    // Add the edge
    graph.get(sourceId)?.add(targetId);
  }

  return graph;
}

/**
 * Check if a component is sequential (outputs don't depend on current inputs).
 * Use metadata-driven classification for extensibility.
 * Do not hardcode "Register" or "DFlipFlop".
 */
function isSequentialComponent(node: FlatNode, library: ComponentLibrary): boolean {
  const component = library.resolveComponent(node.primitiveType);
  if (!component) return false;

  // Check metadata for sequential classification
  if (component.metadata?.kind === 'sequential') {
    return true;
  }

  // Fallback: check outputDependency for state-only components
  if (component.metadata?.outputDependency === 'state-only') {
    return true;
  }

  return false;
}

/**
 * Check if a component has clocked state (even if reads are combinational).
 * This includes RAM which has combinational reads but clocked writes.
 * Edges TO clocked input ports on these components break cycles.
 */
function hasClockedState(node: FlatNode, library: ComponentLibrary): boolean {
  const component = library.resolveComponent(node.primitiveType);
  if (!component) return false;

  // Component has clocks = has clocked state
  if (component.clocks && component.clocks.length > 0) {
    return true;
  }

  // Component has state blocks = has state
  if (component.state && component.state.length > 0) {
    return true;
  }

  return false;
}

/**
 * Check if a component is a sink (display, audio, etc.).
 * Sink components consume signals but their outputs don't feed back into the circuit.
 * They should be excluded from cycle detection as source nodes.
 */
function isSinkComponent(node: FlatNode, library: ComponentLibrary): boolean {
  const component = library.resolveComponent(node.primitiveType);
  if (!component) return false;

  return component.metadata?.kind === 'sink';
}

/**
 * Check if a port is a sequential input (clocked input).
 * These ports break combinational cycles.
 */
function isSequentialInputPort(portName: string): boolean {
  // Common sequential input port names
  const sequentialInputs = new Set([
    'd',        // D flip-flop data input
    'data',     // Generic data input
    'data_in',  // RAM/ROM data input
    'dataA',    // Dual-port memory
    'dataB',
    'we',       // Write enable
    'weA',
    'weB',
  ]);
  return sequentialInputs.has(portName);
}

// ============================================================================
// Tarjan's SCC Algorithm
// ============================================================================

interface TarjanState {
  index: number;
  stack: string[];
  indices: Map<string, number>;
  lowlinks: Map<string, number>;
  onStack: Set<string>;
  sccs: string[][];
}

/**
 * Find all strongly connected components using Tarjan's algorithm.
 * Returns SCCs in reverse topological order.
 */
function tarjanSCC(graph: CombinationalGraph): string[][] {
  const state: TarjanState = {
    index: 0,
    stack: [],
    indices: new Map(),
    lowlinks: new Map(),
    onStack: new Set(),
    sccs: [],
  };

  // Process nodes in sorted order for deterministic results
  const sortedNodes = Array.from(graph.keys()).sort();

  for (const node of sortedNodes) {
    if (!state.indices.has(node)) {
      strongconnect(node, graph, state);
    }
  }

  return state.sccs;
}

function strongconnect(
  v: string,
  graph: CombinationalGraph,
  state: TarjanState
): void {
  // Set the depth index for v to the smallest unused index
  state.indices.set(v, state.index);
  state.lowlinks.set(v, state.index);
  state.index++;
  state.stack.push(v);
  state.onStack.add(v);

  // Consider successors of v
  const successors = graph.get(v) ?? new Set();
  // Sort successors for deterministic traversal
  const sortedSuccessors = Array.from(successors).sort();

  for (const w of sortedSuccessors) {
    if (!state.indices.has(w)) {
      // Successor w has not yet been visited; recurse on it
      strongconnect(w, graph, state);
      state.lowlinks.set(
        v,
        Math.min(state.lowlinks.get(v)!, state.lowlinks.get(w)!)
      );
    } else if (state.onStack.has(w)) {
      // Successor w is in stack and hence in the current SCC
      state.lowlinks.set(
        v,
        Math.min(state.lowlinks.get(v)!, state.indices.get(w)!)
      );
    }
  }

  // If v is a root node, pop the stack and generate an SCC
  if (state.lowlinks.get(v) === state.indices.get(v)) {
    const scc: string[] = [];
    let w: string;
    do {
      w = state.stack.pop()!;
      state.onStack.delete(w);
      scc.push(w);
    } while (w !== v);

    state.sccs.push(scc);
  }
}

// ============================================================================
// Cycle Detection
// ============================================================================

/**
 * Quick cycle detection using the existing topological sort.
 * Returns true if a cycle exists.
 */
export function hasCycle(graph: CombinationalGraph): boolean {
  // Use Kahn's algorithm for quick check
  const inDegree = new Map<string, number>();
  for (const node of graph.keys()) {
    inDegree.set(node, 0);
  }

  for (const successors of graph.values()) {
    for (const succ of successors) {
      inDegree.set(succ, (inDegree.get(succ) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [node, degree] of inDegree) {
    if (degree === 0) {
      queue.push(node);
    }
  }

  let processed = 0;
  while (queue.length > 0) {
    const node = queue.shift()!;
    processed++;

    for (const succ of graph.get(node) ?? []) {
      const newDegree = (inDegree.get(succ) ?? 0) - 1;
      inDegree.set(succ, newDegree);
      if (newDegree === 0) {
        queue.push(succ);
      }
    }
  }

  return processed !== graph.size;
}

/**
 * Find all cycles in the graph using Tarjan's SCC algorithm.
 * Returns non-trivial SCCs (size > 1 = cycle).
 */
function findCycles(graph: CombinationalGraph): string[][] {
  const sccs = tarjanSCC(graph);
  const multiNodeCycles = sccs.filter(scc => scc.length > 1);

  // Also detect self-loops (single node with edge to itself)
  const selfLoops = [...graph.entries()]
    .filter(([node, successors]) => successors.has(node))
    .map(([node]) => [node]);

  return [...multiNodeCycles, ...selfLoops];
}

/**
 * Convert cycles to diagnostics.
 * IMPORTANT: Each SCC generates ONE atomic diagnostic.
 * Don't collapse multiple cycles into one giant message.
 * LLMs fix things better when errors are atomic.
 */
function cyclesToDiagnostics(cycles: string[][]): Diagnostic[] {
  return cycles.map(scc => {
    // CRITICAL: Sort SCC nodes alphabetically for deterministic output
    // Tarjan traversal order depends on graph iteration order
    const sortedScc = [...scc].sort();

    // Format cycle path for human readability
    const cyclePath = sortedScc.join(' -> ') + ' -> ' + sortedScc[0];

    return {
      phase: 'structural' as const,
      code: 'COMBINATIONAL_CYCLE' as const,
      severity: 'error' as const,
      message: `Combinational cycle detected: ${cyclePath}`,
      involvedNodes: sortedScc,
      suggestions: [
        'Break the cycle by adding a Register',
        'Use a DFlipFlop to create a clocked feedback path',
        'Check if feedback is intentional - sequential feedback is allowed',
      ],
    };
  });
}

/**
 * Check for combinational cycles in the elaborated circuit.
 * Two-pass approach: quick detection, then precise reporting.
 */
export function checkCycles(
  flat: FlatCircuit,
  library: ComponentLibrary
): CycleCheckResult {
  const graph = buildCombinationalGraph(flat, library);

  // Quick check first
  if (!hasCycle(graph)) {
    return {
      hasCycle: false,
      cycles: [],
      diagnostics: [],
    };
  }

  // Precise reporting with Tarjan's SCC
  const cycles = findCycles(graph);
  const diagnostics = cyclesToDiagnostics(cycles);

  return {
    hasCycle: true,
    cycles,
    diagnostics,
  };
}

// ============================================================================
// Floating Input Detection
// ============================================================================

/**
 * Check for floating (unconnected) input ports.
 * Skip sequential state inputs (they may be intentionally unconnected initially).
 * Skip ports with default values (they are optional).
 */
export function checkFloatingInputs(
  flat: FlatCircuit,
  library: ComponentLibrary
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Build a set of connected input ports
  const connectedInputs = new Set<string>();
  for (const conn of flat.connections) {
    const targetId = conn.target.nodeId;
    const targetPort = conn.target.portName;
    connectedInputs.add(`${targetId}.${targetPort}`);
  }

  // Check each node's inputs
  for (const node of flat.nodes) {
    // Skip checking sequential state inputs
    const isSequential = isSequentialComponent(node, library);

    // Get the component definition to check for default values
    const component = library.resolveComponent(node.primitiveType);
    const componentInputs = component?.inputs ?? [];

    for (const input of node.inputs) {
      const portKey = `${node.id}.${input.name}`;

      // Skip if connected
      if (connectedInputs.has(portKey)) {
        continue;
      }

      // Skip sequential state inputs (they may be intentionally unconnected)
      if (isSequential && isSequentialInputPort(input.name)) {
        continue;
      }

      // Skip ports with default values (they are optional)
      const portDef = componentInputs.find(p => p.name === input.name);
      if (portDef?.defaultValue !== undefined) {
        continue;
      }

      diagnostics.push({
        phase: 'structural',
        code: 'FLOATING_INPUT',
        severity: 'error',
        message: `Floating input: ${node.id}.${input.name} is not connected`,
        involvedNodes: [node.id],
        suggestions: [
          `Connect a signal to ${node.id}.${input.name}`,
          'Use a constant input (high/low) if intentional',
        ],
      });
    }
  }

  // Also check top-level inputs that are connected TO but not used
  // (This is usually fine, just informational)

  // Sort diagnostics by node ID for deterministic output
  diagnostics.sort((a, b) => {
    const nodeA = a.involvedNodes?.[0] ?? '';
    const nodeB = b.involvedNodes?.[0] ?? '';
    return nodeA.localeCompare(nodeB);
  });

  return diagnostics;
}

// ============================================================================
// Floating Output Detection
// ============================================================================

/**
 * Check for floating (undriven) output ports.
 * Checks that all top-level circuit outputs are driven by internal signals.
 */
export function checkFloatingOutputs(flat: FlatCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Build a set of driven outputs (sources of connections)
  const drivenOutputs = new Set<string>();
  for (const conn of flat.connections) {
    // Top-level outputs are targets of connections FROM internal nodes
    if (conn.target.nodeId === TOP_LEVEL_NODE) {
      drivenOutputs.add(conn.target.portName);
    }
  }

  // Check each top-level output
  for (const output of flat.topLevelOutputs) {
    if (!drivenOutputs.has(output.name)) {
      diagnostics.push({
        phase: 'structural',
        code: 'FLOATING_OUTPUT',
        severity: 'warning', // Warning, not error - simulator defaults undriven to 0
        message: `Floating output: '${output.name}' is not driven by any signal`,
        suggestions: [
          `Connect an internal signal to output '${output.name}'`,
          'Remove the output declaration if not needed',
        ],
      });
    }
  }

  // Sort for deterministic output
  diagnostics.sort((a, b) => a.message.localeCompare(b.message));

  return diagnostics;
}

// ============================================================================
// Main Structural Check Function
// ============================================================================

/**
 * Run all structural checks on an elaborated circuit.
 */
export function runStructuralChecks(
  flat: FlatCircuit,
  library: ComponentLibrary
): StructuralCheckResult {
  const allDiagnostics: Diagnostic[] = [];

  // Check for cycles
  const cycleCheck = checkCycles(flat, library);
  allDiagnostics.push(...cycleCheck.diagnostics);

  // Check for floating inputs
  const floatingInputDiagnostics = checkFloatingInputs(flat, library);
  allDiagnostics.push(...floatingInputDiagnostics);

  // Check for floating outputs
  const floatingOutputDiagnostics = checkFloatingOutputs(flat);
  allDiagnostics.push(...floatingOutputDiagnostics);

  // Extract floating port names for the result
  const floatingInputs = floatingInputDiagnostics
    .map(d => d.involvedNodes?.[0] ?? '')
    .filter(Boolean);
  const floatingOutputs = floatingOutputDiagnostics
    .map(d => {
      const match = d.message.match(/'([^']+)'/);
      return match?.[1] ?? '';
    })
    .filter(Boolean);

  return {
    diagnostics: allDiagnostics,
    cycleCheck,
    floatingInputs,
    floatingOutputs,
  };
}

// ============================================================================
// Exported Utilities
// ============================================================================

/**
 * Get all nodes involved in cycles (for highlighting in UI).
 */
export function getNodesInCycles(
  flat: FlatCircuit,
  library: ComponentLibrary
): Set<string> {
  const cycleCheck = checkCycles(flat, library);
  const nodesInCycles = new Set<string>();
  for (const cycle of cycleCheck.cycles) {
    for (const node of cycle) {
      nodesInCycles.add(node);
    }
  }
  return nodesInCycles;
}

/**
 * Validate that a graph is acyclic before computing metrics.
 * Throws if cycles exist.
 */
export function assertAcyclic(
  flat: FlatCircuit,
  library: ComponentLibrary
): void {
  const graph = buildCombinationalGraph(flat, library);
  if (hasCycle(graph)) {
    throw new Error('Cannot perform analysis on cyclic graph');
  }
}
