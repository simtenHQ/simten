// Stage 5 Branch Instructions
// Conditional branches based on processor flags
// Uses relative addressing: PC = PC + offset (signed 8-bit)
//
// BEQ (0xF0) - Branch if Z=1 (equal)
// BNE (0xD0) - Branch if Z=0 (not equal)
// BCC (0x90) - Branch if C=0 (carry clear)
// BCS (0xB0) - Branch if C=1 (carry set)
// BMI (0x30) - Branch if N=1 (minus)
// BPL (0x10) - Branch if N=0 (plus)
// BVC (0x50) - Branch if V=0 (overflow clear)
// BVS (0x70) - Branch if V=1 (overflow set)

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

// === Branch Control FSM ===
circuit BranchControl {
  input reset: Bit
  input current_opcode: Bus[8]

  // Flag inputs for branch decisions
  input flag_n: Bit
  input flag_z: Bit
  input flag_c: Bit
  input flag_v: Bit

  output current_state: Bus[8]
  output exec_subcycle: Bus[8]
  output pc_increment: Bit
  output ir_load: Bit
  output operand_load: Bit
  output branch_load_pc: Bit   // Load PC with branch target

  output write_a: Bit
  output update_flags: Bit

  // Instruction decode
  output is_lda_imm: Bit    // A9
  output is_cmp_imm: Bit    // C9
  output is_beq: Bit        // F0
  output is_bne: Bit        // D0
  output is_bcc: Bit        // 90
  output is_bcs: Bit        // B0
  output is_bmi: Bit        // 30
  output is_bpl: Bit        // 10

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
    node BEQ: Constant(value=240)       // F0
    node BNE: Constant(value=208)       // D0
    node BCC: Constant(value=144)       // 90
    node BCS: Constant(value=176)       // B0
    node BMI: Constant(value=48)        // 30
    node BPL: Constant(value=16)        // 10

    node cmp_lda_imm: Comparator
    connect current_opcode -> cmp_lda_imm.a
    connect LDA_IMM.out -> cmp_lda_imm.b
    connect cmp_lda_imm.eq -> is_lda_imm

    node cmp_cmp_imm: Comparator
    connect current_opcode -> cmp_cmp_imm.a
    connect CMP_IMM.out -> cmp_cmp_imm.b
    connect cmp_cmp_imm.eq -> is_cmp_imm

    node cmp_beq: Comparator
    connect current_opcode -> cmp_beq.a
    connect BEQ.out -> cmp_beq.b
    connect cmp_beq.eq -> is_beq

    node cmp_bne: Comparator
    connect current_opcode -> cmp_bne.a
    connect BNE.out -> cmp_bne.b
    connect cmp_bne.eq -> is_bne

    node cmp_bcc: Comparator
    connect current_opcode -> cmp_bcc.a
    connect BCC.out -> cmp_bcc.b
    connect cmp_bcc.eq -> is_bcc

    node cmp_bcs: Comparator
    connect current_opcode -> cmp_bcs.a
    connect BCS.out -> cmp_bcs.b
    connect cmp_bcs.eq -> is_bcs

    node cmp_bmi: Comparator
    connect current_opcode -> cmp_bmi.a
    connect BMI.out -> cmp_bmi.b
    connect cmp_bmi.eq -> is_bmi

    node cmp_bpl: Comparator
    connect current_opcode -> cmp_bpl.a
    connect BPL.out -> cmp_bpl.b
    connect cmp_bpl.eq -> is_bpl

    // Instruction categories
    node is_imm: Or
    connect cmp_lda_imm.eq -> is_imm.a
    connect cmp_cmp_imm.eq -> is_imm.b

    // Any branch instruction
    node is_branch_1: Or
    connect cmp_beq.eq -> is_branch_1.a
    connect cmp_bne.eq -> is_branch_1.b

    node is_branch_2: Or
    connect is_branch_1.out -> is_branch_2.a
    connect cmp_bcc.eq -> is_branch_2.b

    node is_branch_3: Or
    connect is_branch_2.out -> is_branch_3.a
    connect cmp_bcs.eq -> is_branch_3.b

    node is_branch_4: Or
    connect is_branch_3.out -> is_branch_4.a
    connect cmp_bmi.eq -> is_branch_4.b

    node is_branch: Or
    connect is_branch_4.out -> is_branch.a
    connect cmp_bpl.eq -> is_branch.b

    // Branch condition checking
    // BEQ: Z=1
    node beq_cond: And
    connect cmp_beq.eq -> beq_cond.a
    connect flag_z -> beq_cond.b

    // BNE: Z=0
    node not_z: Not
    connect flag_z -> not_z.in
    node bne_cond: And
    connect cmp_bne.eq -> bne_cond.a
    connect not_z.out -> bne_cond.b

    // BCC: C=0
    node not_c: Not
    connect flag_c -> not_c.in
    node bcc_cond: And
    connect cmp_bcc.eq -> bcc_cond.a
    connect not_c.out -> bcc_cond.b

    // BCS: C=1
    node bcs_cond: And
    connect cmp_bcs.eq -> bcs_cond.a
    connect flag_c -> bcs_cond.b

    // BMI: N=1
    node bmi_cond: And
    connect cmp_bmi.eq -> bmi_cond.a
    connect flag_n -> bmi_cond.b

    // BPL: N=0
    node not_n: Not
    connect flag_n -> not_n.in
    node bpl_cond: And
    connect cmp_bpl.eq -> bpl_cond.a
    connect not_n.out -> bpl_cond.b

    // OR all branch conditions
    node branch_cond_1: Or
    connect beq_cond.out -> branch_cond_1.a
    connect bne_cond.out -> branch_cond_1.b

    node branch_cond_2: Or
    connect branch_cond_1.out -> branch_cond_2.a
    connect bcc_cond.out -> branch_cond_2.b

    node branch_cond_3: Or
    connect branch_cond_2.out -> branch_cond_3.a
    connect bcs_cond.out -> branch_cond_3.b

    node branch_cond_4: Or
    connect branch_cond_3.out -> branch_cond_4.a
    connect bmi_cond.out -> branch_cond_4.b

    node branch_taken: Or
    connect branch_cond_4.out -> branch_taken.a
    connect bpl_cond.out -> branch_taken.b

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

    // Done conditions
    node done_imm: And
    connect exec_sub1.out -> done_imm.a
    connect is_imm.out -> done_imm.b

    // Branches done at sub1
    node done_branch: And
    connect exec_sub1.out -> done_branch.a
    connect is_branch.out -> done_branch.b

    node exec_done: Or
    connect done_imm.out -> exec_done.a
    connect done_branch.out -> exec_done.b

    node next_from_execute: Mux
    connect exec_done.out -> next_from_execute.sel
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
    node needs_operand: Or
    connect is_imm.out -> needs_operand.a
    connect is_branch.out -> needs_operand.b

    node pc_inc_sub0: And
    connect exec_sub0.out -> pc_inc_sub0.a
    connect needs_operand.out -> pc_inc_sub0.b

    node pc_inc_signal: Or
    connect is_fetch.eq -> pc_inc_signal.a
    connect pc_inc_sub0.out -> pc_inc_signal.b
    connect pc_inc_signal.out -> pc_increment

    // IR load
    connect is_fetch.eq -> ir_load

    // Operand load
    node operand_load_signal: And
    connect exec_sub0.out -> operand_load_signal.a
    connect needs_operand.out -> operand_load_signal.b
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

    // Branch load PC: at sub1 if branch is taken
    node branch_at_sub1: And
    connect exec_sub1.out -> branch_at_sub1.a
    connect branch_taken.out -> branch_at_sub1.b
    connect branch_at_sub1.out -> branch_load_pc
  }
}

