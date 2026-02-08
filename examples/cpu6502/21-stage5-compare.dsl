// Stage 5 Compare Instructions: CMP, CPX, CPY
// These instructions compare a register with memory by subtracting
// but do NOT store the result - only set flags
//
// CMP - Compare A with memory: flags = A - M
// CPX - Compare X with memory: flags = X - M
// CPY - Compare Y with memory: flags = Y - M
//
// Flag effects:
//   N = bit 7 of (reg - mem)
//   Z = 1 if reg == mem
//   C = 1 if reg >= mem (no borrow needed, i.e., NOT borrow_out)

// === Memory Controller (from Stage 4) ===
circuit SimpleMemory {
  input addr: Bus[8]
  input data_in: Bus[8]
  input write_enable: Bit

  output data_out: Bus[8]

  clock clk

  impl {
    node zero: Constant(value=0)
    node addr_10: Constant(value=16)
    node addr_11: Constant(value=17)
    node addr_12: Constant(value=18)
    node addr_13: Constant(value=19)
    node addr_14: Constant(value=20)
    node addr_15: Constant(value=21)

    node at_10: Comparator
    connect addr -> at_10.a
    connect addr_10.out -> at_10.b

    node at_11: Comparator
    connect addr -> at_11.a
    connect addr_11.out -> at_11.b

    node at_12: Comparator
    connect addr -> at_12.a
    connect addr_12.out -> at_12.b

    node at_13: Comparator
    connect addr -> at_13.a
    connect addr_13.out -> at_13.b

    node at_14: Comparator
    connect addr -> at_14.a
    connect addr_14.out -> at_14.b

    node at_15: Comparator
    connect addr -> at_15.a
    connect addr_15.out -> at_15.b

    node mem_10: Register
    node mem_11: Register
    node mem_12: Register
    node mem_13: Register
    node mem_14: Register
    node mem_15: Register

    connect clk -> mem_10.clk
    connect clk -> mem_11.clk
    connect clk -> mem_12.clk
    connect clk -> mem_13.clk
    connect clk -> mem_14.clk
    connect clk -> mem_15.clk

    connect data_in -> mem_10.data
    connect data_in -> mem_11.data
    connect data_in -> mem_12.data
    connect data_in -> mem_13.data
    connect data_in -> mem_14.data
    connect data_in -> mem_15.data

    node we_10: And
    connect write_enable -> we_10.a
    connect at_10.eq -> we_10.b
    connect we_10.out -> mem_10.we

    node we_11: And
    connect write_enable -> we_11.a
    connect at_11.eq -> we_11.b
    connect we_11.out -> mem_11.we

    node we_12: And
    connect write_enable -> we_12.a
    connect at_12.eq -> we_12.b
    connect we_12.out -> mem_12.we

    node we_13: And
    connect write_enable -> we_13.a
    connect at_13.eq -> we_13.b
    connect we_13.out -> mem_13.we

    node we_14: And
    connect write_enable -> we_14.a
    connect at_14.eq -> we_14.b
    connect we_14.out -> mem_14.we

    node we_15: And
    connect write_enable -> we_15.a
    connect at_15.eq -> we_15.b
    connect we_15.out -> mem_15.we

    node mux1: Mux
    connect at_10.eq -> mux1.sel
    connect zero.out -> mux1.in0
    connect mem_10.q -> mux1.in1

    node mux2: Mux
    connect at_11.eq -> mux2.sel
    connect mux1.out -> mux2.in0
    connect mem_11.q -> mux2.in1

    node mux3: Mux
    connect at_12.eq -> mux3.sel
    connect mux2.out -> mux3.in0
    connect mem_12.q -> mux3.in1

    node mux4: Mux
    connect at_13.eq -> mux4.sel
    connect mux3.out -> mux4.in0
    connect mem_13.q -> mux4.in1

    node mux5: Mux
    connect at_14.eq -> mux5.sel
    connect mux4.out -> mux5.in0
    connect mem_14.q -> mux5.in1

    node mux6: Mux
    connect at_15.eq -> mux6.sel
    connect mux5.out -> mux6.in0
    connect mem_15.q -> mux6.in1

    connect mux6.out -> data_out
  }
}

