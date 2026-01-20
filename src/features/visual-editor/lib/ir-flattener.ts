/**
 * IR Flattener
 *
 * Expands composite components into a flat IR of primitives.
 * This allows the simulator to work with nested components by
 * flattening the hierarchy into a single level of primitives.
 *
 * Strategy:
 * 1. For each component on the canvas:
 *    - If primitive: keep as-is
 *    - If composite: expand into internal nodes recursively
 * 2. Remap connections through the hierarchy
 * 3. Initialize state for all sequential primitives at any nesting level
 */

import type { Component, Connection } from '../types';
import type { Circuit } from '../types/ir-v0.1';
import { nanoid } from 'nanoid';

/**
 * Flattened IR contains only primitive components
 */
export interface FlattenedIR {
  components: Record<string, Component>;
  connections: Record<string, Connection>;
  // Maps original component IDs to their internal node IDs (for composite components)
  componentMapping: Map<string, string[]>;
}

/**
 * Flatten the IR by expanding all composite components into primitives
 */
export function flattenIR(
  components: Record<string, Component>,
  connections: Record<string, Connection>,
  resolveComponent: (name: string) => Circuit | undefined
): FlattenedIR {
  const flatComponents: Record<string, Component> = {};
  const flatConnections: Record<string, Connection> = {};
  const componentMapping = new Map<string, string[]>();

  // Port mapping: tracks where each port of a composite component maps to
  // Format: "componentId.portType.portIndex" -> "internalNodeId.portType.portIndex"
  const portMapping = new Map<string, string>();

  // Process each component
  for (const [compId, component] of Object.entries(components)) {
    const circuit = resolveComponent(component.type);

    // If component is not found or is primitive, keep as-is
    if (!circuit || circuit.implementation.kind === 'primitive') {
      flatComponents[compId] = component;
      componentMapping.set(compId, [compId]);
      continue;
    }

    // Component is composite - expand it
    if (circuit.implementation.kind === 'composite') {
      const internalNodeIds: string[] = [];

      // Create internal nodes
      for (const node of circuit.nodes) {
        const internalId = `${compId}__${node.id}`;
        internalNodeIds.push(internalId);

        // Map component type from new IR (DFlipFlop) to old IR (D_FLIP_FLOP)
        const primitiveType = mapToPrimitiveType(node.componentRef);

        // Create the internal component
        const internalComponent = createPrimitiveComponent(internalId, primitiveType);
        flatComponents[internalId] = internalComponent;
      }

      componentMapping.set(compId, internalNodeIds);

      // Create internal connections
      console.log(`[IR-FLATTEN] Processing connections for composite ${compId} (${circuit.name})`);
      for (const conn of circuit.connections) {

        // Map source port
        const sourceNodeId = conn.source.nodeId === ''
          ? compId // Circuit-level input port
          : `${compId}__${conn.source.nodeId}`; // Internal node

        // Map target port
        const targetNodeId = conn.target.nodeId === ''
          ? compId // Circuit-level output port
          : `${compId}__${conn.target.nodeId}`; // Internal node

        // For circuit-level ports, we need to track the mapping
        if (conn.source.nodeId === '') {
          // This is a connection from a circuit input to an internal node
          const inputIndex = circuit.inputs.findIndex(inp => inp.name === conn.source.portName);
          const portKey = `${compId}.input.${inputIndex}`;
          const targetPortIndex = findPortIndex(conn.target.portName, circuit, conn.target.nodeId, 'input');
          const targetPortKey = `${targetNodeId}.input.${targetPortIndex}`;
          portMapping.set(portKey, targetPortKey);
          console.log(`[IR-FLATTEN] Input mapping: ${portKey} → ${targetPortKey}`);
        }

        if (conn.target.nodeId === '') {
          // This is a connection from an internal node to a circuit output
          const outputIndex = circuit.outputs.findIndex(out => out.name === conn.target.portName);
          const portKey = `${compId}.output.${outputIndex}`;
          const sourcePortIndex = findPortIndex(conn.source.portName, circuit, conn.source.nodeId, 'output');
          const sourcePortKey = `${sourceNodeId}.output.${sourcePortIndex}`;
          portMapping.set(portKey, sourcePortKey);
          console.log(`[IR-FLATTEN] Output mapping: ${portKey} → ${sourcePortKey} (output name="${conn.target.portName}", node="${conn.source.nodeId}", port="${conn.source.portName}")`);
        }

        // Only create connection if both sides are internal nodes
        if (conn.source.nodeId !== '' && conn.target.nodeId !== '') {
          const internalConnId = nanoid();
          const sourcePortIndex = findPortIndex(conn.source.portName, circuit, conn.source.nodeId, 'output');
          const targetPortIndex = findPortIndex(conn.target.portName, circuit, conn.target.nodeId, 'input');

          flatConnections[internalConnId] = {
            id: internalConnId,
            sourceComponentId: sourceNodeId,
            sourcePortIndex,
            targetComponentId: targetNodeId,
            targetPortIndex,
          };
          console.log(`[IR-FLATTEN] Internal connection: ${sourceNodeId}.output.${sourcePortIndex} → ${targetNodeId}.input.${targetPortIndex}`);
        }
      }
    }
  }

  // Remap external connections to go through internal nodes
  console.log('[IR-FLATTEN] Remapping external connections:');
  console.log('[IR-FLATTEN] Port mapping:', Array.from(portMapping.entries()));
  for (const conn of Object.values(connections)) {
    const newConnId = nanoid();

    // Resolve source port
    const sourceKey = `${conn.sourceComponentId}.output.${conn.sourcePortIndex}`;
    const resolvedSource = portMapping.get(sourceKey) || sourceKey;
    const [sourceCompId, , sourcePortIdx] = resolvedSource.split('.');

    // Resolve target port
    const targetKey = `${conn.targetComponentId}.input.${conn.targetPortIndex}`;
    const resolvedTarget = portMapping.get(targetKey) || targetKey;
    const [targetCompId, , targetPortIdx] = resolvedTarget.split('.');

    console.log(`[IR-FLATTEN] Connection ${sourceKey} → ${targetKey} remapped to ${resolvedSource} → ${resolvedTarget}`);

    flatConnections[newConnId] = {
      id: newConnId,
      sourceComponentId: sourceCompId,
      sourcePortIndex: parseInt(sourcePortIdx, 10),
      targetComponentId: targetCompId,
      targetPortIndex: parseInt(targetPortIdx, 10),
    };
  }

  return {
    components: flatComponents,
    connections: flatConnections,
    componentMapping,
  };
}

