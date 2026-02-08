// Stage 5 Complete: Flags & Branches
// Full 6502 CPU subset with:
// - LDA/STA (immediate, zero-page, absolute, indexed)
// - TAX, INX
// - PHA, PLA (push/pull accumulator)
// - JSR, RTS (subroutine call/return)
// - CMP #imm (compare A with immediate)
// - BEQ, BNE, BCC, BCS, BMI, BPL (conditional branches)
// - Flag register (N, Z, C, V)

// === Simple Memory Controller ===
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
    node addr_20: Constant(value=32)
    node addr_21: Constant(value=33)

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

    node at_20: Comparator
    connect addr -> at_20.a
    connect addr_20.out -> at_20.b

    node at_21: Comparator
    connect addr -> at_21.a
    connect addr_21.out -> at_21.b

    node mem_10: Register
    node mem_11: Register
    node mem_12: Register
    node mem_13: Register
    node mem_14: Register
    node mem_15: Register
    node mem_20: Register
    node mem_21: Register

    connect clk -> mem_10.clk
    connect clk -> mem_11.clk
    connect clk -> mem_12.clk
    connect clk -> mem_13.clk
    connect clk -> mem_14.clk
    connect clk -> mem_15.clk
    connect clk -> mem_20.clk
    connect clk -> mem_21.clk

    connect data_in -> mem_10.data
    connect data_in -> mem_11.data
    connect data_in -> mem_12.data
    connect data_in -> mem_13.data
    connect data_in -> mem_14.data
    connect data_in -> mem_15.data
    connect data_in -> mem_20.data
    connect data_in -> mem_21.data

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

    node we_20: And
    connect write_enable -> we_20.a
    connect at_20.eq -> we_20.b
    connect we_20.out -> mem_20.we

    node we_21: And
    connect write_enable -> we_21.a
    connect at_21.eq -> we_21.b
    connect we_21.out -> mem_21.we

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

    node mux7: Mux
    connect at_20.eq -> mux7.sel
    connect mux6.out -> mux7.in0
    connect mem_20.q -> mux7.in1

    node mux8: Mux
    connect at_21.eq -> mux8.sel
    connect mux7.out -> mux8.in0
    connect mem_21.q -> mux8.in1

    connect mux8.out -> data_out
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

// === Stack Pointer ===
circuit StackPointer {
  input decrement: Bit
  input increment: Bit
  input load: Bit
  input load_value: Bus[8]

  output sp: Bus[8]

  clock clk

  impl {
    node sp_reg: Register(initial=255)
    connect clk -> sp_reg.clk

    node always_on: Constant(value=1)
    connect always_on.out -> sp_reg.we

    node one: Constant(value=1)

    node dec: Subtractor
    connect sp_reg.q -> dec.a
    connect one.out -> dec.b
    node zero_bit: Constant(value=0)
    connect zero_bit.out -> dec.borrow_in

    node inc: Adder
    connect sp_reg.q -> inc.a
    connect one.out -> inc.b
    connect zero_bit.out -> inc.carry_in

    node mux_inc: Mux
    connect increment -> mux_inc.sel
    connect sp_reg.q -> mux_inc.in0
    connect inc.sum -> mux_inc.in1

    node mux_dec: Mux
    connect decrement -> mux_dec.sel
    connect mux_inc.out -> mux_dec.in0
    connect dec.difference -> mux_dec.in1

    node mux_load: Mux
    connect load -> mux_load.sel
    connect mux_dec.out -> mux_load.in0
    connect load_value -> mux_load.in1

    connect mux_load.out -> sp_reg.data
    connect sp_reg.q -> sp
  }
}

