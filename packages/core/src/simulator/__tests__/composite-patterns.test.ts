/**
 * #140 audit — targeted simulation tests, one per pattern from the audit
 * plan's table. Each test:
 *
 *   1. Builds a small fixture circuit.
 *   2. Asserts a concrete behavioural output via `simulate()`, or asserts an
 *      explicit failure shape for the Confirmed-Fail patterns.
 *   3. Runs `assertFlatCircuitInvariants` on the elaboration output so the
 *      structural net runs on every pattern too.
 *
 * Confirmed-Fail patterns ([#143](.../issues/143), [#144](.../issues/144),
 * [#145](.../issues/145)) get a behavioural `it.fails(...)` test pinned by
 * regex to the specific throw the future fix is expected to produce. The
 * structural side is included when it's meaningful (invariant 3 catches the
 * post-stitch multi-drive shape); for the width cases the structural net does
 * not apply (width validation is a missing feature, not a structural
 * property), so the structural test is intentionally omitted there.
 */

import { describe, it, expect } from 'vitest';
import { simulate } from '../../sim/simulate.js';
import { circuit, bit, bus } from '../../circuit/index.js';
import { And, Or, Xor, Not, Constant, Register, DFlipFlop, Adder } from '../../std/index.js';
import { assertFlatCircuitInvariants, elaborateBuilt } from './_invariants.js';

// ╔════════════════════════════════════════════════════════════════════════╗
// ║ Group: Feedthroughs (the #138 family beyond the chained-bit case)       ║
// ╚════════════════════════════════════════════════════════════════════════╝

describe('P-bus-feedthrough-chain — bus(N) feedthrough across chained composites', () => {
  const BusPass = circuit('BusPass', {
    inputs: { x: bus(8) },
    outputs: { y: bus(8) },
    nodes: { d: Not }, // dummy gate (Not is bit-wide but unused — kept to avoid degenerate-empty-composite shape)
    connect: ({ inputs, outputs, nodes: { d } }) => [
      inputs.x.to(outputs.y),
      // Tap one bit into a dummy gate so the composite isn't node-less. The
      // gate's input takes the bus-as-bit (silent truncation on first bit,
      // which is fine for this test — we care about the bus feedthrough).
      inputs.x.to(d.in),
    ],
  });
  function chain(n: number) {
    const nodes: Record<string, typeof BusPass> = {};
    for (let k = 0; k < n; k++) nodes['p' + k] = BusPass;
    return circuit('BusChain' + n, {
      inputs: { x: bus(8) },
      outputs: { y: bus(8) },
      nodes,
      connect: ({ inputs, outputs, nodes }: any) => {
        const c = [inputs.x.to(nodes.p0.x)];
        for (let k = 0; k < n - 1; k++) c.push(nodes['p' + k].y.to(nodes['p' + (k + 1)].x));
        c.push(nodes['p' + (n - 1)].y.to(outputs.y));
        return c;
      },
    });
  }
  for (const depth of [1, 2, 4, 8]) {
    it(`width-agnostic at depth ${depth}: bus value propagates end-to-end`, () => {
      const c = chain(depth);
      assertFlatCircuitInvariants(elaborateBuilt(c));
      const sim = simulate(c);
      try {
        sim.set({ x: 0xa5 });
        expect(sim.get('y')).toBe(0xa5);
        sim.set({ x: 0x00 });
        expect(sim.get('y')).toBe(0x00);
      } finally {
        sim.dispose();
      }
    });
  }
});

describe('P-feedthrough-fanout-from-input — one input feeds multiple outputs', () => {
  // inputs.x.to(outputs.y) AND inputs.x.to(outputs.z) — two passthroughs from one input.
  const TwoOut = circuit('TwoOut', {
    inputs: { x: bit },
    outputs: { y: bit, z: bit },
    nodes: { d: Not },
    connect: ({ inputs, outputs, nodes: { d } }) => [
      inputs.x.to(outputs.y),
      inputs.x.to(outputs.z),
      inputs.x.to(d.in),
    ],
  });
  // Use it at top level driving two LED-style sinks (via Not as a primitive sink).
  const Wrap = circuit('Wrap', {
    inputs: { a: bit },
    outputs: { y: bit, z: bit },
    nodes: { t: TwoOut },
    connect: ({ inputs, outputs, nodes: { t } }) => [
      inputs.a.to(t.x),
      t.y.to(outputs.y),
      t.z.to(outputs.z),
    ],
  });
  it('both feedthrough outputs carry the input', () => {
    assertFlatCircuitInvariants(elaborateBuilt(Wrap));
    const sim = simulate(Wrap);
    try {
      sim.set({ a: 1 });
      expect(sim.get('y')).toBe(1);
      expect(sim.get('z')).toBe(1);
      sim.set({ a: 0 });
      expect(sim.get('y')).toBe(0);
      expect(sim.get('z')).toBe(0);
    } finally {
      sim.dispose();
    }
  });
});

