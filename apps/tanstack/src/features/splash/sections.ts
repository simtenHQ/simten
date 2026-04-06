/**
 * Section definitions for the scrolling splash page.
 * Each section tells part of the story and has an interactive circuit.
 */

export interface SectionDef {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  hint?: string;
  dsl: string;
  align: "left" | "right";
}

export const SECTIONS: SectionDef[] = [
  {
    id: "nand",
    title: "Everything starts with NAND",
    subtitle: "The universal gate",
    description:
      "A NAND gate outputs 0 only when both inputs are 1. That's it. From this simple rule, we can build an entire computer.",
    hint: "Click the inputs to toggle them",
    align: "right",
    dsl: `
const NandDemo = circuit('NandDemo', {
  nodes: { in_a: Switch, in_b: Switch, gate: Nand, out: Led },
  connect: ({ in_a, in_b, gate, out }) => [
    in_a.out.to(gate.a),
    in_b.out.to(gate.b),
    gate.out.to(out.in),
  ],
})`,
  },
  {
    id: "not",
    title: "Two inputs, one wire",
    subtitle: "Building NOT from NAND",
    description:
      "Connect both inputs of a NAND to the same signal. Now 1 becomes 0, and 0 becomes 1. We've built an inverter.",
    align: "left",
    dsl: `
const NotDemo = circuit('NotDemo', {
  nodes: { sw_in: Switch, gate: Nand, out: Led },
  connect: ({ sw_in, gate, out }) => [
    sw_in.out.to(gate.a, gate.b),
    gate.out.to(out.in),
  ],
})`,
  },
  {
    id: "and",
    title: "Invert the NAND",
    subtitle: "Building AND",
    description:
      "NAND gives us the opposite of AND. So put a NOT after it. Two NANDs working together give us AND logic.",
    align: "right",
    dsl: `
const AndDemo = circuit('AndDemo', {
  nodes: { in_a: Switch, in_b: Switch, nand1: Nand, nand2: Nand, out: Led },
  connect: ({ in_a, in_b, nand1, nand2, out }) => [
    in_a.out.to(nand1.a),
    in_b.out.to(nand1.b),
    nand1.out.to(nand2.a, nand2.b),
    nand2.out.to(out.in),
  ],
})`,
  },
  {
    id: "or",
    title: "Flip the logic",
    subtitle: "Building OR",
    description:
      "Invert each input, then NAND them together. Output is 1 when either input is 1. Three NANDs make an OR gate.",
    align: "left",
    dsl: `
const OrDemo = circuit('OrDemo', {
  nodes: { in_a: Switch, in_b: Switch, not_a: Nand, not_b: Nand, or_out: Nand, out: Led },
  connect: ({ in_a, in_b, not_a, not_b, or_out, out }) => [
    in_a.out.to(not_a.a, not_a.b),
    in_b.out.to(not_b.a, not_b.b),
    not_a.out.to(or_out.a),
    not_b.out.to(or_out.b),
    or_out.out.to(out.in),
  ],
})`,
  },
  {
    id: "xor",
    title: "The odd one out",
    subtitle: "Building XOR",
    description:
      "XOR outputs 1 when inputs are different. It's trickier to build, but still just four NANDs arranged cleverly.",
    align: "right",
    dsl: `
const XorDemo = circuit('XorDemo', {
  nodes: { in_a: Switch, in_b: Switch, nand1: Nand, nand2: Nand, nand3: Nand, nand4: Nand, out: Led },
  connect: ({ in_a, in_b, nand1, nand2, nand3, nand4, out }) => [
    in_a.out.to(nand1.a, nand2.a),
    in_b.out.to(nand1.b, nand3.b),
    nand1.out.to(nand2.b, nand3.a),
    nand2.out.to(nand4.a),
    nand3.out.to(nand4.b),
    nand4.out.to(out.in),
  ],
})`,
  },
  {
    id: "half-adder",
    title: "Now we can add",
    subtitle: "The Half Adder",
    description:
      "XOR tells us if the sum is odd. AND tells us if we need to carry. Together they add two bits. This is arithmetic.",
    hint: "Try: 0+0=00, 0+1=01, 1+0=01, 1+1=10",
    align: "left",
    dsl: `
const HalfAdderDemo = circuit('HalfAdderDemo', {
  nodes: { in_a: Switch, in_b: Switch, xor1: Xor, and1: And, sum: Led, carry: Led },
  connect: ({ in_a, in_b, xor1, and1, sum, carry }) => [
    in_a.out.to(xor1.a, and1.a),
    in_b.out.to(xor1.b, and1.b),
    xor1.out.to(sum.in),
    and1.out.to(carry.in),
  ],
})`,
  },
  {
    id: "full-adder",
    title: "Chain them together",
    subtitle: "The Full Adder",
    description:
      "A full adder takes a carry-in from the previous bit. Chain these together and you can add any size numbers.",
    hint: "Three inputs: A, B, and Carry-in",
    align: "right",
    dsl: `
const HalfAdder4 = circuit('HalfAdder4', {
  in: { a: bit, b: bit },
  out: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
  ],
})

const FullAdderDemo = circuit('FullAdderDemo', {
  nodes: { in_a: Switch, in_b: Switch, in_cin: Switch, ha1: HalfAdder4, ha2: HalfAdder4, or1: Or, sum: Led, cout: Led },
  connect: ({ in_a, in_b, in_cin, ha1, ha2, or1, sum, cout }) => [
    in_a.out.to(ha1.a),
    in_b.out.to(ha1.b),
    ha1.sum.to(ha2.a),
    in_cin.out.to(ha2.b),
    ha2.sum.to(sum.in),
    ha1.carry.to(or1.a),
    ha2.carry.to(or1.b),
    or1.out.to(cout.in),
  ],
})`,
  },
  {
    id: "memory",
    title: "Add memory",
    subtitle: "The D Flip-Flop",
    description:
      "So far, circuits forget immediately. A flip-flop remembers. On each clock tick, it captures the input and holds it until the next tick.",
    hint: "Set input, then click Tick to capture",
    align: "left",
    dsl: `
const MemoryDemo = circuit('MemoryDemo', {
  nodes: { sw_in: Switch, dff: DFlipFlop, stored: Led },
  connect: ({ sw_in, dff, stored }) => [
    sw_in.out.to(dff.d),
    dff.q.to(stored.in),
  ],
})`,
  },
];
