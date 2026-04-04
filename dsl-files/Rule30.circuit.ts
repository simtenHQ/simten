// Auto-generated from DSL

const Rule30Cell = component('Rule30Cell')
  .in('left', bit)
  .in('center', bit)
  .in('right', bit)
  .out('next', bit)
  .node('or1', Or)
  .node('xor1', Xor)
  .connect(({ in: inp, out, or1, xor1 }) => [
    inp.center.to(or1.a),
    inp.right.to(or1.b),
    inp.left.to(xor1.a),
    or1.out.to(xor1.b),
    xor1.out.to(out.next),
  ])
  .build()

const Rule30 = component('Rule30')
  .node('c0', DFlipFlop)
  .node('c1', DFlipFlop)
  .node('c2', DFlipFlop)
  .node('c3', DFlipFlop)
  .node('c4', DFlipFlop)
  .node('c5', DFlipFlop)
  .node('c6', DFlipFlop)
  .node('c7', DFlipFlop)
  .node('r0', Rule30Cell)
  .node('r1', Rule30Cell)
  .node('r2', Rule30Cell)
  .node('r3', Rule30Cell)
  .node('r4', Rule30Cell)
  .node('r5', Rule30Cell)
  .node('r6', Rule30Cell)
  .node('r7', Rule30Cell)
  .node('one', Constant, { value: 1 })
  .node('init', DFlipFlop)
  .node('mux4', Mux)
  .node('led0', Led)
  .node('led1', Led)
  .node('led2', Led)
  .node('led3', Led)
  .node('led4', Led)
  .node('led5', Led)
  .node('led6', Led)
  .node('led7', Led)
  .node('combine', Combiner8to8)
  .node('display', HexDisplay)
  .connect(({ in: inp, out, c0, c1, c2, c3, c4, c5, c6, c7, r0, r1, r2, r3, r4, r5, r6, r7, one, init, mux4, led0, led1, led2, led3, led4, led5, led6, led7, combine, display }) => [
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
  ])
  .build()
