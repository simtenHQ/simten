/**
 * Circuit definitions for the "Adders" learn page.
 *
 * Builds toward the carry-lookahead idea by first showing how a half-adder
 * works, extending it to a full adder with carry-in, then chaining N of them
 * in a ripple-carry configuration to make the depth problem visible.
 *
 * TODO: every circuit below is a stub. Replace each with a real definition
 * that exercises the concept the corresponding section is teaching.
 */

import { circuit, bit } from '@simten/core/circuit';
import type { BlogCircuit } from '@/features/blog/types';
import { And, Xor, Or, Led, Input, HexDisplay, Adder, Constant } from '@simten/core/std';

// ── Half adder ─────────────────────────────────────────────────────────
// Exported so HalfAdderSection can drive it directly via the composition
// pattern (useCircuitSimulator + CircuitCanvas + the live truth table).
export const HalfAdder = circuit('HalfAdder', {
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

// ── Full adder ─────────────────────────────────────────────────────────
// Exported for the same reason as HalfAdder. Also used internally by
// RippleCarryDemo below.
export const FullAdder = circuit('FullAdder', {
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

// ── Ripple-carry adder ─────────────────────────────────────────────────
// TODO: 8 full-adders chained together. The schematic visibly elongates,
// which is the whole pedagogical point. Replace this with a hand-wired
// chain of 8 FullAdders rather than the stdlib Adder, so the depth is
// visible in the canvas.
const RippleCarryDemo = circuit('RippleCarry8', {
  nodes: {
    a: Input({ value: 0b00001111 }),
    b: Input({ value: 0b00000001 }),
    add: Adder({ width: 8 }),
    zero: Constant({ value: 0 }),
    sum: HexDisplay,
    cout: Led,
  },
  connect: ({ nodes: { a, b, add, zero, sum, cout } }) => [
    a.out.to(add.a),
    b.out.to(add.b),
    zero.out.to(add.carry_in),
    add.sum.to(sum.in),
    add.carry_out.to(cout.in),
  ],
});

// ── Depth problem ──────────────────────────────────────────────────────
// TODO: a circuit that visualizes the critical path through a ripple chain.
// Could be the same as RippleCarryDemo but with the high-bit's carry-out
// highlighted, or a wider chain (32-bit) that makes the depth dramatic.
const DepthDemo = RippleCarryDemo;

// ── Carry-lookahead ────────────────────────────────────────────────────
// TODO: implement carry-lookahead. Generate (g_i = a_i AND b_i) and
// propagate (p_i = a_i XOR b_i) signals in parallel, derive each carry
// directly from g and p without waiting for prior stages.
const CarryLookaheadDemo = RippleCarryDemo; // placeholder

// ── Export ─────────────────────────────────────────────────────────────

export const ADDER_CIRCUITS = {
  // halfAdder / fullAdder used to live here as standalone Demo wrappers.
  // The half-adder and full-adder sections now drive HalfAdder / FullAdder
  // directly via useCircuitSimulator + autoHarness, so those entries are
  // gone — the bare circuits are exported above for that composition.
  rippleCarry: {
    name: '8-bit ripple-carry adder',
    description:
      'Eight full-adders chained tail-to-head. The carry from each stage feeds the next.',
    circuit: RippleCarryDemo,
  },
  depth: {
    name: 'The critical path',
    description:
      'The longest path from any input to any output — the depth that bounds clock speed.',
    circuit: DepthDemo,
  },
  carryLookahead: {
    name: 'Carry-lookahead adder',
    description:
      'Generate-and-propagate signals compute every carry in parallel, collapsing depth from O(n) to O(log n).',
    circuit: CarryLookaheadDemo,
  },
} satisfies Record<string, BlogCircuit>;
