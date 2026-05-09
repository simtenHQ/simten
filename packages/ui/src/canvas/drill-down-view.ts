/**
 * Drill-Down View Utilities
 *
 * Creates viewable circuits for composite component internals.
 * When a user drills into a composite (e.g., HalfAdder), we need to:
 * 1. Show its internal nodes on the canvas
 * 2. Add synthetic boundary nodes for the composite's ports
 * 3. Scope port values so internal node IDs match simulation keys
 */

import type { Circuit, Node, Connection, BitValue, BusValue } from '@simten/core';
import type { FlatPortValueMap } from '@simten/core/simulator';

/** Prefix for synthetic boundary input nodes */
export const BOUNDARY_IN_PREFIX = '__boundary_in_';
/** Prefix for synthetic boundary output nodes */
export const BOUNDARY_OUT_PREFIX = '__boundary_out_';

/**
 * Creates a viewable circuit from a composite's definition.
 *
 * The composite Circuit has internal nodes and connections where circuit-level
 * ports use `nodeId: ""`. We replace those with synthetic Switch/Input (for inputs)
 * and Led (for outputs) boundary nodes, so the canvas renders them naturally.
 */
export function createDrillDownViewCircuit(composite: Circuit): Circuit {
  const boundaryNodes: Node[] = [];
  const rewrittenConnections: Connection[] = [];

  // Create boundary input nodes (one per composite input port)
  for (const port of composite.inputs) {
    const boundaryId = `${BOUNDARY_IN_PREFIX}${port.name}`;
    const isBus = port.portType.kind === 'bus';

    boundaryNodes.push({
      id: boundaryId,
      label: port.name,
      componentRef: isBus ? 'Input' : 'Switch',
      arguments: isBus ? { value: 0, width: (port.portType as { kind: 'bus'; width: number }).width } : { value: false },
      inputs: [],
      outputs: [{
        id: `${boundaryId}_out`,
        name: 'out',
        portType: port.portType,
      }],
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
      label: port.name,
      componentRef: isBus ? 'HexDisplay' : 'Led',
      arguments: {},
      inputs: [{
        id: `${boundaryId}_in`,
        name: 'in',
        portType: port.portType,
      }],
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

/**
 * Scopes port values for a drilled-in view.
 *
 * The flat simulator produces port value keys with hierarchical prefixes like
 * "ha1_abc.xor1_def.out". When we drill into "ha1_abc", we need to strip
 * that prefix so keys become "xor1_def.out" — matching the composite's internal node IDs.
 *
 * Also maps boundary port values: the composite instance's own port values
 * get mapped to synthetic boundary node IDs.
 */
export function scopePortValues(
  portValues: FlatPortValueMap,
  prefix: string,
  composite?: Circuit
): FlatPortValueMap {
  if (!prefix) return portValues;

  const scoped = new Map<string, BitValue | BusValue>();

  for (const [key, value] of portValues.entries()) {
    if (key.startsWith(prefix)) {
      const scopedKey = key.slice(prefix.length);
      scoped.set(scopedKey, value);
    }
  }

  // Map boundary port values from the parent scope
  // The composite instance's ports in the parent are keyed as "nodeId.portName"
  // We map them to "__boundary_in_portName.out" and "__boundary_out_portName.in"
  if (composite) {
    // Strip trailing dot from prefix to get the instance nodeId
    const instanceId = prefix.endsWith('.') ? prefix.slice(0, -1) : prefix;

    for (const port of composite.inputs) {
      const parentKey = `${instanceId}.${port.name}`;
      const value = portValues.get(parentKey);
      if (value !== undefined) {
        scoped.set(`${BOUNDARY_IN_PREFIX}${port.name}.out`, value);
      }
    }

    for (const port of composite.outputs) {
      const parentKey = `${instanceId}.${port.name}`;
      const value = portValues.get(parentKey);
      if (value !== undefined) {
        scoped.set(`${BOUNDARY_OUT_PREFIX}${port.name}.in`, value);
      }
    }
  }

  return scoped;
}

