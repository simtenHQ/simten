// 6502 CPU Stage 1: Complete Integration
// ALU + RegisterFile + Integration Test all in one file

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
    // === Three 8-bit registers ===
    node regA: Register
    connect clk -> regA.clk
    connect write_data -> regA.data

    node regX: Register
    connect clk -> regX.clk
    connect write_data -> regX.data

    node regY: Register
    connect clk -> regY.clk
    connect write_data -> regY.data

    // === Write Enable Logic ===
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

    // === Read Mux Logic ===
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
// Stage 1 Integration Test
// ============================================================================
// Cycle 0: Load 66 into A
// Cycle 1: Add 8 to A → A=74
// Cycle 2: Transfer A to X → X=74
// Cycle 3: Add 10 to X → X=84

circuit Stage1Integration {
  output cycle_count: Bus[8]
  output reg_a_value: Bus[8]
  output reg_x_value: Bus[8]
  output alu_result: Bus[8]

  clock clk

  impl {
    // === Cycle Counter ===
    node counter: Register
    connect clk -> counter.clk
    node always_enable: Constant(value=1)
    connect always_enable.out -> counter.we

    node inc: Incrementer
    connect counter.q -> inc.in
    connect inc.out -> counter.data

    connect counter.q -> cycle_count

    // === Cycle Detection ===
    node cycle_0: Constant(value=0)
    node cycle_1: Constant(value=1)
    node cycle_2: Constant(value=2)
    node cycle_3: Constant(value=3)

    node is_cycle_0: Comparator
    connect counter.q -> is_cycle_0.a
    connect cycle_0.out -> is_cycle_0.b

    node is_cycle_1: Comparator
    connect counter.q -> is_cycle_1.a
    connect cycle_1.out -> is_cycle_1.b

    node is_cycle_2: Comparator
    connect counter.q -> is_cycle_2.a
    connect cycle_2.out -> is_cycle_2.b

    node is_cycle_3: Comparator
    connect counter.q -> is_cycle_3.a
    connect cycle_3.out -> is_cycle_3.b

    // === Register File ===
    node regfile: RegisterFile
    connect clk -> regfile.clk

    // === ALU ===
    node alu: ALU

    // === Constants ===
    node val_66: Constant(value=66)
    node val_8: Constant(value=8)
    node val_10: Constant(value=10)
    node zero: Constant(value=0)
    node sel_A: Constant(value=0)
    node sel_X: Constant(value=1)
    node op_add: Constant(value=0)

    // === ALU Input A (read from register) ===
    node alu_read_sel: Mux
    connect is_cycle_2.eq -> alu_read_sel.sel
    connect sel_A.out -> alu_read_sel.in0
    connect sel_X.out -> alu_read_sel.in1

    node alu_read_sel2: Mux
    connect is_cycle_3.eq -> alu_read_sel2.sel
    connect alu_read_sel.out -> alu_read_sel2.in0
    connect sel_X.out -> alu_read_sel2.in1

    connect alu_read_sel2.out -> regfile.read_sel
    connect regfile.read_data -> alu.a

    // === ALU Input B ===
    node alu_b_mux1: Mux
    connect is_cycle_0.eq -> alu_b_mux1.sel
    connect val_8.out -> alu_b_mux1.in0
    connect val_66.out -> alu_b_mux1.in1

    node alu_b_mux2: Mux
    connect is_cycle_2.eq -> alu_b_mux2.sel
    connect alu_b_mux1.out -> alu_b_mux2.in0
    connect zero.out -> alu_b_mux2.in1

    node alu_b_mux3: Mux
    connect is_cycle_3.eq -> alu_b_mux3.sel
    connect alu_b_mux2.out -> alu_b_mux3.in0
    connect val_10.out -> alu_b_mux3.in1

    connect alu_b_mux3.out -> alu.b
    connect op_add.out -> alu.op
    connect zero.out -> alu.carry_in

    connect alu.result -> alu_result

    // === Register Write Control ===
    node write_sel_mux1: Mux
    connect is_cycle_2.eq -> write_sel_mux1.sel
    connect sel_A.out -> write_sel_mux1.in0
    connect sel_X.out -> write_sel_mux1.in1

    node write_sel_mux2: Mux
    connect is_cycle_3.eq -> write_sel_mux2.sel
    connect write_sel_mux1.out -> write_sel_mux2.in0
    connect sel_X.out -> write_sel_mux2.in1

    connect write_sel_mux2.out -> regfile.write_sel
    connect alu.result -> regfile.write_data
    connect always_enable.out -> regfile.write_enable

    // === Outputs (separate readers for A and X) ===
    node reader_A: RegisterFile
    connect clk -> reader_A.clk
    connect write_sel_mux2.out -> reader_A.write_sel
    connect alu.result -> reader_A.write_data
    connect always_enable.out -> reader_A.write_enable
    connect sel_A.out -> reader_A.read_sel
    connect reader_A.read_data -> reg_a_value

    node reader_X: RegisterFile
    connect clk -> reader_X.clk
    connect write_sel_mux2.out -> reader_X.write_sel
    connect alu.result -> reader_X.write_data
    connect always_enable.out -> reader_X.write_enable
    connect sel_X.out -> reader_X.read_sel
    connect reader_X.read_data -> reg_x_value
  }
}

// ============================================================================
// Demo Circuit - Visualizes Stage1Integration with HexDisplays
// ============================================================================
circuit Stage1Demo {
  clock clk

  impl {
    // Instantiate the Stage1Integration circuit
    node cpu: Stage1Integration
    connect clk -> cpu.clk

    // Add HexDisplays to visualize outputs
    node display_cycle: HexDisplay
    connect cpu.cycle_count -> display_cycle.in

    node display_a: HexDisplay
    connect cpu.reg_a_value -> display_a.in

    node display_x: HexDisplay
    connect cpu.reg_x_value -> display_x.in

    node display_alu: HexDisplay
    connect cpu.alu_result -> display_alu.in
  }
}
