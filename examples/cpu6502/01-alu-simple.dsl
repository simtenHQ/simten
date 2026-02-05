// 6502 CPU Stage 1: ALU (Simplified)
// Supports: ADD, SUB, AND, OR, XOR operations
// op=0: ADD, op=1: SUB, op=2: AND, op=3: OR, op=4: XOR

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

    // ADD
    node adder: Adder
    connect a -> adder.a
    connect b -> adder.b
    connect carry_in -> adder.carry_in

    // SUB
    node subtractor: Subtractor
    connect a -> subtractor.a
    connect b -> subtractor.b
    connect carry_in -> subtractor.borrow_in

    // AND
    node and_op: BusAnd
    connect a -> and_op.a
    connect b -> and_op.b

    // OR
    node or_op: BusOr
    connect a -> or_op.a
    connect b -> or_op.b

    // XOR
    node xor_op: BusXor
    connect a -> xor_op.a
    connect b -> xor_op.b

    // === Result Selection (op 0-4) ===
    // Use cascaded 2:1 muxes based on op bits

    // Extract op bits for mux selection
    // op[0] = bit 0, op[1] = bit 1, op[2] = bit 2
    node op0_slice: BitSlice
    connect op -> op0_slice.in
    node zero: Constant(value=0)
    connect zero.out -> op0_slice.__low
    connect zero.out -> op0_slice.__high

    node op1_slice: BitSlice
    connect op -> op1_slice.in
    node one: Constant(value=1)
    connect one.out -> op1_slice.__low
    connect one.out -> op1_slice.__high

    node op2_slice: BitSlice
    connect op -> op2_slice.in
    node two: Constant(value=2)
    connect two.out -> op2_slice.__low
    connect two.out -> op2_slice.__high

    // Level 1: Select ADD or SUB (op[0])
    node mux_arith: Mux
    connect op0_slice.out -> mux_arith.sel
    connect adder.sum -> mux_arith.in0      // op[0]=0: ADD
    connect subtractor.difference -> mux_arith.in1  // op[0]=1: SUB

    // Level 2: Select AND or OR (op[0])
    node mux_logic1: Mux
    connect op0_slice.out -> mux_logic1.sel
    connect and_op.out -> mux_logic1.in0    // op[0]=0: AND
    connect or_op.out -> mux_logic1.in1     // op[0]=1: OR

    // Level 3: Select arithmetic or logic1 (op[1])
    node mux_partial: Mux
    connect op1_slice.out -> mux_partial.sel
    connect mux_arith.out -> mux_partial.in0   // op[1]=0: ADD/SUB
    connect mux_logic1.out -> mux_partial.in1  // op[1]=1: AND/OR

    // Level 4: Select partial or XOR (op[2])
    node mux_final: Mux
    connect op2_slice.out -> mux_final.sel
    connect mux_partial.out -> mux_final.in0   // op[2]=0: ADD/SUB/AND/OR
    connect xor_op.out -> mux_final.in1        // op[2]=1: XOR

    connect mux_final.out -> result

    // === Carry Output ===
    // Select carry from ADD or borrow from SUB (only relevant for arithmetic)
    node mux_carry: Mux
    connect op0_slice.out -> mux_carry.sel
    connect adder.carry_out -> mux_carry.in0
    connect subtractor.borrow_out -> mux_carry.in1
    connect mux_carry.out -> carry_out

    // === Zero Flag ===
    // Result is zero if all bits are 0
    node zero_cmp: Comparator
    connect result -> zero_cmp.a
    connect zero.out -> zero_cmp.b
    connect zero_cmp.eq -> zero

    // === Negative Flag ===
    // Extract bit 7 (sign bit)
    node bit7_slice: BitSlice
    connect result -> bit7_slice.in
    node seven: Constant(value=7)
    connect seven.out -> bit7_slice.__low
    connect seven.out -> bit7_slice.__high
    connect bit7_slice.out -> negative
  }
}
