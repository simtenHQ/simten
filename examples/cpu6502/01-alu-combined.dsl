// 6502 CPU Stage 1: ALU with Test Circuit
// Supports: ADD (0), SUB (1), AND (2), OR (3), XOR (4)

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

    // === Operation Selection using Comparators ===
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

    // === Result Selection using cascaded muxes ===
    // Level 1: ADD vs SUB
    node mux1: Mux
    connect is_sub.eq -> mux1.sel
    connect adder.sum -> mux1.in0      // sel=0 (not SUB): ADD
    connect subtractor.difference -> mux1.in1  // sel=1 (is SUB): SUB

    // Level 2: mux1 vs AND
    node mux2: Mux
    connect is_and.eq -> mux2.sel
    connect mux1.out -> mux2.in0       // sel=0 (not AND): ADD/SUB
    connect and_op.out -> mux2.in1     // sel=1 (is AND): AND

    // Level 3: mux2 vs OR
    node mux3: Mux
    connect is_or.eq -> mux3.sel
    connect mux2.out -> mux3.in0       // sel=0 (not OR): ADD/SUB/AND
    connect or_op.out -> mux3.in1      // sel=1 (is OR): OR

    // Level 4: mux3 vs XOR
    node mux4: Mux
    connect is_xor.eq -> mux4.sel
    connect mux3.out -> mux4.in0       // sel=0 (not XOR): ADD/SUB/AND/OR
    connect xor_op.out -> mux4.in1     // sel=1 (is XOR): XOR

    connect mux4.out -> result

    // === Carry Output ===
    // Only relevant for ADD (use SUB's borrow for SUB operation)
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
    // Bit 7 = 1 means negative (result >= 128, i.e., result > 127)
    node threshold: Constant(value=127)
    node neg_cmp: Comparator
    connect result -> neg_cmp.a
    connect threshold.out -> neg_cmp.b
    connect neg_cmp.gt -> negative
  }
}

// === Test Circuit ===
circuit ALUTest {
  output result: Bus[8]
  output carry: Bit
  output zero: Bit
  output negative: Bit

  impl {
    node val_a: Constant(value=66)    // 0x42
    node val_b: Constant(value=8)     // 0x08
    node op_input: Input              // Try 0=ADD, 1=SUB, 2=AND, 3=OR, 4=XOR
    node carry_in: Constant(value=0)

    node alu: ALU
    connect val_a.out -> alu.a
    connect val_b.out -> alu.b
    connect op_input.out -> alu.op
    connect carry_in.out -> alu.carry_in

    connect alu.result -> result
    connect alu.carry_out -> carry
    connect alu.zero -> zero
    connect alu.negative -> negative
  }
}
