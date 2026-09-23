/**
 * Auto-harness generator.
 *
 * Takes a circuit with inputs/outputs and wraps it in a harness circuit
 * with Switch nodes for bit inputs, Input nodes for bus inputs,
 * Led nodes for bit outputs, and HexDisplay nodes for bus outputs.
 *
 * Only ports the circuit actually uses get one. A declared-but-unwired port
 * used to get a switch anyway, which drew a wire into a port that goes nowhere
 * inside: the diagram looked finished while the circuit did nothing, and
 * drilling into the box showed none of the edges the outside implied. The
 * `dut` still declares every port, so the interface is visible as bare
 * handles, and each switch appears as its port is wired up.
 *
 * If the circuit has no ports (already self-contained), returns it as-is.
 * No code execution — pure Circuit IR construction.
 */

import type { ArgumentValue, Circuit, Connection, Node } from '../types/circuit.js';
import { TOP_LEVEL_NODE } from '../types/circuit.js';

/** A port reference belongs to the circuit's own edge, not to a child node. */
const isCircuitPort = (nodeId: string) => nodeId === '' || nodeId === TOP_LEVEL_NODE;

export function autoHarness(
  circuit: Circuit,
  library: {
    resolveCircuit: (name: string) => Circuit | undefined;
    addCircuit: (c: Circuit) => void;
  },
  initialInputs?: Record<string, number | boolean>,
): Circuit {
  // No ports = already a self-contained harness
  if (circuit.inputs.length === 0 && circuit.outputs.length === 0) {
    return circuit;
  }

  // Register the circuit in the library so the harness can reference it by name.
  //
  // Unconditionally, because the definition can change. The harness's `dut` node
  // takes its ports straight from `circuit`, while the canvas resolves the same
  // name through the library — so skipping the write when an entry already
  // existed left those two disagreeing the moment a port was added or removed:
  // a `dut` claiming three inputs in front of a two-input circuit, with edges
  // landing off their handles. The library store overwrites by name, and the
  // editor re-harnesses on every apply, so the newest definition is the one to
  // keep.
  library.addCircuit(circuit);

  const harnessName = `${circuit.name}Demo`;

  const nodes: Node[] = [];
  const connections: Connection[] = [];
  let connId = 0;

  // DUT node
  nodes.push({
    id: 'dut',
    componentRef: circuit.name,
    arguments: {},
    inputs: circuit.inputs.map((p) => ({
      id: `dut.${p.name}`,
      name: p.name,
      portType: p.portType,
    })),
    outputs: circuit.outputs.map((p) => ({
      id: `dut.${p.name}`,
      name: p.name,
      portType: p.portType,
    })),
    clocks: circuit.clocks.map((c) => ({ id: `dut.${c.name}`, name: c.name })),
  });

  // An input is live once something inside reads it; an output once something
  // inside drives it.
  const readInputs = new Set<string>();
  const drivenOutputs = new Set<string>();
  for (const conn of circuit.connections) {
    if (isCircuitPort(conn.source.nodeId)) readInputs.add(conn.source.portName);
    if (isCircuitPort(conn.target.nodeId)) drivenOutputs.add(conn.target.portName);
  }

  // Switch / Input node for each input port that is used
  for (const input of circuit.inputs) {
    if (!readInputs.has(input.name)) continue;
    const isBit = input.portType.kind === 'bit';
    const args: Record<string, ArgumentValue> = {};
    if (!isBit && input.portType.kind === 'bus') args.width = input.portType.width;
    if (initialInputs && input.name in initialInputs) args.value = initialInputs[input.name];

    nodes.push({
      id: input.name,
      label: input.name,
      componentRef: isBit ? 'Switch' : 'Input',
      arguments: args,
      inputs: [],
      outputs: [{ id: `${input.name}.out`, name: 'out', portType: input.portType }],
      clocks: [],
    });
    connections.push({
      id: `c${connId++}`,
      source: { nodeId: input.name, portName: 'out' },
      target: { nodeId: 'dut', portName: input.name },
      portType: input.portType,
    });
  }

  // Led / HexDisplay node for each output port that is driven
  for (const output of circuit.outputs) {
    if (!drivenOutputs.has(output.name)) continue;
    const isBit = output.portType.kind === 'bit';
    const outArgs: Record<string, ArgumentValue> = {};
    if (!isBit && output.portType.kind === 'bus') outArgs.width = output.portType.width;

    nodes.push({
      id: output.name,
      label: output.name,
      componentRef: isBit ? 'Led' : 'HexDisplay',
      arguments: outArgs,
      inputs: [{ id: `${output.name}.in`, name: 'in', portType: output.portType }],
      outputs: [],
      clocks: [],
    });
    connections.push({
      id: `c${connId++}`,
      source: { nodeId: 'dut', portName: output.name },
      target: { nodeId: output.name, portName: 'in' },
      portType: output.portType,
    });
  }

  return {
    version: 1,
    name: harnessName,
    inputs: [],
    outputs: [],
    clocks: [],
    state: [],
    nodes,
    connections,
    implementation: { kind: 'composite' },
    metadata: { description: `Auto-generated harness for ${circuit.name}` },
  };
}
