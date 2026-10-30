/**
 * Circuit to React Flow: turns a circuit, its node positions and the
 * definitions behind it into the nodes and wires the canvas draws. Values are
 * not part of it. Each node and wire carries the session key it reads its
 * value from, and reads it when it renders (`values.ts`), so this runs once
 * per circuit, not once per update.
 */

import { type CircuitDefinitions, type PortPath, TOP_LEVEL_NODE } from '@simten/core/internal';
import { hasMadeOf } from '@simten/core/std';
import type { Edge, Node as ReactFlowNode } from '@xyflow/react';
import type { NodeData, PixelSource } from '../nodes';
import type { DrawnCircuit, DrawnNode, Positions } from './types';

/** Buses draw heavier than single bits, as on a schematic. Width isn't shown, only bit vs bus. */
const WIRE_STROKE = { BIT: 2, BUS: 4 };

/** What a wire reads: its source's value, or when the session has none there, its target's. */
export interface WireData extends Record<string, unknown> {
  keys: [string | undefined, string | undefined];
}

function getNodeTypeForComponent(
  componentRef: string,
  inputCount: number,
  outputCount: number,
  isComposite: boolean,
): string {
  const typeMap: Record<string, string> = {
    Switch: 'inputNode',
    Input: 'numericInputNode',
    Led: 'outputNode',
    And: 'logicGateNode',
    Or: 'logicGateNode',
    Not: 'logicGateNode',
    Nand: 'logicGateNode',
    Nor: 'logicGateNode',
    Xor: 'logicGateNode',
    Xnor: 'logicGateNode',
    Buffer: 'logicGateNode',
    DFlipFlop: 'logicGateNode',
    Register: 'registerNode',
    RAM: 'ramNode',
    ROM: 'romNode',
    HexDisplay: 'outputNode',
    SevenSegment: 'outputNode',
    Screen: 'screenNode',
    RasterDisplay: 'rasterDisplayNode',
    Console: 'consoleNode',
    UART_TX: 'uartTxNode',
    NIC_FIFO: 'nicFifoNode',
    Constant: 'logicGateNode',
    RV32I_InstrMem: 'rv32iInstrMemNode',
    DualPortROM: 'rv32iInstrMemNode',
    Eth_FrameInput: 'ethFrameInputNode',
  };

  if (typeMap[componentRef]) return typeMap[componentRef];

  // Composites always render as a generic gate box. The shape-based heuristics
  // below only apply to primitives — a composite with 0 inputs (e.g. an internal
  // counter that streams bytes) shouldn't be coerced into a toggle.
  if (isComposite) return 'logicGateNode';

  if (inputCount === 0 && outputCount > 0) return 'inputNode';
  if (inputCount > 0 && outputCount === 0) return 'outputNode';
  if (inputCount > 0 && outputCount > 0) return 'logicGateNode';

  return 'default';
}

/** The pin each kind of control or indicator shows the value of. */
const SHOWS: Record<string, 'out' | 'in'> = {
  Switch: 'out',
  Input: 'out',
  Led: 'in',
  HexDisplay: 'in',
  SevenSegment: 'in',
};

/**
 * Where the values of one drawn circuit are in its session. `path` is where
 * the circuit sits in the session: '' for its top level.
 */
class SessionKeys {
  private readonly prefix: string;
  private readonly byId: Map<string, DrawnNode>;

  constructor(
    private readonly circuit: DrawnCircuit,
    private readonly definitions: CircuitDefinitions,
    private readonly path: string,
  ) {
    this.prefix = path ? `${path}.` : '';
    this.byId = new Map(circuit.nodes.map((n) => [n.id, n]));
  }

  /** A node's path in the session. */
  pathOf(node: DrawnNode): string {
    return node.path ?? `${this.prefix}${node.id}`;
  }

  /** The session key that holds the value on one end of a wire, if there is one. */
  of(end: PortPath): string | undefined {
    const node = this.byId.get(end.nodeId);
    if (!node) return undefined;
    if (node.port !== undefined) return this.ofPort(node);
    const path = this.pathOf(node);
    // The circuit drawn as one box is the session's top level, whose ports are `__top__`'s.
    if (path === '') return `${TOP_LEVEL_NODE}.${end.portName}`;
    return walk(end.portName, node.componentRef, path, this.definitions, new Set());
  }

