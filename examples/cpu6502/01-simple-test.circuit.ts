// Auto-generated from DSL

const SimpleAddTest = component('SimpleAddTest')
  .out('sum', bus(8))
  .out('carry', bit)
  .node('val_a', Constant, { value: 66 })
  .node('val_b', Constant, { value: 8 })
  .node('zero', Constant, { value: 0 })
  .node('adder', Adder)
  .connect(({ in: inp, out, val_a, val_b, zero, adder }) => [
    val_a.out.to(adder.a),
    val_b.out.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(out.sum),
    adder.carry_out.to(out.carry),
  ])
  .build()
