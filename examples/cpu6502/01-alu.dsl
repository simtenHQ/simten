// 6502 CPU Stage 1: Arithmetic Logic Unit (ALU)
// Simplified version - performs basic arithmetic and logical operations

circuit ALU {
  input a: Bus[8]
  input b: Bus[8]
  input op: Bus[3]        // 000=ADD, 001=SUB, 010=AND, 011=OR, 100=XOR
  input carry_in: Bit

  output result: Bus[8]
  output carry_out: Bit
  output zero: Bit
  output negative: Bit

  clock clk

  impl {
    // === Arithmetic Operations ===
    node adder: Adder
    connect a -> adder.a
    connect b -> adder.b
    connect carry_in -> adder.carry_in

    node subtractor: Subtractor
    connect a -> subtractor.a
    connect b -> subtractor.b
    connect carry_in -> subtractor.borrow_in

    // === Logical Operations ===
    node and_op: BusAnd
    connect a -> and_op.a
    connect b -> and_op.b

    node or_op: BusOr
    connect a -> or_op.a
    connect b -> or_op.b

    node xor_op: BusXor
    connect a -> xor_op.a
    connect b -> xor_op.b

    // === Result Selection ===
    // We'll use a simple cascaded mux approach
    // op[0] selects between pairs, op[1] selects between groups

    // Check op bits
    node op_bit0: BitSlice
    connect op -> op_bit0.in
    node zero_const: Constant(value=0)
    node one_const: Constant(value=1)
    node two_const: Constant(value=2)
    connect zero_const.out -> op_bit0.__low
    connect zero_const.out -> op_bit0.__high

    node op_bit1: BitSlice
    connect op -> op_bit1.in
    connect one_const.out -> op_bit1.__low
    connect one_const.out -> op_bit1.__high

    node op_bit2: BitSlice
    connect op -> op_bit2.in
    connect two_const.out -> op_bit2.__low
    connect two_const.out -> op_bit2.__high

    // Level 1: ADD vs SUB
    node arith_mux: Mux
    connect op_bit0.out -> arith_mux.sel
    connect adder.sum -> arith_mux.in0
    connect subtractor.difference -> arith_mux.in1

    // Level 2: AND vs OR
    node logic1_mux: Mux
    connect op_bit0.out -> logic1_mux.sel
    connect and_op.out -> logic1_mux.in0
    connect or_op.out -> logic1_mux.in1

    // Level 3: arithmetic vs logic1
    node partial1_mux: Mux
    connect op_bit1.out -> partial1_mux.sel
    connect arith_mux.out -> partial1_mux.in0
    connect logic1_mux.out -> partial1_mux.in1

    // Level 4: partial1 vs XOR
    node final_mux: Mux
    connect op_bit2.out -> final_mux.sel
    connect partial1_mux.out -> final_mux.in0
    connect xor_op.out -> final_mux.in1

    connect final_mux.out -> result

    // === Carry Output ===
    // Select carry from adder or borrow from subtractor
    node carry_mux: Mux
    connect op_bit0.out -> carry_mux.sel
    connect adder.carry_out -> carry_mux.in0
    connect subtractor.borrow_out -> carry_mux.in1
    connect carry_mux.out -> carry_out

    // === Zero Flag ===
    node zero_cmp: Comparator
    connect result -> zero_cmp.a
    connect zero_const.out -> zero_cmp.b
    connect zero_cmp.eq -> zero

    // === Negative Flag ===
    // Extract bit 7 (sign bit)
    node bit7: BitSlice
    connect result -> bit7.in
    node seven_const: Constant(value=7)
    connect seven_const.out -> bit7.__low
    connect seven_const.out -> bit7.__high
    connect bit7.out -> negative
  }
}
