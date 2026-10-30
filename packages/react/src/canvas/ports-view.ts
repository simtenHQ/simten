/**
 * A circuit's own ports, drawn (#531).
 *
 * The simulation runs the circuit itself. To give its ports something to see
 * and click, the canvas draws a control for each input port the circuit reads
 * (a Switch for a bit, a number Input for a bus) and an indicator for each
 * output it drives (a lamp, or a display for a bus), with the circuit between
 * them as one box, which shows only the circuit's name.
 *
 * Each control and indicator is named after its port and tagged with it
 * (`port`), so it reads the session's own value for the port, `__top__.a`, and
 * a click on `a` is `set({ a: 1 })`. The box is the session's top level
 * (`path: ''`), so double-clicking it opens the circuit itself. Its id is
 * `circuit`, the key a layout places it by.
 *
 * A circuit with no ports is drawn as it is.
 */

import {
  type CircuitDefinitions,
  type CircuitIR,
  internalsOf,
  TOP_LEVEL_NODE,
} from '@simten/core/internal';
import { HexDisplay, Input, Led, Switch } from '@simten/core/std';
import type { DrawnCircuit, DrawnNode } from './types';

/** The box's node id, and the layout key that places it. */
const BOX = 'circuit';

const isCircuitPort = (nodeId: string) => nodeId === '' || nodeId === TOP_LEVEL_NODE;

/** Whether the canvas draws `circuit` with its ports around it. */
export const hasPorts = (circuit: CircuitIR) =>
  circuit.inputs.length > 0 || circuit.outputs.length > 0;

/**
 * The circuit as drawn: controls, the circuit as one box, indicators. Only
 * ports the circuit uses get a node: an input once something inside reads it,
 * an output once something inside drives it, so the diagram never shows a
 * wire into a port that goes nowhere. A primitive's ports are all live.
 */
export function portsView(circuit: CircuitIR): DrawnCircuit {
  const isPrimitive = circuit.implementation.kind === 'primitive';
  const read = new Set<string>();
  const driven = new Set<string>();
  for (const c of circuit.connections) {
    if (isCircuitPort(c.source.nodeId)) read.add(c.source.portName);
    if (isCircuitPort(c.target.nodeId)) driven.add(c.target.portName);
  }

  const nodes: DrawnNode[] = [
    {
      id: BOX,
      path: '',
      // The name alone: the node shows its title only when it differs from the component.
      label: circuit.name,
      componentRef: circuit.name,
      arguments: {},
      inputs: circuit.inputs.map((p) => ({
        id: `${BOX}.${p.name}`,
        name: p.name,
        portType: p.portType,
      })),
      outputs: circuit.outputs.map((p) => ({
        id: `${BOX}.${p.name}`,
        name: p.name,
        portType: p.portType,
      })),
      clocks: circuit.clocks.map((c) => ({ id: `${BOX}.${c.name}`, name: c.name })),
    },
  ];
  const connections: CircuitIR['connections'] = [];
  let id = 0;

  for (const input of circuit.inputs) {
    if (!isPrimitive && !read.has(input.name)) continue;
    const bit = input.portType.kind === 'bit';
    nodes.push({
      id: input.name,
      port: input.name,
      label: input.name,
      componentRef: bit ? 'Switch' : 'Input',
      arguments: input.portType.kind === 'bus' ? { width: input.portType.width } : {},
      inputs: [],
      outputs: [{ id: `${input.name}.out`, name: 'out', portType: input.portType }],
      clocks: [],
    });
    connections.push({
      id: `c${id++}`,
      source: { nodeId: input.name, portName: 'out' },
      target: { nodeId: BOX, portName: input.name },
      portType: input.portType,
    });
  }

  for (const output of circuit.outputs) {
    if (!isPrimitive && !driven.has(output.name)) continue;
    const bit = output.portType.kind === 'bit';
    nodes.push({
      id: output.name,
      port: output.name,
      label: output.name,
      componentRef: bit ? 'Led' : 'HexDisplay',
      arguments: output.portType.kind === 'bus' ? { width: output.portType.width } : {},
      inputs: [{ id: `${output.name}.in`, name: 'in', portType: output.portType }],
      outputs: [],
      clocks: [],
    });
    connections.push({
      id: `c${id++}`,
      source: { nodeId: BOX, portName: output.name },
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
