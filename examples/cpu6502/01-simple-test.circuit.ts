// Auto-generated from DSL

const SimpleAddTest = component('SimpleAddTest', {
  out: { sum: bus(8), carry: bit },
  nodes: { val_a: Constant, val_b: Constant, zero: Constant, adder: Adder },
  nodeArgs: { val_a: { value: 66 }, val_b: { value: 8 }, zero: { value: 0 } },
  connect: ({ in: inp, out, val_a, val_b, zero, adder }) => [
    val_a.out.to(adder.a),
    val_b.out.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(out.sum),
    adder.carry_out.to(out.carry),
  ],
})
