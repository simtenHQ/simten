// 6502 ALU with Manual Test (all inputs controllable)

// === ALU Circuit ===
circuit ALU {
  input a: Bus[8]
  input b: Bus[8]
  input op: Bus[3]
  input carry_in: Bit

  output result: Bus[8]
  output carry_out: Bit
  output zero: Bit
  output negative: Bit

  impl {
    // === Compute all operations ===
    node adder: Adder
    connect a -> adder.a
    connect b -> adder.b
    connect carry_in -> adder.carry_in

    node subtractor: Subtractor
    connect a -> subtractor.a
    connect b -> subtractor.b
    connect carry_in -> subtractor.borrow_in

    node and_op: BusAnd
    connect a -> and_op.a
    connect b -> and_op.b

    node or_op: BusOr
    connect a -> or_op.a
    connect b -> or_op.b

    node xor_op: BusXor
    connect a -> xor_op.a
    connect b -> xor_op.b

    // === Operation Selection ===
    node op_0: Constant(value=0)
    node op_1: Constant(value=1)
    node op_2: Constant(value=2)
    node op_3: Constant(value=3)
    node op_4: Constant(value=4)

    node is_add: Comparator
    connect op -> is_add.a
    connect op_0.out -> is_add.b

    node is_sub: Comparator
    connect op -> is_sub.a
    connect op_1.out -> is_sub.b

    node is_and: Comparator
    connect op -> is_and.a
    connect op_2.out -> is_and.b

    node is_or: Comparator
    connect op -> is_or.a
    connect op_3.out -> is_or.b

    node is_xor: Comparator
    connect op -> is_xor.a
    connect op_4.out -> is_xor.b

    // === Result Selection ===
    node mux1: Mux
    connect is_sub.eq -> mux1.sel
    connect adder.sum -> mux1.in0
    connect subtractor.difference -> mux1.in1

    node mux2: Mux
    connect is_and.eq -> mux2.sel
    connect mux1.out -> mux2.in0
    connect and_op.out -> mux2.in1

    node mux3: Mux
    connect is_or.eq -> mux3.sel
    connect mux2.out -> mux3.in0
    connect or_op.out -> mux3.in1

    node mux4: Mux
    connect is_xor.eq -> mux4.sel
    connect mux3.out -> mux4.in0
    connect xor_op.out -> mux4.in1

    connect mux4.out -> result

    // === Carry Output ===
    node mux_carry: Mux
    connect is_sub.eq -> mux_carry.sel
    connect adder.carry_out -> mux_carry.in0
    connect subtractor.borrow_out -> mux_carry.in1
    connect mux_carry.out -> carry_out

    // === Zero Flag ===
    node zero_cmp: Comparator
    connect result -> zero_cmp.a
    connect op_0.out -> zero_cmp.b
    connect zero_cmp.eq -> zero

    // === Negative Flag ===
    node threshold: Constant(value=127)
    node neg_cmp: Comparator
    connect result -> neg_cmp.a
    connect threshold.out -> neg_cmp.b
    connect neg_cmp.gt -> negative
  }
}

// === Manual Test Circuit ===
// Set input_a=66, input_b=8, input_carry=0
// Then try input_op = 0,1,2,3,4 for different operations

circuit ALUManualTest {
  output result: Bus[8]
  output carry: Bit
  output zero: Bit
  output negative: Bit

  impl {
    node input_a: Input    // Set to 66 (0x42)
    node input_b: Input    // Set to 8
    node input_op: Input   // 0=ADD, 1=SUB, 2=AND, 3=OR, 4=XOR
    node input_carry: Input  // Set to 0

    node alu: ALU
    connect input_a.out -> alu.a
    connect input_b.out -> alu.b
    connect input_op.out -> alu.op
    connect input_carry.out -> alu.carry_in

    connect alu.result -> result
    connect alu.carry_out -> carry
    connect alu.zero -> zero
    connect alu.negative -> negative
  }
}
