/**
 * Demo circuits for the splash page.
 *
 * Each circuit has:
 * - displayCode: The circuit definition shown to users (TS builder syntax)
 * - circuit: The actual BuiltCircuit for simulation
 */

import { circuit, bit } from "@turing-incomplete/core/circuit";
import type { BuiltCircuit } from "@turing-incomplete/core/circuit";
import { Nand, Not, And, Or, Xor, DFlipFlop, Switch, Led } from "@turing-incomplete/core/std";

export interface CircuitDefinition {
  name: string;
  description: string;
  displayCode: string;
  circuit: BuiltCircuit;
}

// ── Gate Circuits (built from NAND only) ──

export const NotGate = circuit('NotGate', {
  in: { a: bit },
  out: { out: bit },
  nodes: { nand1: Nand },
  connect: ({ in: inp, out, nand1 }) => [
    inp.a.to(nand1.a, nand1.b),
    nand1.out.to(out.out),
  ],
});

export const AndGate = circuit('AndGate', {
  in: { a: bit, b: bit },
  out: { out: bit },
  nodes: { nand1: Nand, nand2: Nand },
  connect: ({ in: inp, out, nand1, nand2 }) => [
    inp.a.to(nand1.a),
    inp.b.to(nand1.b),
    nand1.out.to(nand2.a, nand2.b),
    nand2.out.to(out.out),
  ],
});

export const OrGate = circuit('OrGate', {
  in: { a: bit, b: bit },
  out: { out: bit },
  nodes: { not_a: Nand, not_b: Nand, or_out: Nand },
  connect: ({ in: inp, out, not_a, not_b, or_out }) => [
    inp.a.to(not_a.a, not_a.b),
    inp.b.to(not_b.a, not_b.b),
    not_a.out.to(or_out.a),
    not_b.out.to(or_out.b),
    or_out.out.to(out.out),
  ],
});

export const XorGate = circuit('XorGate', {
  in: { a: bit, b: bit },
  out: { out: bit },
  nodes: { nand1: Nand, nand2: Nand, nand3: Nand, nand4: Nand },
  connect: ({ in: inp, out, nand1, nand2, nand3, nand4 }) => [
    inp.a.to(nand1.a, nand2.a),
    inp.b.to(nand1.b, nand3.b),
    nand1.out.to(nand2.b, nand3.a),
    nand2.out.to(nand4.a),
    nand3.out.to(nand4.b),
    nand4.out.to(out.out),
  ],
});

export const HalfAdder = circuit('HalfAdder', {
  in: { a: bit, b: bit },
  out: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
  ],
});

export const FullAdder = circuit('FullAdder', {
  in: { a: bit, b: bit, cin: bit },
  out: { sum: bit, cout: bit },
  nodes: { ha1: HalfAdder, ha2: HalfAdder, or1: Or },
  connect: ({ in: inp, out, ha1, ha2, or1 }) => [
    inp.a.to(ha1.a),
    inp.b.to(ha1.b),
    ha1.sum.to(ha2.a),
    inp.cin.to(ha2.b),
    ha2.sum.to(out.sum),
    ha1.carry.to(or1.a),
    ha2.carry.to(or1.b),
    or1.out.to(out.cout),
  ],
});

export const MuxGate = circuit('MuxGate', {
  in: { a: bit, b: bit, sel: bit },
  out: { out: bit },
  nodes: { not_sel: Not, and_a: And, and_b: And, or_out: Or },
  connect: ({ in: inp, out, not_sel, and_a, and_b, or_out }) => [
    inp.sel.to(not_sel.in, and_b.b),
    inp.a.to(and_a.a),
    not_sel.out.to(and_a.b),
    inp.b.to(and_b.a),
    and_a.out.to(or_out.a),
    and_b.out.to(or_out.b),
    or_out.out.to(out.out),
  ],
});

export const DelayLine = circuit('DelayLine', {
  in: { d: bit },
  out: { q1: bit, q2: bit },
  nodes: { dff1: DFlipFlop, dff2: DFlipFlop },
  connect: ({ in: inp, out, dff1, dff2 }) => [
    inp.d.to(dff1.d),
    dff1.q.to(dff2.d, out.q1),
    dff2.q.to(out.q2),
  ],
});