// === Register File ===
circuit RegisterFile {
  input write_a: Bit
  input write_x: Bit
  input write_y: Bit
  input data_a: Bus[8]
  input data_x: Bus[8]
  input data_y: Bus[8]

  output reg_a: Bus[8]
  output reg_x: Bus[8]
  output reg_y: Bus[8]

  clock clk

  impl {
    node regA: Register
    node regX: Register
    node regY: Register

    connect clk -> regA.clk
    connect clk -> regX.clk
    connect clk -> regY.clk

    connect data_a -> regA.data
    connect data_x -> regX.data
    connect data_y -> regY.data

    connect write_a -> regA.we
    connect write_x -> regX.we
    connect write_y -> regY.we

    connect regA.q -> reg_a
    connect regX.q -> reg_x
    connect regY.q -> reg_y
  }
}

// === Flag Register ===
circuit FlagRegister {
  input update_n: Bit
  input update_z: Bit
  input update_c: Bit
  input update_v: Bit

  input new_n: Bit
  input new_z: Bit
  input new_c: Bit
  input new_v: Bit

  output flag_n: Bit
  output flag_z: Bit
  output flag_c: Bit
  output flag_v: Bit

  clock clk

  impl {
    node reg_n: Register(initial=0)
    connect clk -> reg_n.clk
    connect update_n -> reg_n.we
    connect new_n -> reg_n.data
    connect reg_n.q -> flag_n

    node reg_z: Register(initial=0)
    connect clk -> reg_z.clk
    connect update_z -> reg_z.we
    connect new_z -> reg_z.data
    connect reg_z.q -> flag_z

    node reg_c: Register(initial=0)
    connect clk -> reg_c.clk
    connect update_c -> reg_c.we
    connect new_c -> reg_c.data
    connect reg_c.q -> flag_c

    node reg_v: Register(initial=0)
    connect clk -> reg_v.clk
    connect update_v -> reg_v.we
    connect new_v -> reg_v.data
    connect reg_v.q -> flag_v
  }
}