  /**
   * A port's node reads the port. At the session's top level that's
   * `__top__.<port>`. Inside a composite the port was flattened away, so it
   * reads the other end of its first wire into the composite's insides.
   */
  private ofPort(node: DrawnNode): string | undefined {
    if (this.path === '') return `${TOP_LEVEL_NODE}.${node.port}`;
    for (const c of this.circuit.connections) {
      const other =
        c.source.nodeId === node.id ? c.target : c.target.nodeId === node.id ? c.source : null;
      // An input wired straight to an output has no inside to read.
      if (!other || this.byId.get(other.nodeId)?.port !== undefined) continue;
      const key = this.of(other);
      if (key) return key;
    }
    return undefined;
  }
}

/**
 * The session key for `port` of the node at `path`, looking through composite
 * boundaries.
 *
 * The drawing shows the unelaborated circuit, where a composite is one node
 * with ports. The session's values come from the flattened netlist, where that
 * boundary has been dissolved: a `HalfAdder` named `h1` has `h1.x1.out` and
 * `h1.a1.out`, and no `h1.carry` at all. So a wire between two composites had
 * neither end in the map and drew as undefined while the simulation carried a
 * good 1 along it.
 *
 * This walks inward instead: for an output port, to the internal connection
 * that drives it; for an input port, to one it feeds. It stops at a primitive,
 * whose ports the session has. Depth is bounded by nesting, and `seen` stops a
 * malformed circuit from looping forever.
 */
function walk(
  port: string,
  componentRef: string,
  path: string,
  definitions: CircuitDefinitions,
  seen: Set<string>,
): string | undefined {
  const key = `${path}.${port}`;
  const inner = definitions.resolveCircuit(componentRef);
  if (!inner || inner.implementation?.kind === 'primitive') return key;
  if (seen.has(key)) return undefined;
  seen.add(key);

  // A circuit's own ports use `nodeId: ''` inside its definition. An output is
  // driven by an internal source; an input drives internal targets.
  for (const conn of inner.connections) {
    const end =
      conn.target.nodeId === '' && conn.target.portName === port
        ? conn.source
        : conn.source.nodeId === '' && conn.source.portName === port
          ? conn.target
          : null;
    const node = end && inner.nodes.find((n) => n.id === end.nodeId);
    if (!end || !node) continue;
    const found = walk(end.portName, node.componentRef, `${path}.${node.id}`, definitions, seen);
    if (found) return found;
  }
  return undefined;
}

/**
 * Where a Screen reads its pixels: the RAM wired to its `dataIn`, or through a
 * multiplexer, the RAM on the input its select line picks.
 */
function pixelSourceOf(
  screen: DrawnNode,
  circuit: DrawnCircuit,
  keys: SessionKeys,
): PixelSource | undefined {
  const driver = (nodeId: string, portName: string) => {
    const conn = circuit.connections.find(
      (c) => c.target.nodeId === nodeId && c.target.portName === portName,
    );
    return conn && circuit.nodes.find((n) => n.id === conn.source.nodeId);
  };
  const ram = (node: DrawnNode | undefined) =>
    node?.componentRef === 'DualPortRAM' ? keys.pathOf(node) : undefined;

  const source = driver(screen.id, 'dataIn');
  if (source?.componentRef === 'DualPortRAM') return { memory: keys.pathOf(source) };
  if (source?.componentRef !== 'Mux') return undefined;
  const select = keys.of({ nodeId: source.id, portName: 'sel' });
  if (!select) return undefined;
  return { select, memories: [ram(driver(source.id, 'in0')), ram(driver(source.id, 'in1'))] };
}

