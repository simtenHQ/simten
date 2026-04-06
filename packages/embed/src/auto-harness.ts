/**
 * Auto-harness generator for CircuitEmbed.
 *
 * Takes a circuit with inputs/outputs and wraps it in a harness circuit
 * with Switch nodes for inputs and Led nodes for outputs.
 * If the circuit has no ports (already self-contained), returns it as-is.
 */

import type { Circuit, Connection, Node, PortDescriptor, PortType, ArgumentValue } from "@turing-incomplete/core";

const BIT: PortType = { kind: 'bit' };

let harnessCounter = 0;

export function autoHarness(
  circuit: Circuit,
  library: { resolveCircuit: (name: string) => Circuit | undefined; addCircuit: (c: Circuit) => void },
  initialInputs?: Record<string, number | boolean>,
): Circuit {
  // No ports = already a self-contained harness
  if (circuit.inputs.length === 0 && circuit.outputs.length === 0) {
    return circuit;
  }

  // Register the circuit in the library so the harness can reference it
  if (!library.resolveCircuit(circuit.name)) {
    library.addCircuit(circuit);
  }

  const harnessId = `__harness_${++harnessCounter}`;
  const harnessName = `${circuit.name}Demo`;

  const nodes: Node[] = [];
  const connections: Connection[] = [];
  let connId = 0;

  // DUT node
  const dutNode: Node = {
    id: 'dut',
    componentRef: circuit.name,
    arguments: {},
    inputs: circuit.inputs.map(p => ({ name: p.name, portType: p.portType })),
    outputs: circuit.outputs.map(p => ({ name: p.name, portType: p.portType })),
    clocks: circuit.clocks.map(c => ({ name: c.name, edge: c.edge })),
  };
  nodes.push(dutNode);

  // Switch/Input node for each input
  for (const input of circuit.inputs) {
    const isBit = input.portType.kind === 'bit';
    const args: Record<string, ArgumentValue> = {};
    if (!isBit && input.portType.kind === 'bus') {
      args.width = input.portType.width;
    }
    if (initialInputs && input.name in initialInputs) {
      args.value = initialInputs[input.name];
    }
    const switchNode: Node = {
      id: input.name,
      label: input.name,
      componentRef: isBit ? 'Switch' : 'Input',
      arguments: args,
      inputs: [],
      outputs: [{ name: 'out', portType: input.portType }],
      clocks: [],
    };
    nodes.push(switchNode);

    connections.push({
      id: `c${connId++}`,
      source: { nodeId: input.name, portName: 'out' },
      target: { nodeId: 'dut', portName: input.name },
      portType: input.portType,
    });
  }

  // Led/HexDisplay node for each output
  for (const output of circuit.outputs) {
    const isBit = output.portType.kind === 'bit';
    const outArgs: Record<string, ArgumentValue> = {};
    if (!isBit && output.portType.kind === 'bus') {
      outArgs.width = output.portType.width;
    }
    const ledNode: Node = {
      id: output.name,
      label: output.name,
      componentRef: isBit ? 'Led' : 'HexDisplay',
      arguments: outArgs,
      inputs: [{ name: 'in', portType: output.portType }],
      outputs: [],
      clocks: [],
    };
    nodes.push(ledNode);

    connections.push({
      id: `c${connId++}`,
      source: { nodeId: 'dut', portName: output.name },
      target: { nodeId: output.name, portName: 'in' },
      portType: output.portType,
    });
  }

  const harness: Circuit = {
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

  return harness;
}