// === Compare Control FSM ===
// Simplified control for testing CMP instruction
circuit CompareControl {
  input reset: Bit
  input current_opcode: Bus[8]

  output current_state: Bus[8]
  output exec_subcycle: Bus[8]
  output pc_increment: Bit
  output ir_load: Bit
  output operand_load: Bit

  output write_a: Bit

  // Flag control
  output update_flags: Bit

  // Instruction decode
  output is_lda_imm: Bit    // A9
  output is_cmp_imm: Bit    // C9

  clock clk

  impl {
    node state_reg: Register
    connect clk -> state_reg.clk

    node subcycle_reg: Register
    connect clk -> subcycle_reg.clk

    // States
    node STATE_FETCH: Constant(value=0)
    node STATE_DECODE: Constant(value=1)
    node STATE_EXECUTE: Constant(value=2)

    node is_fetch: Comparator
    connect state_reg.q -> is_fetch.a
    connect STATE_FETCH.out -> is_fetch.b

    node is_decode: Comparator
    connect state_reg.q -> is_decode.a
    connect STATE_DECODE.out -> is_decode.b

    node is_execute: Comparator
    connect state_reg.q -> is_execute.a
    connect STATE_EXECUTE.out -> is_execute.b

    // Instruction decode
    node LDA_IMM: Constant(value=169)   // A9
    node CMP_IMM: Constant(value=201)   // C9

    node cmp_lda_imm: Comparator
    connect current_opcode -> cmp_lda_imm.a
    connect LDA_IMM.out -> cmp_lda_imm.b
    connect cmp_lda_imm.eq -> is_lda_imm

    node cmp_cmp_imm: Comparator
    connect current_opcode -> cmp_cmp_imm.a
    connect CMP_IMM.out -> cmp_cmp_imm.b
    connect cmp_cmp_imm.eq -> is_cmp_imm

    // Both LDA and CMP are immediate mode (2-byte, 2-cycle)
    node is_imm: Or
    connect cmp_lda_imm.eq -> is_imm.a
    connect cmp_cmp_imm.eq -> is_imm.b

    // Subcycle management
    node zero: Constant(value=0)
    node one: Constant(value=1)

    node inc_subcycle: Incrementer
    connect subcycle_reg.q -> inc_subcycle.in

    node subcycle_increment: Mux
    connect is_execute.eq -> subcycle_increment.sel
    connect zero.out -> subcycle_increment.in0
    connect inc_subcycle.out -> subcycle_increment.in1

    connect subcycle_increment.out -> subcycle_reg.data

    node always_on: Constant(value=1)
    connect always_on.out -> subcycle_reg.we
    connect subcycle_reg.q -> exec_subcycle

    // Subcycle comparators
    node is_sub0: Comparator
    connect subcycle_reg.q -> is_sub0.a
    connect zero.out -> is_sub0.b

    node is_sub1: Comparator
    connect subcycle_reg.q -> is_sub1.a
    connect one.out -> is_sub1.b

    // Execute state checks
    node exec_sub0: And
    connect is_execute.eq -> exec_sub0.a
    connect is_sub0.eq -> exec_sub0.b

    node exec_sub1: And
    connect is_execute.eq -> exec_sub1.a
    connect is_sub1.eq -> exec_sub1.b

    // State transitions
    node next_from_fetch: Mux
    connect is_fetch.eq -> next_from_fetch.sel
    connect state_reg.q -> next_from_fetch.in0
    connect STATE_DECODE.out -> next_from_fetch.in1

    node next_from_decode: Mux
    connect is_decode.eq -> next_from_decode.sel
    connect next_from_fetch.out -> next_from_decode.in0
    connect STATE_EXECUTE.out -> next_from_decode.in1

    // Done at sub1 for immediate
    node done_imm: And
    connect exec_sub1.out -> done_imm.a
    connect is_imm.out -> done_imm.b

    node next_from_execute: Mux
    connect done_imm.out -> next_from_execute.sel
    connect next_from_decode.out -> next_from_execute.in0
    connect STATE_FETCH.out -> next_from_execute.in1

    node next_state: Mux
    connect reset -> next_state.sel
    connect next_from_execute.out -> next_state.in0
    connect STATE_FETCH.out -> next_state.in1

    connect next_state.out -> state_reg.data
    connect always_on.out -> state_reg.we
    connect state_reg.q -> current_state

    // Control signals
    // PC increment: FETCH + operand fetch (sub0)
    node pc_inc_sub0: And
    connect exec_sub0.out -> pc_inc_sub0.a
    connect is_imm.out -> pc_inc_sub0.b

    node pc_inc_signal: Or
    connect is_fetch.eq -> pc_inc_signal.a
    connect pc_inc_sub0.out -> pc_inc_signal.b
    connect pc_inc_signal.out -> pc_increment

    // IR load
    connect is_fetch.eq -> ir_load

    // Operand load
    node operand_load_signal: And
    connect exec_sub0.out -> operand_load_signal.a
    connect is_imm.out -> operand_load_signal.b
    connect operand_load_signal.out -> operand_load

    // A write: LDA at sub1
    node write_a_signal: And
    connect exec_sub1.out -> write_a_signal.a
    connect cmp_lda_imm.eq -> write_a_signal.b
    connect write_a_signal.out -> write_a

    // Update flags: LDA and CMP at sub1
    node update_flags_lda: And
    connect exec_sub1.out -> update_flags_lda.a
    connect cmp_lda_imm.eq -> update_flags_lda.b

    node update_flags_cmp: And
    connect exec_sub1.out -> update_flags_cmp.a
    connect cmp_cmp_imm.eq -> update_flags_cmp.b

    node update_flags_signal: Or
    connect update_flags_lda.out -> update_flags_signal.a
    connect update_flags_cmp.out -> update_flags_signal.b
    connect update_flags_signal.out -> update_flags
  }
}

