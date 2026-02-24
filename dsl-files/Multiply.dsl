// Multiply - 8-bit multiplier with 16-bit result split into high and low bytes

circuit Multiply {
  input a: Bus[8]
  input b: Bus[8]
  output low: Bus[8]
  output high: Bus[8]

  impl {
    node mul: Multiplier
    node lo: BitSlice(low=0, high=7)
    node hi: BitSlice(low=8, high=15)

    // Multiply a * b -> 16-bit product
    connect a -> mul.a
    connect b -> mul.b

    // Extract low byte (bits 0-7) and high byte (bits 8-15)
    connect mul.product -> lo.in
    connect mul.product -> hi.in

    connect lo.out -> low
    connect hi.out -> high
  }
}
