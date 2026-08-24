/**
 * Circuit definitions for the "Adders" learn page.
 *
 * Builds toward the carry-lookahead idea by first showing how a half-adder
 * works, extending it to a full adder with carry-in, then chaining N of them
 * in a ripple-carry configuration to make the depth problem visible.
 *
 * HalfAdder, FullAdder and RippleCarryDemo are real. DepthDemo and
 * CarryLookaheadDemo are still stubs aliased to RippleCarryDemo — see the
 * TODOs on each.
 */

import { bit, circuit } from '@simten/core/circuit';
import { And, Concat, Constant, HexDisplay, Input, Led, Or, Slice, Xor } from '@simten/core/std';
import type { BlogCircuit } from '@/features/blog/types';

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
// Eight of the FullAdder above, chained tail-to-head. Deliberately NOT the
// stdlib `Adder`: that one is eval-only, so it draws as a single box and the
// depth this section is about would be invisible. Wiring the chain by hand
// makes the schematic elongate, which is the whole point.
//
// The Slice/Concat nodes are not gates — they are how this IR spells "take
// bit i of a bus" and "put these bits back together", because a Connection
// addresses a port, not a bit within one.
const RippleCarryDemo = circuit('RippleCarry8', {
  nodes: {
    a: Input({ value: 0b00001111 }),
    b: Input({ value: 0b00000001 }),
    zero: Constant({ value: 0 }),
    aBit: Array.from({ length: 8 }, (_, i) => Slice({ inWidth: 8, offset: i, width: 1 })),
    bBit: Array.from({ length: 8 }, (_, i) => Slice({ inWidth: 8, offset: i, width: 1 })),
    fa: Array.from({ length: 8 }, () => FullAdder),
    join: Array.from({ length: 7 }, (_, i) => Concat({ hiWidth: 1, loWidth: i + 1 })),
    sum: HexDisplay,
    cout: Led,
  },
  connect: ({ nodes: { a, b, zero, aBit, bBit, fa, join, sum, cout } }) => [
    ...aBit.map((s) => a.out.to(s.in)),
    ...bBit.map((s) => b.out.to(s.in)),
    ...aBit.map((s, i) => s.out.to(fa[i].a)),
    ...bBit.map((s, i) => s.out.to(fa[i].b)),
    // The chain: bit 0 starts from a hard zero, every later stage waits on the
    // stage below it.
    zero.out.to(fa[0].cin),
    ...fa.slice(0, -1).map((stage, i) => stage.cout.to(fa[i + 1].cin)),
    fa[7].cout.to(cout.in),
    // Fold the sum bits back into one bus, LSB first.
    fa[0].sum.to(join[0].low),
    ...join.map((j, i) => fa[i + 1].sum.to(j.high)),
    ...join.slice(0, -1).map((j, i) => j.out.to(join[i + 1].low)),
    join[6].out.to(sum.in),
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
