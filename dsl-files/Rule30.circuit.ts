// Auto-generated from DSL

const Rule30Cell = component('Rule30Cell', {
  in: { left: bit, center: bit, right: bit },
  out: { next: bit },
  meta: { description: "Single Rule 30 cell: next = left XOR (center OR right)" },
  nodes: { or1: Or, xor1: Xor },
  connect: ({ in: inp, out, or1, xor1 }) => [
    inp.center.to(or1.a),
    inp.right.to(or1.b),
    inp.left.to(xor1.a),
    or1.out.to(xor1.b),
    xor1.out.to(out.next),
  ],
})

const Rule30 = component('Rule30', {
  meta: { description: "Rule 30 cellular automaton — 8 cells in a ring, chaos from a single seed" },
  nodes: { c0: DFlipFlop, c1: DFlipFlop, c2: DFlipFlop, c3: DFlipFlop, c4: DFlipFlop, c5: DFlipFlop, c6: DFlipFlop, c7: DFlipFlop, r0: Rule30Cell, r1: Rule30Cell, r2: Rule30Cell, r3: Rule30Cell, r4: Rule30Cell, r5: Rule30Cell, r6: Rule30Cell, r7: Rule30Cell, one: Constant, init: DFlipFlop, mux4: Mux, led0: Led, led1: Led, led2: Led, led3: Led, led4: Led, led5: Led, led6: Led, led7: Led, combine: Combiner8to8, display: HexDisplay },
  nodeArgs: { one: { value: 1 } },
  connect: ({ in: inp, out, c0, c1, c2, c3, c4, c5, c6, c7, r0, r1, r2, r3, r4, r5, r6, r7, one, init, mux4, led0, led1, led2, led3, led4, led5, led6, led7, combine, display }) => [
    one.out.to(init.d, mux4.in0),
    r4.next.to(mux4.in1),
    init.q.to(mux4.sel),
    mux4.out.to(c4.d),
    c7.q.to(r0.left, r6.right, r7.center, led7.in, combine.bit7),
    c0.q.to(r0.center, r1.left, r7.right, led0.in, combine.bit0),
    c1.q.to(r0.right, r1.center, r2.left, led1.in, combine.bit1),
    r0.next.to(c0.d),
    c2.q.to(r1.right, r2.center, r3.left, led2.in, combine.bit2),
    r1.next.to(c1.d),
    c3.q.to(r2.right, r3.center, r4.left, led3.in, combine.bit3),
    r2.next.to(c2.d),
    c4.q.to(r3.right, r4.center, r5.left, led4.in, combine.bit4),
    r3.next.to(c3.d),
    c5.q.to(r4.right, r5.center, r6.left, led5.in, combine.bit5),
    c6.q.to(r5.right, r6.center, r7.left, led6.in, combine.bit6),
    r5.next.to(c5.d),
    r6.next.to(c6.d),
    r7.next.to(c7.d),
    combine.out.to(display.in),
  ],
})
