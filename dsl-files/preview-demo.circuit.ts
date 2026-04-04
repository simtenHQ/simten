// Auto-generated from DSL

const HalfAdder = component('HalfAdder')
  .in('a', bit)
  .in('b', bit)
  .out('sum', bit)
  .out('carry', bit)
  .node('xor1', Xor)
  .node('and1', And)
  .connect(({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
  ])
  .build()

const FullAdder = component('FullAdder')
  .in('a', bit)
  .in('b', bit)
  .in('cin', bit)
  .out('sum', bit)
  .out('cout', bit)
  .node('ha1', HalfAdder)
  .node('ha2', HalfAdder)
  .node('or1', Or)
  .connect(({ in: inp, out, ha1, ha2, or1 }) => [
    inp.a.to(ha1.a),
    inp.b.to(ha1.b),
    ha1.sum.to(ha2.a),
    inp.cin.to(ha2.b),
    ha2.sum.to(out.sum),
    ha1.carry.to(or1.a),
    ha2.carry.to(or1.b),
    or1.out.to(out.cout),
  ])
  .build()

const Adder8Bit = component('Adder8Bit')
  .in('a', bus(8))
  .in('b', bus(8))
  .in('cin', bit)
  .out('sum', bus(8))
  .out('cout', bit)
  .node('splitA', Splitter8to8)
  .node('splitB', Splitter8to8)
  .node('fa0', FullAdder)
  .node('fa1', FullAdder)
  .node('fa2', FullAdder)
  .node('fa3', FullAdder)
  .node('fa4', FullAdder)
  .node('fa5', FullAdder)
  .node('fa6', FullAdder)
  .node('fa7', FullAdder)
  .node('combine', Combiner8to8)
  .connect(({ in: inp, out, splitA, splitB, fa0, fa1, fa2, fa3, fa4, fa5, fa6, fa7, combine }) => [
    inp.a.to(splitA.in),
    inp.b.to(splitB.in),
    splitA.bit0.to(fa0.a),
    splitB.bit0.to(fa0.b),
    inp.cin.to(fa0.cin),
    splitA.bit1.to(fa1.a),
    splitB.bit1.to(fa1.b),
    fa0.cout.to(fa1.cin),
    splitA.bit2.to(fa2.a),
    splitB.bit2.to(fa2.b),
    fa1.cout.to(fa2.cin),
    splitA.bit3.to(fa3.a),
    splitB.bit3.to(fa3.b),
    fa2.cout.to(fa3.cin),
    splitA.bit4.to(fa4.a),
    splitB.bit4.to(fa4.b),
    fa3.cout.to(fa4.cin),
    splitA.bit5.to(fa5.a),
    splitB.bit5.to(fa5.b),
    fa4.cout.to(fa5.cin),
    splitA.bit6.to(fa6.a),
    splitB.bit6.to(fa6.b),
    fa5.cout.to(fa6.cin),
    splitA.bit7.to(fa7.a),
    splitB.bit7.to(fa7.b),
    fa6.cout.to(fa7.cin),
    fa0.sum.to(combine.bit0),
    fa1.sum.to(combine.bit1),
    fa2.sum.to(combine.bit2),
    fa3.sum.to(combine.bit3),
    fa4.sum.to(combine.bit4),
    fa5.sum.to(combine.bit5),
    fa6.sum.to(combine.bit6),
    fa7.sum.to(combine.bit7),
    combine.out.to(out.sum),
    fa7.cout.to(out.cout),
  ])
  .build()

const Adder8BitDemo = component('Adder8BitDemo')
  .node('inA', Input, { value: 42 })
  .node('inB', Input, { value: 17 })
  .node('sw_cin', Switch)
  .node('adder', Adder8Bit)
  .node('dispSum', HexDisplay)
  .node('led_cout', Led)
  .connect(({ in: inp, out, inA, inB, sw_cin, adder, dispSum, led_cout }) => [
    inA.out.to(adder.a),
    inB.out.to(adder.b),
    sw_cin.out.to(adder.cin),
    adder.sum.to(dispSum.in),
    adder.cout.to(led_cout.in),
  ])
  .build()
