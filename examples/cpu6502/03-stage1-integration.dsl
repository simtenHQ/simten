// 6502 CPU Stage 1: Full Integration Test
// Combines ALU + Registers with sequenced operations
//
// Cycle 0: Load 66 (0x42) into register A
// Cycle 1: Add 8 to A, store result in A (should be 74/0x4A)
// Cycle 2: Transfer A to X
// Cycle 3: Add 10 to X, store result in X (should be 84/0x54)

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
    connect counter.q -> inc.input
    connect inc.output -> counter.data

    connect counter.q -> cycle_count

    // === Constants for cycle detection ===
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

    // === Data Path Control ===

    // Constants for operations
    node val_66: Constant(value=66)   // Initial value for A
    node val_8: Constant(value=8)     // Value to add in cycle 1
    node val_10: Constant(value=10)   // Value to add in cycle 3
    node zero: Constant(value=0)
    node sel_A: Constant(value=0)     // Register A selector
    node sel_X: Constant(value=1)     // Register X selector
    node op_add: Constant(value=0)    // ADD operation

    // ALU input A: always read from register A or X
    // Cycle 0,1: read A, Cycle 2,3: read X
    node alu_read_sel: Mux
    connect is_cycle_2.eq -> alu_read_sel.sel
    connect sel_A.out -> alu_read_sel.in0    // Cycles 0,1: read A
    connect sel_X.out -> alu_read_sel.in1    // Cycles 2,3: read X

    node alu_read_sel2: Mux
    connect is_cycle_3.eq -> alu_read_sel2.sel
    connect alu_read_sel.out -> alu_read_sel2.in0
    connect sel_X.out -> alu_read_sel2.in1   // Cycle 3: read X

    connect alu_read_sel2.out -> regfile.read_sel
    connect regfile.read_data -> alu.a

    // ALU input B:
    // Cycle 0: 66, Cycle 1: 8, Cycle 2: 0, Cycle 3: 10
    node alu_b_mux1: Mux
    connect is_cycle_0.eq -> alu_b_mux1.sel
    connect val_8.out -> alu_b_mux1.in0      // Not cycle 0
    connect val_66.out -> alu_b_mux1.in1     // Cycle 0: 66

    node alu_b_mux2: Mux
    connect is_cycle_2.eq -> alu_b_mux2.sel
    connect alu_b_mux1.out -> alu_b_mux2.in0
    connect zero.out -> alu_b_mux2.in1       // Cycle 2: 0

    node alu_b_mux3: Mux
    connect is_cycle_3.eq -> alu_b_mux3.sel
    connect alu_b_mux2.out -> alu_b_mux3.in0
    connect val_10.out -> alu_b_mux3.in1     // Cycle 3: 10

    connect alu_b_mux3.out -> alu.b
    connect op_add.out -> alu.op
    connect zero.out -> alu.carry_in

    connect alu.result -> alu_result

    // Register write control
    // Cycle 0,1: write to A, Cycle 2,3: write to X
    node write_sel_mux1: Mux
    connect is_cycle_2.eq -> write_sel_mux1.sel
    connect sel_A.out -> write_sel_mux1.in0  // Cycles 0,1: write A
    connect sel_X.out -> write_sel_mux1.in1  // Cycle 2: write X

    node write_sel_mux2: Mux
    connect is_cycle_3.eq -> write_sel_mux2.sel
    connect write_sel_mux1.out -> write_sel_mux2.in0
    connect sel_X.out -> write_sel_mux2.in1  // Cycle 3: write X

    connect write_sel_mux2.out -> regfile.write_sel
    connect alu.result -> regfile.write_data
    connect always_enable.out -> regfile.write_enable

    // === Outputs for monitoring ===
    // Read A value
    node reader_A: RegisterFile
    connect clk -> reader_A.clk
    connect write_sel_mux2.out -> reader_A.write_sel
    connect alu.result -> reader_A.write_data
    connect always_enable.out -> reader_A.write_enable
    connect sel_A.out -> reader_A.read_sel
    connect reader_A.read_data -> reg_a_value

    // Read X value
    node reader_X: RegisterFile
    connect clk -> reader_X.clk
    connect write_sel_mux2.out -> reader_X.write_sel
    connect alu.result -> reader_X.write_data
    connect always_enable.out -> reader_X.write_enable
    connect sel_X.out -> reader_X.read_sel
    connect reader_X.read_data -> reg_x_value
  }
}