// === Branch CPU ===
// Simplified CPU for testing branch instructions
circuit BranchCPU {
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

    node pc_inc: Incrementer
    connect pc_reg.q -> pc_inc.in

    // ROM: Test program
    // $00: LDA #$05     (A9 05) - Load 5 into A
    // $02: CMP #$05     (C9 05) - Compare with 5, sets Z=1
    // $04: BEQ $02      (F0 02) - Branch +2 if Z=1 (should branch to $08)
    // $06: LDA #$FF     (A9 FF) - Should be skipped
    // $08: LDA #$42     (A9 42) - Target of branch
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)
    node three: Constant(value=3)
    node four: Constant(value=4)
    node five: Constant(value=5)
    node six: Constant(value=6)
    node seven: Constant(value=7)
    node eight: Constant(value=8)
    node nine: Constant(value=9)

    node byte_0: Constant(value=169)  // A9 - LDA #imm
    node byte_1: Constant(value=5)    // 05 - operand
    node byte_2: Constant(value=201)  // C9 - CMP #imm
    node byte_3: Constant(value=5)    // 05 - compare with 5
    node byte_4: Constant(value=240)  // F0 - BEQ
    node byte_5: Constant(value=2)    // 02 - offset (+2)
    node byte_6: Constant(value=169)  // A9 - LDA #imm (should skip)
    node byte_7: Constant(value=255)  // FF - bad value
    node byte_8: Constant(value=169)  // A9 - LDA #imm (branch target)
    node byte_9: Constant(value=66)   // 42 - good value

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

    node at_8: Comparator
    connect pc_reg.q -> at_8.a
    connect eight.out -> at_8.b

    node at_9: Comparator
    connect pc_reg.q -> at_9.a
    connect nine.out -> at_9.b

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

    node mux8: Mux
    connect at_8.eq -> mux8.sel
    connect mux7.out -> mux8.in0
    connect byte_8.out -> mux8.in1

    node mux9: Mux
    connect at_9.eq -> mux9.sel
    connect mux8.out -> mux9.in0
    connect byte_9.out -> mux9.in1

    // Instruction register
    node ir: Register
    connect clk -> ir.clk
    connect mux9.out -> ir.data

    // Operand register
    node operand_reg: Register
    connect clk -> operand_reg.clk
    connect mux9.out -> operand_reg.data

    // Flag register
    node flags: FlagRegister
    connect clk -> flags.clk

    // Control FSM
    node control: BranchControl
    connect clk -> control.clk
    connect reset -> control.reset
    connect ir.q -> control.current_opcode
    connect flags.flag_n -> control.flag_n
    connect flags.flag_z -> control.flag_z
    connect flags.flag_c -> control.flag_c
    connect flags.flag_v -> control.flag_v

    // PC control with branch support
    // Branch target = PC + offset (PC already points to next instruction after operand fetch)
    node branch_adder: Adder
    connect pc_reg.q -> branch_adder.a
    connect operand_reg.q -> branch_adder.b
    connect zero.out -> branch_adder.carry_in

    // PC next selection
    node pc_after_inc: Mux
    connect control.pc_increment -> pc_after_inc.sel
    connect pc_reg.q -> pc_after_inc.in0
    connect pc_inc.out -> pc_after_inc.in1

    node pc_after_branch: Mux
    connect control.branch_load_pc -> pc_after_branch.sel
    connect pc_after_inc.out -> pc_after_branch.in0
    connect branch_adder.sum -> pc_after_branch.in1

    connect pc_after_branch.out -> pc_reg.data
    connect always_on.out -> pc_reg.we

    // Register control
    connect control.ir_load -> ir.we
    connect control.operand_load -> operand_reg.we

    // A register
    node reg_a_reg: Register
    connect clk -> reg_a_reg.clk
    connect control.write_a -> reg_a_reg.we
    connect operand_reg.q -> reg_a_reg.data

    // Comparator for CMP: A - operand
    node cmp_sub: Subtractor
    connect reg_a_reg.q -> cmp_sub.a
    connect operand_reg.q -> cmp_sub.b
    connect zero.out -> cmp_sub.borrow_in

    // Flag calculation
    node const_128: Constant(value=128)

    // N from subtraction result
    node cmp_n: Comparator
    connect cmp_sub.difference -> cmp_n.a
    connect const_128.out -> cmp_n.b
    node n_gte: Or
    connect cmp_n.gt -> n_gte.a
    connect cmp_n.eq -> n_gte.b

    // Z from subtraction result
    node cmp_z: Comparator
    connect cmp_sub.difference -> cmp_z.a
    connect zero.out -> cmp_z.b

    // C = NOT borrow_out
    node not_borrow: Not
    connect cmp_sub.borrow_out -> not_borrow.in

    // N from LDA (operand value)
    node lda_n: Comparator
    connect operand_reg.q -> lda_n.a
    connect const_128.out -> lda_n.b
    node lda_n_gte: Or
    connect lda_n.gt -> lda_n_gte.a
    connect lda_n.eq -> lda_n_gte.b

    // Z from LDA
    node lda_z: Comparator
    connect operand_reg.q -> lda_z.a
    connect zero.out -> lda_z.b

    // Select flag source
    node n_source: Mux
    connect control.is_cmp_imm -> n_source.sel
    connect lda_n_gte.out -> n_source.in0
    connect n_gte.out -> n_source.in1

    node z_source: Mux
    connect control.is_cmp_imm -> z_source.sel
    connect lda_z.eq -> z_source.in0
    connect cmp_z.eq -> z_source.in1

    // Flag updates
    connect control.update_flags -> flags.update_n
    connect control.update_flags -> flags.update_z
    connect control.update_flags -> flags.update_c
    connect zero.out -> flags.update_v

    connect n_source.out -> flags.new_n
    connect z_source.out -> flags.new_z
    connect not_borrow.out -> flags.new_c
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
circuit BranchTest {
  clock clk

  impl {
    node cpu: BranchCPU
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
