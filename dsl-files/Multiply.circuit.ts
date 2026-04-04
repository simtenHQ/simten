// Auto-generated from DSL

const Multiply = component('Multiply')
  .in('a', bus(8))
  .in('b', bus(8))
  .out('low', bus(8))
  .out('high', bus(8))
  .node('mul', Multiplier)
  .node('lo', BitSlice, { low: 0, high: 7 })
  .node('hi', BitSlice, { low: 8, high: 15 })
  .connect(({ in: inp, out, mul, lo, hi }) => [
    inp.a.to(mul.a),
    inp.b.to(mul.b),
    mul.product.to(lo.in, hi.in),
    lo.out.to(out.low),
    hi.out.to(out.high),
  ])
  .build()