function projectNode(
  node: DrawnNode,
  position: { x: number; y: number },
  circuit: DrawnCircuit,
  definitions: CircuitDefinitions,
  keys: SessionKeys,
): ReactFlowNode<NodeData> | null {
  const componentDef = definitions.resolveCircuit(node.componentRef);
  if (!componentDef) return null;

  const isComposite = componentDef.implementation.kind === 'composite';
  const shows = SHOWS[node.componentRef];
  const pin = shows === 'out' ? node.outputs[0] : shows === 'in' ? node.inputs[0] : undefined;

  return {
    id: node.id,
    type: getNodeTypeForComponent(
      node.componentRef,
      node.inputs.length,
      node.outputs.length,
      isComposite,
    ),
    position,
    data: {
      nodeId: node.id,
      path: keys.pathOf(node),
      componentRef: node.componentRef,
      label: node.label,
      inputCount: node.inputs.length,
      outputCount: node.outputs.length,
      inputNames: node.inputs.map((p) => p.name),
      outputNames: node.outputs.map((p) => p.name),
      isComposite,
      // Eval-only primitives with a gate-level reference build can also be
      // opened. Kept out of `isComposite` so the node still renders as itself.
      hasReference: !isComposite && hasMadeOf(node.componentRef),
      arguments: node.arguments,
      showPortLabels: node.port === undefined,
      valueKey: pin && keys.of({ nodeId: node.id, portName: pin.name }),
      pixelSource: node.componentRef === 'Screen' ? pixelSourceOf(node, circuit, keys) : undefined,
    },
    selectable: true,
    deletable: false,
  };
}

/**
 * Consoles and UARTs nested inside composites, drawn as nodes of their own at
 * the side, so their text shows on the top-level canvas. `paths` are their
 * session paths.
 */
function consoleNodes(paths: readonly string[]): ReactFlowNode<NodeData>[] {
  return paths.map((path, index) => {
    const parts = path.split('.');
    const shortLabel = parts.length > 1 ? parts.slice(-2).join('.') : path;
    const isUart = path.toLowerCase().includes('uart');
    return {
      id: `__virtual_console_${index}`,
      type: isUart ? 'uartTxNode' : 'consoleNode',
      position: { x: 600, y: 50 + index * 250 },
      data: {
        nodeId: path,
        path,
        componentRef: isUart ? 'UART_TX' : 'Console',
        label: isUart ? `UART (${shortLabel})` : `Console (${shortLabel})`,
        inputCount: isUart ? 4 : 2,
        outputCount: 1,
        inputNames: isUart ? ['addr', 'write_data', 'mem_read', 'mem_write'] : ['data', 'we'],
        outputNames: isUart ? ['read_data'] : ['text'],
      },
      selected: false,
      selectable: false,
      deletable: false,
    };
  });
}

export interface Projection {
  nodes: ReactFlowNode<NodeData>[];
  edges: Edge<WireData>[];
}

/**
 * The nodes and wires for `circuit`, which sits at `path` in its session.
 * A node without a position isn't drawn. `consoles` are the session paths of
 * consoles to draw at the side.
 */
export function projectCircuit(
  circuit: DrawnCircuit,
  positions: Positions,
  definitions: CircuitDefinitions,
  path = '',
  consoles: readonly string[] = [],
): Projection {
  const keys = new SessionKeys(circuit, definitions, path);

  const nodes: ReactFlowNode<NodeData>[] = [];
  for (const node of circuit.nodes) {
    const position = positions[node.id];
    if (!position) {
      console.warn(
        `[projection] node '${node.id}' (${node.componentRef}) has no layout metadata, skipping render`,
      );
      continue;
    }
    const projected = projectNode(node, position, circuit, definitions, keys);
    if (projected) nodes.push(projected);
  }
  nodes.push(...consoleNodes(consoles));

  const edges = circuit.connections.map(
    (connection): Edge<WireData> => ({
      id: connection.id,
      type: 'wire',
      source: connection.source.nodeId,
      target: connection.target.nodeId,
      sourceHandle: `out-${connection.source.portName}`,
      targetHandle: `in-${connection.target.portName}`,
      data: { keys: [keys.of(connection.source), keys.of(connection.target)] },
      style: {
        strokeWidth: connection.portType.kind === 'bus' ? WIRE_STROKE.BUS : WIRE_STROKE.BIT,
      },
      animated: false,
      selectable: false,
      deletable: false,
    }),
  );

  return { nodes, edges };
}
