// 6502 CPU Stage 1: Complete Integration (Simplified)
// ALU + RegisterFile + Integration Test

// ============================================================================
// ALU Circuit
// ============================================================================
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

    node mux_carry: Mux
    connect is_sub.eq -> mux_carry.sel
    connect adder.carry_out -> mux_carry.in0
    connect subtractor.borrow_out -> mux_carry.in1
    connect mux_carry.out -> carry_out

    node zero_cmp: Comparator
    connect result -> zero_cmp.a
    connect op_0.out -> zero_cmp.b
    connect zero_cmp.eq -> zero

    node threshold: Constant(value=127)
    node neg_cmp: Comparator
    connect result -> neg_cmp.a
    connect threshold.out -> neg_cmp.b
    connect neg_cmp.gt -> negative
  }
}

// ============================================================================
// Register File Circuit
// ============================================================================
circuit RegisterFile {
  input write_sel: Bus[2]
  input write_data: Bus[8]
  input write_enable: Bit
  input read_sel: Bus[2]

  output read_data: Bus[8]

  clock clk

  impl {
    node regA: Register
    connect clk -> regA.clk
    connect write_data -> regA.data

    node regX: Register
    connect clk -> regX.clk
    connect write_data -> regX.data

    node regY: Register
    connect clk -> regY.clk
    connect write_data -> regY.data

    node sel_0: Constant(value=0)
    node sel_1: Constant(value=1)
    node sel_2: Constant(value=2)

    node is_sel_A: Comparator
    connect write_sel -> is_sel_A.a
    connect sel_0.out -> is_sel_A.b

    node is_sel_X: Comparator
    connect write_sel -> is_sel_X.a
    connect sel_1.out -> is_sel_X.b

    node is_sel_Y: Comparator
    connect write_sel -> is_sel_Y.a
    connect sel_2.out -> is_sel_Y.b

    node write_A: And
    connect is_sel_A.eq -> write_A.a
    connect write_enable -> write_A.b
    connect write_A.out -> regA.we

    node write_X: And
    connect is_sel_X.eq -> write_X.a
    connect write_enable -> write_X.b
    connect write_X.out -> regX.we

    node write_Y: And
    connect is_sel_Y.eq -> write_Y.a
    connect write_enable -> write_Y.b
    connect write_Y.out -> regY.we

    node is_read_X: Comparator
    connect read_sel -> is_read_X.a
    connect sel_1.out -> is_read_X.b

    node is_read_Y: Comparator
    connect read_sel -> is_read_Y.a
    connect sel_2.out -> is_read_Y.b

    node read_mux1: Mux
    connect is_read_X.eq -> read_mux1.sel
    connect regA.q -> read_mux1.in0
    connect regX.q -> read_mux1.in1

    node read_mux2: Mux
    connect is_read_Y.eq -> read_mux2.sel
    connect read_mux1.out -> read_mux2.in0
    connect regY.q -> read_mux2.in1

    connect read_mux2.out -> read_data
  }
}

// ============================================================================
// Stage 1 Integration - Simplified
// ============================================================================
// Cycle 0: A ← 66
// Cycle 1: A ← A + 8 = 74
// Cycle 2: X ← A = 74
// Cycle 3: X ← X + 10 = 84

circuit Stage1Simple {
  output cycle: Bus[8]
  output alu_out: Bus[8]
  output reg_out: Bus[8]
  output write_to: Bus[2]

  clock clk

  impl {
    // === Cycle Counter ===
    node counter: Register
    connect clk -> counter.clk
    node always_on: Constant(value=1)
    connect always_on.out -> counter.we

    node inc: Incrementer
    connect counter.q -> inc.in
    connect inc.out -> counter.data
    connect counter.q -> cycle

    // === Cycle Detection ===
    node c0: Constant(value=0)
    node c1: Constant(value=1)
    node c2: Constant(value=2)
    node c3: Constant(value=3)

    node is_c0: Comparator
    connect counter.q -> is_c0.a
    connect c0.out -> is_c0.b

    node is_c1: Comparator
    connect counter.q -> is_c1.a
    connect c1.out -> is_c1.b

    node is_c2: Comparator
    connect counter.q -> is_c2.a
    connect c2.out -> is_c2.b

    node is_c3: Comparator
    connect counter.q -> is_c3.a
    connect c3.out -> is_c3.b

    // === Register File ===
    node rf: RegisterFile
    connect clk -> rf.clk

    // === ALU ===
    node alu: ALU

    // === Constants ===
    node v66: Constant(value=66)
    node v8: Constant(value=8)
    node v10: Constant(value=10)
    node zero: Constant(value=0)
    node sel_a: Constant(value=0)
    node sel_x: Constant(value=1)

    // === ALU Inputs ===
    // ALU.a = register file output
    // read_sel: cycles 0-1 read A (0), cycles 2-3 read X (1)
    node read_sel: Mux
    connect is_c2.eq -> read_sel.sel
    connect sel_a.out -> read_sel.in0
    connect sel_x.out -> read_sel.in1

    node read_sel2: Mux
    connect is_c3.eq -> read_sel2.sel
    connect read_sel.out -> read_sel2.in0
    connect sel_x.out -> read_sel2.in1

    connect read_sel2.out -> rf.read_sel
    connect rf.read_data -> alu.a
    connect rf.read_data -> reg_out

    // ALU.b = immediate value
    // c0: 66, c1: 8, c2: 0, c3: 10
    node b1: Mux
    connect is_c0.eq -> b1.sel
    connect v8.out -> b1.in0
    connect v66.out -> b1.in1

    node b2: Mux
    connect is_c2.eq -> b2.sel
    connect b1.out -> b2.in0
    connect zero.out -> b2.in1

    node b3: Mux
    connect is_c3.eq -> b3.sel
    connect b2.out -> b3.in0
    connect v10.out -> b3.in1

    connect b3.out -> alu.b
    connect zero.out -> alu.op
    connect zero.out -> alu.carry_in
    connect alu.result -> alu_out

    // === Register Write ===
    // write_sel: cycles 0-1 write A, cycles 2-3 write X
    node ws1: Mux
    connect is_c2.eq -> ws1.sel
    connect sel_a.out -> ws1.in0
    connect sel_x.out -> ws1.in1

    node ws2: Mux
    connect is_c3.eq -> ws2.sel
    connect ws1.out -> ws2.in0
    connect sel_x.out -> ws2.in1

    connect ws2.out -> rf.write_sel
    connect ws2.out -> write_to
    connect alu.result -> rf.write_data
    connect always_on.out -> rf.write_enable
  }
}

// ============================================================================
// Demo with HexDisplays
// ============================================================================
circuit Stage1Demo {
  clock clk

  impl {
    node cpu: Stage1Simple
    connect clk -> cpu.clk

    node d_cycle: HexDisplay
    connect cpu.cycle -> d_cycle.in

    node d_alu: HexDisplay
    connect cpu.alu_out -> d_alu.in

    node d_reg: HexDisplay
    connect cpu.reg_out -> d_reg.in

    node d_write: HexDisplay
    connect cpu.write_to -> d_write.in
  }
}
