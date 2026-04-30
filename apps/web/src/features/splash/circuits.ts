/**
 * Demo circuits for the splash page.
 *
 * Each circuit has:
 * - displayCode: The circuit definition shown to users (TS builder syntax)
 * - circuit: The actual BuiltCircuit for simulation
 */

import { circuit, bit } from "@simten/core/circuit";
import type { BuiltCircuit } from "@simten/core/circuit";
import { Nand, Not, And, Or, Xor, DFlipFlop, Switch, Led } from "@simten/core/std";

export interface CircuitDefinition {
  name: string;
  description: string;
  displayCode: string;
  circuit: BuiltCircuit;
}

// ── Gate Circuits (built from NAND only) ──

export const NotGate = circuit('NotGate', {
  inputs: { a: bit },
  outputs: { out: bit },
  nodes: { nand1: Nand },
  connect: ({ inputs, outputs, nodes: { nand1 } }) => [
    inputs.a.to(nand1.a, nand1.b),
    nand1.out.to(outputs.out),
  ],
});

export const AndGate = circuit('AndGate', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  nodes: { nand1: Nand, nand2: Nand },
  connect: ({ inputs, outputs, nodes: { nand1, nand2 } }) => [
    inputs.a.to(nand1.a),
    inputs.b.to(nand1.b),
    nand1.out.to(nand2.a, nand2.b),
    nand2.out.to(outputs.out),
  ],
});

export const OrGate = circuit('OrGate', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  nodes: { not_a: Nand, not_b: Nand, or_out: Nand },
  connect: ({ inputs, outputs, nodes: { not_a, not_b, or_out } }) => [
    inputs.a.to(not_a.a, not_a.b),
    inputs.b.to(not_b.a, not_b.b),
    not_a.out.to(or_out.a),
    not_b.out.to(or_out.b),
    or_out.out.to(outputs.out),
  ],
});

export const XorGate = circuit('XorGate', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  nodes: { nand1: Nand, nand2: Nand, nand3: Nand, nand4: Nand },
  connect: ({ inputs, outputs, nodes: { nand1, nand2, nand3, nand4 } }) => [
    inputs.a.to(nand1.a, nand2.a),
    inputs.b.to(nand1.b, nand3.b),
    nand1.out.to(nand2.b, nand3.a),
    nand2.out.to(nand4.a),
    nand3.out.to(nand4.b),
    nand4.out.to(outputs.out),
  ],
});

export const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
    inputs.a.to(xor1.a, and1.a),
    inputs.b.to(xor1.b, and1.b),
    xor1.out.to(outputs.sum),
    and1.out.to(outputs.carry),
  ],
});

export const FullAdder = circuit('FullAdder', {
  inputs: { a: bit, b: bit, cin: bit },
  outputs: { sum: bit, cout: bit },
  nodes: { ha1: HalfAdder, ha2: HalfAdder, or1: Or },
  connect: ({ inputs, outputs, nodes: { ha1, ha2, or1 } }) => [
    inputs.a.to(ha1.a),
    inputs.b.to(ha1.b),
    ha1.sum.to(ha2.a),
    inputs.cin.to(ha2.b),
    ha2.sum.to(outputs.sum),
    ha1.carry.to(or1.a),
    ha2.carry.to(or1.b),
    or1.out.to(outputs.cout),
  ],
});

export const MuxGate = circuit('MuxGate', {
  inputs: { a: bit, b: bit, sel: bit },
  outputs: { out: bit },
  nodes: { not_sel: Not, and_a: And, and_b: And, or_out: Or },
  connect: ({ inputs, outputs, nodes: { not_sel, and_a, and_b, or_out } }) => [
    inputs.sel.to(not_sel.in, and_b.b),
    inputs.a.to(and_a.a),
    not_sel.out.to(and_a.b),
    inputs.b.to(and_b.a),
    and_a.out.to(or_out.a),
    and_b.out.to(or_out.b),
    or_out.out.to(outputs.out),
  ],
});

export const DelayLine = circuit('DelayLine', {
  inputs: { d: bit },
  outputs: { q1: bit, q2: bit },
  nodes: { dff1: DFlipFlop, dff2: DFlipFlop },
  connect: ({ inputs, outputs, nodes: { dff1, dff2 } }) => [
    inputs.d.to(dff1.d),
    dff1.q.to(dff2.d, outputs.q1),
    dff2.q.to(outputs.q2),
  ],
});

