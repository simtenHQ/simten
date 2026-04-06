// Auto-generated from DSL

const Multiply = circuit('Multiply', {
  in: { a: bus(8), b: bus(8) },
  out: { low: bus(8), high: bus(8) },
  nodes: { mul: Multiplier, lo: BitSlice, hi: BitSlice },
  nodeArgs: { lo: { low: 0, high: 7 }, hi: { low: 8, high: 15 } },
  connect: ({ in: inp, out, mul, lo, hi }) => [
    inp.a.to(mul.a),
    inp.b.to(mul.b),
    mul.product.to(lo.in, hi.in),
    lo.out.to(out.low),
    hi.out.to(out.high),
  ],
})