describe('P-crcstep-shape — mixed gated + feedthrough composite, chained', () => {
  // Two outputs: y_gate = NOT NOT x (gated), y_pass = x (feedthrough).
  const Step = circuit('Step', {
    inputs: { x: bit },
    outputs: { y_gate: bit, y_pass: bit },
    nodes: { n1: Not, n2: Not },
    connect: ({ inputs, outputs, nodes: { n1, n2 } }) => [
      inputs.x.to(n1.in),
      n1.out.to(n2.in),
      n2.out.to(outputs.y_gate),
      inputs.x.to(outputs.y_pass), // feedthrough sibling
    ],
  });
  function chain(n: number) {
    const nodes: Record<string, typeof Step> = {};
    for (let k = 0; k < n; k++) nodes['s' + k] = Step;
    return circuit('StepChain' + n, {
      inputs: { x: bit },
      outputs: { y_gate: bit, y_pass: bit },
      nodes,
      connect: ({ inputs, outputs, nodes }: any) => {
        const c = [inputs.x.to(nodes.s0.x)];
        for (let k = 0; k < n - 1; k++) c.push(nodes['s' + k].y_gate.to(nodes['s' + (k + 1)].x));
        c.push(nodes['s' + (n - 1)].y_gate.to(outputs.y_gate));
        c.push(nodes['s' + (n - 1)].y_pass.to(outputs.y_pass));
        return c;
      },
    });
  }
  for (const depth of [1, 2, 4]) {
    it(`gated + feedthrough both propagate at depth ${depth}`, () => {
      const c = chain(depth);
      assertFlatCircuitInvariants(elaborateBuilt(c));
      const sim = simulate(c);
      try {
        sim.set({ x: 1 });
        expect(sim.get('y_gate')).toBe(1); // NOT NOT 1 = 1, chained = 1
        expect(sim.get('y_pass')).toBe(1); // final step's feedthrough of the chained gate output
        sim.set({ x: 0 });
        expect(sim.get('y_gate')).toBe(0);
        expect(sim.get('y_pass')).toBe(0);
      } finally {
        sim.dispose();
      }
    });
  }
});

// ╔════════════════════════════════════════════════════════════════════════╗
// ║ Group: Fan-out                                                          ║
// ╚════════════════════════════════════════════════════════════════════════╝

describe('P-fanout-composite-output — composite output fans out to multiple primitives', () => {
  // Composite that produces a gated output, then top-level fans it out.
  const GateOut = circuit('GateOut', {
    inputs: { x: bit },
    outputs: { y: bit },
    nodes: { n: Not },
    connect: ({ inputs, outputs, nodes: { n } }) => [inputs.x.to(n.in), n.out.to(outputs.y)],
  });
  const Wrap = circuit('FanWrap', {
    inputs: { a: bit },
    outputs: { o1: bit, o2: bit, o3: bit },
    nodes: { g: GateOut, n1: Not, n2: Not, n3: Not },
    connect: ({ inputs, outputs, nodes: { g, n1, n2, n3 } }) => [
      inputs.a.to(g.x),
      g.y.to(n1.in, n2.in, n3.in), // fan-out from composite output
      n1.out.to(outputs.o1),
      n2.out.to(outputs.o2),
      n3.out.to(outputs.o3),
    ],
  });
  it('all three fan-out targets see the same gated value', () => {
    assertFlatCircuitInvariants(elaborateBuilt(Wrap));
    const sim = simulate(Wrap);
    try {
      sim.set({ a: 0 });
      // g.y = NOT 0 = 1; nN.out = NOT 1 = 0
      expect(sim.get('o1')).toBe(0);
      expect(sim.get('o2')).toBe(0);
      expect(sim.get('o3')).toBe(0);
      sim.set({ a: 1 });
      expect(sim.get('o1')).toBe(1);
      expect(sim.get('o2')).toBe(1);
      expect(sim.get('o3')).toBe(1);
    } finally {
      sim.dispose();
    }
  });
});

