/**
 * Demo circuits for the splash page.
 *
 * Each circuit has:
 * - displayCode: The circuit definition shown to users (TS builder syntax)
 * - code: Full TS code including wrapper with Switch/LED nodes for simulation
 */

export interface CircuitDefinition {
  name: string;
  description: string;
  displayDsl: string;
  dsl: string;
}

export const CIRCUITS: Record<string, CircuitDefinition> = {
  inverter: {
    name: "NOT Gate",
    description: "Inverts the input signal",
    displayDsl: `const NotGate = component('NotGate', {
  in: { a: bit },
  out: { out: bit },
  nodes: { nand1: Nand },
  connect: ({ in: inp, out, nand1 }) => [
    inp.a.to(nand1.a, nand1.b),
    nand1.out.to(out.out),
  ],
})`,
    dsl: `
const NotGate = component('NotGate', {
  in: { a: bit },
  out: { out: bit },
  nodes: { nand1: Nand },
  connect: ({ in: inp, out, nand1 }) => [
    inp.a.to(nand1.a, nand1.b),
    nand1.out.to(out.out),
  ],
})

const DemoNot = component('DemoNot', {
  nodes: { sw_a: Switch, dut: NotGate, led_out: Led },
  connect: ({ sw_a, dut, led_out }) => [
    sw_a.out.to(dut.a),
    dut.out.to(led_out.in),
  ],
})`,
  },

  and: {
    name: "AND Gate",
    description: "Output is 1 only when both inputs are 1",
    displayDsl: `const AndGate = component('AndGate', {
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
    dsl: `
const AndGate = component('AndGate', {
  in: { a: bit, b: bit },
  out: { out: bit },
  nodes: { nand1: Nand, nand2: Nand },
  connect: ({ in: inp, out, nand1, nand2 }) => [
    inp.a.to(nand1.a),
    inp.b.to(nand1.b),
    nand1.out.to(nand2.a, nand2.b),
    nand2.out.to(out.out),
  ],
})

const DemoAnd = component('DemoAnd', {
  nodes: { sw_a: Switch, sw_b: Switch, dut: AndGate, led_out: Led },
  connect: ({ sw_a, sw_b, dut, led_out }) => [
    sw_a.out.to(dut.a),
    sw_b.out.to(dut.b),
    dut.out.to(led_out.in),
  ],
})`,
  },

  or: {
    name: "OR Gate",
    description: "Output is 1 when either input is 1",
    displayDsl: `const OrGate = component('OrGate', {
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
    dsl: `
const OrGate = component('OrGate', {
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
})

const DemoOr = component('DemoOr', {
  nodes: { sw_a: Switch, sw_b: Switch, dut: OrGate, led_out: Led },
  connect: ({ sw_a, sw_b, dut, led_out }) => [
    sw_a.out.to(dut.a),
    sw_b.out.to(dut.b),
    dut.out.to(led_out.in),
  ],
})`,
  },

  xor: {
    name: "XOR Gate",
    description: "Output is 1 when inputs are different",
    displayDsl: `const XorGate = component('XorGate', {
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
    dsl: `
const XorGate = component('XorGate', {
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
})

const DemoXor = component('DemoXor', {
  nodes: { sw_a: Switch, sw_b: Switch, dut: XorGate, led_out: Led },
  connect: ({ sw_a, sw_b, dut, led_out }) => [
    sw_a.out.to(dut.a),
    sw_b.out.to(dut.b),
    dut.out.to(led_out.in),
  ],
})`,
  },

  halfAdder: {
    name: "Half Adder",
    description: "Adds two bits, outputs sum and carry",
    displayDsl: `const HalfAdder = component('HalfAdder', {
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
    dsl: `
const HalfAdder = component('HalfAdder', {
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

const DemoHalfAdder = component('DemoHalfAdder', {
  nodes: { sw_a: Switch, sw_b: Switch, dut: HalfAdder, led_sum: Led, led_carry: Led },
  connect: ({ sw_a, sw_b, dut, led_sum, led_carry }) => [
    sw_a.out.to(dut.a),
    sw_b.out.to(dut.b),
    dut.sum.to(led_sum.in),
    dut.carry.to(led_carry.in),
  ],
})`,
  },

  fullAdder: {
    name: "Full Adder",
    description: "Adds three bits (a, b, carry-in)",
    displayDsl: `const FullAdder = component('FullAdder', {
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
    dsl: `
const HalfAdder = component('HalfAdder', {
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

const FullAdder = component('FullAdder', {
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
})

const DemoFullAdder = component('DemoFullAdder', {
  nodes: { sw_a: Switch, sw_b: Switch, sw_cin: Switch, dut: FullAdder, led_sum: Led, led_cout: Led },
  connect: ({ sw_a, sw_b, sw_cin, dut, led_sum, led_cout }) => [
    sw_a.out.to(dut.a),
    sw_b.out.to(dut.b),
    sw_cin.out.to(dut.cin),
    dut.sum.to(led_sum.in),
    dut.cout.to(led_cout.in),
  ],
})`,
  },

  mux: {
    name: "Multiplexer",
    description: "sel=0 picks a, sel=1 picks b",
    displayDsl: `const MuxGate = component('MuxGate', {
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
    dsl: `
const MuxGate = component('MuxGate', {
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
})

const DemoMux = component('DemoMux', {
  nodes: { sw_a: Switch, sw_b: Switch, sw_sel: Switch, dut: MuxGate, led_out: Led },
  connect: ({ sw_a, sw_b, sw_sel, dut, led_out }) => [
    sw_a.out.to(dut.a),
    sw_b.out.to(dut.b),
    sw_sel.out.to(dut.sel),
    dut.out.to(led_out.in),
  ],
})`,
  },

  delayLine: {
    name: "2-Cycle Delay",
    description: "Data takes 2 clock ticks to reach output",
    displayDsl: `const DelayLine = component('DelayLine', {
  in: { d: bit },
  out: { q1: bit, q2: bit },
  nodes: { dff1: DFlipFlop, dff2: DFlipFlop },
  connect: ({ in: inp, out, dff1, dff2 }) => [
    inp.d.to(dff1.d),
    dff1.q.to(dff2.d, out.q1),
    dff2.q.to(out.q2),
  ],
})`,
    dsl: `
const DelayLine = component('DelayLine', {
  in: { d: bit },
  out: { q1: bit, q2: bit },
  nodes: { dff1: DFlipFlop, dff2: DFlipFlop },
  connect: ({ in: inp, out, dff1, dff2 }) => [
    inp.d.to(dff1.d),
    dff1.q.to(dff2.d, out.q1),
    dff2.q.to(out.q2),
  ],
})

const DemoDelayLine = component('DemoDelayLine', {
  nodes: { sw_d: Switch, dut: DelayLine, led_q1: Led, led_q2: Led },
  connect: ({ sw_d, dut, led_q1, led_q2 }) => [
    sw_d.out.to(dut.d),
    dut.q1.to(led_q1.in),
    dut.q2.to(led_q2.in),
  ],
})`,
  },
};

export const CIRCUIT_KEYS = Object.keys(CIRCUITS) as (keyof typeof CIRCUITS)[];
