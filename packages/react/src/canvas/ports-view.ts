/**
 * A circuit's own ports, drawn (#531).
 *
 * The simulation runs the circuit itself. To give its ports something to see
 * and click, the canvas draws a control for each input port the circuit reads
 * (a Switch for a bit, a number Input for a bus) and an indicator for each
 * output it drives (a lamp, or a display for a bus), with the circuit between
 * them as one box, the node `dut`, which shows only the circuit's name. Each
 * control and indicator is named after its port, so `set({ a: 1 })` and a
 * click on `a` are the same write. A layout places them by port name, and the
 * box by the key `circuit` (`layoutForPortsView`). Double-clicking the box
 * opens its insides.
 *
 * Only the drawing has these nodes. Their values come from the circuit's own
 * ports (`__top__.a`), and the circuit's insides are read under `dut.`.
 * A circuit with no ports is drawn as it is.
 */

import {
  type CircuitDefinitions,
  type CircuitIR,
  type Connection,
  internalsOf,
  type Node,
  TOP_LEVEL_NODE,
} from '@simten/core/internal';
import { HexDisplay, Input, Led, Switch } from '@simten/core/std';

/** The node the circuit itself is drawn as. Its id is internal: paths inside it read `dut.`. */
const DUT = 'dut';
/** The layout key for that node. */
const CIRCUIT_KEY = 'circuit';
const TOP = '__top__';

const isCircuitPort = (nodeId: string) => nodeId === '' || nodeId === TOP_LEVEL_NODE;

/** Whether the canvas draws `circuit` with its ports around it. */
export const hasPorts = (circuit: CircuitIR) =>
  circuit.inputs.length > 0 || circuit.outputs.length > 0;

/**
 * The circuit as drawn: controls, the circuit as `dut`, indicators. Only ports
 * the circuit uses get a node: an input once something inside reads it, an
 * output once something inside drives it, so the diagram never shows a wire
 * into a port that goes nowhere. A primitive's ports are all live.
 */
export function portsView(circuit: CircuitIR): CircuitIR {
  const isPrimitive = circuit.implementation.kind === 'primitive';
  const read = new Set<string>();
  const driven = new Set<string>();
  for (const c of circuit.connections) {
    if (isCircuitPort(c.source.nodeId)) read.add(c.source.portName);
    if (isCircuitPort(c.target.nodeId)) driven.add(c.target.portName);
  }

  const nodes: Node[] = [
    {
      id: DUT,
      // The name alone: the node shows its title only when it differs from the component.
      label: circuit.name,
      componentRef: circuit.name,
      arguments: {},
      inputs: circuit.inputs.map((p) => ({
        id: `${DUT}.${p.name}`,
        name: p.name,
        portType: p.portType,
      })),
      outputs: circuit.outputs.map((p) => ({
        id: `${DUT}.${p.name}`,
        name: p.name,
        portType: p.portType,
      })),
      clocks: circuit.clocks.map((c) => ({ id: `${DUT}.${c.name}`, name: c.name })),
    },
  ];
  const connections: Connection[] = [];
  let id = 0;

  for (const input of circuit.inputs) {
    if (!isPrimitive && !read.has(input.name)) continue;
    const bit = input.portType.kind === 'bit';
    nodes.push({
      id: input.name,
      label: input.name,
      componentRef: bit ? 'Switch' : 'Input',
      arguments: input.portType.kind === 'bus' ? { width: input.portType.width } : {},
      inputs: [],
      outputs: [{ id: `${input.name}.out`, name: 'out', portType: input.portType }],
      clocks: [],
      harness: true,
    });
    connections.push({
      id: `c${id++}`,
      source: { nodeId: input.name, portName: 'out' },
      target: { nodeId: DUT, portName: input.name },
      portType: input.portType,
    });
  }

  for (const output of circuit.outputs) {
    if (!isPrimitive && !driven.has(output.name)) continue;
    const bit = output.portType.kind === 'bit';
    nodes.push({
      id: output.name,
      label: output.name,
      componentRef: bit ? 'Led' : 'HexDisplay',
      arguments: output.portType.kind === 'bus' ? { width: output.portType.width } : {},
      inputs: [{ id: `${output.name}.in`, name: 'in', portType: output.portType }],
      outputs: [],
      clocks: [],
      harness: true,
    });
    connections.push({
      id: `c${id++}`,
      source: { nodeId: DUT, portName: output.name },
      target: { nodeId: output.name, portName: 'in' },
      portType: output.portType,
    });
  }

  return {
    version: 1,
    name: `${circuit.name}Demo`,
    inputs: [],
    outputs: [],
    clocks: [],
    state: [],
    nodes,
    connections,
    implementation: { kind: 'composite' },
    metadata: { description: `${circuit.name} with its ports drawn` },
  };
}

/**
 * The session's port values in the drawing's terms: the circuit's insides
 * under `dut.`, each input port as its control's output, each output port as
 * its indicator's input.
 */
export function portsViewValues(
  circuit: CircuitIR,
  values: ReadonlyMap<string, number>,
): Map<string, number> {
  const view = new Map<string, number>();
  for (const [key, value] of values) {
    if (!key.startsWith(`${TOP}.`)) view.set(`${DUT}.${key}`, value);
  }
  for (const p of circuit.inputs) {
    const value = values.get(`${TOP}.${p.name}`);
    if (value !== undefined) view.set(`${p.name}.out`, value);
  }
  for (const p of circuit.outputs) {
    const value = values.get(`${TOP}.${p.name}`);
    if (value !== undefined) view.set(`${p.name}.in`, value);
  }
  return view;
}

/**
 * A layout in the drawing's terms: the box's position, given as `circuit`, moves
 * to the box's node.
 */
export function layoutForPortsView(
  layout: Readonly<Record<string, { x: number; y: number }>>,
): Record<string, { x: number; y: number }> {
  const { [CIRCUIT_KEY]: box, ...rest } = layout;
  return box ? { ...rest, [DUT]: box } : rest;
}

/** The components the drawing adds, by name. */
let parts: Map<string, CircuitIR> | null = null;
function part(name: string): CircuitIR | undefined {
  parts ??= new Map(
    [Switch, Led, Input(), HexDisplay()].map((c) => {
      const { ir } = internalsOf(c);
      return [ir.name, ir];
    }),
  );
  return parts.get(name);
}

/** `definitions`, plus the controls and indicators the drawing adds. */
export function withPortParts(definitions: CircuitDefinitions): CircuitDefinitions {
  return {
    resolveCircuit: (name) => definitions.resolveCircuit(name) ?? part(name),
    getAllPrimitiveNames: () => definitions.getAllPrimitiveNames(),
  };
}
