// Stage 6 Part 4 Test: LDX #imm, SBC #imm
// Test program to verify the new instructions work correctly

circuit Part4TestCPU {
  input reset: Bit

  output pc: Bus[8]
  output reg_a: Bus[8]
  output reg_x: Bus[8]
  output reg_y: Bus[8]
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

    // ROM - Test program for Part 4 instructions
    // $00: LDX #$42     (A2 42) - Load X with 0x42
    // $02: LDA #$50     (A9 50) - A = 0x50
    // $04: SEC          (38)    - Set carry (needed for SBC)
    // $05: SBC #$10     (E9 10) - A = 0x50 - 0x10 - 0 = 0x40, C=1 (no borrow)
    // $07: SBC #$30     (E9 30) - A = 0x40 - 0x30 - 0 = 0x10, C=1 (no borrow)
    // $09: SBC #$10     (E9 10) - A = 0x10 - 0x10 - 0 = 0x00, C=1, Z=1
    // $0B: LDA #$05     (A9 05) - A = 0x05
    // $0D: SBC #$10     (E9 10) - A = 0x05 - 0x10 - 0 = 0xF5, C=0 (borrow), N=1
    // $0F: NOP          (EA)
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
    node ten: Constant(value=10)
    node eleven: Constant(value=11)
    node twelve: Constant(value=12)
    node thirteen: Constant(value=13)
    node fourteen: Constant(value=14)
    node fifteen: Constant(value=15)

    // Program bytes
    node byte_0: Constant(value=162)   // A2 - LDX #imm
    node byte_1: Constant(value=66)    // 42 - operand
    node byte_2: Constant(value=169)   // A9 - LDA #imm
    node byte_3: Constant(value=80)    // 50 - operand (0x50)
    node byte_4: Constant(value=56)    // 38 - SEC
    node byte_5: Constant(value=233)   // E9 - SBC #imm
    node byte_6: Constant(value=16)    // 10 - operand (0x10)
    node byte_7: Constant(value=233)   // E9 - SBC #imm
    node byte_8: Constant(value=48)    // 30 - operand (0x30)
    node byte_9: Constant(value=233)   // E9 - SBC #imm
    node byte_10: Constant(value=16)   // 10 - operand
    node byte_11: Constant(value=169)  // A9 - LDA #imm
    node byte_12: Constant(value=5)    // 05 - operand
    node byte_13: Constant(value=233)  // E9 - SBC #imm
    node byte_14: Constant(value=16)   // 10 - operand
    node byte_15: Constant(value=234)  // EA - NOP

    // PC comparators for ROM
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

    node at_10: Comparator
    connect pc_reg.q -> at_10.a
    connect ten.out -> at_10.b

    node at_11: Comparator
    connect pc_reg.q -> at_11.a
    connect eleven.out -> at_11.b

    node at_12: Comparator
    connect pc_reg.q -> at_12.a
    connect twelve.out -> at_12.b

    node at_13: Comparator
    connect pc_reg.q -> at_13.a
    connect thirteen.out -> at_13.b

    node at_14: Comparator
    connect pc_reg.q -> at_14.a
    connect fourteen.out -> at_14.b

    node at_15: Comparator
    connect pc_reg.q -> at_15.a
    connect fifteen.out -> at_15.b

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

    node mux10: Mux
    connect at_10.eq -> mux10.sel
    connect mux9.out -> mux10.in0
    connect byte_10.out -> mux10.in1

    node mux11: Mux
    connect at_11.eq -> mux11.sel
    connect mux10.out -> mux11.in0
    connect byte_11.out -> mux11.in1

    node mux12: Mux
    connect at_12.eq -> mux12.sel
    connect mux11.out -> mux12.in0
    connect byte_12.out -> mux12.in1

    node mux13: Mux
    connect at_13.eq -> mux13.sel
    connect mux12.out -> mux13.in0
    connect byte_13.out -> mux13.in1

    node mux14: Mux
    connect at_14.eq -> mux14.sel
    connect mux13.out -> mux14.in0
    connect byte_14.out -> mux14.in1

    node mux15: Mux
    connect at_15.eq -> mux15.sel
    connect mux14.out -> mux15.in0
    connect byte_15.out -> mux15.in1

    // Instruction register
    node ir: Register
    connect clk -> ir.clk
    connect mux15.out -> ir.data

    // Operand register
    node operand_reg: Register
    connect clk -> operand_reg.clk
    connect mux15.out -> operand_reg.data

    // Registers A, X, Y
    node regA: Register
    node regX: Register
    node regY: Register
    connect clk -> regA.clk
    connect clk -> regX.clk
    connect clk -> regY.clk

    // Flag registers
    node flag_n_reg: Register(initial=0)
    node flag_z_reg: Register(initial=0)
    node flag_c_reg: Register(initial=0)
    connect clk -> flag_n_reg.clk
    connect clk -> flag_z_reg.clk
    connect clk -> flag_c_reg.clk

    // State machine
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
    node LDX_IMM: Constant(value=162)  // 0xA2
    node LDA_IMM: Constant(value=169)  // 0xA9
    node SEC: Constant(value=56)       // 0x38
    node SBC_IMM: Constant(value=233)  // 0xE9
    node NOP: Constant(value=234)      // 0xEA

    node cmp_ldx_imm: Comparator
    connect ir.q -> cmp_ldx_imm.a
    connect LDX_IMM.out -> cmp_ldx_imm.b

    node cmp_lda_imm: Comparator
    connect ir.q -> cmp_lda_imm.a
    connect LDA_IMM.out -> cmp_lda_imm.b

    node cmp_sec: Comparator
    connect ir.q -> cmp_sec.a
    connect SEC.out -> cmp_sec.b

    node cmp_sbc_imm: Comparator
    connect ir.q -> cmp_sbc_imm.a
    connect SBC_IMM.out -> cmp_sbc_imm.b

    node cmp_nop: Comparator
    connect ir.q -> cmp_nop.a
    connect NOP.out -> cmp_nop.b

    // Subcycle
    node is_sub0: Comparator
    connect subcycle_reg.q -> is_sub0.a
    connect zero.out -> is_sub0.b

    node is_sub1: Comparator
    connect subcycle_reg.q -> is_sub1.a
    connect one.out -> is_sub1.b

    node inc_subcycle: Incrementer
    connect subcycle_reg.q -> inc_subcycle.in

    node subcycle_next: Mux
    connect is_execute.eq -> subcycle_next.sel
    connect zero.out -> subcycle_next.in0
    connect inc_subcycle.out -> subcycle_next.in1

    connect subcycle_next.out -> subcycle_reg.data
    connect always_on.out -> subcycle_reg.we

    // Execute conditions
    node exec_sub0: And
    connect is_execute.eq -> exec_sub0.a
    connect is_sub0.eq -> exec_sub0.b

    node exec_sub1: And
    connect is_execute.eq -> exec_sub1.a
    connect is_sub1.eq -> exec_sub1.b

    // Immediate mode instructions: LDA, LDX, SBC
    node is_imm_1: Or
    connect cmp_ldx_imm.eq -> is_imm_1.a
    connect cmp_lda_imm.eq -> is_imm_1.b

    node is_imm: Or
    connect is_imm_1.out -> is_imm.a
    connect cmp_sbc_imm.eq -> is_imm.b

    // 1-cycle instructions: SEC, NOP
    node is_1cycle: Or
    connect cmp_sec.eq -> is_1cycle.a
    connect cmp_nop.eq -> is_1cycle.b

    // Done conditions
    node done_imm: And
    connect exec_sub1.out -> done_imm.a
    connect is_imm.out -> done_imm.b

    node done_1cyc: And
    connect exec_sub0.out -> done_1cyc.a
    connect is_1cycle.out -> done_1cyc.b

    node exec_done: Or
    connect done_imm.out -> exec_done.a
    connect done_1cyc.out -> exec_done.b

    // State transitions
    node next_from_fetch: Mux
    connect is_fetch.eq -> next_from_fetch.sel
    connect state_reg.q -> next_from_fetch.in0
    connect STATE_DECODE.out -> next_from_fetch.in1

    node next_from_decode: Mux
    connect is_decode.eq -> next_from_decode.sel
    connect next_from_fetch.out -> next_from_decode.in0
    connect STATE_EXECUTE.out -> next_from_decode.in1

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

    // PC increment
    node pc_inc_fetch: Or
    connect is_fetch.eq -> pc_inc_fetch.a
    connect exec_sub0.out -> pc_inc_fetch.b  // immediate mode increments at sub0

    node needs_operand: And
    connect exec_sub0.out -> needs_operand.a
    connect is_imm.out -> needs_operand.b

    node pc_inc_imm: Or
    connect is_fetch.eq -> pc_inc_imm.a
    connect needs_operand.out -> pc_inc_imm.b

    node pc_next: Mux
    connect pc_inc_imm.out -> pc_next.sel
    connect pc_reg.q -> pc_next.in0
    connect pc_inc.out -> pc_next.in1

    connect pc_next.out -> pc_reg.data
    connect always_on.out -> pc_reg.we

    // IR load
    connect is_fetch.eq -> ir.we

    // Operand load
    connect needs_operand.out -> operand_reg.we

    // SBC: A - M - !C
    node not_carry: Not
    connect flag_c_reg.q -> not_carry.in

    node sbc_sub: Subtractor
    connect regA.q -> sbc_sub.a
    connect operand_reg.q -> sbc_sub.b
    connect not_carry.out -> sbc_sub.borrow_in

    // Data source for A register: LDA or SBC
    node a_from_lda: Mux
    connect cmp_lda_imm.eq -> a_from_lda.sel
    connect regA.q -> a_from_lda.in0
    connect operand_reg.q -> a_from_lda.in1

    node a_data: Mux
    connect cmp_sbc_imm.eq -> a_data.sel
    connect a_from_lda.out -> a_data.in0
    connect sbc_sub.difference -> a_data.in1

    connect a_data.out -> regA.data

    // Write A: LDA or SBC at sub1
    node is_lda_or_sbc: Or
    connect cmp_lda_imm.eq -> is_lda_or_sbc.a
    connect cmp_sbc_imm.eq -> is_lda_or_sbc.b

    node write_a: And
    connect exec_sub1.out -> write_a.a
    connect is_lda_or_sbc.out -> write_a.b

    connect write_a.out -> regA.we

    // Data source for X: LDX #imm
    connect operand_reg.q -> regX.data

    node write_x: And
    connect exec_sub1.out -> write_x.a
    connect cmp_ldx_imm.eq -> write_x.b

    connect write_x.out -> regX.we

    // Flag updates
    node const_128: Constant(value=128)

    // For N flag: check if bit 7 set
    node flag_val: Mux
    connect cmp_ldx_imm.eq -> flag_val.sel
    connect a_data.out -> flag_val.in0
    connect operand_reg.q -> flag_val.in1

    node n_check: Comparator
    connect flag_val.out -> n_check.a
    connect const_128.out -> n_check.b

    node n_val: Or
    connect n_check.gt -> n_val.a
    connect n_check.eq -> n_val.b

    // Z flag
    node z_check: Comparator
    connect flag_val.out -> z_check.a
    connect zero.out -> z_check.b

    // C flag for SBC: NOT borrow_out
    node not_borrow: Not
    connect sbc_sub.borrow_out -> not_borrow.in

    // C value: either from SBC or SEC
    node c_from_sbc: Mux
    connect cmp_sbc_imm.eq -> c_from_sbc.sel
    connect flag_c_reg.q -> c_from_sbc.in0
    connect not_borrow.out -> c_from_sbc.in1

    node c_from_sec: Mux
    connect cmp_sec.eq -> c_from_sec.sel
    connect c_from_sbc.out -> c_from_sec.in0
    connect one.out -> c_from_sec.in1

    // Update flags for: LDA, LDX, SBC at sub1, SEC at sub0
    node update_imm: And
    connect exec_sub1.out -> update_imm.a
    connect is_imm.out -> update_imm.b

    node update_sec: And
    connect exec_sub0.out -> update_sec.a
    connect cmp_sec.eq -> update_sec.b

    node update_flags: Or
    connect update_imm.out -> update_flags.a
    connect update_sec.out -> update_flags.b

    connect update_flags.out -> flag_n_reg.we
    connect update_flags.out -> flag_z_reg.we
    connect update_flags.out -> flag_c_reg.we

    connect n_val.out -> flag_n_reg.data
    connect z_check.eq -> flag_z_reg.data
    connect c_from_sec.out -> flag_c_reg.data

    // Outputs
    connect pc_reg.q -> pc
    connect regA.q -> reg_a
    connect regX.q -> reg_x
    connect regY.q -> reg_y
    connect flag_n_reg.q -> flag_n
    connect flag_z_reg.q -> flag_z
    connect flag_c_reg.q -> flag_c
  }
}

// === TEST CIRCUIT ===
circuit Part4Test {
  clock clk

  impl {
    node cpu: Part4TestCPU
    connect clk -> cpu.clk

    node reset_input: Input
    connect reset_input.out -> cpu.reset

    node d_pc: HexDisplay
    connect cpu.pc -> d_pc.in

    node d_a: HexDisplay
    connect cpu.reg_a -> d_a.in

    node d_x: HexDisplay
    connect cpu.reg_x -> d_x.in
  }
}
