// Auto-generated from DSL

const HalfAdder = component('HalfAdder')
  .in('a', bit)
  .in('b', bit)
  .out('sum', bit)
  .out('carry', bit)
  .node('n1', Nand)
  .node('n2', Nand)
  .node('n3', Nand)
  .node('n4', Nand)
  .node('n5', Nand)
  .connect(({ in: inp, out, n1, n2, n3, n4, n5 }) => [
    inp.a.to(n1.a, n2.a),
    inp.b.to(n1.b, n3.b),
    n1.out.to(n2.b, n3.a, n5.a, n5.b),
    n2.out.to(n4.a),
    n3.out.to(n4.b),
    n4.out.to(out.sum),
    n5.out.to(out.carry),
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
  .node('nc1', Nand)
  .node('nc2', Nand)
  .node('nor', Nand)
  .connect(({ in: inp, out, ha1, ha2, nc1, nc2, nor }) => [
    inp.a.to(ha1.a),
    inp.b.to(ha1.b),
    ha1.sum.to(ha2.a),
    inp.cin.to(ha2.b),
    ha2.sum.to(out.sum),
    ha1.carry.to(nc1.a, nc1.b),
    ha2.carry.to(nc2.a, nc2.b),
    nc1.out.to(nor.a),
    nc2.out.to(nor.b),
    nor.out.to(out.cout),
  ])
  .build()

const Adder8Bit = component('Adder8Bit')
  .in('a', bus(8))
  .in('b', bus(8))
  .out('sum', bus(8))
  .out('carry_out', bit)
  .node('split_a', Splitter8to8)
  .node('split_b', Splitter8to8)
  .node('fa0', FullAdder)
  .node('fa1', FullAdder)
  .node('fa2', FullAdder)
  .node('fa3', FullAdder)
  .node('fa4', FullAdder)
  .node('fa5', FullAdder)
  .node('fa6', FullAdder)
  .node('fa7', FullAdder)
  .node('gnd', Constant, { value: 0 })
  .node('combine', Combiner8to8)
  .connect(({ in: inp, out, split_a, split_b, fa0, fa1, fa2, fa3, fa4, fa5, fa6, fa7, gnd, combine }) => [
    inp.a.to(split_a.in),
    inp.b.to(split_b.in),
    gnd.out.to(fa0.cin),
    split_a.bit0.to(fa0.a),
    split_b.bit0.to(fa0.b),
    fa0.cout.to(fa1.cin),
    split_a.bit1.to(fa1.a),
    split_b.bit1.to(fa1.b),
    fa1.cout.to(fa2.cin),
    split_a.bit2.to(fa2.a),
    split_b.bit2.to(fa2.b),
    fa2.cout.to(fa3.cin),
    split_a.bit3.to(fa3.a),
    split_b.bit3.to(fa3.b),
    fa3.cout.to(fa4.cin),
    split_a.bit4.to(fa4.a),
    split_b.bit4.to(fa4.b),
    fa4.cout.to(fa5.cin),
    split_a.bit5.to(fa5.a),
    split_b.bit5.to(fa5.b),
    fa5.cout.to(fa6.cin),
    split_a.bit6.to(fa6.a),
    split_b.bit6.to(fa6.b),
    fa6.cout.to(fa7.cin),
    split_a.bit7.to(fa7.a),
    split_b.bit7.to(fa7.b),
    fa7.cout.to(out.carry_out),
    fa0.sum.to(combine.bit0),
    fa1.sum.to(combine.bit1),
    fa2.sum.to(combine.bit2),
    fa3.sum.to(combine.bit3),
    fa4.sum.to(combine.bit4),
    fa5.sum.to(combine.bit5),
    fa6.sum.to(combine.bit6),
    fa7.sum.to(combine.bit7),
    combine.out.to(out.sum),
  ])
  .build()

const Adder8BitDemo = component('Adder8BitDemo')
  .node('a', Input, { value: 42 })
  .node('b', Input, { value: 73 })
  .node('adder', Adder8Bit)
  .node('led_carry', Led)
  .node('display_a', HexDisplay)
  .node('display_b', HexDisplay)
  .node('display_sum', HexDisplay)
  .connect(({ in: inp, out, a, b, adder, led_carry, display_a, display_b, display_sum }) => [
    a.out.to(adder.a, display_a.in),
    b.out.to(adder.b, display_b.in),
    adder.sum.to(display_sum.in),
    adder.carry_out.to(led_carry.in),
  ])
  .build()