describe('P-fanout-feedthrough-cross-composite — feedthrough output drives multiple downstream composites', () => {
  // Pass composite: pure feedthrough.
  const Pass = circuit('Pass', {
    inputs: { x: bit },
    outputs: { y: bit },
    nodes: { d: Not },
    connect: ({ inputs, outputs, nodes: { d } }) => [inputs.x.to(outputs.y), inputs.x.to(d.in)],
  });
  // p0 feedthrough → both p1 and p2 (two downstream composites consuming the same passthrough output).
  const Cross = circuit('Cross', {
    inputs: { a: bit },
    outputs: { y1: bit, y2: bit },
    nodes: { p0: Pass, p1: Pass, p2: Pass },
    connect: ({ inputs, outputs, nodes: { p0, p1, p2 } }) => [
      inputs.a.to(p0.x),
      p0.y.to(p1.x),
      p0.y.to(p2.x),
      p1.y.to(outputs.y1),
      p2.y.to(outputs.y2),
    ],
  });
  it('feedthrough output fans out to multiple composite consumers', () => {
    assertFlatCircuitInvariants(elaborateBuilt(Cross));
    const sim = simulate(Cross);
    try {
      sim.set({ a: 1 });
      expect(sim.get('y1')).toBe(1);
      expect(sim.get('y2')).toBe(1);
      sim.set({ a: 0 });
      expect(sim.get('y1')).toBe(0);
      expect(sim.get('y2')).toBe(0);
    } finally {
      sim.dispose();
    }
  });
});

// ╔════════════════════════════════════════════════════════════════════════╗
// ║ Group: Nesting                                                          ║
// ╚════════════════════════════════════════════════════════════════════════╝

describe('P-nesting-feedthrough-3-4-levels — feedthrough threaded through deep nesting', () => {
  // L1 contains L2 contains L3 contains L4 contains a Not; each forwards via feedthrough.
  const L4 = circuit('L4', {
    inputs: { x: bit },
    outputs: { y: bit },
    nodes: { d: Not },
    connect: ({ inputs, outputs, nodes: { d } }) => [inputs.x.to(outputs.y), inputs.x.to(d.in)],
  });
  const L3 = circuit('L3', {
    inputs: { x: bit },
    outputs: { y: bit },
    nodes: { inner: L4 },
    connect: ({ inputs, outputs, nodes: { inner } }) => [
      inputs.x.to(inner.x),
      inner.y.to(outputs.y),
    ],
  });
  const L2 = circuit('L2', {
    inputs: { x: bit },
    outputs: { y: bit },
    nodes: { inner: L3 },
    connect: ({ inputs, outputs, nodes: { inner } }) => [
      inputs.x.to(inner.x),
      inner.y.to(outputs.y),
    ],
  });
  const L1 = circuit('L1', {
    inputs: { x: bit },
    outputs: { y: bit },
    nodes: { inner: L2 },
    connect: ({ inputs, outputs, nodes: { inner } }) => [
      inputs.x.to(inner.x),
      inner.y.to(outputs.y),
    ],
  });
  // Newly-discovered audit finding — see #146. Today: invariants fire (the
  // innermost dummy gate's input port ends up listed as a connection source,
  // and the top output has 2 drivers post-stitch). After fix: structural net
  // passes AND simulation propagates correctly. One `it.fails(...)` asserts
  // the after-fix state; flips green when #146 lands.
  it.fails('depth-4 feedthrough nesting elaborates cleanly and propagates — currently malformed, see #146', () => {
    expect(() => assertFlatCircuitInvariants(elaborateBuilt(L1))).not.toThrow();
    const sim = simulate(L1);
    try {
      sim.set({ x: 1 });
      expect(sim.get('y')).toBe(1);
      sim.set({ x: 0 });
      expect(sim.get('y')).toBe(0);
    } finally {
      sim.dispose();
    }
  });
});

