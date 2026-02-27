// 8-Bit Adder Built Entirely from NAND Gates
//
// 104 NAND gates. Zero other logic.
// 3 levels of hierarchy:
//   Adder8BitDemo -> Adder8Bit (8 FullAdders) -> FullAdder (2 HalfAdders + OR) -> HalfAdder (5 NANDs)
//
// Change the Input values in the preview, see the hex result instantly.
// Drill down through any component to see the gates inside.

circuit HalfAdder {
  description "Half adder from 5 NAND gates"
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit
  impl {
    node n1: Nand
    node n2: Nand
    node n3: Nand
    node n4: Nand
    node n5: Nand
    connect a -> n1.a
    connect b -> n1.b
    connect a -> n2.a
    connect n1.out -> n2.b
    connect n1.out -> n3.a
    connect b -> n3.b
    connect n2.out -> n4.a
    connect n3.out -> n4.b
    connect n1.out -> n5.a
    connect n1.out -> n5.b
    connect n4.out -> sum
    connect n5.out -> carry
  }
}

circuit FullAdder {
  description "Full adder from 2 NAND half adders + 3-NAND OR gate (13 NANDs)"
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit
  impl {
    node ha1: HalfAdder
    node ha2: HalfAdder
    node nc1: Nand
    node nc2: Nand
    node nor: Nand
    connect a -> ha1.a
    connect b -> ha1.b
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b
    connect ha2.sum -> sum
    connect ha1.carry -> nc1.a
    connect ha1.carry -> nc1.b
    connect ha2.carry -> nc2.a
    connect ha2.carry -> nc2.b
    connect nc1.out -> nor.a
    connect nc2.out -> nor.b
    connect nor.out -> cout
  }
}

circuit Adder8Bit {
  description "8-bit ripple carry adder from 8 NAND-only full adders (104 NANDs)"
  input a: Bus[8]
  input b: Bus[8]
  output sum: Bus[8]
  output carry_out: Bit
  impl {
    node split_a: Splitter8to8
    node split_b: Splitter8to8
    connect a -> split_a.in
    connect b -> split_b.in

    node fa0: FullAdder
    node fa1: FullAdder
    node fa2: FullAdder
    node fa3: FullAdder
    node fa4: FullAdder
    node fa5: FullAdder
    node fa6: FullAdder
    node fa7: FullAdder

    node gnd: Constant(value=0)
    connect gnd.out -> fa0.cin

    // Ripple carry chain
    connect split_a.bit0 -> fa0.a
    connect split_b.bit0 -> fa0.b
    connect fa0.cout -> fa1.cin

    connect split_a.bit1 -> fa1.a
    connect split_b.bit1 -> fa1.b
    connect fa1.cout -> fa2.cin

    connect split_a.bit2 -> fa2.a
    connect split_b.bit2 -> fa2.b
    connect fa2.cout -> fa3.cin

    connect split_a.bit3 -> fa3.a
    connect split_b.bit3 -> fa3.b
    connect fa3.cout -> fa4.cin

    connect split_a.bit4 -> fa4.a
    connect split_b.bit4 -> fa4.b
    connect fa4.cout -> fa5.cin

    connect split_a.bit5 -> fa5.a
    connect split_b.bit5 -> fa5.b
    connect fa5.cout -> fa6.cin

    connect split_a.bit6 -> fa6.a
    connect split_b.bit6 -> fa6.b
    connect fa6.cout -> fa7.cin

    connect split_a.bit7 -> fa7.a
    connect split_b.bit7 -> fa7.b
    connect fa7.cout -> carry_out

    // Combine result bits back to bus
    node combine: Combiner8to8
    connect fa0.sum -> combine.bit0
    connect fa1.sum -> combine.bit1
    connect fa2.sum -> combine.bit2
    connect fa3.sum -> combine.bit3
    connect fa4.sum -> combine.bit4
    connect fa5.sum -> combine.bit5
    connect fa6.sum -> combine.bit6
    connect fa7.sum -> combine.bit7
    connect combine.out -> sum
  }
}

circuit Adder8BitDemo {
  description "Interactive 8-bit NAND adder — change inputs, see result, drill down to gates"
  impl {
    node a: Input(value=42)
    node b: Input(value=73)
    node adder: Adder8Bit
    node led_carry: Led

    node display_a: HexDisplay
    node display_b: HexDisplay
    node display_sum: HexDisplay

    connect a.out -> adder.a
    connect b.out -> adder.b

    connect a.out -> display_a.in
    connect b.out -> display_b.in
    connect adder.sum -> display_sum.in
    connect adder.carry_out -> led_carry.in
  }
}
