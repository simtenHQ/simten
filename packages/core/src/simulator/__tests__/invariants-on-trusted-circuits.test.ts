/**
 * Runs `assertFlatCircuitInvariants` against a curated set of trusted shapes
 * — circuits the project already depends on (or close analogues), elaborated
 * and structurally checked.
 *
 * Honest framing of what this buys (per #140's audit plan): these circuits are
 * already passing behaviour-level tests elsewhere, so they don't have live
 * dropped-wire bugs on the paths their behavioural tests exercise. The two
 * things this file *does* buy:
 *
 *   1. A regression net: a future refactor of `elaboration.ts` that drops a
 *      wire on a path the behavioural test doesn't cover gets caught
 *      structurally.
 *   2. Inert-malformation detection: duplicate connection ids, dangling
 *      composite paths, zero/multi-driver outputs that don't (yet) move an
 *      observed value.
 *
 * Wider integration coverage (the CPU project, the figlet and Snake landing
 * demos, the `.verify.ts` circuits when they land tracked) is a follow-up
 * called out in #140's audit report — those circuits live outside
 * `packages/core/src/` and aren't reachable from this test file without
 * cross-package wiring that's out of scope here.
 */

import { describe, it } from 'vitest';
import { circuit, bit, bus } from '../../circuit/index.js';
import { And, Or, Xor, Not, Adder, Register, DFlipFlop, Constant } from '../../std/index.js';
import { assertFlatCircuitInvariants, elaborateBuilt } from './_invariants.js';

// ── 1. HalfAdder — two primitives, no nesting. Trivial baseline. ──────────────
const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { x: Xor, a1: And },
  connect: ({ inputs, outputs, nodes: { x, a1 } }) => [
    inputs.a.to(x.a, a1.a),
    inputs.b.to(x.b, a1.b),
    x.out.to(outputs.sum),
    a1.out.to(outputs.carry),
  ],
});

// ── 2. FullAdder — composite-of-composites. Stresses nesting depth-2. ────────
const FullAdder = circuit('FullAdder', {
  inputs: { a: bit, b: bit, cin: bit },
  outputs: { sum: bit, cout: bit },
  nodes: { h1: HalfAdder, h2: HalfAdder, or1: Or },
  connect: ({ inputs, outputs, nodes: { h1, h2, or1 } }) => [
    inputs.a.to(h1.a),
    inputs.b.to(h1.b),
    h1.sum.to(h2.a),
    inputs.cin.to(h2.b),
    h2.sum.to(outputs.sum),
    h1.carry.to(or1.a),
    h2.carry.to(or1.b),
    or1.out.to(outputs.cout),
  ],
});

// ── 3. Counter — sequential, the figlet-demo shape. Register + Adder loop. ───
const Counter8 = circuit('Counter8', {
  outputs: { q: bus(8) },
  nodes: {
    reg: Register({ width: 8 }),
    adder: Adder({ width: 8 }),
    one: Constant({ value: 1 }),
    we: Constant({ value: 1 }),
    zero: Constant({ value: 0 }),
  },
  connect: ({ outputs, nodes: n }) => [
    n.reg.q.to(n.adder.a),
    n.one.out.to(n.adder.b),
    n.zero.out.to(n.adder.carry_in),
    n.adder.sum.to(n.reg.data),
    n.we.out.to(n.reg.we),
    n.reg.q.to(outputs.q),
  ],
});

// ── 4. 4-bit shift register — chained sequential. Mirrors `crc8`'s LFSR. ─────
const Shift4 = circuit('Shift4', {
  inputs: { din: bit },
  outputs: { q0: bit, q1: bit, q2: bit, q3: bit },
  nodes: {
    d0: DFlipFlop(),
    d1: DFlipFlop(),
    d2: DFlipFlop(),
    d3: DFlipFlop(),
  },
  connect: ({ inputs, outputs, nodes: { d0, d1, d2, d3 } }) => [
    inputs.din.to(d0.d),
    d0.q.to(d1.d),
    d1.q.to(d2.d),
    d2.q.to(d3.d),
    d0.q.to(outputs.q0),
    d1.q.to(outputs.q1),
    d2.q.to(outputs.q2),
    d3.q.to(outputs.q3),
  ],
});

// ── 5. NotNotPair — gated mirror of the #138 passthrough composite, used to
//    chain 4 deep. Exercises the same boundaries as Crc8Chained but without
//    pulling crc8/Crc8Chained themselves in (those aren't committed yet). ────
const NotNotPair = circuit('NotNotPair', {
  inputs: { x: bit },
  outputs: { y: bit },
  nodes: { n1: Not, n2: Not },
  connect: ({ inputs, outputs, nodes: { n1, n2 } }) => [
    inputs.x.to(n1.in),
    n1.out.to(n2.in),
    n2.out.to(outputs.y),
  ],
});
const NotChain4 = circuit('NotChain4', {
  inputs: { x: bit },
  outputs: { y: bit },
  nodes: { p0: NotNotPair, p1: NotNotPair, p2: NotNotPair, p3: NotNotPair },
  connect: ({ inputs, outputs, nodes: { p0, p1, p2, p3 } }) => [
    inputs.x.to(p0.x),
    p0.y.to(p1.x),
    p1.y.to(p2.x),
    p2.y.to(p3.x),
    p3.y.to(outputs.y),
  ],
});

describe('assertFlatCircuitInvariants on trusted circuit shapes', () => {
  it('HalfAdder (combinational, two primitives)', () => {
    assertFlatCircuitInvariants(elaborateBuilt(HalfAdder));
  });
  it('FullAdder (composite-of-composites, nesting depth 2)', () => {
    assertFlatCircuitInvariants(elaborateBuilt(FullAdder));
  });
  it('Counter8 (sequential, Register + Adder feedback)', () => {
    assertFlatCircuitInvariants(elaborateBuilt(Counter8));
  });
  it('Shift4 (chained sequential — 4 DFlipFlops)', () => {
    assertFlatCircuitInvariants(elaborateBuilt(Shift4));
  });
  it('NotChain4 (4 gated composites chained — Crc8Chained-shaped boundaries)', () => {
    assertFlatCircuitInvariants(elaborateBuilt(NotChain4));
  });
});