// === Stack Memory (16 cells: $F0-$FF) ===
circuit StackMemory {
  input addr: Bus[8]
  input data_in: Bus[8]
  input write_enable: Bit

  output data_out: Bus[8]

  clock clk

  impl {
    node zero: Constant(value=0)

    node addr_f0: Constant(value=240)
    node addr_f1: Constant(value=241)
    node addr_f2: Constant(value=242)
    node addr_f3: Constant(value=243)
    node addr_f4: Constant(value=244)
    node addr_f5: Constant(value=245)
    node addr_f6: Constant(value=246)
    node addr_f7: Constant(value=247)
    node addr_f8: Constant(value=248)
    node addr_f9: Constant(value=249)
    node addr_fa: Constant(value=250)
    node addr_fb: Constant(value=251)
    node addr_fc: Constant(value=252)
    node addr_fd: Constant(value=253)
    node addr_fe: Constant(value=254)
    node addr_ff: Constant(value=255)

    node at_f0: Comparator
    connect addr -> at_f0.a
    connect addr_f0.out -> at_f0.b

    node at_f1: Comparator
    connect addr -> at_f1.a
    connect addr_f1.out -> at_f1.b

    node at_f2: Comparator
    connect addr -> at_f2.a
    connect addr_f2.out -> at_f2.b

    node at_f3: Comparator
    connect addr -> at_f3.a
    connect addr_f3.out -> at_f3.b

    node at_f4: Comparator
    connect addr -> at_f4.a
    connect addr_f4.out -> at_f4.b

    node at_f5: Comparator
    connect addr -> at_f5.a
    connect addr_f5.out -> at_f5.b

    node at_f6: Comparator
    connect addr -> at_f6.a
    connect addr_f6.out -> at_f6.b

    node at_f7: Comparator
    connect addr -> at_f7.a
    connect addr_f7.out -> at_f7.b

    node at_f8: Comparator
    connect addr -> at_f8.a
    connect addr_f8.out -> at_f8.b

    node at_f9: Comparator
    connect addr -> at_f9.a
    connect addr_f9.out -> at_f9.b

    node at_fa: Comparator
    connect addr -> at_fa.a
    connect addr_fa.out -> at_fa.b

    node at_fb: Comparator
    connect addr -> at_fb.a
    connect addr_fb.out -> at_fb.b

    node at_fc: Comparator
    connect addr -> at_fc.a
    connect addr_fc.out -> at_fc.b

    node at_fd: Comparator
    connect addr -> at_fd.a
    connect addr_fd.out -> at_fd.b

    node at_fe: Comparator
    connect addr -> at_fe.a
    connect addr_fe.out -> at_fe.b

    node at_ff: Comparator
    connect addr -> at_ff.a
    connect addr_ff.out -> at_ff.b

    node mem_f0: Register
    node mem_f1: Register
    node mem_f2: Register
    node mem_f3: Register
    node mem_f4: Register
    node mem_f5: Register
    node mem_f6: Register
    node mem_f7: Register
    node mem_f8: Register
    node mem_f9: Register
    node mem_fa: Register
    node mem_fb: Register
    node mem_fc: Register
    node mem_fd: Register
    node mem_fe: Register
    node mem_ff: Register

    connect clk -> mem_f0.clk
    connect clk -> mem_f1.clk
    connect clk -> mem_f2.clk
    connect clk -> mem_f3.clk
    connect clk -> mem_f4.clk
    connect clk -> mem_f5.clk
    connect clk -> mem_f6.clk
    connect clk -> mem_f7.clk
    connect clk -> mem_f8.clk
    connect clk -> mem_f9.clk
    connect clk -> mem_fa.clk
    connect clk -> mem_fb.clk
    connect clk -> mem_fc.clk
    connect clk -> mem_fd.clk
    connect clk -> mem_fe.clk
    connect clk -> mem_ff.clk

    connect data_in -> mem_f0.data
    connect data_in -> mem_f1.data
    connect data_in -> mem_f2.data
    connect data_in -> mem_f3.data
    connect data_in -> mem_f4.data
    connect data_in -> mem_f5.data
    connect data_in -> mem_f6.data
    connect data_in -> mem_f7.data
    connect data_in -> mem_f8.data
    connect data_in -> mem_f9.data
    connect data_in -> mem_fa.data
    connect data_in -> mem_fb.data
    connect data_in -> mem_fc.data
    connect data_in -> mem_fd.data
    connect data_in -> mem_fe.data
    connect data_in -> mem_ff.data

    node we_f0: And
    connect write_enable -> we_f0.a
    connect at_f0.eq -> we_f0.b
    connect we_f0.out -> mem_f0.we

    node we_f1: And
    connect write_enable -> we_f1.a
    connect at_f1.eq -> we_f1.b
    connect we_f1.out -> mem_f1.we

    node we_f2: And
    connect write_enable -> we_f2.a
    connect at_f2.eq -> we_f2.b
    connect we_f2.out -> mem_f2.we

    node we_f3: And
    connect write_enable -> we_f3.a
    connect at_f3.eq -> we_f3.b
    connect we_f3.out -> mem_f3.we

    node we_f4: And
    connect write_enable -> we_f4.a
    connect at_f4.eq -> we_f4.b
    connect we_f4.out -> mem_f4.we

    node we_f5: And
    connect write_enable -> we_f5.a
    connect at_f5.eq -> we_f5.b
    connect we_f5.out -> mem_f5.we

    node we_f6: And
    connect write_enable -> we_f6.a
    connect at_f6.eq -> we_f6.b
    connect we_f6.out -> mem_f6.we

    node we_f7: And
    connect write_enable -> we_f7.a
    connect at_f7.eq -> we_f7.b
    connect we_f7.out -> mem_f7.we

    node we_f8: And
    connect write_enable -> we_f8.a
    connect at_f8.eq -> we_f8.b
    connect we_f8.out -> mem_f8.we

    node we_f9: And
    connect write_enable -> we_f9.a
    connect at_f9.eq -> we_f9.b
    connect we_f9.out -> mem_f9.we

    node we_fa: And
    connect write_enable -> we_fa.a
    connect at_fa.eq -> we_fa.b
    connect we_fa.out -> mem_fa.we

    node we_fb: And
    connect write_enable -> we_fb.a
    connect at_fb.eq -> we_fb.b
    connect we_fb.out -> mem_fb.we

    node we_fc: And
    connect write_enable -> we_fc.a
    connect at_fc.eq -> we_fc.b
    connect we_fc.out -> mem_fc.we

    node we_fd: And
    connect write_enable -> we_fd.a
    connect at_fd.eq -> we_fd.b
    connect we_fd.out -> mem_fd.we

    node we_fe: And
    connect write_enable -> we_fe.a
    connect at_fe.eq -> we_fe.b
    connect we_fe.out -> mem_fe.we

    node we_ff: And
    connect write_enable -> we_ff.a
    connect at_ff.eq -> we_ff.b
    connect we_ff.out -> mem_ff.we

    node mux1: Mux
    connect at_f0.eq -> mux1.sel
    connect zero.out -> mux1.in0
    connect mem_f0.q -> mux1.in1

    node mux2: Mux
    connect at_f1.eq -> mux2.sel
    connect mux1.out -> mux2.in0
    connect mem_f1.q -> mux2.in1

    node mux3: Mux
    connect at_f2.eq -> mux3.sel
    connect mux2.out -> mux3.in0
    connect mem_f2.q -> mux3.in1

    node mux4: Mux
    connect at_f3.eq -> mux4.sel
    connect mux3.out -> mux4.in0
    connect mem_f3.q -> mux4.in1

    node mux5: Mux
    connect at_f4.eq -> mux5.sel
    connect mux4.out -> mux5.in0
    connect mem_f4.q -> mux5.in1

    node mux6: Mux
    connect at_f5.eq -> mux6.sel
    connect mux5.out -> mux6.in0
    connect mem_f5.q -> mux6.in1

    node mux7: Mux
    connect at_f6.eq -> mux7.sel
    connect mux6.out -> mux7.in0
    connect mem_f6.q -> mux7.in1

    node mux8: Mux
    connect at_f7.eq -> mux8.sel
    connect mux7.out -> mux8.in0
    connect mem_f7.q -> mux8.in1

    node mux9: Mux
    connect at_f8.eq -> mux9.sel
    connect mux8.out -> mux9.in0
    connect mem_f8.q -> mux9.in1

    node mux10: Mux
    connect at_f9.eq -> mux10.sel
    connect mux9.out -> mux10.in0
    connect mem_f9.q -> mux10.in1

    node mux11: Mux
    connect at_fa.eq -> mux11.sel
    connect mux10.out -> mux11.in0
    connect mem_fa.q -> mux11.in1

    node mux12: Mux
    connect at_fb.eq -> mux12.sel
    connect mux11.out -> mux12.in0
    connect mem_fb.q -> mux12.in1

    node mux13: Mux
    connect at_fc.eq -> mux13.sel
    connect mux12.out -> mux13.in0
    connect mem_fc.q -> mux13.in1

    node mux14: Mux
    connect at_fd.eq -> mux14.sel
    connect mux13.out -> mux14.in0
    connect mem_fd.q -> mux14.in1

    node mux15: Mux
    connect at_fe.eq -> mux15.sel
    connect mux14.out -> mux15.in0
    connect mem_fe.q -> mux15.in1

    node mux16: Mux
    connect at_ff.eq -> mux16.sel
    connect mux15.out -> mux16.in0
    connect mem_ff.q -> mux16.in1

    connect mux16.out -> data_out
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

  // Debug outputs to trace signal path
  output debug_update_z_received: Bit
  output debug_new_z_received: Bit

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

    // Debug: expose what we're receiving
    connect update_z -> debug_update_z_received
    connect new_z -> debug_new_z_received

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

// === Complete Control FSM with Flags & Branches ===
circuit Stage5Control {
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
  output addr_lo_load: Bit
  output addr_hi_load: Bit
  output mem_read: Bit
  output mem_write: Bit

  output write_a: Bit
  output write_x: Bit
  output write_y: Bit

  // Stack control
  output sp_decrement: Bit
  output sp_increment: Bit
  output stack_write: Bit
  output use_stack_data: Bit

  // JSR/RTS control
  output jsr_load_pc: Bit
  output rts_load_pc: Bit
  output push_pc_hi: Bit
  output push_pc_lo: Bit
  output pull_pc_lo: Bit
  output pull_pc_hi: Bit

  // Branch control
  output branch_load_pc: Bit

  // Flag control
  output update_flags: Bit

  // Instruction decode
  output is_lda_imm: Bit
  output is_lda_zp: Bit
  output is_lda_abs: Bit
  output is_lda_abs_x: Bit
  output is_sta_zp: Bit
  output is_sta_abs: Bit
  output is_sta_abs_x: Bit
  output is_tax: Bit
  output is_inx: Bit
  output is_pha: Bit
  output is_pla: Bit
  output is_jsr: Bit
  output is_rts: Bit
  output is_cmp_imm: Bit
  output is_beq: Bit
  output is_bne: Bit
  output is_bcc: Bit
  output is_bcs: Bit
  output is_bmi: Bit
  output is_bpl: Bit

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

    // Instruction decode - Stage 4 instructions
    node LDA_IMM: Constant(value=169)
    node LDA_ZP: Constant(value=165)
    node LDA_ABS: Constant(value=173)
    node LDA_ABS_X: Constant(value=189)
    node STA_ZP: Constant(value=133)
    node STA_ABS: Constant(value=141)
    node STA_ABS_X: Constant(value=157)
    node TAX: Constant(value=170)
    node INX: Constant(value=232)
    node PHA: Constant(value=72)
    node PLA: Constant(value=104)
    node JSR: Constant(value=32)
    node RTS: Constant(value=96)

    // Stage 5 instructions
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

    node cmp_lda_zp: Comparator
    connect current_opcode -> cmp_lda_zp.a
    connect LDA_ZP.out -> cmp_lda_zp.b
    connect cmp_lda_zp.eq -> is_lda_zp

    node cmp_lda_abs: Comparator
    connect current_opcode -> cmp_lda_abs.a
    connect LDA_ABS.out -> cmp_lda_abs.b
    connect cmp_lda_abs.eq -> is_lda_abs

    node cmp_lda_abs_x: Comparator
    connect current_opcode -> cmp_lda_abs_x.a
    connect LDA_ABS_X.out -> cmp_lda_abs_x.b
    connect cmp_lda_abs_x.eq -> is_lda_abs_x

    node cmp_sta_zp: Comparator
    connect current_opcode -> cmp_sta_zp.a
    connect STA_ZP.out -> cmp_sta_zp.b
    connect cmp_sta_zp.eq -> is_sta_zp

    node cmp_sta_abs: Comparator
    connect current_opcode -> cmp_sta_abs.a
    connect STA_ABS.out -> cmp_sta_abs.b
    connect cmp_sta_abs.eq -> is_sta_abs

    node cmp_sta_abs_x: Comparator
    connect current_opcode -> cmp_sta_abs_x.a
    connect STA_ABS_X.out -> cmp_sta_abs_x.b
    connect cmp_sta_abs_x.eq -> is_sta_abs_x

    node cmp_tax: Comparator
    connect current_opcode -> cmp_tax.a
    connect TAX.out -> cmp_tax.b
    connect cmp_tax.eq -> is_tax

    node cmp_inx: Comparator
    connect current_opcode -> cmp_inx.a
    connect INX.out -> cmp_inx.b
    connect cmp_inx.eq -> is_inx

    node cmp_pha: Comparator
    connect current_opcode -> cmp_pha.a
    connect PHA.out -> cmp_pha.b
    connect cmp_pha.eq -> is_pha

    node cmp_pla: Comparator
    connect current_opcode -> cmp_pla.a
    connect PLA.out -> cmp_pla.b
    connect cmp_pla.eq -> is_pla

    node cmp_jsr: Comparator
    connect current_opcode -> cmp_jsr.a
    connect JSR.out -> cmp_jsr.b
    connect cmp_jsr.eq -> is_jsr

    node cmp_rts: Comparator
    connect current_opcode -> cmp_rts.a
    connect RTS.out -> cmp_rts.b
    connect cmp_rts.eq -> is_rts

    // Stage 5 instruction decode
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
    node is_imm_lda_cmp: Or
    connect cmp_lda_imm.eq -> is_imm_lda_cmp.a
    connect cmp_cmp_imm.eq -> is_imm_lda_cmp.b

    node is_imm: Or
    connect is_imm_lda_cmp.out -> is_imm.a
    connect cmp_lda_imm.eq -> is_imm.b

    node is_zp: Or
    connect cmp_lda_zp.eq -> is_zp.a
    connect cmp_sta_zp.eq -> is_zp.b

    node is_abs_temp: Or
    connect cmp_lda_abs.eq -> is_abs_temp.a
    connect cmp_sta_abs.eq -> is_abs_temp.b

    node is_abs: Or
    connect is_abs_temp.out -> is_abs.a
    connect cmp_lda_abs_x.eq -> is_abs.b

    node is_abs_final: Or
    connect is_abs.out -> is_abs_final.a
    connect cmp_sta_abs_x.eq -> is_abs_final.b

    node is_1cycle: Or
    connect cmp_tax.eq -> is_1cycle.a
    connect cmp_inx.eq -> is_1cycle.b

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
    node two: Constant(value=2)
    node three: Constant(value=3)
    node four: Constant(value=4)
    node five: Constant(value=5)

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

    node is_sub2: Comparator
    connect subcycle_reg.q -> is_sub2.a
    connect two.out -> is_sub2.b

    node is_sub3: Comparator
    connect subcycle_reg.q -> is_sub3.a
    connect three.out -> is_sub3.b

    node is_sub4: Comparator
    connect subcycle_reg.q -> is_sub4.a
    connect four.out -> is_sub4.b

    node is_sub5: Comparator
    connect subcycle_reg.q -> is_sub5.a
    connect five.out -> is_sub5.b

    // State transitions
    node next_from_fetch: Mux
    connect is_fetch.eq -> next_from_fetch.sel
    connect state_reg.q -> next_from_fetch.in0
    connect STATE_DECODE.out -> next_from_fetch.in1

    node next_from_decode: Mux
    connect is_decode.eq -> next_from_decode.sel
    connect next_from_fetch.out -> next_from_decode.in0
    connect STATE_EXECUTE.out -> next_from_decode.in1

    // Execute state checks
    node exec_sub0: And
    connect is_execute.eq -> exec_sub0.a
    connect is_sub0.eq -> exec_sub0.b

    node exec_sub1: And
    connect is_execute.eq -> exec_sub1.a
    connect is_sub1.eq -> exec_sub1.b

    node exec_sub2: And
    connect is_execute.eq -> exec_sub2.a
    connect is_sub2.eq -> exec_sub2.b

    node exec_sub3: And
    connect is_execute.eq -> exec_sub3.a
    connect is_sub3.eq -> exec_sub3.b

    node exec_sub4: And
    connect is_execute.eq -> exec_sub4.a
    connect is_sub4.eq -> exec_sub4.b

    node exec_sub5: And
    connect is_execute.eq -> exec_sub5.a
    connect is_sub5.eq -> exec_sub5.b

    // Done conditions
    node done_imm: And
    connect exec_sub1.out -> done_imm.a
    connect is_imm_lda_cmp.out -> done_imm.b

    node done_zp: And
    connect exec_sub3.out -> done_zp.a
    connect is_zp.out -> done_zp.b

    node done_abs: And
    connect exec_sub4.out -> done_abs.a
    connect is_abs_final.out -> done_abs.b

    node done_1cyc: And
    connect exec_sub0.out -> done_1cyc.a
    connect is_1cycle.out -> done_1cyc.b

    node done_pha: And
    connect exec_sub1.out -> done_pha.a
    connect cmp_pha.eq -> done_pha.b

    node done_pla: And
    connect exec_sub2.out -> done_pla.a
    connect cmp_pla.eq -> done_pla.b

    node done_jsr: And
    connect exec_sub5.out -> done_jsr.a
    connect cmp_jsr.eq -> done_jsr.b

    node done_rts: And
    connect exec_sub5.out -> done_rts.a
    connect cmp_rts.eq -> done_rts.b

    // Branch done at sub1
    node done_branch: And
    connect exec_sub1.out -> done_branch.a
    connect is_branch.out -> done_branch.b

    node exec_done_temp1: Or
    connect done_imm.out -> exec_done_temp1.a
    connect done_zp.out -> exec_done_temp1.b

    node exec_done_temp2: Or
    connect exec_done_temp1.out -> exec_done_temp2.a
    connect done_abs.out -> exec_done_temp2.b

    node exec_done_temp3: Or
    connect exec_done_temp2.out -> exec_done_temp3.a
    connect done_1cyc.out -> exec_done_temp3.b

    node exec_done_temp4: Or
    connect exec_done_temp3.out -> exec_done_temp4.a
    connect done_pha.out -> exec_done_temp4.b

    node exec_done_temp5: Or
    connect exec_done_temp4.out -> exec_done_temp5.a
    connect done_pla.out -> exec_done_temp5.b

    node exec_done_temp6: Or
    connect exec_done_temp5.out -> exec_done_temp6.a
    connect done_jsr.out -> exec_done_temp6.b

    node exec_done_temp7: Or
    connect exec_done_temp6.out -> exec_done_temp7.a
    connect done_rts.out -> exec_done_temp7.b

    node exec_done: Or
    connect exec_done_temp7.out -> exec_done.a
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

    // Control signals - PC increment
    node needs_operand_any: Or
    connect is_imm_lda_cmp.out -> needs_operand_any.a
    connect is_zp.out -> needs_operand_any.b

    node needs_operand_temp: Or
    connect needs_operand_any.out -> needs_operand_temp.a
    connect is_abs_final.out -> needs_operand_temp.b

    node needs_operand_temp2: Or
    connect needs_operand_temp.out -> needs_operand_temp2.a
    connect cmp_jsr.eq -> needs_operand_temp2.b

    node needs_operand: Or
    connect needs_operand_temp2.out -> needs_operand.a
    connect is_branch.out -> needs_operand.b

    node pc_inc_exec_sub0: And
    connect exec_sub0.out -> pc_inc_exec_sub0.a
    connect needs_operand.out -> pc_inc_exec_sub0.b

    node needs_2nd_byte: Or
    connect is_abs_final.out -> needs_2nd_byte.a
    connect cmp_jsr.eq -> needs_2nd_byte.b

    node pc_inc_exec_sub1: And
    connect exec_sub1.out -> pc_inc_exec_sub1.a
    connect needs_2nd_byte.out -> pc_inc_exec_sub1.b

    node pc_inc_temp: Or
    connect is_fetch.eq -> pc_inc_temp.a
    connect pc_inc_exec_sub0.out -> pc_inc_temp.b

    node pc_inc_signal: Or
    connect pc_inc_temp.out -> pc_inc_signal.a
    connect pc_inc_exec_sub1.out -> pc_inc_signal.b
    connect pc_inc_signal.out -> pc_increment

    // IR load
    connect is_fetch.eq -> ir_load

    // Operand and address loads
    node operand_load_signal: And
    connect exec_sub0.out -> operand_load_signal.a
    connect needs_operand.out -> operand_load_signal.b
    connect operand_load_signal.out -> operand_load

    node addr_lo_load_signal: And
    connect exec_sub0.out -> addr_lo_load_signal.a
    connect needs_operand.out -> addr_lo_load_signal.b
    connect addr_lo_load_signal.out -> addr_lo_load

    node addr_hi_load_signal: And
    connect exec_sub1.out -> addr_hi_load_signal.a
    connect needs_2nd_byte.out -> addr_hi_load_signal.b
    connect addr_hi_load_signal.out -> addr_hi_load

    // Memory read
    node is_load: Or
    connect cmp_lda_zp.eq -> is_load.a
    connect cmp_lda_abs.eq -> is_load.b

    node is_load_final: Or
    connect is_load.out -> is_load_final.a
    connect cmp_lda_abs_x.eq -> is_load_final.b

    node mem_read_zp: And
    connect exec_sub2.out -> mem_read_zp.a
    connect cmp_lda_zp.eq -> mem_read_zp.b

    node mem_read_abs_temp: And
    connect exec_sub3.out -> mem_read_abs_temp.a
    connect cmp_lda_abs.eq -> mem_read_abs_temp.b

    node mem_read_abs_x: And
    connect exec_sub3.out -> mem_read_abs_x.a
    connect cmp_lda_abs_x.eq -> mem_read_abs_x.b

    node mem_read_abs: Or
    connect mem_read_abs_temp.out -> mem_read_abs.a
    connect mem_read_abs_x.out -> mem_read_abs.b

    node mem_read_signal: Or
    connect mem_read_zp.out -> mem_read_signal.a
    connect mem_read_abs.out -> mem_read_signal.b
    connect mem_read_signal.out -> mem_read

    // Memory write
    node mem_write_zp: And
    connect exec_sub2.out -> mem_write_zp.a
    connect cmp_sta_zp.eq -> mem_write_zp.b

    node mem_write_abs_temp: And
    connect exec_sub3.out -> mem_write_abs_temp.a
    connect cmp_sta_abs.eq -> mem_write_abs_temp.b

    node mem_write_abs_x: And
    connect exec_sub3.out -> mem_write_abs_x.a
    connect cmp_sta_abs_x.eq -> mem_write_abs_x.b

    node mem_write_abs: Or
    connect mem_write_abs_temp.out -> mem_write_abs.a
    connect mem_write_abs_x.out -> mem_write_abs.b

    node mem_write_signal: Or
    connect mem_write_zp.out -> mem_write_signal.a
    connect mem_write_abs.out -> mem_write_signal.b
    connect mem_write_signal.out -> mem_write

    // Stack pointer decrement
    node sp_dec_pha: And
    connect exec_sub0.out -> sp_dec_pha.a
    connect cmp_pha.eq -> sp_dec_pha.b

    node sp_dec_jsr_sub2: And
    connect exec_sub2.out -> sp_dec_jsr_sub2.a
    connect cmp_jsr.eq -> sp_dec_jsr_sub2.b

    node sp_dec_jsr_sub3: And
    connect exec_sub3.out -> sp_dec_jsr_sub3.a
    connect cmp_jsr.eq -> sp_dec_jsr_sub3.b

    node sp_dec_temp: Or
    connect sp_dec_pha.out -> sp_dec_temp.a
    connect sp_dec_jsr_sub2.out -> sp_dec_temp.b

    node sp_dec_signal: Or
    connect sp_dec_temp.out -> sp_dec_signal.a
    connect sp_dec_jsr_sub3.out -> sp_dec_signal.b
    connect sp_dec_signal.out -> sp_decrement

    // Stack pointer increment
    node sp_inc_pla: And
    connect exec_sub0.out -> sp_inc_pla.a
    connect cmp_pla.eq -> sp_inc_pla.b

    node sp_inc_rts_sub0: And
    connect exec_sub0.out -> sp_inc_rts_sub0.a
    connect cmp_rts.eq -> sp_inc_rts_sub0.b

    node sp_inc_rts_sub2: And
    connect exec_sub2.out -> sp_inc_rts_sub2.a
    connect cmp_rts.eq -> sp_inc_rts_sub2.b

    node sp_inc_temp: Or
    connect sp_inc_pla.out -> sp_inc_temp.a
    connect sp_inc_rts_sub0.out -> sp_inc_temp.b

    node sp_inc_signal: Or
    connect sp_inc_temp.out -> sp_inc_signal.a
    connect sp_inc_rts_sub2.out -> sp_inc_signal.b
    connect sp_inc_signal.out -> sp_increment

    // Stack write
    node stack_write_pha: And
    connect exec_sub0.out -> stack_write_pha.a
    connect cmp_pha.eq -> stack_write_pha.b

    node stack_write_jsr_hi: And
    connect exec_sub2.out -> stack_write_jsr_hi.a
    connect cmp_jsr.eq -> stack_write_jsr_hi.b

    node stack_write_jsr_lo: And
    connect exec_sub3.out -> stack_write_jsr_lo.a
    connect cmp_jsr.eq -> stack_write_jsr_lo.b

    node stack_write_temp: Or
    connect stack_write_pha.out -> stack_write_temp.a
    connect stack_write_jsr_hi.out -> stack_write_temp.b

    node stack_write_signal: Or
    connect stack_write_temp.out -> stack_write_signal.a
    connect stack_write_jsr_lo.out -> stack_write_signal.b
    connect stack_write_signal.out -> stack_write

    // Use stack data for A
    node use_stack_signal: And
    connect exec_sub2.out -> use_stack_signal.a
    connect cmp_pla.eq -> use_stack_signal.b
    connect use_stack_signal.out -> use_stack_data

    // JSR/RTS PC control
    node jsr_load_pc_signal: And
    connect exec_sub4.out -> jsr_load_pc_signal.a
    connect cmp_jsr.eq -> jsr_load_pc_signal.b
    connect jsr_load_pc_signal.out -> jsr_load_pc

    node rts_load_pc_signal: And
    connect exec_sub4.out -> rts_load_pc_signal.a
    connect cmp_rts.eq -> rts_load_pc_signal.b
    connect rts_load_pc_signal.out -> rts_load_pc

    node push_pc_hi_signal: And
    connect exec_sub2.out -> push_pc_hi_signal.a
    connect cmp_jsr.eq -> push_pc_hi_signal.b
    connect push_pc_hi_signal.out -> push_pc_hi

    node push_pc_lo_signal: And
    connect exec_sub3.out -> push_pc_lo_signal.a
    connect cmp_jsr.eq -> push_pc_lo_signal.b
    connect push_pc_lo_signal.out -> push_pc_lo

    node pull_pc_lo_signal: And
    connect exec_sub1.out -> pull_pc_lo_signal.a
    connect cmp_rts.eq -> pull_pc_lo_signal.b
    connect pull_pc_lo_signal.out -> pull_pc_lo

    node pull_pc_hi_signal: And
    connect exec_sub3.out -> pull_pc_hi_signal.a
    connect cmp_rts.eq -> pull_pc_hi_signal.b
    connect pull_pc_hi_signal.out -> pull_pc_hi

    // Branch load PC: at sub1 if branch is taken
    node branch_at_sub1: And
    connect exec_sub1.out -> branch_at_sub1.a
    connect branch_taken.out -> branch_at_sub1.b
    connect branch_at_sub1.out -> branch_load_pc

    // Update flags: LDA, CMP at sub1; INX at sub0
    node update_flags_lda: And
    connect exec_sub1.out -> update_flags_lda.a
    connect cmp_lda_imm.eq -> update_flags_lda.b

    node update_flags_cmp: And
    connect exec_sub1.out -> update_flags_cmp.a
    connect cmp_cmp_imm.eq -> update_flags_cmp.b

    node update_flags_inx: And
    connect exec_sub0.out -> update_flags_inx.a
    connect cmp_inx.eq -> update_flags_inx.b

    node update_flags_temp: Or
    connect update_flags_lda.out -> update_flags_temp.a
    connect update_flags_cmp.out -> update_flags_temp.b

    node update_flags_signal: Or
    connect update_flags_temp.out -> update_flags_signal.a
    connect update_flags_inx.out -> update_flags_signal.b
    connect update_flags_signal.out -> update_flags

    // Register A write
    node write_a_imm: And
    connect exec_sub1.out -> write_a_imm.a
    connect cmp_lda_imm.eq -> write_a_imm.b

    node write_a_zp: And
    connect exec_sub3.out -> write_a_zp.a
    connect cmp_lda_zp.eq -> write_a_zp.b

    node write_a_abs_temp: And
    connect exec_sub4.out -> write_a_abs_temp.a
    connect cmp_lda_abs.eq -> write_a_abs_temp.b

    node write_a_abs_x: And
    connect exec_sub4.out -> write_a_abs_x.a
    connect cmp_lda_abs_x.eq -> write_a_abs_x.b

    node write_a_abs: Or
    connect write_a_abs_temp.out -> write_a_abs.a
    connect write_a_abs_x.out -> write_a_abs.b

    node write_a_temp: Or
    connect write_a_imm.out -> write_a_temp.a
    connect write_a_zp.out -> write_a_temp.b

    node write_a_temp2: Or
    connect write_a_temp.out -> write_a_temp2.a
    connect write_a_abs.out -> write_a_temp2.b

    node write_a_pla: And
    connect exec_sub2.out -> write_a_pla.a
    connect cmp_pla.eq -> write_a_pla.b

    node write_a_signal: Or
    connect write_a_temp2.out -> write_a_signal.a
    connect write_a_pla.out -> write_a_signal.b
    connect write_a_signal.out -> write_a

    // Register X write
    node write_x_tax: And
    connect exec_sub0.out -> write_x_tax.a
    connect cmp_tax.eq -> write_x_tax.b

    node write_x_inx: And
    connect exec_sub0.out -> write_x_inx.a
    connect cmp_inx.eq -> write_x_inx.b

    node write_x_signal: Or
    connect write_x_tax.out -> write_x_signal.a
    connect write_x_inx.out -> write_x_signal.b
    connect write_x_signal.out -> write_x

    // Y register
    connect zero.out -> write_y
  }
}

// === Complete Stage 5 CPU ===
circuit Stage5CPU {
  input reset: Bit

  output pc: Bus[8]
  output instruction: Bus[8]
  output operand: Bus[8]
  output address: Bus[8]
  output mem_data: Bus[8]
  output stack_data: Bus[8]
  output current_state: Bus[8]
  output subcycle: Bus[8]
  output reg_a: Bus[8]
  output reg_x: Bus[8]
  output reg_sp: Bus[8]
  output flag_n: Bit
  output flag_z: Bit
  output flag_c: Bit
  output debug_update_flags: Bit
  output debug_cmp_z_eq: Bit
  output debug_z_source: Bit
  output debug_is_cmp: Bit

  clock clk

  impl {
    // Program counter
    node pc_reg: Register
    connect clk -> pc_reg.clk
    node always_on: Constant(value=1)

    node pc_inc: Incrementer
    connect pc_reg.q -> pc_inc.in

    // ROM - Test program: Flags & Branch Test
    // $00: LDA #$05     (A9 05) - Load 5 into A
    // $02: CMP #$05     (C9 05) - Compare with 5, sets Z=1, C=1
    // $04: BEQ $02      (F0 02) - Branch +2 if equal (should branch to $08)
    // $06: LDA #$FF     (A9 FF) - Should be skipped (bad value)
    // $08: STA $20      (85 20) - Store A ($05) to memory
    // $0A: LDA #$42     (A9 42) - Load final value
    // (continue with padding)
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
    node byte_0: Constant(value=169)   // A9 - LDA #imm
    node byte_1: Constant(value=5)     // 05 - operand
    node byte_2: Constant(value=201)   // C9 - CMP #imm
    node byte_3: Constant(value=5)     // 05 - compare with 5 (equal)
    node byte_4: Constant(value=240)   // F0 - BEQ
    node byte_5: Constant(value=2)     // 02 - offset (+2, skip to $08)
    node byte_6: Constant(value=169)   // A9 - LDA #imm (should be skipped)
    node byte_7: Constant(value=255)   // FF - bad value
    node byte_8: Constant(value=133)   // 85 - STA zp
    node byte_9: Constant(value=32)    // 20 - address $20
    node byte_10: Constant(value=169)  // A9 - LDA #imm
    node byte_11: Constant(value=66)   // 42 - final value ($42)
    node byte_12: Constant(value=0)    // padding
    node byte_13: Constant(value=0)
    node byte_14: Constant(value=0)
    node byte_15: Constant(value=0)

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

    // Address registers
    node addr_lo_reg: Register
    connect clk -> addr_lo_reg.clk
    connect mux15.out -> addr_lo_reg.data

    node addr_hi_reg: Register
    connect clk -> addr_hi_reg.clk
    connect mux15.out -> addr_hi_reg.data

    // Temp registers for RTS
    node pc_lo_temp: Register
    connect clk -> pc_lo_temp.clk

    node pc_hi_temp: Register
    connect clk -> pc_hi_temp.clk

    // Flag register
    node flags: FlagRegister
    connect clk -> flags.clk

    // Indexed addressing
    node addr_with_x: Adder
    connect addr_lo_reg.q -> addr_with_x.a
    connect zero.out -> addr_with_x.carry_in

    // Control FSM
    node control: Stage5Control
    connect clk -> control.clk
    connect reset -> control.reset
    connect ir.q -> control.current_opcode
    connect flags.flag_n -> control.flag_n
    connect flags.flag_z -> control.flag_z
    connect flags.flag_c -> control.flag_c
    connect flags.flag_v -> control.flag_v

    // Register file
    node registers: RegisterFile
    connect clk -> registers.clk
    connect control.write_a -> registers.write_a
    connect control.write_x -> registers.write_x
    connect control.write_y -> registers.write_y

    // Stack Pointer
    node sp: StackPointer
    connect clk -> sp.clk
    connect control.sp_decrement -> sp.decrement
    connect control.sp_increment -> sp.increment
    connect reset -> sp.load
    node sp_init: Constant(value=255)
    connect sp_init.out -> sp.load_value

    // Stack Memory
    node stack: StackMemory
    connect clk -> stack.clk
    connect sp.sp -> stack.addr

    // PC-1 for JSR return address (6502 pushes address of last byte of JSR)
    node pc_minus_1: Subtractor
    connect pc_reg.q -> pc_minus_1.a
    node one_const: Constant(value=1)
    connect one_const.out -> pc_minus_1.b
    connect zero.out -> pc_minus_1.borrow_in

    // Stack data input mux
    node stack_data_pha_or_lo: Mux
    connect control.push_pc_lo -> stack_data_pha_or_lo.sel
    connect registers.reg_a -> stack_data_pha_or_lo.in0
    connect pc_minus_1.difference -> stack_data_pha_or_lo.in1

    node stack_data_final: Mux
    connect control.push_pc_hi -> stack_data_final.sel
    connect stack_data_pha_or_lo.out -> stack_data_final.in0
    connect zero.out -> stack_data_final.in1

    connect stack_data_final.out -> stack.data_in
    connect control.stack_write -> stack.write_enable

    // Save stack data to temp registers for RTS
    connect stack.data_out -> pc_lo_temp.data
    connect control.pull_pc_lo -> pc_lo_temp.we
    connect stack.data_out -> pc_hi_temp.data
    connect control.pull_pc_hi -> pc_hi_temp.we

    // Address selection
    node effective_addr: Mux
    connect control.is_lda_abs_x -> effective_addr.sel
    connect addr_lo_reg.q -> effective_addr.in0
    connect addr_with_x.sum -> effective_addr.in1

    node effective_addr_final: Mux
    connect control.is_sta_abs_x -> effective_addr_final.sel
    connect effective_addr.out -> effective_addr_final.in0
    connect addr_with_x.sum -> effective_addr_final.in1

    connect registers.reg_x -> addr_with_x.b

    // Data Memory
    node memory: SimpleMemory
    connect clk -> memory.clk
    connect effective_addr_final.out -> memory.addr
    connect control.mem_write -> memory.write_enable
    connect registers.reg_a -> memory.data_in

    // Incrementer for INX
    node inc_x: Incrementer
    connect registers.reg_x -> inc_x.in

    // Incrementer for RTS PC+1 fix
    node rts_pc_plus1: Incrementer
    connect pc_lo_temp.q -> rts_pc_plus1.in

    // Branch target calculation: PC + offset
    node branch_adder: Adder
    connect pc_reg.q -> branch_adder.a
    connect operand_reg.q -> branch_adder.b
    connect zero.out -> branch_adder.carry_in

    // Data source for A register
    node result_a_imm_zp: Mux
    connect control.is_lda_zp -> result_a_imm_zp.sel
    connect operand_reg.q -> result_a_imm_zp.in0
    connect memory.data_out -> result_a_imm_zp.in1

    node result_a_abs: Mux
    connect control.is_lda_abs -> result_a_abs.sel
    connect result_a_imm_zp.out -> result_a_abs.in0
    connect memory.data_out -> result_a_abs.in1

    node result_a_abs_x: Mux
    connect control.is_lda_abs_x -> result_a_abs_x.sel
    connect result_a_abs.out -> result_a_abs_x.in0
    connect memory.data_out -> result_a_abs_x.in1

    node result_a: Mux
    connect control.use_stack_data -> result_a.sel
    connect result_a_abs_x.out -> result_a.in0
    connect stack.data_out -> result_a.in1

    connect result_a.out -> registers.data_a

    // Data source for X register
    node result_x: Mux
    connect control.is_tax -> result_x.sel
    connect inc_x.out -> result_x.in0
    connect registers.reg_a -> result_x.in1

    connect result_x.out -> registers.data_x

    // Dummy for Y
    connect zero.out -> registers.data_y

    // Comparator for CMP: A - operand
    node cmp_sub: Subtractor
    connect registers.reg_a -> cmp_sub.a
    connect operand_reg.q -> cmp_sub.b
    connect zero.out -> cmp_sub.borrow_in

    // Flag calculation
    node const_128: Constant(value=128)

    // N from subtraction result (for CMP)
    node cmp_n: Comparator
    connect cmp_sub.difference -> cmp_n.a
    connect const_128.out -> cmp_n.b
    node n_gte: Or
    connect cmp_n.gt -> n_gte.a
    connect cmp_n.eq -> n_gte.b

    // Z from subtraction result (for CMP)
    node cmp_z: Comparator
    connect cmp_sub.difference -> cmp_z.a
    connect zero.out -> cmp_z.b

    // C = NOT borrow_out (for CMP)
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

    // N from INX (result of X+1)
    node inx_n: Comparator
    connect inc_x.out -> inx_n.a
    connect const_128.out -> inx_n.b
    node inx_n_gte: Or
    connect inx_n.gt -> inx_n_gte.a
    connect inx_n.eq -> inx_n_gte.b

    // Z from INX
    node inx_z: Comparator
    connect inc_x.out -> inx_z.a
    connect zero.out -> inx_z.b

    // Select flag source
    node n_cmp_or_lda: Mux
    connect control.is_cmp_imm -> n_cmp_or_lda.sel
    connect lda_n_gte.out -> n_cmp_or_lda.in0
    connect n_gte.out -> n_cmp_or_lda.in1

    node n_source: Mux
    connect control.is_inx -> n_source.sel
    connect n_cmp_or_lda.out -> n_source.in0
    connect inx_n_gte.out -> n_source.in1

    node z_cmp_or_lda: Mux
    connect control.is_cmp_imm -> z_cmp_or_lda.sel
    connect lda_z.eq -> z_cmp_or_lda.in0
    connect cmp_z.eq -> z_cmp_or_lda.in1

    node z_source: Mux
    connect control.is_inx -> z_source.sel
    connect z_cmp_or_lda.out -> z_source.in0
    connect inx_z.eq -> z_source.in1

    // Flag updates
    connect control.update_flags -> flags.update_n
    connect control.update_flags -> flags.update_z
    connect control.update_flags -> flags.update_c
    connect zero.out -> flags.update_v

    connect n_source.out -> flags.new_n
    connect z_source.out -> flags.new_z
    connect not_borrow.out -> flags.new_c
    connect zero.out -> flags.new_v

    // PC next value selection
    node pc_after_inc: Mux
    connect control.pc_increment -> pc_after_inc.sel
    connect pc_reg.q -> pc_after_inc.in0
    connect pc_inc.out -> pc_after_inc.in1

    node pc_after_branch: Mux
    connect control.branch_load_pc -> pc_after_branch.sel
    connect pc_after_inc.out -> pc_after_branch.in0
    connect branch_adder.sum -> pc_after_branch.in1

    node pc_after_rts: Mux
    connect control.rts_load_pc -> pc_after_rts.sel
    connect pc_after_branch.out -> pc_after_rts.in0
    connect rts_pc_plus1.out -> pc_after_rts.in1

    node pc_after_jsr: Mux
    connect control.jsr_load_pc -> pc_after_jsr.sel
    connect pc_after_rts.out -> pc_after_jsr.in0
    connect addr_lo_reg.q -> pc_after_jsr.in1

    connect pc_after_jsr.out -> pc_reg.data
    connect always_on.out -> pc_reg.we

    // Register control
    connect control.ir_load -> ir.we
    connect control.operand_load -> operand_reg.we
    connect control.addr_lo_load -> addr_lo_reg.we
    connect control.addr_hi_load -> addr_hi_reg.we

    // Outputs
    connect pc_reg.q -> pc
    connect ir.q -> instruction
    connect operand_reg.q -> operand
    connect effective_addr_final.out -> address
    connect memory.data_out -> mem_data
    connect stack.data_out -> stack_data
    connect control.current_state -> current_state
    connect control.exec_subcycle -> subcycle
    connect registers.reg_a -> reg_a
    connect registers.reg_x -> reg_x
    connect sp.sp -> reg_sp
    connect flags.flag_n -> flag_n
    connect flags.flag_z -> flag_z
    connect flags.flag_c -> flag_c
    connect control.update_flags -> debug_update_flags
    connect cmp_z.eq -> debug_cmp_z_eq
    connect z_source.out -> debug_z_source
    connect control.is_cmp_imm -> debug_is_cmp
  }
}

// === TEST CIRCUIT ===
circuit Stage5Test {
  clock clk

  impl {
    node cpu: Stage5CPU
    connect clk -> cpu.clk

    node reset_input: Input
    connect reset_input.out -> cpu.reset

    node d_pc: HexDisplay
    connect cpu.pc -> d_pc.in

    node d_instruction: HexDisplay
    connect cpu.instruction -> d_instruction.in

    node d_operand: HexDisplay
    connect cpu.operand -> d_operand.in

    node d_address: HexDisplay
    connect cpu.address -> d_address.in

    node d_mem_data: HexDisplay
    connect cpu.mem_data -> d_mem_data.in

    node d_stack_data: HexDisplay
    connect cpu.stack_data -> d_stack_data.in

    node d_state: HexDisplay
    connect cpu.current_state -> d_state.in

    node d_subcycle: HexDisplay
    connect cpu.subcycle -> d_subcycle.in

    node d_a: HexDisplay
    connect cpu.reg_a -> d_a.in

    node d_x: HexDisplay
    connect cpu.reg_x -> d_x.in

    node d_sp: HexDisplay
    connect cpu.reg_sp -> d_sp.in

    node d_n: HexDisplay
    connect cpu.flag_n -> d_n.in

    node d_z: HexDisplay
    connect cpu.flag_z -> d_z.in

    node d_c: HexDisplay
    connect cpu.flag_c -> d_c.in
  }
}
