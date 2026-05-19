/**
 * Circuit definitions for the "Abstraction" learn page.
 *
 * Each pair (flat vs encapsulated) implements the same function with the
 * same external ports; only the internal topology differs. The whole page
 * lives or dies on that side-by-side comparison being convincing.
 *
 * TODO: many of these reuse the gate-level pattern from /learn/adders.
 * If you end up wanting to share circuits across pages, factor them into
 * a features/learn/_shared/ module. For now the page is self-contained.
 */

import { circuit, bit, bus } from "@simten/core/circuit";
import type { BlogCircuit } from "@/features/blog/types";
import {
  And,
  Xor,
  Or,
  Switch,
  Led,
  Input,
  HexDisplay,
  Constant,
  Splitter8to8,
  Combiner8to8,
} from "@simten/core/std";

// ── Subcircuits (the "abstracted" building blocks) ─────────────────────

const HalfAdder = circuit("HalfAdder", {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { xorGate: Xor, andGate: And },
  connect: ({ inputs, outputs, nodes: { xorGate, andGate } }) => [
    inputs.a.to(xorGate.a, andGate.a),
    inputs.b.to(xorGate.b, andGate.b),
    xorGate.out.to(outputs.sum),
    andGate.out.to(outputs.carry),
  ],
});

const FullAdder = circuit("FullAdder", {
  inputs: { a: bit, b: bit, cin: bit },
  outputs: { sum: bit, cout: bit },
  nodes: {
    ha1: HalfAdder,
    ha2: HalfAdder,
    orGate: Or,
  },
  connect: ({ inputs, outputs, nodes: { ha1, ha2, orGate } }) => [
    inputs.a.to(ha1.a),
    inputs.b.to(ha1.b),
    ha1.sum.to(ha2.a),
    inputs.cin.to(ha2.b),
    ha2.sum.to(outputs.sum),
    ha1.carry.to(orGate.a),
    ha2.carry.to(orGate.b),
    orGate.out.to(outputs.cout),
  ],
});

// ── Section 2: same circuit, two ways ──────────────────────────────────
// Flat half-adder — XOR and AND wired directly. No subcircuit.

const FlatHalfAdderDemo = circuit("FlatHalfAdderDemo", {
  nodes: {
    a: Switch(),
    b: Switch(),
    xorGate: Xor,
    andGate: And,
    sumLed: Led,
    carryLed: Led,
  },
  connect: ({ nodes: { a, b, xorGate, andGate, sumLed, carryLed } }) => [
    a.out.to(xorGate.a, andGate.a),
    b.out.to(xorGate.b, andGate.b),
    xorGate.out.to(sumLed.in),
    andGate.out.to(carryLed.in),
  ],
});

// Encapsulated half-adder — uses the named HalfAdder subcircuit.

const EncapsulatedHalfAdderDemo = circuit("EncapsulatedHalfAdderDemo", {
  nodes: {
    a: Switch(),
    b: Switch(),
    ha: HalfAdder,
    sumLed: Led,
    carryLed: Led,
  },
  connect: ({ nodes: { a, b, ha, sumLed, carryLed } }) => [
    a.out.to(ha.a),
    b.out.to(ha.b),
    ha.sum.to(sumLed.in),
    ha.carry.to(carryLed.in),
  ],
});

// ── Section 3: building up — full adder, two ways ──────────────────────
// Flat full adder — all five gates exposed (two XOR, two AND, one OR).

const FlatFullAdderDemo = circuit("FlatFullAdderDemo", {
  nodes: {
    a: Switch(),
    b: Switch(),
    cin: Switch(),
    xor1: Xor,
    xor2: Xor,
    and1: And,
    and2: And,
    orGate: Or,
    sumLed: Led,
    coutLed: Led,
  },
  connect: ({
    nodes: { a, b, cin, xor1, xor2, and1, and2, orGate, sumLed, coutLed },
  }) => [
    // First half-adder (flattened): a + b
    a.out.to(xor1.a, and1.a),
    b.out.to(xor1.b, and1.b),
    // Second half-adder (flattened): partial_sum + cin
    xor1.out.to(xor2.a, and2.a),
    cin.out.to(xor2.b, and2.b),
    // Sum
    xor2.out.to(sumLed.in),
    // Carry-out = and1 OR and2
    and1.out.to(orGate.a),
    and2.out.to(orGate.b),
    orGate.out.to(coutLed.in),
  ],
});

// Composed full adder — two HalfAdder subcircuits + an OR. Same behavior.

const ComposedFullAdderDemo = circuit("ComposedFullAdderDemo", {
  nodes: {
    a: Switch(),
    b: Switch(),
    cin: Switch(),
    fa: FullAdder,
    sumLed: Led,
    coutLed: Led,
  },
  connect: ({ nodes: { a, b, cin, fa, sumLed, coutLed } }) => [
    a.out.to(fa.a),
    b.out.to(fa.b),
    cin.out.to(fa.cin),
    fa.sum.to(sumLed.in),
    fa.cout.to(coutLed.in),
  ],
});

