// Full Adder built entirely from NAND gates
// 13 NAND gates total: 5 per HalfAdder + 3 for carry OR

circuit HalfAdder {
  description "Half adder built entirely from NAND gates"
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit
  impl {
    // XOR from 4 NANDs: sum = a XOR b
    node nand1: Nand
    node nand2: Nand
    node nand3: Nand
    node nand4: Nand

    connect a -> nand1.a
    connect b -> nand1.b

    connect a -> nand2.a
    connect nand1.out -> nand2.b

    connect nand1.out -> nand3.a
    connect b -> nand3.b

    connect nand2.out -> nand4.a
    connect nand3.out -> nand4.b

    // AND from 1 NAND: carry = NAND(NAND(a,b), NAND(a,b))
    node nand5: Nand
    connect nand1.out -> nand5.a
    connect nand1.out -> nand5.b

    connect nand4.out -> sum
    connect nand5.out -> carry
  }
}

circuit FullAdder {
  description "Full adder from two NAND-only half adders and a NAND OR gate"
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit
  impl {
    node ha1: HalfAdder
    node ha2: HalfAdder

    // OR from 3 NANDs: cout = ha1.carry OR ha2.carry
    node nand_c1: Nand
    node nand_c2: Nand
    node nand_or: Nand

    // First half adder: a + b
    connect a -> ha1.a
    connect b -> ha1.b

    // Second half adder: ha1.sum + cin
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b

    connect ha2.sum -> sum

    // OR gate from NANDs for carry out
    connect ha1.carry -> nand_c1.a
    connect ha1.carry -> nand_c1.b

    connect ha2.carry -> nand_c2.a
    connect ha2.carry -> nand_c2.b

    connect nand_c1.out -> nand_or.a
    connect nand_c2.out -> nand_or.b

    connect nand_or.out -> cout
  }
}

circuit FullAdderDemo {
  description "Interactive full adder demo with drill-down"
  impl {
    node sw_a: Switch
    node sw_b: Switch
    node sw_cin: Switch
    node led_sum: Led
    node led_cout: Led
    node fa: FullAdder

    connect sw_a.out -> fa.a
    connect sw_b.out -> fa.b
    connect sw_cin.out -> fa.cin
    connect fa.sum -> led_sum.in
    connect fa.cout -> led_cout.in
  }
}
