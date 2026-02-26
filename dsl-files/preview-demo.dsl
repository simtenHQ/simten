circuit HalfAdder {
  description "Adds two 1-bit values"
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit

  impl {
    node xor1: Xor
    node and1: And

    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum

    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}

circuit FullAdder {
  description "Adds two 1-bit values with carry-in"
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit

  impl {
    node ha1: HalfAdder
    node ha2: HalfAdder
    node or1: Or

    connect a -> ha1.a
    connect b -> ha1.b
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b
    connect ha2.sum -> sum

    connect ha1.carry -> or1.a
    connect ha2.carry -> or1.b
    connect or1.out -> cout
  }
}

circuit Adder8Bit {
  description "Ripple-carry 8-bit adder built from full adders"
  input a: Bus[8]
  input b: Bus[8]
  input cin: Bit
  output sum: Bus[8]
  output cout: Bit

  impl {
    node splitA: Splitter8to8
    node splitB: Splitter8to8

    node fa0: FullAdder
    node fa1: FullAdder
    node fa2: FullAdder
    node fa3: FullAdder
    node fa4: FullAdder
    node fa5: FullAdder
    node fa6: FullAdder
    node fa7: FullAdder

    node combine: Combiner8to8

    connect a -> splitA.in
    connect b -> splitB.in

    connect splitA.bit0 -> fa0.a
    connect splitB.bit0 -> fa0.b
    connect cin -> fa0.cin

    connect splitA.bit1 -> fa1.a
    connect splitB.bit1 -> fa1.b
    connect fa0.cout -> fa1.cin

    connect splitA.bit2 -> fa2.a
    connect splitB.bit2 -> fa2.b
    connect fa1.cout -> fa2.cin

    connect splitA.bit3 -> fa3.a
    connect splitB.bit3 -> fa3.b
    connect fa2.cout -> fa3.cin

    connect splitA.bit4 -> fa4.a
    connect splitB.bit4 -> fa4.b
    connect fa3.cout -> fa4.cin

    connect splitA.bit5 -> fa5.a
    connect splitB.bit5 -> fa5.b
    connect fa4.cout -> fa5.cin

    connect splitA.bit6 -> fa6.a
    connect splitB.bit6 -> fa6.b
    connect fa5.cout -> fa6.cin

    connect splitA.bit7 -> fa7.a
    connect splitB.bit7 -> fa7.b
    connect fa6.cout -> fa7.cin

    connect fa0.sum -> combine.bit0
    connect fa1.sum -> combine.bit1
    connect fa2.sum -> combine.bit2
    connect fa3.sum -> combine.bit3
    connect fa4.sum -> combine.bit4
    connect fa5.sum -> combine.bit5
    connect fa6.sum -> combine.bit6
    connect fa7.sum -> combine.bit7

    connect combine.out -> sum
    connect fa7.cout -> cout
  }
}

circuit Adder8BitDemo {
  description "Interactive 8-bit ripple-carry adder"
  impl {
    node inA: Input(value=42)
    node inB: Input(value=17)
    node sw_cin: Switch
    node adder: Adder8Bit
    node dispSum: HexDisplay
    node led_cout: Led

    connect inA.out -> adder.a
    connect inB.out -> adder.b
    connect sw_cin.out -> adder.cin
    connect adder.sum -> dispSum.in
    connect adder.cout -> led_cout.in
  }
}