// === Compare CPU ===
// Simplified CPU for testing CMP instruction
circuit CompareCPU {
  input reset: Bit

  output pc: Bus[8]
  output instruction: Bus[8]
  output operand: Bus[8]
  output current_state: Bus[8]
  output subcycle: Bus[8]
  output reg_a: Bus[8]
  output flag_n: Bit
  output flag_z: Bit
  output flag_c: Bit

  clock clk

  impl {
    // Program counter
    node pc_reg: Register
    connect clk -> pc_reg.clk
    node always_on: Constant(value=1)
    connect always_on.out -> pc_reg.we

    node pc_inc: Incrementer
    connect pc_reg.q -> pc_inc.in

    // ROM: LDA #$05, CMP #$05 (should set Z=1), CMP #$03 (should set C=1, Z=0), CMP #$10 (should set C=0, N=1)
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)
    node three: Constant(value=3)
    node four: Constant(value=4)
    node five: Constant(value=5)
    node six: Constant(value=6)
    node seven: Constant(value=7)

    node byte_0: Constant(value=169)  // A9 - LDA #imm
    node byte_1: Constant(value=5)    // 05 - operand
    node byte_2: Constant(value=201)  // C9 - CMP #imm
    node byte_3: Constant(value=5)    // 05 - compare with 5 (equal)
    node byte_4: Constant(value=201)  // C9 - CMP #imm
    node byte_5: Constant(value=3)    // 03 - compare with 3 (A > 3)
    node byte_6: Constant(value=201)  // C9 - CMP #imm
    node byte_7: Constant(value=16)   // 10 - compare with 16 (A < 16)

    // PC comparators
    node at_0: Comparator
    connect pc_reg.q -> at_0.a
    connect zero.out -> at_0.b

    node at_1: Comparator
    connect pc_reg.q -> at_1.a
    connect one.out -> at_1.b

    node at_2: Comparator
    connect pc_reg.q -> at_2.a
    connect two.out -> at_2.b

    node at_3: Comparator
    connect pc_reg.q -> at_3.a
    connect three.out -> at_3.b

    node at_4: Comparator
    connect pc_reg.q -> at_4.a
    connect four.out -> at_4.b

    node at_5: Comparator
    connect pc_reg.q -> at_5.a
    connect five.out -> at_5.b

    node at_6: Comparator
    connect pc_reg.q -> at_6.a
    connect six.out -> at_6.b

    node at_7: Comparator
    connect pc_reg.q -> at_7.a
    connect seven.out -> at_7.b

    // ROM mux cascade
    node mux1: Mux
    connect at_1.eq -> mux1.sel
    connect byte_0.out -> mux1.in0
    connect byte_1.out -> mux1.in1

    node mux2: Mux
    connect at_2.eq -> mux2.sel
    connect mux1.out -> mux2.in0
    connect byte_2.out -> mux2.in1

    node mux3: Mux
    connect at_3.eq -> mux3.sel
    connect mux2.out -> mux3.in0
    connect byte_3.out -> mux3.in1

    node mux4: Mux
    connect at_4.eq -> mux4.sel
    connect mux3.out -> mux4.in0
    connect byte_4.out -> mux4.in1

    node mux5: Mux
    connect at_5.eq -> mux5.sel
    connect mux4.out -> mux5.in0
    connect byte_5.out -> mux5.in1

    node mux6: Mux
    connect at_6.eq -> mux6.sel
    connect mux5.out -> mux6.in0
    connect byte_6.out -> mux6.in1

    node mux7: Mux
    connect at_7.eq -> mux7.sel
    connect mux6.out -> mux7.in0
    connect byte_7.out -> mux7.in1

    // Instruction register
    node ir: Register
    connect clk -> ir.clk
    connect mux7.out -> ir.data

    // Operand register
    node operand_reg: Register
    connect clk -> operand_reg.clk
    connect mux7.out -> operand_reg.data

    // Control FSM
    node control: CompareControl
    connect clk -> control.clk
    connect reset -> control.reset
    connect ir.q -> control.current_opcode

    // PC control
    node pc_next: Mux
    connect control.pc_increment -> pc_next.sel
    connect pc_reg.q -> pc_next.in0
    connect pc_inc.out -> pc_next.in1
    connect pc_next.out -> pc_reg.data

    // Register control
    connect control.ir_load -> ir.we
    connect control.operand_load -> operand_reg.we

    // Register file (A only for this test)
    node reg_a_reg: Register
    connect clk -> reg_a_reg.clk
    connect control.write_a -> reg_a_reg.we

    // For LDA, write operand to A
    connect operand_reg.q -> reg_a_reg.data

    // Comparator for CMP: A - operand
    node cmp_sub: Subtractor
    connect reg_a_reg.q -> cmp_sub.a
    connect operand_reg.q -> cmp_sub.b
    connect zero.out -> cmp_sub.borrow_in

    // Flag calculation
    // N = bit 7 of difference (result >= 128)
    node const_128: Constant(value=128)
    node cmp_n: Comparator
    connect cmp_sub.difference -> cmp_n.a
    connect const_128.out -> cmp_n.b
    node n_gte: Or
    connect cmp_n.gt -> n_gte.a
    connect cmp_n.eq -> n_gte.b

    // Z = difference == 0
    node cmp_z: Comparator
    connect cmp_sub.difference -> cmp_z.a
    connect zero.out -> cmp_z.b

    // C = NOT borrow_out (A >= M)
    node not_borrow: Not
    connect cmp_sub.borrow_out -> not_borrow.in

    // Flag register
    node flags: FlagRegister
    connect clk -> flags.clk

    // Update N, Z, C flags when update_flags is set
    // For LDA: only N, Z (but we'll update all for simplicity)
    // For CMP: N, Z, C
    connect control.update_flags -> flags.update_n
    connect control.update_flags -> flags.update_z
    connect control.update_flags -> flags.update_c
    connect zero.out -> flags.update_v  // V not set by CMP

    // Select flag source based on instruction
    // For LDA: flags come from A value (which equals operand)
    // For CMP: flags come from subtraction result

    // N flag source
    node lda_n: Comparator
    connect operand_reg.q -> lda_n.a
    connect const_128.out -> lda_n.b
    node lda_n_gte: Or
    connect lda_n.gt -> lda_n_gte.a
    connect lda_n.eq -> lda_n_gte.b

    node n_source: Mux
    connect control.is_cmp_imm -> n_source.sel
    connect lda_n_gte.out -> n_source.in0
    connect n_gte.out -> n_source.in1
    connect n_source.out -> flags.new_n

    // Z flag source
    node lda_z: Comparator
    connect operand_reg.q -> lda_z.a
    connect zero.out -> lda_z.b

    node z_source: Mux
    connect control.is_cmp_imm -> z_source.sel
    connect lda_z.eq -> z_source.in0
    connect cmp_z.eq -> z_source.in1
    connect z_source.out -> flags.new_z

    // C flag (only from CMP)
    connect not_borrow.out -> flags.new_c

    // V flag (not used)
    connect zero.out -> flags.new_v

    // Outputs
    connect pc_reg.q -> pc
    connect ir.q -> instruction
    connect operand_reg.q -> operand
    connect control.current_state -> current_state
    connect control.exec_subcycle -> subcycle
    connect reg_a_reg.q -> reg_a
    connect flags.flag_n -> flag_n
    connect flags.flag_z -> flag_z
    connect flags.flag_c -> flag_c
  }
}

// === Test Circuit ===
circuit CompareTest {
  clock clk

  impl {
    node cpu: CompareCPU
    connect clk -> cpu.clk

    node reset_input: Input
    connect reset_input.out -> cpu.reset

    node d_pc: HexDisplay
    connect cpu.pc -> d_pc.in

    node d_instruction: HexDisplay
    connect cpu.instruction -> d_instruction.in

    node d_operand: HexDisplay
    connect cpu.operand -> d_operand.in

    node d_state: HexDisplay
    connect cpu.current_state -> d_state.in

    node d_subcycle: HexDisplay
    connect cpu.subcycle -> d_subcycle.in

    node d_a: HexDisplay
    connect cpu.reg_a -> d_a.in

    node d_n: HexDisplay
    connect cpu.flag_n -> d_n.in

    node d_z: HexDisplay
    connect cpu.flag_z -> d_z.in

    node d_c: HexDisplay
    connect cpu.flag_c -> d_c.in
  }
}