// ── Section 4: scaling — an 8-bit adder built from FullAdders ──────────
// A real composed multi-bit adder. The "flat" version would have 40+
// gates with criss-crossing carry wires — we don't render that; the
// prose makes the legibility argument, and the composed version below
// is the proof. Uses Splitter8to8/Combiner8to8 to bridge the bus(8)
// external ports to/from the bit-level full-adder chain inside.

const EightBitAdder = circuit("EightBitAdder", {
  inputs: { a: bus(8), b: bus(8), cin: bit },
  outputs: { sum: bus(8), cout: bit },
  nodes: {
    splitA: Splitter8to8,
    splitB: Splitter8to8,
    fa0: FullAdder, fa1: FullAdder, fa2: FullAdder, fa3: FullAdder,
    fa4: FullAdder, fa5: FullAdder, fa6: FullAdder, fa7: FullAdder,
    combineSum: Combiner8to8,
  },
  connect: ({ inputs, outputs, nodes }) => [
    inputs.a.to(nodes.splitA.in),
    inputs.b.to(nodes.splitB.in),

    nodes.splitA.bit0.to(nodes.fa0.a),
    nodes.splitB.bit0.to(nodes.fa0.b),
    inputs.cin.to(nodes.fa0.cin),

    nodes.splitA.bit1.to(nodes.fa1.a),
    nodes.splitB.bit1.to(nodes.fa1.b),
    nodes.fa0.cout.to(nodes.fa1.cin),

    nodes.splitA.bit2.to(nodes.fa2.a),
    nodes.splitB.bit2.to(nodes.fa2.b),
    nodes.fa1.cout.to(nodes.fa2.cin),

    nodes.splitA.bit3.to(nodes.fa3.a),
    nodes.splitB.bit3.to(nodes.fa3.b),
    nodes.fa2.cout.to(nodes.fa3.cin),

    nodes.splitA.bit4.to(nodes.fa4.a),
    nodes.splitB.bit4.to(nodes.fa4.b),
    nodes.fa3.cout.to(nodes.fa4.cin),

    nodes.splitA.bit5.to(nodes.fa5.a),
    nodes.splitB.bit5.to(nodes.fa5.b),
    nodes.fa4.cout.to(nodes.fa5.cin),

    nodes.splitA.bit6.to(nodes.fa6.a),
    nodes.splitB.bit6.to(nodes.fa6.b),
    nodes.fa5.cout.to(nodes.fa6.cin),

    nodes.splitA.bit7.to(nodes.fa7.a),
    nodes.splitB.bit7.to(nodes.fa7.b),
    nodes.fa6.cout.to(nodes.fa7.cin),

    nodes.fa0.sum.to(nodes.combineSum.bit0),
    nodes.fa1.sum.to(nodes.combineSum.bit1),
    nodes.fa2.sum.to(nodes.combineSum.bit2),
    nodes.fa3.sum.to(nodes.combineSum.bit3),
    nodes.fa4.sum.to(nodes.combineSum.bit4),
    nodes.fa5.sum.to(nodes.combineSum.bit5),
    nodes.fa6.sum.to(nodes.combineSum.bit6),
    nodes.fa7.sum.to(nodes.combineSum.bit7),

    nodes.combineSum.out.to(outputs.sum),
    nodes.fa7.cout.to(outputs.cout),
  ],
});

const EightBitAdderDemo = circuit("EightBitAdderDemo", {
  nodes: {
    a: Input({ value: 0b00001111 }),
    b: Input({ value: 0b00000101 }),
    cin: Constant({ value: 0 }),
    adder: EightBitAdder,
    sumDisplay: HexDisplay,
    coutLed: Led,
  },
  connect: ({ nodes: { a, b, cin, adder, sumDisplay, coutLed } }) => [
    a.out.to(adder.a),
    b.out.to(adder.b),
    cin.out.to(adder.cin),
    adder.sum.to(sumDisplay.in),
    adder.cout.to(coutLed.in),
  ],
});

// ── Export ─────────────────────────────────────────────────────────────

export const ABSTRACTION_CIRCUITS = {
  flatHalfAdder: {
    name: "Half adder — gates exposed",
    description:
      "XOR and AND wired directly. Same behavior as the encapsulated version below.",
    circuit: FlatHalfAdderDemo,
  },
  encapsulatedHalfAdder: {
    name: "Half adder — encapsulated",
    description:
      "Same circuit, named as a single 'HalfAdder' node. Behavior identical.",
    circuit: EncapsulatedHalfAdderDemo,
  },
  flatFullAdder: {
    name: "Full adder — five gates exposed",
    description:
      "Two XORs, two ANDs, one OR. The whole structure visible at once.",
    circuit: FlatFullAdderDemo,
  },
  composedFullAdder: {
    name: "Full adder — composed from half adders",
    description:
      "Two HalfAdder subcircuits and one OR gate. Same five gates inside, organized into three named pieces.",
    circuit: ComposedFullAdderDemo,
  },
  eightBitAdder: {
    name: "8-bit adder built from full adders",
    description:
      "Eight FullAdder nodes chained tail-to-head. The flat equivalent has 40+ gates.",
    circuit: EightBitAdderDemo,
  },
} satisfies Record<string, BlogCircuit>;