export const CIRCUITS: Record<string, CircuitDefinition> = {
  inverter: {
    name: "NOT Gate",
    description: "Inverts the input signal",
    displayCode: `const NotGate = circuit('NotGate', {
  in: { a: bit },
  out: { out: bit },
  nodes: { nand1: Nand },
  connect: ({ in: inp, out, nand1 }) => [
    inp.a.to(nand1.a, nand1.b),
    nand1.out.to(out.out),
  ],
})`,
    circuit: NotGate,
  },

  and: {
    name: "AND Gate",
    description: "Output is 1 only when both inputs are 1",
    displayCode: `const AndGate = circuit('AndGate', {
  in: { a: bit, b: bit },
  out: { out: bit },
  nodes: { nand1: Nand, nand2: Nand },
  connect: ({ in: inp, out, nand1, nand2 }) => [
    inp.a.to(nand1.a),
    inp.b.to(nand1.b),
    nand1.out.to(nand2.a, nand2.b),
    nand2.out.to(out.out),
  ],
})`,
    circuit: AndGate,
  },

  or: {
    name: "OR Gate",
    description: "Output is 1 when either input is 1",
    displayCode: `const OrGate = circuit('OrGate', {
  in: { a: bit, b: bit },
  out: { out: bit },
  nodes: { not_a: Nand, not_b: Nand, or_out: Nand },
  connect: ({ in: inp, out, not_a, not_b, or_out }) => [
    inp.a.to(not_a.a, not_a.b),
    inp.b.to(not_b.a, not_b.b),
    not_a.out.to(or_out.a),
    not_b.out.to(or_out.b),
    or_out.out.to(out.out),
  ],
})`,
    circuit: OrGate,
  },

  xor: {
    name: "XOR Gate",
    description: "Output is 1 when inputs are different",
    displayCode: `const XorGate = circuit('XorGate', {
  in: { a: bit, b: bit },
  out: { out: bit },
  nodes: { nand1: Nand, nand2: Nand, nand3: Nand, nand4: Nand },
  connect: ({ in: inp, out, nand1, nand2, nand3, nand4 }) => [
    inp.a.to(nand1.a, nand2.a),
    inp.b.to(nand1.b, nand3.b),
    nand1.out.to(nand2.b, nand3.a),
    nand2.out.to(nand4.a),
    nand3.out.to(nand4.b),
    nand4.out.to(out.out),
  ],
})`,
    circuit: XorGate,
  },

  halfAdder: {
    name: "Half Adder",
    description: "Adds two bits, outputs sum and carry",
    displayCode: `const HalfAdder = circuit('HalfAdder', {
  in: { a: bit, b: bit },
  out: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
  ],
})`,
    circuit: HalfAdder,
  },

  fullAdder: {
    name: "Full Adder",
    description: "Adds three bits (a, b, carry-in)",
    displayCode: `const FullAdder = circuit('FullAdder', {
  in: { a: bit, b: bit, cin: bit },
  out: { sum: bit, cout: bit },
  nodes: { ha1: HalfAdder, ha2: HalfAdder, or1: Or },
  connect: ({ in: inp, out, ha1, ha2, or1 }) => [
    inp.a.to(ha1.a),
    inp.b.to(ha1.b),
    ha1.sum.to(ha2.a),
    inp.cin.to(ha2.b),
    ha2.sum.to(out.sum),
    ha1.carry.to(or1.a),
    ha2.carry.to(or1.b),
    or1.out.to(out.cout),
  ],
})`,
    circuit: FullAdder,
  },

  mux: {
    name: "Multiplexer",
    description: "sel=0 picks a, sel=1 picks b",
    displayCode: `const MuxGate = circuit('MuxGate', {
  in: { a: bit, b: bit, sel: bit },
  out: { out: bit },
  nodes: { not_sel: Not, and_a: And, and_b: And, or_out: Or },
  connect: ({ in: inp, out, not_sel, and_a, and_b, or_out }) => [
    inp.sel.to(not_sel.in, and_b.b),
    inp.a.to(and_a.a),
    not_sel.out.to(and_a.b),
    inp.b.to(and_b.a),
    and_a.out.to(or_out.a),
    and_b.out.to(or_out.b),
    or_out.out.to(out.out),
  ],
})`,
    circuit: MuxGate,
  },

  delayLine: {
    name: "2-Cycle Delay",
    description: "Data takes 2 clock ticks to reach output",
    displayCode: `const DelayLine = circuit('DelayLine', {
  in: { d: bit },
  out: { q1: bit, q2: bit },
  nodes: { dff1: DFlipFlop, dff2: DFlipFlop },
  connect: ({ in: inp, out, dff1, dff2 }) => [
    inp.d.to(dff1.d),
    dff1.q.to(dff2.d, out.q1),
    dff2.q.to(out.q2),
  ],
})`,
    circuit: DelayLine,
  },
};

export const CIRCUIT_KEYS = Object.keys(CIRCUITS) as (keyof typeof CIRCUITS)[];