describe('P-nesting-with-inner-gates — deep nesting with a gate at the innermost level', () => {
  const Inner = circuit('Inner', {
    inputs: { x: bit },
    outputs: { y: bit },
    nodes: { n: Not },
    connect: ({ inputs, outputs, nodes: { n } }) => [inputs.x.to(n.in), n.out.to(outputs.y)],
  });
  const Mid = circuit('Mid', {
    inputs: { x: bit },
    outputs: { y: bit },
    nodes: { inner: Inner },
    connect: ({ inputs, outputs, nodes: { inner } }) => [
      inputs.x.to(inner.x),
      inner.y.to(outputs.y),
    ],
  });
  const Outer = circuit('Outer', {
    inputs: { x: bit },
    outputs: { y: bit },
    nodes: { mid: Mid },
    connect: ({ inputs, outputs, nodes: { mid } }) => [inputs.x.to(mid.x), mid.y.to(outputs.y)],
  });
  it('gate at depth 3 inverts the signal', () => {
    assertFlatCircuitInvariants(elaborateBuilt(Outer));
    const sim = simulate(Outer);
    try {
      sim.set({ x: 1 });
      expect(sim.get('y')).toBe(0);
      sim.set({ x: 0 });
      expect(sim.get('y')).toBe(1);
    } finally {
      sim.dispose();
    }
  });
});

// ╔════════════════════════════════════════════════════════════════════════╗
// ║ Group: Multi-driver                                                     ║
// ╚════════════════════════════════════════════════════════════════════════╝

describe('P-multi-drive-composite-input — pre-elaboration rejection (per-circuit check)', () => {
  it('two top-level inputs driving the same composite input port is rejected at definition', () => {
    const Sub = circuit('Sub', {
      inputs: { x: bit },
      outputs: { y: bit },
      nodes: { n: Not },
      connect: ({ inputs, outputs, nodes: { n } }) => [inputs.x.to(n.in), n.out.to(outputs.y)],
    });
    expect(() =>
      circuit('BadDef', {
        inputs: { a: bit, b: bit },
        outputs: { y: bit },
        nodes: { s: Sub },
        connect: ({ inputs, outputs, nodes: { s } }) => [
          inputs.a.to(s.x),
          inputs.b.to(s.x), // ← second driver of s.x — per-circuit check should fire here
          s.y.to(outputs.y),
        ],
      }),
    ).toThrow(/multi.*driv|multiple drivers|already driven/i);
  });
});

describe('P-multi-drive-stitch — post-stitch multi-drive silently accepted (#143)', () => {
  // Confirmed fail. Per the plan: structural test that the invariant fires
  // today (it does — top-level output has 2 drivers post-stitch). Behavioural
  // test pins the future elaboration-time throw via it.fails().
  const Pass = circuit('Pass', {
    inputs: { x: bit },
    outputs: { y: bit },
    nodes: { d: Not },
    connect: ({ inputs, outputs, nodes: { d } }) => [inputs.x.to(outputs.y), inputs.x.to(d.in)],
  });
  const Bad = circuit('BadCircuit', {
    inputs: { A: bit, B: bit },
    outputs: { out: bit },
    nodes: { p: Pass },
    connect: ({ inputs, outputs, nodes: { p } }) => [
      inputs.A.to(p.x),
      inputs.B.to(p.y), // ← driver #1 of p.y at top
      p.y.to(outputs.out), // ← p.y's downstream is outputs.out
      // After stitching, A's feedthrough through Pass ALSO drives outputs.out
      // (via the resolved feedthrough chain). Multi-drive at outputs.out.
    ],
  });
  it('structural: invariant 3 catches the multi-driven top output today (or elaborate throws post-fix)', () => {
    // Match either today's invariant message OR a future elaborate-time throw.
    expect(() => assertFlatCircuitInvariants(elaborateBuilt(Bad))).toThrow(
      /invariant 3|multi.*driv|multiple drivers/i,
    );
  });
  it.fails('behavioral: elaborate(Bad) throws naming the multi-driver — currently silent, see #143', () => {
    expect(() => elaborateBuilt(Bad)).toThrow(/multi.*driv|multiple drivers/i);
  });
});

// ╔════════════════════════════════════════════════════════════════════════╗
// ║ Group: Instance pathing                                                 ║
// ╚════════════════════════════════════════════════════════════════════════╝