/**
 * Map new IR component names to old IR primitive types
 */
function mapToPrimitiveType(componentRef: string): string {
  const mapping: Record<string, string> = {
    'DFlipFlop': 'D_FLIP_FLOP',
    'Register': 'REGISTER',
    'RAM': 'RAM',
    'And': 'AND_GATE',
    'Or': 'OR_GATE',
    'Not': 'NOT_GATE',
    'Nand': 'NAND_GATE',
    'Nor': 'NOR_GATE',
    'Xor': 'XOR_GATE',
    'Xnor': 'XNOR_GATE',
    'Buffer': 'BUFFER',
    'Switch': 'SWITCH',
    'Led': 'LED',
  };

  return mapping[componentRef] || componentRef;
}

/**
 * Create a primitive component with the given type
 */
function createPrimitiveComponent(id: string, type: string): Component {
  let component: Component;
  switch (type) {
    case 'D_FLIP_FLOP':
      component = { id, type: 'D_FLIP_FLOP', state: false };
      console.log(`[IR-FLATTEN] Created D_FLIP_FLOP: id=${id}, state=${false}`);
      return component;
    case 'REGISTER':
      return { id, type: 'REGISTER', width: 8, state: 0 };
    case 'RAM':
      return { id, type: 'RAM', addressWidth: 8, dataWidth: 8, memory: new Map() };
    case 'SWITCH':
      return { id, type: 'SWITCH', value: false };
    case 'LED':
      return { id, type: 'LED', value: false };
    case 'AND_GATE':
      return { id, type: 'AND_GATE' };
    case 'OR_GATE':
      return { id, type: 'OR_GATE' };
    case 'NOT_GATE':
      return { id, type: 'NOT_GATE' };
    case 'NAND_GATE':
      return { id, type: 'NAND_GATE' };
    case 'NOR_GATE':
      return { id, type: 'NOR_GATE' };
    case 'XOR_GATE':
      return { id, type: 'XOR_GATE' };
    case 'XNOR_GATE':
      return { id, type: 'XNOR_GATE' };
    case 'BUFFER':
      return { id, type: 'BUFFER' };
    default:
      throw new Error(`Unknown primitive type: ${type}`);
  }
}

/**
 * Find the port index for a named port on a node
 */
function findPortIndex(
  portName: string,
  circuit: Circuit,
  nodeId: string,
  portType: 'input' | 'output'
): number {
  if (nodeId === '') {
    // Circuit-level port
    const ports = portType === 'input' ? circuit.inputs : circuit.outputs;
    const index = ports.findIndex(p => p.name === portName);
    return index >= 0 ? index : 0;
  }

  // Node-level port - find the node
  const node = circuit.nodes.find(n => n.id === nodeId);
  if (!node) return 0;

  const ports = portType === 'input' ? node.inputs : node.outputs;
  const index = ports.findIndex(p => p.name === portName);
  return index >= 0 ? index : 0;
}
