// Auto-generated from DSL

const HalfAdder = component('HalfAdder')
  .in('a', bit)
  .in('b', bit)
  .out('sum', bit)
  .out('carry', bit)
  .node('nand1', Nand)
  .node('nand2', Nand)
  .node('nand3', Nand)
  .node('nand4', Nand)
  .node('nand5', Nand)
  .connect(({ in: inp, out, nand1, nand2, nand3, nand4, nand5 }) => [
    inp.a.to(nand1.a, nand2.a),
    inp.b.to(nand1.b, nand3.b),
    nand1.out.to(nand2.b, nand3.a, nand5.a, nand5.b),
    nand2.out.to(nand4.a),
    nand3.out.to(nand4.b),
    nand4.out.to(out.sum),
    nand5.out.to(out.carry),
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
  .node('nand_c1', Nand)
  .node('nand_c2', Nand)
  .node('nand_or', Nand)
  .connect(({ in: inp, out, ha1, ha2, nand_c1, nand_c2, nand_or }) => [
    inp.a.to(ha1.a),
    inp.b.to(ha1.b),
    ha1.sum.to(ha2.a),
    inp.cin.to(ha2.b),
    ha2.sum.to(out.sum),
    ha1.carry.to(nand_c1.a, nand_c1.b),
    ha2.carry.to(nand_c2.a, nand_c2.b),
    nand_c1.out.to(nand_or.a),
    nand_c2.out.to(nand_or.b),
    nand_or.out.to(out.cout),
  ])
  .build()

const FullAdderDemo = component('FullAdderDemo')
  .node('sw_a', Switch)
  .node('sw_b', Switch)
  .node('sw_cin', Switch)
  .node('led_sum', Led)
  .node('led_cout', Led)
  .node('fa', FullAdder)
  .connect(({ in: inp, out, sw_a, sw_b, sw_cin, led_sum, led_cout, fa }) => [
    sw_a.out.to(fa.a),
    sw_b.out.to(fa.b),
    sw_cin.out.to(fa.cin),
    fa.sum.to(led_sum.in),
    fa.cout.to(led_cout.in),
  ])
  .build()
