/**
 * The drill-down's view of a composite: its internal nodes, with a node for
 * each of its ports where the wires cross its boundary. The canvas draws it
 * at the composite's path in the session, so its nodes read their values by
 * their own ids under that path (`circuit-to-flow.ts`).
 */

import type { CircuitIR, Connection } from '@simten/core/internal';
import type { DrawnCircuit, DrawnNode } from './types';

/** Prefix for synthetic boundary input nodes */
const BOUNDARY_IN_PREFIX = '__boundary_in_';
/** Prefix for synthetic boundary output nodes */
const BOUNDARY_OUT_PREFIX = '__boundary_out_';

/**
 * Creates a viewable circuit from a composite's definition.
 *
 * The composite Circuit has internal nodes and connections where circuit-level
 * ports use `nodeId: ""`. We replace those with synthetic Switch/Input (for inputs)
 * and Led (for outputs) boundary nodes, so the canvas renders them naturally.
 */
export function createDrillDownViewCircuit(composite: CircuitIR): DrawnCircuit {
  const boundaryNodes: DrawnNode[] = [];
  const rewrittenConnections: Connection[] = [];

  // Create boundary input nodes (one per composite input port)
  for (const port of composite.inputs) {
    const boundaryId = `${BOUNDARY_IN_PREFIX}${port.name}`;
    const isBus = port.portType.kind === 'bus';

    boundaryNodes.push({
      id: boundaryId,
      port: port.name,
      label: port.name,
      componentRef: isBus ? 'Input' : 'Switch',
      arguments: isBus
        ? { value: 0, width: (port.portType as { kind: 'bus'; width: number }).width }
        : { value: false },
      inputs: [],
      outputs: [
        {
          id: `${boundaryId}_out`,
          name: 'out',
          portType: port.portType,
        },
      ],
      clocks: [],
    });
  }

  // Create boundary output nodes (one per composite output port)
  // Bus outputs use HexDisplay (shows numeric value), bit outputs use Led (shows on/off)
  for (const port of composite.outputs) {
    const boundaryId = `${BOUNDARY_OUT_PREFIX}${port.name}`;
    const isBus = port.portType.kind === 'bus';

    boundaryNodes.push({
      id: boundaryId,
      port: port.name,
      label: port.name,
      componentRef: isBus ? 'HexDisplay' : 'Led',
      arguments: {},
      inputs: [
        {
          id: `${boundaryId}_in`,
          name: 'in',
          portType: port.portType,
        },
      ],
      outputs: [],
      clocks: [],
    });
  }

  // Rewrite connections: replace circuit-level port references (nodeId: "")
  // with the corresponding boundary node IDs
  for (const conn of composite.connections) {
    const newSource = { ...conn.source };
    const newTarget = { ...conn.target };

    if (conn.source.nodeId === '') {
      // Circuit-level input port → boundary input node's output
      newSource.nodeId = `${BOUNDARY_IN_PREFIX}${conn.source.portName}`;
      newSource.portName = 'out';
    }

    if (conn.target.nodeId === '') {
      // Circuit-level output port → boundary output node's input
      newTarget.nodeId = `${BOUNDARY_OUT_PREFIX}${conn.target.portName}`;
      newTarget.portName = 'in';
    }

    rewrittenConnections.push({
      ...conn,
      source: newSource,
      target: newTarget,
    });
  }

  return {
    ...composite,
    name: `__drilldown_${composite.name}`,
    nodes: [...boundaryNodes, ...composite.nodes],
    connections: rewrittenConnections,
    // Mark as primitive so the view circuit itself isn't treated as drillable
    implementation: { kind: 'primitive' },
  };
}
