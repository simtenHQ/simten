/**
 * Circuit Flattener (IR v0.1)
 *
 * Expands composite components into a flat Circuit containing only primitives.
 * This allows the simulator to work with nested components by flattening the
 * hierarchy into a single level, avoiding recursive evaluation overhead.
 *
 * Key features:
 * - State isolation: Each instance gets unique IDs (componentId__nodeId)
 * - Preserves all port connections through hierarchy
 * - Recursively expands nested composites
 * - Compatible with IR v0.1 Circuit/Node format
 */

import { nanoid } from 'nanoid';
import { useCircuitLibraryStore } from '../../stores/circuit-library-store';
import type { Circuit, Connection, Node, PortPath } from '../../types/circuit';

/**
 * Flattened circuit contains only primitive nodes
 */
export interface FlattenedCircuit extends Circuit {
  // Track original node IDs to their expanded internal node IDs
  nodeMapping: Map<string, string[]>;
}

/**
 * Port mapping key format: "nodeId.portName"
 */
function portMapKey(nodeId: string, portName: string): string {
  return `${nodeId}.${portName}`;
}

/**
 * Flatten a circuit by recursively expanding all composite components into primitives
 */
export function flattenCircuit(circuit: Circuit): FlattenedCircuit {
  const library = useCircuitLibraryStore.getState();

  const flatNodes: Node[] = [];
  const flatConnections: Connection[] = [];
  const nodeMapping = new Map<string, string[]>();

  // Port mapping: tracks how ports of composite nodes map to internal primitive ports
  // Format: "nodeId.portName" -> ["expandedNodeId1.portName", "expandedNodeId2.portName", ...]
  // Supports fan-out (one port connecting to multiple internal ports)
  const portMapping = new Map<string, PortPath[]>();

  // Known primitive component types (don't need to be expanded)
  const knownPrimitives = new Set([
    'And',
    'Or',
    'Not',
    'Nand',
    'Nor',
    'Xor',
    'Xnor',
    'Buffer',
    'Switch',
    'Input',
    'Led',
    'HexDisplay',
    'SevenSegment',
    'DFlipFlop',
    'Register',
    'RAM',
  ]);

  // Recursively expand each node
  for (const node of circuit.nodes) {
    // Check if it's a known primitive (don't need library lookup)
    if (knownPrimitives.has(node.componentRef)) {
      flatNodes.push(node);
      nodeMapping.set(node.id, [node.id]);
      continue;
    }

    // Try to resolve from library for user-defined components
    const componentDef = library.resolveCircuit(node.componentRef);

    if (!componentDef) {
      // Unknown component - treat as primitive (fail gracefully)
      console.warn(`[FLATTEN] Component not found: ${node.componentRef}, treating as primitive`);
      flatNodes.push(node);
      nodeMapping.set(node.id, [node.id]);
      continue;
    }

    // If primitive, keep as-is
    if (componentDef.implementation.kind === 'primitive') {
      flatNodes.push(node);
      nodeMapping.set(node.id, [node.id]);
      continue;
    }

    // If composite, expand it
    if (componentDef.implementation.kind === 'composite') {
      const expansionResult = expandCompositeNode(
        node,
        componentDef,
        library.resolveCircuit.bind(library),
        knownPrimitives,
      );

      flatNodes.push(...expansionResult.nodes);
      nodeMapping.set(
        node.id,
        expansionResult.nodes.map((n) => n.id),
      );

      // Merge port mappings
      for (const [key, values] of expansionResult.portMapping.entries()) {
        const existing = portMapping.get(key) || [];
        portMapping.set(key, [...existing, ...values]);
      }

      // Add internal connections
      flatConnections.push(...expansionResult.connections);
    }
  }

  // Remap external connections to go through expanded internal nodes
  for (const conn of circuit.connections) {
    const remappedConns = remapConnection(conn, portMapping);
    flatConnections.push(...remappedConns);
  }

  return {
    ...circuit,
    nodes: flatNodes,
    connections: flatConnections,
    nodeMapping,
  };
}

/**
 * Expand a single composite node into its internal primitive nodes
 */
interface ExpansionResult {
  nodes: Node[];
  connections: Connection[];
  portMapping: Map<string, PortPath[]>;
}