describe('P-instance-pathing — same composite type, multiple instance ids', () => {
  const Inv = circuit('Inv', {
    inputs: { x: bit },
    outputs: { y: bit },
    nodes: { n: Not },
    connect: ({ inputs, outputs, nodes: { n } }) => [inputs.x.to(n.in), n.out.to(outputs.y)],
  });
  const Triple = circuit('Triple', {
    inputs: { a: bit, b: bit, c: bit },
    outputs: { x: bit, y: bit, z: bit },
    nodes: { i1: Inv, i2: Inv, i3: Inv },
    connect: ({ inputs, outputs, nodes: { i1, i2, i3 } }) => [
      inputs.a.to(i1.x),
      i1.y.to(outputs.x),
      inputs.b.to(i2.x),
      i2.y.to(outputs.y),
      inputs.c.to(i3.x),
      i3.y.to(outputs.z),
    ],
  });
  it('three instances of the same composite produce independent outputs', () => {
    assertFlatCircuitInvariants(elaborateBuilt(Triple));
    const sim = simulate(Triple);
    try {
      sim.set({ a: 1, b: 0, c: 1 });
      expect(sim.get('x')).toBe(0);
      expect(sim.get('y')).toBe(1);
      expect(sim.get('z')).toBe(0);
    } finally {
      sim.dispose();
    }
  });
});

describe('P-recursive-composite — recursive definition rejected with cycle chain', () => {
  // We can't statically build a recursive composite via the circuit() API (the
  // dependency map is resolved at construction time), so we synthesise the
  // recursive shape by constructing the IR directly. The guard at
  // elaboration.ts:103-108 fires during flattenCircuit's DFS.
  it('elaborator rejects a circuit whose nodes reference itself', () => {
    // Build a circuit whose `nodes` references a component name pointing back
    // to itself. We do this by manually constructing the IR shape.
    const A = circuit('SelfRefA', {
      inputs: { x: bit },
      outputs: { y: bit },
      nodes: { n: Not },
      connect: ({ inputs, outputs, nodes: { n } }) => [inputs.x.to(n.in), n.out.to(outputs.y)],
    });
    // Mutate the IR to insert a self-reference node. This is intentionally
    // hostile to the elaborator to exercise the guard.
    const mutated = {
      ...A.circuit,
      nodes: [
        ...A.circuit.nodes,
        // Reference back to SelfRefA by component name — creates the cycle.
        {
          id: 'self_loop',
          componentRef: 'SelfRefA',
          arguments: {},
          inputs: [],
          outputs: [],
          clocks: [],
        },
      ],
    };
    const built = { circuit: mutated, _dependencies: A._dependencies };
    expect(() => elaborateBuilt(built as any)).toThrow(/recursive|cycle/i);
  });
});

// ╔════════════════════════════════════════════════════════════════════════╗
// ║ Group: Sequential                                                       ║
// ╚════════════════════════════════════════════════════════════════════════╝

describe('P-stateful-feedthrough-clk — composite forwards we through to an internal Register', () => {
  // Composite wraps a Register; we and data come via feedthrough from outside.
  const RegWrap = circuit('RegWrap', {
    inputs: { data: bus(8), we: bit },
    outputs: { q: bus(8) },
    nodes: { r: Register({ width: 8 }) },
    connect: ({ inputs, outputs, nodes: { r } }) => [
      inputs.data.to(r.data),
      inputs.we.to(r.we),
      r.q.to(outputs.q),
    ],
  });
  const Top = circuit('CounterViaWrap', {
    outputs: { q: bus(8) },
    nodes: {
      w: RegWrap,
      five: Constant({ value: 5, width: 8 }),
      en: Constant({ value: 1 }),
    },
    connect: ({ outputs, nodes: { w, five, en } }) => [
      five.out.to(w.data),
      en.out.to(w.we),
      w.q.to(outputs.q),
    ],
  });
  it('Register inside composite latches on tick when we is driven via feedthrough', () => {
    assertFlatCircuitInvariants(elaborateBuilt(Top));
    const sim = simulate(Top);
    try {
      sim.tick();
      expect(sim.get('q')).toBe(5);
    } finally {
      sim.dispose();
    }
  });
});