export const CIRCUITS: Record<string, CircuitDefinition> = {
  inverter: {
    name: "NOT Gate",
    description: "Inverts the input signal",
    displayCode: `const NotGate = circuit('NotGate', {
  inputs: { a: bit },
  outputs: { out: bit },
  nodes: { nand1: Nand },
  connect: ({ inputs, outputs, nodes: { nand1 } }) => [
    inputs.a.to(nand1.a, nand1.b),
    nand1.out.to(outputs.out),
  ],
})`,
    circuit: NotGate,
  },

  and: {
    name: "AND Gate",
    description: "Output is 1 only when both inputs are 1",
    displayCode: `const AndGate = circuit('AndGate', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  nodes: { nand1: Nand, nand2: Nand },
  connect: ({ inputs, outputs, nodes: { nand1, nand2 } }) => [
    inputs.a.to(nand1.a),
    inputs.b.to(nand1.b),
    nand1.out.to(nand2.a, nand2.b),
    nand2.out.to(outputs.out),
  ],
})`,
    circuit: AndGate,
  },

  or: {
    name: "OR Gate",
    description: "Output is 1 when either input is 1",
    displayCode: `const OrGate = circuit('OrGate', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  nodes: { not_a: Nand, not_b: Nand, or_out: Nand },
  connect: ({ inputs, outputs, nodes: { not_a, not_b, or_out } }) => [
    inputs.a.to(not_a.a, not_a.b),
    inputs.b.to(not_b.a, not_b.b),
    not_a.out.to(or_out.a),
    not_b.out.to(or_out.b),
    or_out.out.to(outputs.out),
  ],
})`,
    circuit: OrGate,
  },

  xor: {
    name: "XOR Gate",
    description: "Output is 1 when inputs are different",
    displayCode: `const XorGate = circuit('XorGate', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  nodes: { nand1: Nand, nand2: Nand, nand3: Nand, nand4: Nand },
  connect: ({ inputs, outputs, nodes: { nand1, nand2, nand3, nand4 } }) => [
    inputs.a.to(nand1.a, nand2.a),
    inputs.b.to(nand1.b, nand3.b),
    nand1.out.to(nand2.b, nand3.a),
    nand2.out.to(nand4.a),
    nand3.out.to(nand4.b),
    nand4.out.to(outputs.out),
  ],
})`,
    circuit: XorGate,
  },

  halfAdder: {
    name: "Half Adder",
    description: "Adds two bits, outputs sum and carry",
    displayCode: `const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
    inputs.a.to(xor1.a, and1.a),
    inputs.b.to(xor1.b, and1.b),
    xor1.out.to(outputs.sum),
    and1.out.to(outputs.carry),
  ],
})`,
    circuit: HalfAdder,
  },

  fullAdder: {
    name: "Full Adder",
    description: "Adds three bits (a, b, carry-in)",
    displayCode: `const FullAdder = circuit('FullAdder', {
  inputs: { a: bit, b: bit, cin: bit },
  outputs: { sum: bit, cout: bit },
  nodes: { ha1: HalfAdder, ha2: HalfAdder, or1: Or },
  connect: ({ inputs, outputs, nodes: { ha1, ha2, or1 } }) => [
    inputs.a.to(ha1.a),
    inputs.b.to(ha1.b),
    ha1.sum.to(ha2.a),
    inputs.cin.to(ha2.b),
    ha2.sum.to(outputs.sum),
    ha1.carry.to(or1.a),
    ha2.carry.to(or1.b),
    or1.out.to(outputs.cout),
  ],
})`,
    circuit: FullAdder,
  },

  mux: {
    name: "Multiplexer",
    description: "sel=0 picks a, sel=1 picks b",
    displayCode: `const MuxGate = circuit('MuxGate', {
  inputs: { a: bit, b: bit, sel: bit },
  outputs: { out: bit },
  nodes: { not_sel: Not, and_a: And, and_b: And, or_out: Or },
  connect: ({ inputs, outputs, nodes: { not_sel, and_a, and_b, or_out } }) => [
    inputs.sel.to(not_sel.in, and_b.b),
    inputs.a.to(and_a.a),
    not_sel.out.to(and_a.b),
    inputs.b.to(and_b.a),
    and_a.out.to(or_out.a),
    and_b.out.to(or_out.b),
    or_out.out.to(outputs.out),
  ],
})`,
    circuit: MuxGate,
  },

  delayLine: {
    name: "2-Cycle Delay",
    description: "Data takes 2 clock ticks to reach output",
    displayCode: `const DelayLine = circuit('DelayLine', {
  inputs: { d: bit },
  outputs: { q1: bit, q2: bit },
  nodes: { dff1: DFlipFlop, dff2: DFlipFlop },
  connect: ({ inputs, outputs, nodes: { dff1, dff2 } }) => [
    inputs.d.to(dff1.d),
    dff1.q.to(dff2.d, outputs.q1),
    dff2.q.to(outputs.q2),
  ],
})`,
    circuit: DelayLine,
  },
};

export const CIRCUIT_KEYS = Object.keys(CIRCUITS) as (keyof typeof CIRCUITS)[];