function expandCompositeNode(
  node: Node,
  componentDef: Circuit,
  resolveCircuit: (name: string) => Circuit | undefined,
  knownPrimitives: Set<string>,
  visited: Set<string> = new Set(),
): ExpansionResult {
  const nodes: Node[] = [];
  const connections: Connection[] = [];
  const portMapping = new Map<string, PortPath[]>();

  // Create internal nodes with prefixed IDs
  for (const internalNode of componentDef.nodes) {
    const expandedId = `${node.id}__${internalNode.id}`;

    // Check if it's a known primitive
    if (knownPrimitives.has(internalNode.componentRef)) {
      // Primitive node - create expanded version
      const expandedNode: Node = {
        ...internalNode,
        id: expandedId,
        inputs: internalNode.inputs.map((inp) => ({
          ...inp,
          id: `${expandedId}.${inp.name}`,
        })),
        outputs: internalNode.outputs.map((out) => ({
          ...out,
          id: `${expandedId}.${out.name}`,
        })),
      };

      nodes.push(expandedNode);
      continue;
    }

    // Check if internal node is also composite - recursively expand
    const internalComponentDef = resolveCircuit(internalNode.componentRef);

    if (internalComponentDef?.implementation.kind === 'composite') {
      // Guard against recursive circuit definitions
      if (visited.has(internalNode.componentRef)) {
        console.warn(
          `[FLATTEN] Recursive circuit reference: ${internalNode.componentRef}, skipping`,
        );
        continue;
      }
      const childVisited = new Set(visited);
      childVisited.add(internalNode.componentRef);
      // Recursively expand nested composite
      const nestedExpansion = expandCompositeNode(
        { ...internalNode, id: expandedId },
        internalComponentDef,
        resolveCircuit,
        knownPrimitives,
        childVisited,
      );

      nodes.push(...nestedExpansion.nodes);
      connections.push(...nestedExpansion.connections);

      // Remap nested port mappings through our prefix
      for (const [key, values] of nestedExpansion.portMapping.entries()) {
        const [keyNodeId, keyPortName] = key.split('.');
        const remappedKey = portMapKey(keyNodeId, keyPortName);
        const existing = portMapping.get(remappedKey) || [];
        portMapping.set(remappedKey, [...existing, ...values]);
      }
    } else {
      // Unknown or primitive node - create expanded version
      const expandedNode: Node = {
        ...internalNode,
        id: expandedId,
        inputs: internalNode.inputs.map((inp) => ({
          ...inp,
          id: `${expandedId}.${inp.name}`,
        })),
        outputs: internalNode.outputs.map((out) => ({
          ...out,
          id: `${expandedId}.${out.name}`,
        })),
      };

      nodes.push(expandedNode);
    }
  }

  // Process internal connections and build port mappings
  for (const conn of componentDef.connections) {
    const sourceNodeId = conn.source.nodeId === '' ? node.id : `${node.id}__${conn.source.nodeId}`;
    const targetNodeId = conn.target.nodeId === '' ? node.id : `${node.id}__${conn.target.nodeId}`;

    // If source is circuit-level input (empty nodeId), create port mapping
    if (conn.source.nodeId === '') {
      // Map: original node's input port -> internal node's input port
      const originalInputKey = portMapKey(node.id, conn.source.portName);
      const internalTargetPath: PortPath = {
        nodeId: targetNodeId,
        portName: conn.target.portName,
      };
      const existing = portMapping.get(originalInputKey) || [];
      portMapping.set(originalInputKey, [...existing, internalTargetPath]);
    }

    // If target is circuit-level output (empty nodeId), create port mapping
    if (conn.target.nodeId === '') {
      // Map: original node's output port -> internal node's output port
      const originalOutputKey = portMapKey(node.id, conn.target.portName);
      const internalSourcePath: PortPath = {
        nodeId: sourceNodeId,
        portName: conn.source.portName,
      };
      const existing = portMapping.get(originalOutputKey) || [];
      portMapping.set(originalOutputKey, [...existing, internalSourcePath]);
    }

    // Only create internal connection if both sides are internal nodes
    if (conn.source.nodeId !== '' && conn.target.nodeId !== '') {
      const expandedConn: Connection = {
        ...conn,
        id: nanoid(),
        source: { nodeId: sourceNodeId, portName: conn.source.portName },
        target: { nodeId: targetNodeId, portName: conn.target.portName },
      };
      connections.push(expandedConn);
    }
  }

  return { nodes, connections, portMapping };
}

/**
 * Remap a connection through port mappings (for composite component ports)
 * Returns an array to handle fan-out (one source to multiple targets)
 */
function remapConnection(conn: Connection, portMapping: Map<string, PortPath[]>): Connection[] {
  // Try to remap source
  const sourceKey = portMapKey(conn.source.nodeId, conn.source.portName);
  const remappedSources = portMapping.get(sourceKey) || [conn.source];

  // Try to remap target
  const targetKey = portMapKey(conn.target.nodeId, conn.target.portName);
  const remappedTargets = portMapping.get(targetKey) || [conn.target];

  // Create connection for each combination of source/target (handles fan-out)
  const connections: Connection[] = [];

  for (const source of remappedSources) {
    for (const target of remappedTargets) {
      connections.push({
        ...conn,
        id: nanoid(),
        source,
        target,
      });
    }
  }

  return connections;
}

/**
 * Check if a circuit contains any composite components
 */
export function hasCompositeComponents(circuit: Circuit): boolean {
  const library = useCircuitLibraryStore.getState();

  for (const node of circuit.nodes) {
    const componentDef = library.resolveCircuit(node.componentRef);
    if (componentDef?.implementation.kind === 'composite') {
      return true;
    }
  }

  return false;
}
