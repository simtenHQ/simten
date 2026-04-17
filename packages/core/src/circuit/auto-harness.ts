/**
 * Auto-harness generator.
 *
 * Takes a circuit with inputs/outputs and wraps it in a harness circuit
 * with Switch nodes for bit inputs, Input nodes for bus inputs,
 * Led nodes for bit outputs, and HexDisplay nodes for bus outputs.
 *
 * If the circuit has no ports (already self-contained), returns it as-is.
 * No code execution — pure Circuit IR construction.
 */

import type { Circuit, Connection, Node, ArgumentValue } from '../types/circuit.js';

export function autoHarness(
  circuit: Circuit,
  library: { resolveCircuit: (name: string) => Circuit | undefined; addCircuit: (c: Circuit) => void },
  initialInputs?: Record<string, number | boolean>,
): Circuit {
  // No ports = already a self-contained harness
  if (circuit.inputs.length === 0 && circuit.outputs.length === 0) {
    return circuit;
  }

  // Register the circuit in the library so the harness can reference it by name
  if (!library.resolveCircuit(circuit.name)) {
    library.addCircuit(circuit);
  }

  const harnessId = `__harness_${circuit.name}`;
  const harnessName = `${circuit.name}Demo`;

  const nodes: Node[] = [];
  const connections: Connection[] = [];
  let connId = 0;

  // DUT node
  nodes.push({
    id: 'dut',
    componentRef: circuit.name,
    arguments: {},
    inputs: circuit.inputs.map(p => ({ id: `dut.${p.name}`, name: p.name, portType: p.portType })),
    outputs: circuit.outputs.map(p => ({ id: `dut.${p.name}`, name: p.name, portType: p.portType })),
    clocks: circuit.clocks.map(c => ({ id: `dut.${c.name}`, name: c.name })),
  });

  // Switch / Input node for each input port
  for (const input of circuit.inputs) {
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

  // Led / HexDisplay node for each output port
  for (const output of circuit.outputs) {
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
    id: harnessId,
    name: harnessName,
    parameters: [],
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