describe('P-self-loop-feedback-through-composite — register feedback crossing a composite boundary', () => {
  // Counter pattern, but the +1 path passes through a composite. Increments by
  // one per tick if the composite is a faithful feedthrough.
  const Plus1 = circuit('Plus1', {
    inputs: { a: bus(8) },
    outputs: { sum: bus(8) },
    // Implement +1 via a tiny gate so the composite isn't pure feedthrough on
    // the operand path; the sum output is gated, not a passthrough.
    nodes: {
      add: Adder({ width: 8 }),
      one: Constant({ value: 1, width: 8 }),
      zero: Constant({ value: 0 }),
    },
    connect: ({ inputs, outputs, nodes: { add, one, zero } }) => [
      inputs.a.to(add.a),
      one.out.to(add.b),
      zero.out.to(add.carry_in),
      add.sum.to(outputs.sum),
    ],
  });
  const Top = circuit('CounterViaComposite', {
    outputs: { q: bus(8) },
    nodes: {
      reg: Register({ width: 8 }),
      inc: Plus1,
      we: Constant({ value: 1 }),
    },
    connect: ({ outputs, nodes: { reg, inc, we } }) => [
      reg.q.to(inc.a),
      inc.sum.to(reg.data),
      we.out.to(reg.we),
      reg.q.to(outputs.q),
    ],
  });
  it('register feedback through a composite still increments the counter', () => {
    assertFlatCircuitInvariants(elaborateBuilt(Top));
    const sim = simulate(Top);
    try {
      expect(sim.get('q')).toBe(0);
      sim.tick();
      expect(sim.get('q')).toBe(1);
      sim.tick();
      expect(sim.get('q')).toBe(2);
      sim.tick();
      expect(sim.get('q')).toBe(3);
    } finally {
      sim.dispose();
    }
  });
});

// ╔════════════════════════════════════════════════════════════════════════╗
// ║ Group: Width                                                            ║
// ╚════════════════════════════════════════════════════════════════════════╝

describe('P-width-bit-bus — bit source driving bus(N) target silently accepted (#144)', () => {
  // Structural side intentionally omitted: invariants don't validate width
  // (width validation is a missing feature, not a structural property). The
  // behavioural it.fails() pins the future elaborate-time throw.
  const Bad = circuit('BadWidthBitBus', {
    outputs: { out: bus(8) },
    nodes: { one: Constant({ value: 1 }) }, // bit-wide
    connect: ({ outputs, nodes: { one } }) => [one.out.to(outputs.out)],
  });
  it.fails('behavioral: elaborate(Bad) throws naming bit→bus(N) width mismatch — currently silent, see #144', () => {
    expect(() => elaborateBuilt(Bad)).toThrow(/width|bit.*bus/i);
  });
});

describe('P-width-mismatch — bus(M) → bus(N), M ≠ N silently accepted (#145)', () => {
  const Bad = circuit('BadWidthMismatch', {
    outputs: { out: bus(16) },
    nodes: { eight: Constant({ value: 0xaa, width: 8 }) },
    connect: ({ outputs, nodes: { eight } }) => [eight.out.to(outputs.out)],
  });
  it.fails('behavioral: elaborate(Bad) throws naming bus(M)→bus(N) mismatch — currently silent, see #145', () => {
    expect(() => elaborateBuilt(Bad)).toThrow(/width|mismatch|bus\(\d+\)/i);
  });
});

// ╔════════════════════════════════════════════════════════════════════════╗
// ║ Group: Degenerate shapes                                                ║
// ╚════════════════════════════════════════════════════════════════════════╝

describe('P-empty-composite-passthrough-only — composite with a single passthrough and no gates', () => {
  const Pass = circuit('JustPass', {
    inputs: { x: bit },
    outputs: { y: bit },
    nodes: {}, // ← deliberately empty: only a passthrough connection
    connect: ({ inputs, outputs }) => [inputs.x.to(outputs.y)],
  });
  const Wrap = circuit('WrapJustPass', {
    inputs: { a: bit },
    outputs: { y: bit },
    nodes: { p: Pass },
    connect: ({ inputs, outputs, nodes: { p } }) => [inputs.a.to(p.x), p.y.to(outputs.y)],
  });
  // Newly-discovered audit finding — see #147. Today: invariants pass (the
  // flat netlist is structurally well-formed), but the simulator returns 0
  // instead of the input value — a behaviour-only silent bug specific to
  // node-less passthrough composites. Single `it.fails(...)` pins both halves
  // of the future-fix state.
  it.fails('node-less passthrough composite propagates the signal — currently dropped, see #147', () => {
    assertFlatCircuitInvariants(elaborateBuilt(Wrap));
    const sim = simulate(Wrap);
    try {
      sim.set({ a: 1 });
      expect(sim.get('y')).toBe(1);
      sim.set({ a: 0 });
      expect(sim.get('y')).toBe(0);
    } finally {
      sim.dispose();
    }
  });
});
