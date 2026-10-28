/**
 * Drill-Down View Utilities
 *
 * Creates viewable circuits for composite component internals.
 * When a user drills into a composite (e.g., HalfAdder), we need to:
 * 1. Show its internal nodes on the canvas
 * 2. Add synthetic boundary nodes for the composite's ports
 * 3. Scope the session's port values so internal node IDs match its keys
 */

import type { BitValue, BusValue } from '@simten/core';
import {
  type CircuitDefinitions,
  type CircuitIR,
  type Connection,
  type FlatPortValueMap,
  type Node,
  TOP_LEVEL_NODE,
} from '@simten/core/internal';
import { resolvePortValue } from './projection';

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
export function createDrillDownViewCircuit(composite: CircuitIR): CircuitIR {
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

/**
 * The values a drilled-in view shows, read from its session's flat port map.
 *
 * Inside: the keys under `path.`, with the prefix stripped, so `dut.ha1.x.out`
 * becomes `x.out` and matches the composite's own node ids. At a session's top
 * level (`path` empty) the keys already are.
 *
 * Boundary: flattening dissolves a composite's own ports, so there is no
 * `dut.ha1.a` in the map. Each boundary node takes the value of the inside port
 * it is wired to, looked up the way the canvas colours a wire into a composite
 * (`resolvePortValue`). At a top level the circuit's own ports are in the map
 * as `__top__.<name>` and are read directly.
 */
export function scopePortValues(
  portValues: ReadonlyMap<string, number>,
  path: string,
  view: CircuitIR,
  definitions: CircuitDefinitions,
): FlatPortValueMap {
  const scoped = new Map<string, BitValue | BusValue>();
  const prefix = path ? `${path}.` : '';
  for (const [key, value] of portValues) {
    if (key.startsWith(prefix)) scoped.set(key.slice(prefix.length), value);
  }

  /** The value at the other end of the first resolvable wire on `side` of a boundary node. */
  const inside = (boundaryId: string, side: 'source' | 'target') => {
    for (const conn of view.connections) {
      if (conn[side].nodeId !== boundaryId) continue;
      const other = side === 'source' ? conn.target : conn.source;
      const value = resolvePortValue(other, view, definitions, scoped);
      if (value !== undefined) return value;
    }
    return undefined;
  };
  const own = (name: string) => (path ? undefined : portValues.get(`${TOP_LEVEL_NODE}.${name}`));

  for (const port of view.inputs) {
    const id = `${BOUNDARY_IN_PREFIX}${port.name}`;
    const value = own(port.name) ?? inside(id, 'source');
    if (value !== undefined) scoped.set(`${id}.out`, value);
  }
  for (const port of view.outputs) {
    const id = `${BOUNDARY_OUT_PREFIX}${port.name}`;
    const value = own(port.name) ?? inside(id, 'target');
    if (value !== undefined) scoped.set(`${id}.in`, value);
  }
  return scoped;
}
