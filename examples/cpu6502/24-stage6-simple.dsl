// Stage 6 Part 1: Simple Instructions
// Adds to Stage 5:
// - SEC (0x38) - Set Carry flag
// - CLC (0x18) - Clear Carry flag
// - NOP (0xEA) - No Operation
// - AND #imm (0x29) - Logical AND with immediate
// - ORA #imm (0x09) - Logical OR with immediate
// - EOR #imm (0x49) - Exclusive OR with immediate
// - INY (0xC8) - Increment Y
// - DEX (0xCA) - Decrement X
// - DEY (0x88) - Decrement Y

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
// Status byte format: NV1BDIZC (bits 7-0)
circuit FlagRegister {
  input update_n: Bit
  input update_z: Bit
  input update_c: Bit
  input update_v: Bit
  input update_d: Bit   // Decimal mode flag
  input update_i: Bit   // Interrupt disable flag

  input new_n: Bit
  input new_z: Bit
  input new_c: Bit
  input new_v: Bit
  input new_d: Bit
  input new_i: Bit

  output flag_n: Bit
  output flag_z: Bit
  output flag_c: Bit
  output flag_v: Bit
  output flag_d: Bit
  output flag_i: Bit

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

    node reg_d: Register(initial=0)
    connect clk -> reg_d.clk
    connect update_d -> reg_d.we
    connect new_d -> reg_d.data
    connect reg_d.q -> flag_d

    node reg_i: Register(initial=0)
    connect clk -> reg_i.clk
    connect update_i -> reg_i.we
    connect new_i -> reg_i.data
    connect reg_i.q -> flag_i
  }
}

// === Complete Control FSM with Stage 6 Instructions ===
circuit Stage6Control {
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
  output update_c_only: Bit
  output set_c: Bit
  output clear_c: Bit

  // Instruction decode - existing
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
  output is_bvc: Bit
  output is_bvs: Bit

  // Stage 6 instruction decode
  output is_sec: Bit
  output is_clc: Bit
  output is_nop: Bit
  output is_and_imm: Bit
  output is_ora_imm: Bit
  output is_eor_imm: Bit
  output is_iny: Bit
  output is_dex: Bit
  output is_dey: Bit
  output is_txa: Bit
  output is_tya: Bit
  output is_ldy_imm: Bit
  output is_cpx_imm: Bit
  output is_cpy_imm: Bit

  // Part 3 instruction decode
  output is_txs: Bit
  output is_tsx: Bit
  output is_clv: Bit
  output clear_v: Bit
  output sp_load: Bit

  // Part 16: D and I flag controls
  output set_d: Bit      // SED sets decimal flag
  output clear_d: Bit    // CLD clears decimal flag
  output set_i: Bit      // SEI sets interrupt disable
  output clear_i: Bit    // CLI clears interrupt disable
  output update_d: Bit   // Update D flag enable
  output update_i: Bit   // Update I flag enable

  // Part 16: PHP/PLP instruction decode
  output is_php: Bit     // Push Processor Status (0x08)
  output is_plp: Bit     // Pull Processor Status (0x28)
  output update_flags_plp: Bit  // Update all flags from PLP

  // Part 4 instruction decode
  output is_ldx_imm: Bit
  output is_sbc_imm: Bit

  // Part 5 instruction decode
  output is_adc_imm: Bit
  output is_stx_zp: Bit
  output is_sty_zp: Bit
  output use_x_for_mem: Bit
  output use_y_for_mem: Bit

  // Part 6 instruction decode - Shift/Rotate (accumulator mode)
  output is_asl_a: Bit
  output is_lsr_a: Bit
  output is_rol_a: Bit
  output is_ror_a: Bit

  // Part 7 instruction decode - Additional flag instructions
  output is_sei: Bit
  output is_cli: Bit
  output is_sed: Bit
  output is_cld: Bit

  // Part 8 instruction decode - Memory inc/dec
  output is_inc_zp: Bit
  output is_dec_zp: Bit
  output mem_rmw: Bit      // Read-Modify-Write operation
  output use_rmw_data: Bit // Use incremented/decremented memory value for write

  // Part 9 instruction decode - Shift/Rotate memory modes
  output is_asl_zp: Bit
  output is_lsr_zp: Bit
  output is_rol_zp: Bit
  output is_ror_zp: Bit

  // Part 10 instruction decode - Zero-page,X addressing mode
  output is_lda_zp_x: Bit
  output is_sta_zp_x: Bit
  output is_adc_zp_x: Bit
  output is_sbc_zp_x: Bit
  output is_and_zp_x: Bit
  output is_ora_zp_x: Bit
  output is_eor_zp_x: Bit
  output is_cmp_zp_x: Bit
  output is_zp_x: Bit      // Any zero-page,X instruction

  // Part 11: Zero-page,Y addressing mode
  output is_ldx_zp_y: Bit
  output is_stx_zp_y: Bit
  output is_zp_y: Bit      // Any zero-page,Y instruction

  // Part 12: Absolute,Y addressing mode
  output is_lda_abs_y: Bit
  output is_sta_abs_y: Bit
  output is_adc_abs_y: Bit
  output is_sbc_abs_y: Bit
  output is_and_abs_y: Bit
  output is_ora_abs_y: Bit
  output is_eor_abs_y: Bit
  output is_cmp_abs_y: Bit
  output is_ldx_abs_y: Bit
  output is_abs_y: Bit     // Any absolute,Y instruction

  // Part 13: Indirect,X (Indexed Indirect) addressing mode - (zp,X)
  output is_lda_ind_x: Bit
  output is_sta_ind_x: Bit
  output is_adc_ind_x: Bit
  output is_sbc_ind_x: Bit
  output is_and_ind_x: Bit
  output is_ora_ind_x: Bit
  output is_eor_ind_x: Bit
  output is_cmp_ind_x: Bit
  output is_ind_x: Bit     // Any indirect,X instruction
  output ptr_lo_load: Bit  // Load pointer low byte from memory
  output ptr_hi_load: Bit  // Load pointer high byte from memory
  output ind_x_sub3: Bit   // At sub3 for ind,X (reading ptr_lo)
  output ind_x_sub4: Bit   // At sub4 for ind,X (reading ptr_hi)
  output ind_x_sub5: Bit   // At sub5 for ind,X (final access)

  // Part 14: Indirect,Y (Indirect Indexed) addressing mode - (zp),Y
  output is_lda_ind_y: Bit
  output is_sta_ind_y: Bit
  output is_adc_ind_y: Bit
  output is_sbc_ind_y: Bit
  output is_and_ind_y: Bit
  output is_ora_ind_y: Bit
  output is_eor_ind_y: Bit
  output is_cmp_ind_y: Bit
  output is_ind_y: Bit     // Any indirect,Y instruction
  output ind_y_sub2: Bit   // At sub2 for ind,Y (reading ptr_lo from zp)
  output ind_y_sub3: Bit   // At sub3 for ind,Y (reading ptr_hi from zp+1)
  output ind_y_sub4: Bit   // At sub4 for ind,Y (calculating ptr+Y)
  output ind_y_sub5: Bit   // At sub5 for ind,Y (final access)

  // Part 15: BIT instruction and BVC/BVS branches
  output is_bit_zp: Bit    // BIT zero page (0x24)
  output is_bit_abs: Bit   // BIT absolute (0x2C)
  output update_v_bit: Bit // Update V flag from memory bit 6 (for BIT)

  // Part 17: JMP indirect and RTI
  output is_jmp_ind: Bit   // JMP indirect (0x6C)
  output is_rti: Bit       // RTI - Return from Interrupt (0x40)
  output jmp_ind_load_pc: Bit  // Load PC from indirect pointer
  output rti_load_pc: Bit      // Load PC from stack (for RTI)
  output rti_pull_p: Bit       // Pull status register for RTI
  output update_flags_rti: Bit // Update all flags from RTI
  output jmp_ind_sub2: Bit     // JMP indirect at sub2 (reading ptr_lo)
  output jmp_ind_sub3: Bit     // JMP indirect at sub3 (reading ptr_hi from addr+1)

  // Part 18: Shift/Rotate additional addressing modes
  output is_asl_zp_x: Bit  // ASL zero-page,X (0x16)
  output is_lsr_zp_x: Bit  // LSR zero-page,X (0x56)
  output is_rol_zp_x: Bit  // ROL zero-page,X (0x36)
  output is_ror_zp_x: Bit  // ROR zero-page,X (0x76)
  output is_asl_abs: Bit   // ASL absolute (0x0E)
  output is_lsr_abs: Bit   // LSR absolute (0x4E)
  output is_rol_abs: Bit   // ROL absolute (0x2E)
  output is_ror_abs: Bit   // ROR absolute (0x6E)
  output is_asl_abs_x: Bit // ASL absolute,X (0x1E)
  output is_lsr_abs_x: Bit // LSR absolute,X (0x5E)
  output is_rol_abs_x: Bit // ROL absolute,X (0x3E)
  output is_ror_abs_x: Bit // ROR absolute,X (0x7E)
  output is_shift_zp_x: Bit    // Any shift zp,X instruction
  output is_shift_abs: Bit     // Any shift absolute instruction
  output is_shift_abs_x: Bit   // Any shift absolute,X instruction

  // Part 19: INC/DEC additional addressing modes
  output is_inc_zp_x: Bit  // INC zero-page,X (0xF6)
  output is_dec_zp_x: Bit  // DEC zero-page,X (0xD6)
  output is_inc_abs: Bit   // INC absolute (0xEE)
  output is_dec_abs: Bit   // DEC absolute (0xCE)
  output is_inc_abs_x: Bit // INC absolute,X (0xFE)
  output is_dec_abs_x: Bit // DEC absolute,X (0xDE)
  output is_inc_dec_zp_x: Bit  // Any INC/DEC zp,X instruction
  output is_inc_dec_abs: Bit   // Any INC/DEC absolute instruction
  output is_inc_dec_abs_x: Bit // Any INC/DEC absolute,X instruction

  // Part 20: Compare additional addressing modes
  output is_cpx_zp: Bit   // CPX zero-page (0xE4)
  output is_cpy_zp: Bit   // CPY zero-page (0xC4)
  output is_cpx_abs: Bit  // CPX absolute (0xEC)
  output is_cpy_abs: Bit  // CPY absolute (0xCC)

  // Part 21: Load/Store additional addressing modes
  output is_ldx_zp: Bit    // LDX zero-page (0xA6)
  output is_ldx_abs: Bit   // LDX absolute (0xAE)
  output is_ldy_zp: Bit    // LDY zero-page (0xA4)
  output is_ldy_zp_x: Bit  // LDY zero-page,X (0xB4)
  output is_ldy_abs: Bit   // LDY absolute (0xAC)
  output is_ldy_abs_x: Bit // LDY absolute,X (0xBC)
  output is_stx_abs: Bit   // STX absolute (0x8E)
  output is_sty_zp_x: Bit  // STY zero-page,X (0x94)
  output is_sty_abs: Bit   // STY absolute (0x8C)

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

    // Instruction decode - Stage 4/5 instructions
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
    node CMP_IMM: Constant(value=201)
    node BEQ: Constant(value=240)
    node BNE: Constant(value=208)
    node BCC: Constant(value=144)
    node BCS: Constant(value=176)
    node BMI: Constant(value=48)
    node BPL: Constant(value=16)
    node BVC: Constant(value=80)
    node BVS: Constant(value=112)

    // Stage 6 instruction opcodes
    node SEC: Constant(value=56)    // 0x38
    node CLC: Constant(value=24)    // 0x18
    node NOP: Constant(value=234)   // 0xEA
    node AND_IMM: Constant(value=41)  // 0x29
    node ORA_IMM: Constant(value=9)   // 0x09
    node EOR_IMM: Constant(value=73)  // 0x49
    node INY: Constant(value=200)     // 0xC8
    node DEX: Constant(value=202)     // 0xCA
    node DEY: Constant(value=136)     // 0x88
    node TXA: Constant(value=138)     // 0x8A
    node TYA: Constant(value=152)     // 0x98
    node LDY_IMM: Constant(value=160) // 0xA0
    node CPX_IMM: Constant(value=224) // 0xE0
    node CPY_IMM: Constant(value=192) // 0xC0

    // Part 3 instruction opcodes
    node TXS: Constant(value=154)     // 0x9A - Transfer X to Stack Pointer
    node TSX: Constant(value=186)     // 0xBA - Transfer Stack Pointer to X
    node CLV: Constant(value=184)     // 0xB8 - Clear Overflow flag

    // Part 4 instruction opcodes
    node LDX_IMM: Constant(value=162) // 0xA2 - Load X immediate
    node SBC_IMM: Constant(value=233) // 0xE9 - Subtract with Carry immediate

    // Part 5 instruction opcodes
    node ADC_IMM: Constant(value=105) // 0x69 - Add with Carry immediate
    node STX_ZP: Constant(value=134)  // 0x86 - Store X to zero page
    node STY_ZP: Constant(value=132)  // 0x84 - Store Y to zero page

    // Part 6 instruction opcodes - Shift/Rotate (accumulator mode)
    node ASL_A: Constant(value=10)    // 0x0A - Arithmetic Shift Left Accumulator
    node LSR_A: Constant(value=74)    // 0x4A - Logical Shift Right Accumulator
    node ROL_A: Constant(value=42)    // 0x2A - Rotate Left through Carry Accumulator
    node ROR_A: Constant(value=106)   // 0x6A - Rotate Right through Carry Accumulator

    // Part 7 instruction opcodes - Additional flag instructions
    node SEI: Constant(value=120)     // 0x78 - Set Interrupt Disable
    node CLI: Constant(value=88)      // 0x58 - Clear Interrupt Disable
    node SED: Constant(value=248)     // 0xF8 - Set Decimal Mode
    node CLD: Constant(value=216)     // 0xD8 - Clear Decimal Mode

    // Part 8 instruction opcodes - Memory inc/dec
    node INC_ZP: Constant(value=230)  // 0xE6 - Increment Memory (zero page)
    node DEC_ZP: Constant(value=198)  // 0xC6 - Decrement Memory (zero page)

    // Part 9 instruction opcodes - Shift/Rotate memory modes
    node ASL_ZP: Constant(value=6)    // 0x06 - Arithmetic Shift Left (zero page)
    node LSR_ZP: Constant(value=70)   // 0x46 - Logical Shift Right (zero page)
    node ROL_ZP: Constant(value=38)   // 0x26 - Rotate Left (zero page)
    node ROR_ZP: Constant(value=102)  // 0x66 - Rotate Right (zero page)

    // Part 10 instruction opcodes - Zero-page,X addressing mode
    node LDA_ZP_X: Constant(value=181)  // 0xB5 - Load A (zero page,X)
    node STA_ZP_X: Constant(value=149)  // 0x95 - Store A (zero page,X)
    node ADC_ZP_X: Constant(value=117)  // 0x75 - Add with Carry (zero page,X)
    node SBC_ZP_X: Constant(value=245)  // 0xF5 - Subtract with Carry (zero page,X)
    node AND_ZP_X: Constant(value=53)   // 0x35 - Logical AND (zero page,X)
    node ORA_ZP_X: Constant(value=21)   // 0x15 - Logical OR (zero page,X)
    node EOR_ZP_X: Constant(value=85)   // 0x55 - Exclusive OR (zero page,X)
    node CMP_ZP_X: Constant(value=213)  // 0xD5 - Compare A (zero page,X)

    // Part 11: Zero-page,Y opcodes
    node LDX_ZP_Y: Constant(value=182)  // 0xB6 - Load X (zero page,Y)
    node STX_ZP_Y: Constant(value=150)  // 0x96 - Store X (zero page,Y)

    // Part 12: Absolute,Y opcodes
    node LDA_ABS_Y: Constant(value=185)  // 0xB9 - Load A (absolute,Y)
    node STA_ABS_Y: Constant(value=153)  // 0x99 - Store A (absolute,Y)
    node ADC_ABS_Y: Constant(value=121)  // 0x79 - Add with Carry (absolute,Y)
    node SBC_ABS_Y: Constant(value=249)  // 0xF9 - Subtract with Carry (absolute,Y)
    node AND_ABS_Y: Constant(value=57)   // 0x39 - Logical AND (absolute,Y)
    node ORA_ABS_Y: Constant(value=25)   // 0x19 - Logical OR (absolute,Y)
    node EOR_ABS_Y: Constant(value=89)   // 0x59 - Exclusive OR (absolute,Y)
    node CMP_ABS_Y: Constant(value=217)  // 0xD9 - Compare A (absolute,Y)
    node LDX_ABS_Y: Constant(value=190)  // 0xBE - Load X (absolute,Y)

    // Part 13: Indirect,X (Indexed Indirect) opcodes - (zp,X)
    node LDA_IND_X: Constant(value=161)  // 0xA1 - Load A (indirect,X)
    node STA_IND_X: Constant(value=129)  // 0x81 - Store A (indirect,X)
    node ADC_IND_X: Constant(value=97)   // 0x61 - Add with Carry (indirect,X)
    node SBC_IND_X: Constant(value=225)  // 0xE1 - Subtract with Carry (indirect,X)
    node AND_IND_X: Constant(value=33)   // 0x21 - Logical AND (indirect,X)
    node ORA_IND_X: Constant(value=1)    // 0x01 - Logical OR (indirect,X)
    node EOR_IND_X: Constant(value=65)   // 0x41 - Exclusive OR (indirect,X)
    node CMP_IND_X: Constant(value=193)  // 0xC1 - Compare A (indirect,X)

    // Part 14: Indirect,Y (Indirect Indexed) opcodes - (zp),Y
    node LDA_IND_Y: Constant(value=177)  // 0xB1 - Load A (indirect,Y)
    node STA_IND_Y: Constant(value=145)  // 0x91 - Store A (indirect,Y)
    node ADC_IND_Y: Constant(value=113)  // 0x71 - Add with Carry (indirect,Y)
    node SBC_IND_Y: Constant(value=241)  // 0xF1 - Subtract with Carry (indirect,Y)
    node AND_IND_Y: Constant(value=49)   // 0x31 - Logical AND (indirect,Y)
    node ORA_IND_Y: Constant(value=17)   // 0x11 - Logical OR (indirect,Y)
    node EOR_IND_Y: Constant(value=81)   // 0x51 - Exclusive OR (indirect,Y)
    node CMP_IND_Y: Constant(value=209)  // 0xD1 - Compare A (indirect,Y)

    // Part 15: BIT instruction
    node BIT_ZP: Constant(value=36)   // 0x24 - Bit test zero page
    node BIT_ABS: Constant(value=44)  // 0x2C - Bit test absolute

    // Part 16: PHP/PLP instructions
    node PHP: Constant(value=8)       // 0x08 - Push Processor Status
    node PLP: Constant(value=40)      // 0x28 - Pull Processor Status

    // Part 17: JMP indirect and RTI
    node JMP_IND: Constant(value=108) // 0x6C - Jump indirect
    node RTI: Constant(value=64)      // 0x40 - Return from Interrupt

    // Part 18: Shift/Rotate additional modes
    node ASL_ZP_X: Constant(value=22)   // 0x16 - ASL zero-page,X
    node LSR_ZP_X: Constant(value=86)   // 0x56 - LSR zero-page,X
    node ROL_ZP_X: Constant(value=54)   // 0x36 - ROL zero-page,X
    node ROR_ZP_X: Constant(value=118)  // 0x76 - ROR zero-page,X
    node ASL_ABS: Constant(value=14)    // 0x0E - ASL absolute
    node LSR_ABS: Constant(value=78)    // 0x4E - LSR absolute
    node ROL_ABS: Constant(value=46)    // 0x2E - ROL absolute
    node ROR_ABS: Constant(value=110)   // 0x6E - ROR absolute
    node ASL_ABS_X: Constant(value=30)  // 0x1E - ASL absolute,X
    node LSR_ABS_X: Constant(value=94)  // 0x5E - LSR absolute,X
    node ROL_ABS_X: Constant(value=62)  // 0x3E - ROL absolute,X
    node ROR_ABS_X: Constant(value=126) // 0x7E - ROR absolute,X

    // Part 19: INC/DEC additional modes
    node INC_ZP_X: Constant(value=246)  // 0xF6 - INC zero-page,X
    node DEC_ZP_X: Constant(value=214)  // 0xD6 - DEC zero-page,X
    node INC_ABS: Constant(value=238)   // 0xEE - INC absolute
    node DEC_ABS: Constant(value=206)   // 0xCE - DEC absolute
    node INC_ABS_X: Constant(value=254) // 0xFE - INC absolute,X
    node DEC_ABS_X: Constant(value=222) // 0xDE - DEC absolute,X

    // Part 20: Compare additional modes
    node CPX_ZP: Constant(value=228)  // 0xE4 - CPX zero-page
    node CPY_ZP: Constant(value=196)  // 0xC4 - CPY zero-page
    node CPX_ABS: Constant(value=236) // 0xEC - CPX absolute
    node CPY_ABS: Constant(value=204) // 0xCC - CPY absolute

    // Part 21: Load/Store additional modes
    node LDX_ZP: Constant(value=166)   // 0xA6 - LDX zero-page
    node LDX_ABS: Constant(value=174)  // 0xAE - LDX absolute
    node LDY_ZP: Constant(value=164)   // 0xA4 - LDY zero-page
    node LDY_ZP_X: Constant(value=180) // 0xB4 - LDY zero-page,X
    node LDY_ABS: Constant(value=172)  // 0xAC - LDY absolute
    node LDY_ABS_X: Constant(value=188) // 0xBC - LDY absolute,X
    node STX_ABS: Constant(value=142)  // 0x8E - STX absolute
    node STY_ZP_X: Constant(value=148) // 0x94 - STY zero-page,X
    node STY_ABS: Constant(value=140)  // 0x8C - STY absolute

    // Comparators for Stage 4/5
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

    node cmp_bvc: Comparator
    connect current_opcode -> cmp_bvc.a
    connect BVC.out -> cmp_bvc.b
    connect cmp_bvc.eq -> is_bvc

    node cmp_bvs: Comparator
    connect current_opcode -> cmp_bvs.a
    connect BVS.out -> cmp_bvs.b
    connect cmp_bvs.eq -> is_bvs

    // Stage 6 instruction comparators
    node cmp_sec: Comparator
    connect current_opcode -> cmp_sec.a
    connect SEC.out -> cmp_sec.b
    connect cmp_sec.eq -> is_sec

    node cmp_clc: Comparator
    connect current_opcode -> cmp_clc.a
    connect CLC.out -> cmp_clc.b
    connect cmp_clc.eq -> is_clc

    node cmp_nop: Comparator
    connect current_opcode -> cmp_nop.a
    connect NOP.out -> cmp_nop.b
    connect cmp_nop.eq -> is_nop

    node cmp_and_imm: Comparator
    connect current_opcode -> cmp_and_imm.a
    connect AND_IMM.out -> cmp_and_imm.b
    connect cmp_and_imm.eq -> is_and_imm

    node cmp_ora_imm: Comparator
    connect current_opcode -> cmp_ora_imm.a
    connect ORA_IMM.out -> cmp_ora_imm.b
    connect cmp_ora_imm.eq -> is_ora_imm

    node cmp_eor_imm: Comparator
    connect current_opcode -> cmp_eor_imm.a
    connect EOR_IMM.out -> cmp_eor_imm.b
    connect cmp_eor_imm.eq -> is_eor_imm

    node cmp_iny: Comparator
    connect current_opcode -> cmp_iny.a
    connect INY.out -> cmp_iny.b
    connect cmp_iny.eq -> is_iny

    node cmp_dex: Comparator
    connect current_opcode -> cmp_dex.a
    connect DEX.out -> cmp_dex.b
    connect cmp_dex.eq -> is_dex

    node cmp_dey: Comparator
    connect current_opcode -> cmp_dey.a
    connect DEY.out -> cmp_dey.b
    connect cmp_dey.eq -> is_dey

    node cmp_txa: Comparator
    connect current_opcode -> cmp_txa.a
    connect TXA.out -> cmp_txa.b
    connect cmp_txa.eq -> is_txa

    node cmp_tya: Comparator
    connect current_opcode -> cmp_tya.a
    connect TYA.out -> cmp_tya.b
    connect cmp_tya.eq -> is_tya

    node cmp_ldy_imm: Comparator
    connect current_opcode -> cmp_ldy_imm.a
    connect LDY_IMM.out -> cmp_ldy_imm.b
    connect cmp_ldy_imm.eq -> is_ldy_imm

    node cmp_cpx_imm: Comparator
    connect current_opcode -> cmp_cpx_imm.a
    connect CPX_IMM.out -> cmp_cpx_imm.b
    connect cmp_cpx_imm.eq -> is_cpx_imm

    node cmp_cpy_imm: Comparator
    connect current_opcode -> cmp_cpy_imm.a
    connect CPY_IMM.out -> cmp_cpy_imm.b
    connect cmp_cpy_imm.eq -> is_cpy_imm

    // Part 3 instruction comparators
    node cmp_txs: Comparator
    connect current_opcode -> cmp_txs.a
    connect TXS.out -> cmp_txs.b
    connect cmp_txs.eq -> is_txs

    node cmp_tsx: Comparator
    connect current_opcode -> cmp_tsx.a
    connect TSX.out -> cmp_tsx.b
    connect cmp_tsx.eq -> is_tsx

    node cmp_clv: Comparator
    connect current_opcode -> cmp_clv.a
    connect CLV.out -> cmp_clv.b
    connect cmp_clv.eq -> is_clv

    // Part 4 instruction comparators
    node cmp_ldx_imm: Comparator
    connect current_opcode -> cmp_ldx_imm.a
    connect LDX_IMM.out -> cmp_ldx_imm.b
    connect cmp_ldx_imm.eq -> is_ldx_imm

    node cmp_sbc_imm: Comparator
    connect current_opcode -> cmp_sbc_imm.a
    connect SBC_IMM.out -> cmp_sbc_imm.b
    connect cmp_sbc_imm.eq -> is_sbc_imm

    // Part 5 instruction comparators
    node cmp_adc_imm: Comparator
    connect current_opcode -> cmp_adc_imm.a
    connect ADC_IMM.out -> cmp_adc_imm.b
    connect cmp_adc_imm.eq -> is_adc_imm

    node cmp_stx_zp: Comparator
    connect current_opcode -> cmp_stx_zp.a
    connect STX_ZP.out -> cmp_stx_zp.b
    connect cmp_stx_zp.eq -> is_stx_zp

    node cmp_sty_zp: Comparator
    connect current_opcode -> cmp_sty_zp.a
    connect STY_ZP.out -> cmp_sty_zp.b
    connect cmp_sty_zp.eq -> is_sty_zp

    // Part 6 instruction comparators - Shift/Rotate
    node cmp_asl_a: Comparator
    connect current_opcode -> cmp_asl_a.a
    connect ASL_A.out -> cmp_asl_a.b
    connect cmp_asl_a.eq -> is_asl_a

    node cmp_lsr_a: Comparator
    connect current_opcode -> cmp_lsr_a.a
    connect LSR_A.out -> cmp_lsr_a.b
    connect cmp_lsr_a.eq -> is_lsr_a

    node cmp_rol_a: Comparator
    connect current_opcode -> cmp_rol_a.a
    connect ROL_A.out -> cmp_rol_a.b
    connect cmp_rol_a.eq -> is_rol_a

    node cmp_ror_a: Comparator
    connect current_opcode -> cmp_ror_a.a
    connect ROR_A.out -> cmp_ror_a.b
    connect cmp_ror_a.eq -> is_ror_a

    // Part 7 instruction comparators - Flag instructions
    node cmp_sei: Comparator
    connect current_opcode -> cmp_sei.a
    connect SEI.out -> cmp_sei.b
    connect cmp_sei.eq -> is_sei

    node cmp_cli: Comparator
    connect current_opcode -> cmp_cli.a
    connect CLI.out -> cmp_cli.b
    connect cmp_cli.eq -> is_cli

    node cmp_sed: Comparator
    connect current_opcode -> cmp_sed.a
    connect SED.out -> cmp_sed.b
    connect cmp_sed.eq -> is_sed

    node cmp_cld: Comparator
    connect current_opcode -> cmp_cld.a
    connect CLD.out -> cmp_cld.b
    connect cmp_cld.eq -> is_cld

    // Part 8 instruction comparators - Memory inc/dec
    node cmp_inc_zp: Comparator
    connect current_opcode -> cmp_inc_zp.a
    connect INC_ZP.out -> cmp_inc_zp.b
    connect cmp_inc_zp.eq -> is_inc_zp

    node cmp_dec_zp: Comparator
    connect current_opcode -> cmp_dec_zp.a
    connect DEC_ZP.out -> cmp_dec_zp.b
    connect cmp_dec_zp.eq -> is_dec_zp

    // Part 9 instruction comparators - Shift/Rotate memory modes
    node cmp_asl_zp: Comparator
    connect current_opcode -> cmp_asl_zp.a
    connect ASL_ZP.out -> cmp_asl_zp.b
    connect cmp_asl_zp.eq -> is_asl_zp

    node cmp_lsr_zp: Comparator
    connect current_opcode -> cmp_lsr_zp.a
    connect LSR_ZP.out -> cmp_lsr_zp.b
    connect cmp_lsr_zp.eq -> is_lsr_zp

    node cmp_rol_zp: Comparator
    connect current_opcode -> cmp_rol_zp.a
    connect ROL_ZP.out -> cmp_rol_zp.b
    connect cmp_rol_zp.eq -> is_rol_zp

    node cmp_ror_zp: Comparator
    connect current_opcode -> cmp_ror_zp.a
    connect ROR_ZP.out -> cmp_ror_zp.b
    connect cmp_ror_zp.eq -> is_ror_zp

    // Part 10 instruction comparators - Zero-page,X addressing mode
    node cmp_lda_zp_x: Comparator
    connect current_opcode -> cmp_lda_zp_x.a
    connect LDA_ZP_X.out -> cmp_lda_zp_x.b
    connect cmp_lda_zp_x.eq -> is_lda_zp_x

    node cmp_sta_zp_x: Comparator
    connect current_opcode -> cmp_sta_zp_x.a
    connect STA_ZP_X.out -> cmp_sta_zp_x.b
    connect cmp_sta_zp_x.eq -> is_sta_zp_x

    node cmp_adc_zp_x: Comparator
    connect current_opcode -> cmp_adc_zp_x.a
    connect ADC_ZP_X.out -> cmp_adc_zp_x.b
    connect cmp_adc_zp_x.eq -> is_adc_zp_x

    node cmp_sbc_zp_x: Comparator
    connect current_opcode -> cmp_sbc_zp_x.a
    connect SBC_ZP_X.out -> cmp_sbc_zp_x.b
    connect cmp_sbc_zp_x.eq -> is_sbc_zp_x

    node cmp_and_zp_x: Comparator
    connect current_opcode -> cmp_and_zp_x.a
    connect AND_ZP_X.out -> cmp_and_zp_x.b
    connect cmp_and_zp_x.eq -> is_and_zp_x

    node cmp_ora_zp_x: Comparator
    connect current_opcode -> cmp_ora_zp_x.a
    connect ORA_ZP_X.out -> cmp_ora_zp_x.b
    connect cmp_ora_zp_x.eq -> is_ora_zp_x

    node cmp_eor_zp_x: Comparator
    connect current_opcode -> cmp_eor_zp_x.a
    connect EOR_ZP_X.out -> cmp_eor_zp_x.b
    connect cmp_eor_zp_x.eq -> is_eor_zp_x

    node cmp_cmp_zp_x: Comparator
    connect current_opcode -> cmp_cmp_zp_x.a
    connect CMP_ZP_X.out -> cmp_cmp_zp_x.b
    connect cmp_cmp_zp_x.eq -> is_cmp_zp_x

    // is_zp_x: Any zero-page,X instruction
    node is_zp_x_1: Or
    connect cmp_lda_zp_x.eq -> is_zp_x_1.a
    connect cmp_sta_zp_x.eq -> is_zp_x_1.b

    node is_zp_x_2: Or
    connect is_zp_x_1.out -> is_zp_x_2.a
    connect cmp_adc_zp_x.eq -> is_zp_x_2.b

    node is_zp_x_3: Or
    connect is_zp_x_2.out -> is_zp_x_3.a
    connect cmp_sbc_zp_x.eq -> is_zp_x_3.b

    node is_zp_x_4: Or
    connect is_zp_x_3.out -> is_zp_x_4.a
    connect cmp_and_zp_x.eq -> is_zp_x_4.b

    node is_zp_x_5: Or
    connect is_zp_x_4.out -> is_zp_x_5.a
    connect cmp_ora_zp_x.eq -> is_zp_x_5.b

    node is_zp_x_6: Or
    connect is_zp_x_5.out -> is_zp_x_6.a
    connect cmp_eor_zp_x.eq -> is_zp_x_6.b

    node is_zp_x_7: Or
    connect is_zp_x_6.out -> is_zp_x_7.a
    connect cmp_cmp_zp_x.eq -> is_zp_x_7.b

    // Part 18: Add shift zp,X to is_zp_x chain
    node is_zp_x_8: Or
    connect is_zp_x_7.out -> is_zp_x_8.a
    connect is_shift_zp_x_signal.out -> is_zp_x_8.b

    // Part 19: Add INC/DEC zp,X to is_zp_x chain
    node is_zp_x_9: Or
    connect is_zp_x_8.out -> is_zp_x_9.a
    connect is_inc_dec_zp_x_signal.out -> is_zp_x_9.b

    // Part 21: Add LDY zp,X and STY zp,X to is_zp_x chain
    node is_zp_x_10: Or
    connect is_zp_x_9.out -> is_zp_x_10.a
    connect cmp_ldy_zp_x.eq -> is_zp_x_10.b

    node is_zp_x_final: Or
    connect is_zp_x_10.out -> is_zp_x_final.a
    connect cmp_sty_zp_x.eq -> is_zp_x_final.b
    connect is_zp_x_final.out -> is_zp_x

    // Part 11: Zero-page,Y comparators
    node cmp_ldx_zp_y: Comparator
    connect current_opcode -> cmp_ldx_zp_y.a
    connect LDX_ZP_Y.out -> cmp_ldx_zp_y.b
    connect cmp_ldx_zp_y.eq -> is_ldx_zp_y

    node cmp_stx_zp_y: Comparator
    connect current_opcode -> cmp_stx_zp_y.a
    connect STX_ZP_Y.out -> cmp_stx_zp_y.b
    connect cmp_stx_zp_y.eq -> is_stx_zp_y

    // is_zp_y: Any zero-page,Y instruction
    node is_zp_y_final: Or
    connect cmp_ldx_zp_y.eq -> is_zp_y_final.a
    connect cmp_stx_zp_y.eq -> is_zp_y_final.b
    connect is_zp_y_final.out -> is_zp_y

    // Part 12: Absolute,Y comparators
    node cmp_lda_abs_y: Comparator
    connect current_opcode -> cmp_lda_abs_y.a
    connect LDA_ABS_Y.out -> cmp_lda_abs_y.b
    connect cmp_lda_abs_y.eq -> is_lda_abs_y

    node cmp_sta_abs_y: Comparator
    connect current_opcode -> cmp_sta_abs_y.a
    connect STA_ABS_Y.out -> cmp_sta_abs_y.b
    connect cmp_sta_abs_y.eq -> is_sta_abs_y

    node cmp_adc_abs_y: Comparator
    connect current_opcode -> cmp_adc_abs_y.a
    connect ADC_ABS_Y.out -> cmp_adc_abs_y.b
    connect cmp_adc_abs_y.eq -> is_adc_abs_y

    node cmp_sbc_abs_y: Comparator
    connect current_opcode -> cmp_sbc_abs_y.a
    connect SBC_ABS_Y.out -> cmp_sbc_abs_y.b
    connect cmp_sbc_abs_y.eq -> is_sbc_abs_y

    node cmp_and_abs_y: Comparator
    connect current_opcode -> cmp_and_abs_y.a
    connect AND_ABS_Y.out -> cmp_and_abs_y.b
    connect cmp_and_abs_y.eq -> is_and_abs_y

    node cmp_ora_abs_y: Comparator
    connect current_opcode -> cmp_ora_abs_y.a
    connect ORA_ABS_Y.out -> cmp_ora_abs_y.b
    connect cmp_ora_abs_y.eq -> is_ora_abs_y

    node cmp_eor_abs_y: Comparator
    connect current_opcode -> cmp_eor_abs_y.a
    connect EOR_ABS_Y.out -> cmp_eor_abs_y.b
    connect cmp_eor_abs_y.eq -> is_eor_abs_y

    node cmp_cmp_abs_y: Comparator
    connect current_opcode -> cmp_cmp_abs_y.a
    connect CMP_ABS_Y.out -> cmp_cmp_abs_y.b
    connect cmp_cmp_abs_y.eq -> is_cmp_abs_y

    node cmp_ldx_abs_y: Comparator
    connect current_opcode -> cmp_ldx_abs_y.a
    connect LDX_ABS_Y.out -> cmp_ldx_abs_y.b
    connect cmp_ldx_abs_y.eq -> is_ldx_abs_y

    // is_abs_y: Any absolute,Y instruction
    node is_abs_y_1: Or
    connect cmp_lda_abs_y.eq -> is_abs_y_1.a
    connect cmp_sta_abs_y.eq -> is_abs_y_1.b

    node is_abs_y_2: Or
    connect is_abs_y_1.out -> is_abs_y_2.a
    connect cmp_adc_abs_y.eq -> is_abs_y_2.b

    node is_abs_y_3: Or
    connect is_abs_y_2.out -> is_abs_y_3.a
    connect cmp_sbc_abs_y.eq -> is_abs_y_3.b

    node is_abs_y_4: Or
    connect is_abs_y_3.out -> is_abs_y_4.a
    connect cmp_and_abs_y.eq -> is_abs_y_4.b

    node is_abs_y_5: Or
    connect is_abs_y_4.out -> is_abs_y_5.a
    connect cmp_ora_abs_y.eq -> is_abs_y_5.b

    node is_abs_y_6: Or
    connect is_abs_y_5.out -> is_abs_y_6.a
    connect cmp_eor_abs_y.eq -> is_abs_y_6.b

    node is_abs_y_7: Or
    connect is_abs_y_6.out -> is_abs_y_7.a
    connect cmp_cmp_abs_y.eq -> is_abs_y_7.b

    node is_abs_y_final: Or
    connect is_abs_y_7.out -> is_abs_y_final.a
    connect cmp_ldx_abs_y.eq -> is_abs_y_final.b
    connect is_abs_y_final.out -> is_abs_y

    // Part 13: Indirect,X (Indexed Indirect) comparators
    node cmp_lda_ind_x: Comparator
    connect current_opcode -> cmp_lda_ind_x.a
    connect LDA_IND_X.out -> cmp_lda_ind_x.b
    connect cmp_lda_ind_x.eq -> is_lda_ind_x

    node cmp_sta_ind_x: Comparator
    connect current_opcode -> cmp_sta_ind_x.a
    connect STA_IND_X.out -> cmp_sta_ind_x.b
    connect cmp_sta_ind_x.eq -> is_sta_ind_x

    node cmp_adc_ind_x: Comparator
    connect current_opcode -> cmp_adc_ind_x.a
    connect ADC_IND_X.out -> cmp_adc_ind_x.b
    connect cmp_adc_ind_x.eq -> is_adc_ind_x

    node cmp_sbc_ind_x: Comparator
    connect current_opcode -> cmp_sbc_ind_x.a
    connect SBC_IND_X.out -> cmp_sbc_ind_x.b
    connect cmp_sbc_ind_x.eq -> is_sbc_ind_x

    node cmp_and_ind_x: Comparator
    connect current_opcode -> cmp_and_ind_x.a
    connect AND_IND_X.out -> cmp_and_ind_x.b
    connect cmp_and_ind_x.eq -> is_and_ind_x

    node cmp_ora_ind_x: Comparator
    connect current_opcode -> cmp_ora_ind_x.a
    connect ORA_IND_X.out -> cmp_ora_ind_x.b
    connect cmp_ora_ind_x.eq -> is_ora_ind_x

    node cmp_eor_ind_x: Comparator
    connect current_opcode -> cmp_eor_ind_x.a
    connect EOR_IND_X.out -> cmp_eor_ind_x.b
    connect cmp_eor_ind_x.eq -> is_eor_ind_x

    node cmp_cmp_ind_x: Comparator
    connect current_opcode -> cmp_cmp_ind_x.a
    connect CMP_IND_X.out -> cmp_cmp_ind_x.b
    connect cmp_cmp_ind_x.eq -> is_cmp_ind_x

    // is_ind_x: Any indirect,X instruction
    node is_ind_x_1: Or
    connect cmp_lda_ind_x.eq -> is_ind_x_1.a
    connect cmp_sta_ind_x.eq -> is_ind_x_1.b

    node is_ind_x_2: Or
    connect is_ind_x_1.out -> is_ind_x_2.a
    connect cmp_adc_ind_x.eq -> is_ind_x_2.b

    node is_ind_x_3: Or
    connect is_ind_x_2.out -> is_ind_x_3.a
    connect cmp_sbc_ind_x.eq -> is_ind_x_3.b

    node is_ind_x_4: Or
    connect is_ind_x_3.out -> is_ind_x_4.a
    connect cmp_and_ind_x.eq -> is_ind_x_4.b

    node is_ind_x_5: Or
    connect is_ind_x_4.out -> is_ind_x_5.a
    connect cmp_ora_ind_x.eq -> is_ind_x_5.b

    node is_ind_x_6: Or
    connect is_ind_x_5.out -> is_ind_x_6.a
    connect cmp_eor_ind_x.eq -> is_ind_x_6.b

    node is_ind_x_final: Or
    connect is_ind_x_6.out -> is_ind_x_final.a
    connect cmp_cmp_ind_x.eq -> is_ind_x_final.b
    connect is_ind_x_final.out -> is_ind_x

    // Part 14: Indirect,Y (Indirect Indexed) comparators
    node cmp_lda_ind_y: Comparator
    connect current_opcode -> cmp_lda_ind_y.a
    connect LDA_IND_Y.out -> cmp_lda_ind_y.b
    connect cmp_lda_ind_y.eq -> is_lda_ind_y

    node cmp_sta_ind_y: Comparator
    connect current_opcode -> cmp_sta_ind_y.a
    connect STA_IND_Y.out -> cmp_sta_ind_y.b
    connect cmp_sta_ind_y.eq -> is_sta_ind_y

    node cmp_adc_ind_y: Comparator
    connect current_opcode -> cmp_adc_ind_y.a
    connect ADC_IND_Y.out -> cmp_adc_ind_y.b
    connect cmp_adc_ind_y.eq -> is_adc_ind_y

    node cmp_sbc_ind_y: Comparator
    connect current_opcode -> cmp_sbc_ind_y.a
    connect SBC_IND_Y.out -> cmp_sbc_ind_y.b
    connect cmp_sbc_ind_y.eq -> is_sbc_ind_y

    node cmp_and_ind_y: Comparator
    connect current_opcode -> cmp_and_ind_y.a
    connect AND_IND_Y.out -> cmp_and_ind_y.b
    connect cmp_and_ind_y.eq -> is_and_ind_y

    node cmp_ora_ind_y: Comparator
    connect current_opcode -> cmp_ora_ind_y.a
    connect ORA_IND_Y.out -> cmp_ora_ind_y.b
    connect cmp_ora_ind_y.eq -> is_ora_ind_y

    node cmp_eor_ind_y: Comparator
    connect current_opcode -> cmp_eor_ind_y.a
    connect EOR_IND_Y.out -> cmp_eor_ind_y.b
    connect cmp_eor_ind_y.eq -> is_eor_ind_y

    node cmp_cmp_ind_y: Comparator
    connect current_opcode -> cmp_cmp_ind_y.a
    connect CMP_IND_Y.out -> cmp_cmp_ind_y.b
    connect cmp_cmp_ind_y.eq -> is_cmp_ind_y

    // is_ind_y: Any indirect,Y instruction
    node is_ind_y_1: Or
    connect cmp_lda_ind_y.eq -> is_ind_y_1.a
    connect cmp_sta_ind_y.eq -> is_ind_y_1.b

    node is_ind_y_2: Or
    connect is_ind_y_1.out -> is_ind_y_2.a
    connect cmp_adc_ind_y.eq -> is_ind_y_2.b

    node is_ind_y_3: Or
    connect is_ind_y_2.out -> is_ind_y_3.a
    connect cmp_sbc_ind_y.eq -> is_ind_y_3.b

    node is_ind_y_4: Or
    connect is_ind_y_3.out -> is_ind_y_4.a
    connect cmp_and_ind_y.eq -> is_ind_y_4.b

    node is_ind_y_5: Or
    connect is_ind_y_4.out -> is_ind_y_5.a
    connect cmp_ora_ind_y.eq -> is_ind_y_5.b

    node is_ind_y_6: Or
    connect is_ind_y_5.out -> is_ind_y_6.a
    connect cmp_eor_ind_y.eq -> is_ind_y_6.b

    node is_ind_y_final: Or
    connect is_ind_y_6.out -> is_ind_y_final.a
    connect cmp_cmp_ind_y.eq -> is_ind_y_final.b
    connect is_ind_y_final.out -> is_ind_y

    // Part 15: BIT instruction decode
    node cmp_bit_zp: Comparator
    connect current_opcode -> cmp_bit_zp.a
    connect BIT_ZP.out -> cmp_bit_zp.b
    connect cmp_bit_zp.eq -> is_bit_zp

    node cmp_bit_abs: Comparator
    connect current_opcode -> cmp_bit_abs.a
    connect BIT_ABS.out -> cmp_bit_abs.b
    connect cmp_bit_abs.eq -> is_bit_abs

    // Part 16: PHP/PLP instruction decode
    node cmp_php: Comparator
    connect current_opcode -> cmp_php.a
    connect PHP.out -> cmp_php.b
    connect cmp_php.eq -> is_php

    node cmp_plp: Comparator
    connect current_opcode -> cmp_plp.a
    connect PLP.out -> cmp_plp.b
    connect cmp_plp.eq -> is_plp

    // Part 17: JMP indirect and RTI instruction decode
    node cmp_jmp_ind: Comparator
    connect current_opcode -> cmp_jmp_ind.a
    connect JMP_IND.out -> cmp_jmp_ind.b
    connect cmp_jmp_ind.eq -> is_jmp_ind

    node cmp_rti: Comparator
    connect current_opcode -> cmp_rti.a
    connect RTI.out -> cmp_rti.b
    connect cmp_rti.eq -> is_rti

    // Part 18: Shift/Rotate additional modes comparators
    node cmp_asl_zp_x: Comparator
    connect current_opcode -> cmp_asl_zp_x.a
    connect ASL_ZP_X.out -> cmp_asl_zp_x.b
    connect cmp_asl_zp_x.eq -> is_asl_zp_x

    node cmp_lsr_zp_x: Comparator
    connect current_opcode -> cmp_lsr_zp_x.a
    connect LSR_ZP_X.out -> cmp_lsr_zp_x.b
    connect cmp_lsr_zp_x.eq -> is_lsr_zp_x

    node cmp_rol_zp_x: Comparator
    connect current_opcode -> cmp_rol_zp_x.a
    connect ROL_ZP_X.out -> cmp_rol_zp_x.b
    connect cmp_rol_zp_x.eq -> is_rol_zp_x

    node cmp_ror_zp_x: Comparator
    connect current_opcode -> cmp_ror_zp_x.a
    connect ROR_ZP_X.out -> cmp_ror_zp_x.b
    connect cmp_ror_zp_x.eq -> is_ror_zp_x

    node cmp_asl_abs: Comparator
    connect current_opcode -> cmp_asl_abs.a
    connect ASL_ABS.out -> cmp_asl_abs.b
    connect cmp_asl_abs.eq -> is_asl_abs

    node cmp_lsr_abs: Comparator
    connect current_opcode -> cmp_lsr_abs.a
    connect LSR_ABS.out -> cmp_lsr_abs.b
    connect cmp_lsr_abs.eq -> is_lsr_abs

    node cmp_rol_abs: Comparator
    connect current_opcode -> cmp_rol_abs.a
    connect ROL_ABS.out -> cmp_rol_abs.b
    connect cmp_rol_abs.eq -> is_rol_abs

    node cmp_ror_abs: Comparator
    connect current_opcode -> cmp_ror_abs.a
    connect ROR_ABS.out -> cmp_ror_abs.b
    connect cmp_ror_abs.eq -> is_ror_abs

    node cmp_asl_abs_x: Comparator
    connect current_opcode -> cmp_asl_abs_x.a
    connect ASL_ABS_X.out -> cmp_asl_abs_x.b
    connect cmp_asl_abs_x.eq -> is_asl_abs_x

    node cmp_lsr_abs_x: Comparator
    connect current_opcode -> cmp_lsr_abs_x.a
    connect LSR_ABS_X.out -> cmp_lsr_abs_x.b
    connect cmp_lsr_abs_x.eq -> is_lsr_abs_x

    node cmp_rol_abs_x: Comparator
    connect current_opcode -> cmp_rol_abs_x.a
    connect ROL_ABS_X.out -> cmp_rol_abs_x.b
    connect cmp_rol_abs_x.eq -> is_rol_abs_x

    node cmp_ror_abs_x: Comparator
    connect current_opcode -> cmp_ror_abs_x.a
    connect ROR_ABS_X.out -> cmp_ror_abs_x.b
    connect cmp_ror_abs_x.eq -> is_ror_abs_x

    // Part 18: Combined shift mode signals
    node is_shift_zp_x_temp: Or
    connect cmp_asl_zp_x.eq -> is_shift_zp_x_temp.a
    connect cmp_lsr_zp_x.eq -> is_shift_zp_x_temp.b

    node is_shift_zp_x_temp2: Or
    connect is_shift_zp_x_temp.out -> is_shift_zp_x_temp2.a
    connect cmp_rol_zp_x.eq -> is_shift_zp_x_temp2.b

    node is_shift_zp_x_signal: Or
    connect is_shift_zp_x_temp2.out -> is_shift_zp_x_signal.a
    connect cmp_ror_zp_x.eq -> is_shift_zp_x_signal.b
    connect is_shift_zp_x_signal.out -> is_shift_zp_x

    node is_shift_abs_temp: Or
    connect cmp_asl_abs.eq -> is_shift_abs_temp.a
    connect cmp_lsr_abs.eq -> is_shift_abs_temp.b

    node is_shift_abs_temp2: Or
    connect is_shift_abs_temp.out -> is_shift_abs_temp2.a
    connect cmp_rol_abs.eq -> is_shift_abs_temp2.b

    node is_shift_abs_signal: Or
    connect is_shift_abs_temp2.out -> is_shift_abs_signal.a
    connect cmp_ror_abs.eq -> is_shift_abs_signal.b
    connect is_shift_abs_signal.out -> is_shift_abs

    node is_shift_abs_x_temp: Or
    connect cmp_asl_abs_x.eq -> is_shift_abs_x_temp.a
    connect cmp_lsr_abs_x.eq -> is_shift_abs_x_temp.b

    node is_shift_abs_x_temp2: Or
    connect is_shift_abs_x_temp.out -> is_shift_abs_x_temp2.a
    connect cmp_rol_abs_x.eq -> is_shift_abs_x_temp2.b

    node is_shift_abs_x_signal: Or
    connect is_shift_abs_x_temp2.out -> is_shift_abs_x_signal.a
    connect cmp_ror_abs_x.eq -> is_shift_abs_x_signal.b
    connect is_shift_abs_x_signal.out -> is_shift_abs_x

    // Part 19: INC/DEC additional modes comparators
    node cmp_inc_zp_x: Comparator
    connect current_opcode -> cmp_inc_zp_x.a
    connect INC_ZP_X.out -> cmp_inc_zp_x.b
    connect cmp_inc_zp_x.eq -> is_inc_zp_x

    node cmp_dec_zp_x: Comparator
    connect current_opcode -> cmp_dec_zp_x.a
    connect DEC_ZP_X.out -> cmp_dec_zp_x.b
    connect cmp_dec_zp_x.eq -> is_dec_zp_x

    node cmp_inc_abs: Comparator
    connect current_opcode -> cmp_inc_abs.a
    connect INC_ABS.out -> cmp_inc_abs.b
    connect cmp_inc_abs.eq -> is_inc_abs

    node cmp_dec_abs: Comparator
    connect current_opcode -> cmp_dec_abs.a
    connect DEC_ABS.out -> cmp_dec_abs.b
    connect cmp_dec_abs.eq -> is_dec_abs

    node cmp_inc_abs_x: Comparator
    connect current_opcode -> cmp_inc_abs_x.a
    connect INC_ABS_X.out -> cmp_inc_abs_x.b
    connect cmp_inc_abs_x.eq -> is_inc_abs_x

    node cmp_dec_abs_x: Comparator
    connect current_opcode -> cmp_dec_abs_x.a
    connect DEC_ABS_X.out -> cmp_dec_abs_x.b
    connect cmp_dec_abs_x.eq -> is_dec_abs_x

    // Part 19: Combined INC/DEC mode signals
    node is_inc_dec_zp_x_signal: Or
    connect cmp_inc_zp_x.eq -> is_inc_dec_zp_x_signal.a
    connect cmp_dec_zp_x.eq -> is_inc_dec_zp_x_signal.b
    connect is_inc_dec_zp_x_signal.out -> is_inc_dec_zp_x

    node is_inc_dec_abs_signal: Or
    connect cmp_inc_abs.eq -> is_inc_dec_abs_signal.a
    connect cmp_dec_abs.eq -> is_inc_dec_abs_signal.b
    connect is_inc_dec_abs_signal.out -> is_inc_dec_abs

    node is_inc_dec_abs_x_signal: Or
    connect cmp_inc_abs_x.eq -> is_inc_dec_abs_x_signal.a
    connect cmp_dec_abs_x.eq -> is_inc_dec_abs_x_signal.b
    connect is_inc_dec_abs_x_signal.out -> is_inc_dec_abs_x

    // Part 20: Compare additional modes comparators
    node cmp_cpx_zp: Comparator
    connect current_opcode -> cmp_cpx_zp.a
    connect CPX_ZP.out -> cmp_cpx_zp.b
    connect cmp_cpx_zp.eq -> is_cpx_zp

    node cmp_cpy_zp: Comparator
    connect current_opcode -> cmp_cpy_zp.a
    connect CPY_ZP.out -> cmp_cpy_zp.b
    connect cmp_cpy_zp.eq -> is_cpy_zp

    node cmp_cpx_abs: Comparator
    connect current_opcode -> cmp_cpx_abs.a
    connect CPX_ABS.out -> cmp_cpx_abs.b
    connect cmp_cpx_abs.eq -> is_cpx_abs

    node cmp_cpy_abs: Comparator
    connect current_opcode -> cmp_cpy_abs.a
    connect CPY_ABS.out -> cmp_cpy_abs.b
    connect cmp_cpy_abs.eq -> is_cpy_abs

    // Part 21: Load/Store additional modes comparators
    node cmp_ldx_zp: Comparator
    connect current_opcode -> cmp_ldx_zp.a
    connect LDX_ZP.out -> cmp_ldx_zp.b
    connect cmp_ldx_zp.eq -> is_ldx_zp

    node cmp_ldx_abs: Comparator
    connect current_opcode -> cmp_ldx_abs.a
    connect LDX_ABS.out -> cmp_ldx_abs.b
    connect cmp_ldx_abs.eq -> is_ldx_abs

    node cmp_ldy_zp: Comparator
    connect current_opcode -> cmp_ldy_zp.a
    connect LDY_ZP.out -> cmp_ldy_zp.b
    connect cmp_ldy_zp.eq -> is_ldy_zp

    node cmp_ldy_zp_x: Comparator
    connect current_opcode -> cmp_ldy_zp_x.a
    connect LDY_ZP_X.out -> cmp_ldy_zp_x.b
    connect cmp_ldy_zp_x.eq -> is_ldy_zp_x

    node cmp_ldy_abs: Comparator
    connect current_opcode -> cmp_ldy_abs.a
    connect LDY_ABS.out -> cmp_ldy_abs.b
    connect cmp_ldy_abs.eq -> is_ldy_abs

    node cmp_ldy_abs_x: Comparator
    connect current_opcode -> cmp_ldy_abs_x.a
    connect LDY_ABS_X.out -> cmp_ldy_abs_x.b
    connect cmp_ldy_abs_x.eq -> is_ldy_abs_x

    node cmp_stx_abs: Comparator
    connect current_opcode -> cmp_stx_abs.a
    connect STX_ABS.out -> cmp_stx_abs.b
    connect cmp_stx_abs.eq -> is_stx_abs

    node cmp_sty_zp_x: Comparator
    connect current_opcode -> cmp_sty_zp_x.a
    connect STY_ZP_X.out -> cmp_sty_zp_x.b
    connect cmp_sty_zp_x.eq -> is_sty_zp_x

    node cmp_sty_abs: Comparator
    connect current_opcode -> cmp_sty_abs.a
    connect STY_ABS.out -> cmp_sty_abs.b
    connect cmp_sty_abs.eq -> is_sty_abs

    // All RMW instructions: INC, DEC, ASL, LSR, ROL, ROR
    node is_rmw_inc_dec_zp: Or
    connect cmp_inc_zp.eq -> is_rmw_inc_dec_zp.a
    connect cmp_dec_zp.eq -> is_rmw_inc_dec_zp.b

    // Part 19: Extend RMW INC/DEC to include zp,X, abs, abs,X
    node is_rmw_inc_dec_temp: Or
    connect is_rmw_inc_dec_zp.out -> is_rmw_inc_dec_temp.a
    connect is_inc_dec_zp_x_signal.out -> is_rmw_inc_dec_temp.b

    node is_rmw_inc_dec_temp2: Or
    connect is_rmw_inc_dec_temp.out -> is_rmw_inc_dec_temp2.a
    connect is_inc_dec_abs_signal.out -> is_rmw_inc_dec_temp2.b

    node is_rmw_inc_dec: Or
    connect is_rmw_inc_dec_temp2.out -> is_rmw_inc_dec.a
    connect is_inc_dec_abs_x_signal.out -> is_rmw_inc_dec.b

    node is_rmw_asl_lsr: Or
    connect cmp_asl_zp.eq -> is_rmw_asl_lsr.a
    connect cmp_lsr_zp.eq -> is_rmw_asl_lsr.b

    node is_rmw_rol_ror: Or
    connect cmp_rol_zp.eq -> is_rmw_rol_ror.a
    connect cmp_ror_zp.eq -> is_rmw_rol_ror.b

    node is_rmw_shift_zp: Or
    connect is_rmw_asl_lsr.out -> is_rmw_shift_zp.a
    connect is_rmw_rol_ror.out -> is_rmw_shift_zp.b

    // Part 18: Extend RMW to include zp,X, abs, abs,X shift modes
    node is_rmw_shift_temp: Or
    connect is_rmw_shift_zp.out -> is_rmw_shift_temp.a
    connect is_shift_zp_x_signal.out -> is_rmw_shift_temp.b

    node is_rmw_shift_temp2: Or
    connect is_rmw_shift_temp.out -> is_rmw_shift_temp2.a
    connect is_shift_abs_signal.out -> is_rmw_shift_temp2.b

    node is_rmw_shift: Or
    connect is_rmw_shift_temp2.out -> is_rmw_shift.a
    connect is_shift_abs_x_signal.out -> is_rmw_shift.b

    node is_rmw: Or
    connect is_rmw_inc_dec.out -> is_rmw.a
    connect is_rmw_shift.out -> is_rmw.b
    connect is_rmw.out -> mem_rmw

    // Instruction categories
    // Immediate mode instructions that load A (LDA, AND, ORA, EOR)
    node is_imm_lda: Or
    connect cmp_lda_imm.eq -> is_imm_lda.a
    connect cmp_and_imm.eq -> is_imm_lda.b

    node is_imm_lda_2: Or
    connect is_imm_lda.out -> is_imm_lda_2.a
    connect cmp_ora_imm.eq -> is_imm_lda_2.b

    node is_imm_lda_3: Or
    connect is_imm_lda_2.out -> is_imm_lda_3.a
    connect cmp_eor_imm.eq -> is_imm_lda_3.b

    // SBC also writes to A
    node is_imm_lda_4: Or
    connect is_imm_lda_3.out -> is_imm_lda_4.a
    connect cmp_sbc_imm.eq -> is_imm_lda_4.b

    // ADC also writes to A
    node is_imm_lda_5: Or
    connect is_imm_lda_4.out -> is_imm_lda_5.a
    connect cmp_adc_imm.eq -> is_imm_lda_5.b

    // All immediate instructions (LDA, AND, ORA, EOR, SBC, ADC, CMP, LDY, LDX, CPX, CPY)
    node is_imm_any_1: Or
    connect is_imm_lda_5.out -> is_imm_any_1.a
    connect cmp_cmp_imm.eq -> is_imm_any_1.b

    node is_imm_any_2: Or
    connect is_imm_any_1.out -> is_imm_any_2.a
    connect cmp_ldy_imm.eq -> is_imm_any_2.b

    node is_imm_any_3: Or
    connect is_imm_any_2.out -> is_imm_any_3.a
    connect cmp_cpx_imm.eq -> is_imm_any_3.b

    node is_imm_any_4: Or
    connect is_imm_any_3.out -> is_imm_any_4.a
    connect cmp_cpy_imm.eq -> is_imm_any_4.b

    // LDX #imm is also immediate mode
    node is_imm_any: Or
    connect is_imm_any_4.out -> is_imm_any.a
    connect cmp_ldx_imm.eq -> is_imm_any.b

    node is_zp_1: Or
    connect cmp_lda_zp.eq -> is_zp_1.a
    connect cmp_sta_zp.eq -> is_zp_1.b

    node is_zp_2: Or
    connect is_zp_1.out -> is_zp_2.a
    connect cmp_stx_zp.eq -> is_zp_2.b

    node is_zp_3: Or
    connect is_zp_2.out -> is_zp_3.a
    connect cmp_sty_zp.eq -> is_zp_3.b

    node is_zp_4: Or
    connect is_zp_3.out -> is_zp_4.a
    connect cmp_inc_zp.eq -> is_zp_4.b

    node is_zp_5: Or
    connect is_zp_4.out -> is_zp_5.a
    connect cmp_dec_zp.eq -> is_zp_5.b

    // Part 9: Add shift/rotate ZP to is_zp
    node is_zp_6: Or
    connect is_zp_5.out -> is_zp_6.a
    connect cmp_asl_zp.eq -> is_zp_6.b

    node is_zp_7: Or
    connect is_zp_6.out -> is_zp_7.a
    connect cmp_lsr_zp.eq -> is_zp_7.b

    node is_zp_8: Or
    connect is_zp_7.out -> is_zp_8.a
    connect cmp_rol_zp.eq -> is_zp_8.b

    node is_zp_9: Or
    connect is_zp_8.out -> is_zp_9.a
    connect cmp_ror_zp.eq -> is_zp_9.b

    // Part 10: Add zp,X to is_zp chain
    node is_zp_10: Or
    connect is_zp_9.out -> is_zp_10.a
    connect is_zp_x_final.out -> is_zp_10.b

    // Part 11: Add zp,Y to is_zp chain
    node is_zp_11: Or
    connect is_zp_10.out -> is_zp_11.a
    connect is_zp_y_final.out -> is_zp_11.b

    // Part 15: Add BIT zp to is_zp chain
    node is_zp_12: Or
    connect is_zp_11.out -> is_zp_12.a
    connect cmp_bit_zp.eq -> is_zp_12.b

    // Part 20: Add CPX/CPY zp to is_zp chain
    node is_zp_13: Or
    connect is_zp_12.out -> is_zp_13.a
    connect cmp_cpx_zp.eq -> is_zp_13.b

    node is_zp_14: Or
    connect is_zp_13.out -> is_zp_14.a
    connect cmp_cpy_zp.eq -> is_zp_14.b

    // Part 21: Add LDX/LDY zp to is_zp chain
    node is_zp_15: Or
    connect is_zp_14.out -> is_zp_15.a
    connect cmp_ldx_zp.eq -> is_zp_15.b

    node is_zp: Or
    connect is_zp_15.out -> is_zp.a
    connect cmp_ldy_zp.eq -> is_zp.b

    node is_abs_temp: Or
    connect cmp_lda_abs.eq -> is_abs_temp.a
    connect cmp_sta_abs.eq -> is_abs_temp.b

    node is_abs_temp2: Or
    connect is_abs_temp.out -> is_abs_temp2.a
    connect cmp_lda_abs_x.eq -> is_abs_temp2.b

    node is_abs_temp3: Or
    connect is_abs_temp2.out -> is_abs_temp3.a
    connect cmp_sta_abs_x.eq -> is_abs_temp3.b

    // Part 12: Add absolute,Y to is_abs chain
    node is_abs_temp4: Or
    connect is_abs_temp3.out -> is_abs_temp4.a
    connect is_abs_y_final.out -> is_abs_temp4.b

    // Part 15: Add BIT absolute to is_abs chain
    node is_abs_temp5: Or
    connect is_abs_temp4.out -> is_abs_temp5.a
    connect cmp_bit_abs.eq -> is_abs_temp5.b

    // Part 18: Add shift absolute to is_abs chain
    node is_abs_temp6: Or
    connect is_abs_temp5.out -> is_abs_temp6.a
    connect is_shift_abs_signal.out -> is_abs_temp6.b

    // Part 18: Add shift absolute,X to is_abs chain
    node is_abs_temp7: Or
    connect is_abs_temp6.out -> is_abs_temp7.a
    connect is_shift_abs_x_signal.out -> is_abs_temp7.b

    // Part 19: Add INC/DEC absolute and absolute,X to is_abs chain
    node is_abs_temp8: Or
    connect is_abs_temp7.out -> is_abs_temp8.a
    connect is_inc_dec_abs_signal.out -> is_abs_temp8.b

    node is_abs_temp9: Or
    connect is_abs_temp8.out -> is_abs_temp9.a
    connect is_inc_dec_abs_x_signal.out -> is_abs_temp9.b

    // Part 20: Add CPX/CPY absolute to is_abs chain
    node is_abs_temp10: Or
    connect is_abs_temp9.out -> is_abs_temp10.a
    connect cmp_cpx_abs.eq -> is_abs_temp10.b

    node is_abs_temp11: Or
    connect is_abs_temp10.out -> is_abs_temp11.a
    connect cmp_cpy_abs.eq -> is_abs_temp11.b

    // Part 21: Add LDX/LDY/STX/STY absolute and LDY abs,X to is_abs chain
    node is_abs_temp12: Or
    connect is_abs_temp11.out -> is_abs_temp12.a
    connect cmp_ldx_abs.eq -> is_abs_temp12.b

    node is_abs_temp13: Or
    connect is_abs_temp12.out -> is_abs_temp13.a
    connect cmp_ldy_abs.eq -> is_abs_temp13.b

    node is_abs_temp14: Or
    connect is_abs_temp13.out -> is_abs_temp14.a
    connect cmp_ldy_abs_x.eq -> is_abs_temp14.b

    node is_abs_temp15: Or
    connect is_abs_temp14.out -> is_abs_temp15.a
    connect cmp_stx_abs.eq -> is_abs_temp15.b

    node is_abs_final: Or
    connect is_abs_temp15.out -> is_abs_final.a
    connect cmp_sty_abs.eq -> is_abs_final.b

    // 1-cycle implied mode instructions (TAX, INX, NOP, SEC, CLC, INY, DEX, DEY)
    node is_1cycle_1: Or
    connect cmp_tax.eq -> is_1cycle_1.a
    connect cmp_inx.eq -> is_1cycle_1.b

    node is_1cycle_2: Or
    connect is_1cycle_1.out -> is_1cycle_2.a
    connect cmp_nop.eq -> is_1cycle_2.b

    node is_1cycle_3: Or
    connect is_1cycle_2.out -> is_1cycle_3.a
    connect cmp_sec.eq -> is_1cycle_3.b

    node is_1cycle_4: Or
    connect is_1cycle_3.out -> is_1cycle_4.a
    connect cmp_clc.eq -> is_1cycle_4.b

    node is_1cycle_5: Or
    connect is_1cycle_4.out -> is_1cycle_5.a
    connect cmp_iny.eq -> is_1cycle_5.b

    node is_1cycle_6: Or
    connect is_1cycle_5.out -> is_1cycle_6.a
    connect cmp_dex.eq -> is_1cycle_6.b

    node is_1cycle_7: Or
    connect is_1cycle_6.out -> is_1cycle_7.a
    connect cmp_dey.eq -> is_1cycle_7.b

    node is_1cycle_8: Or
    connect is_1cycle_7.out -> is_1cycle_8.a
    connect cmp_txa.eq -> is_1cycle_8.b

    node is_1cycle_9: Or
    connect is_1cycle_8.out -> is_1cycle_9.a
    connect cmp_tya.eq -> is_1cycle_9.b

    node is_1cycle_10: Or
    connect is_1cycle_9.out -> is_1cycle_10.a
    connect cmp_txs.eq -> is_1cycle_10.b

    node is_1cycle_11: Or
    connect is_1cycle_10.out -> is_1cycle_11.a
    connect cmp_tsx.eq -> is_1cycle_11.b

    node is_1cycle_12: Or
    connect is_1cycle_11.out -> is_1cycle_12.a
    connect cmp_clv.eq -> is_1cycle_12.b

    // Part 6: Shift/Rotate accumulator mode are 1-cycle instructions
    node is_1cycle_13: Or
    connect is_1cycle_12.out -> is_1cycle_13.a
    connect cmp_asl_a.eq -> is_1cycle_13.b

    node is_1cycle_14: Or
    connect is_1cycle_13.out -> is_1cycle_14.a
    connect cmp_lsr_a.eq -> is_1cycle_14.b

    node is_1cycle_15: Or
    connect is_1cycle_14.out -> is_1cycle_15.a
    connect cmp_rol_a.eq -> is_1cycle_15.b

    node is_1cycle_16: Or
    connect is_1cycle_15.out -> is_1cycle_16.a
    connect cmp_ror_a.eq -> is_1cycle_16.b

    // Part 7: SEI, CLI, SED, CLD are also 1-cycle instructions
    node is_1cycle_17: Or
    connect is_1cycle_16.out -> is_1cycle_17.a
    connect cmp_sei.eq -> is_1cycle_17.b

    node is_1cycle_18: Or
    connect is_1cycle_17.out -> is_1cycle_18.a
    connect cmp_cli.eq -> is_1cycle_18.b

    node is_1cycle_19: Or
    connect is_1cycle_18.out -> is_1cycle_19.a
    connect cmp_sed.eq -> is_1cycle_19.b

    node is_1cycle: Or
    connect is_1cycle_19.out -> is_1cycle.a
    connect cmp_cld.eq -> is_1cycle.b

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

    node is_branch_5: Or
    connect is_branch_4.out -> is_branch_5.a
    connect cmp_bpl.eq -> is_branch_5.b

    node is_branch_6: Or
    connect is_branch_5.out -> is_branch_6.a
    connect cmp_bvc.eq -> is_branch_6.b

    node is_branch: Or
    connect is_branch_6.out -> is_branch.a
    connect cmp_bvs.eq -> is_branch.b

    // Branch condition checking
    node beq_cond: And
    connect cmp_beq.eq -> beq_cond.a
    connect flag_z -> beq_cond.b

    node not_z: Not
    connect flag_z -> not_z.in
    node bne_cond: And
    connect cmp_bne.eq -> bne_cond.a
    connect not_z.out -> bne_cond.b

    node not_c: Not
    connect flag_c -> not_c.in
    node bcc_cond: And
    connect cmp_bcc.eq -> bcc_cond.a
    connect not_c.out -> bcc_cond.b

    node bcs_cond: And
    connect cmp_bcs.eq -> bcs_cond.a
    connect flag_c -> bcs_cond.b

    node bmi_cond: And
    connect cmp_bmi.eq -> bmi_cond.a
    connect flag_n -> bmi_cond.b

    node not_n: Not
    connect flag_n -> not_n.in
    node bpl_cond: And
    connect cmp_bpl.eq -> bpl_cond.a
    connect not_n.out -> bpl_cond.b

    node not_v: Not
    connect flag_v -> not_v.in
    node bvc_cond: And
    connect cmp_bvc.eq -> bvc_cond.a
    connect not_v.out -> bvc_cond.b

    node bvs_cond: And
    connect cmp_bvs.eq -> bvs_cond.a
    connect flag_v -> bvs_cond.b

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

    node branch_cond_5: Or
    connect branch_cond_4.out -> branch_cond_5.a
    connect bpl_cond.out -> branch_cond_5.b

    node branch_cond_6: Or
    connect branch_cond_5.out -> branch_cond_6.a
    connect bvc_cond.out -> branch_cond_6.b

    node branch_taken: Or
    connect branch_cond_6.out -> branch_taken.a
    connect bvs_cond.out -> branch_taken.b

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
    connect is_imm_any.out -> done_imm.b

    // Exclude RMW instructions from done_zp (they complete at sub4)
    node not_rmw: Not
    connect is_rmw.out -> not_rmw.in

    node is_zp_non_rmw: And
    connect is_zp.out -> is_zp_non_rmw.a
    connect not_rmw.out -> is_zp_non_rmw.b

    node done_zp: And
    connect exec_sub3.out -> done_zp.a
    connect is_zp_non_rmw.out -> done_zp.b

    // RMW instructions (INC/DEC) complete at sub4
    node done_rmw: And
    connect exec_sub4.out -> done_rmw.a
    connect is_rmw.out -> done_rmw.b

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

    // Part 16: PHP/PLP done timing (same as PHA/PLA)
    node done_php: And
    connect exec_sub1.out -> done_php.a
    connect cmp_php.eq -> done_php.b

    node done_plp: And
    connect exec_sub2.out -> done_plp.a
    connect cmp_plp.eq -> done_plp.b

    // Part 17: JMP indirect done at sub4, RTI done at sub5
    node done_jmp_ind: And
    connect exec_sub4.out -> done_jmp_ind.a
    connect cmp_jmp_ind.eq -> done_jmp_ind.b

    node done_rti: And
    connect exec_sub5.out -> done_rti.a
    connect cmp_rti.eq -> done_rti.b

    node done_jsr: And
    connect exec_sub5.out -> done_jsr.a
    connect cmp_jsr.eq -> done_jsr.b

    node done_rts: And
    connect exec_sub5.out -> done_rts.a
    connect cmp_rts.eq -> done_rts.b

    // Part 13: Indirect,X completes at sub5
    node done_ind_x: And
    connect exec_sub5.out -> done_ind_x.a
    connect is_ind_x_final.out -> done_ind_x.b

    // Part 14: Indirect,Y completes at sub5
    node done_ind_y: And
    connect exec_sub5.out -> done_ind_y.a
    connect is_ind_y_final.out -> done_ind_y.b

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

    node exec_done_temp8: Or
    connect exec_done_temp7.out -> exec_done_temp8.a
    connect done_branch.out -> exec_done_temp8.b

    node exec_done_temp9: Or
    connect exec_done_temp8.out -> exec_done_temp9.a
    connect done_rmw.out -> exec_done_temp9.b

    node exec_done_temp10: Or
    connect exec_done_temp9.out -> exec_done_temp10.a
    connect done_ind_x.out -> exec_done_temp10.b

    // Part 14: Add ind,Y to exec_done
    node exec_done_temp11: Or
    connect exec_done_temp10.out -> exec_done_temp11.a
    connect done_ind_y.out -> exec_done_temp11.b

    // Part 16: Add PHP/PLP to exec_done
    node exec_done_temp12: Or
    connect exec_done_temp11.out -> exec_done_temp12.a
    connect done_php.out -> exec_done_temp12.b

    node exec_done_temp13: Or
    connect exec_done_temp12.out -> exec_done_temp13.a
    connect done_plp.out -> exec_done_temp13.b

    // Part 17: Add JMP indirect and RTI to exec_done
    node exec_done_temp14: Or
    connect exec_done_temp13.out -> exec_done_temp14.a
    connect done_jmp_ind.out -> exec_done_temp14.b

    node exec_done: Or
    connect exec_done_temp14.out -> exec_done.a
    connect done_rti.out -> exec_done.b

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
    connect is_imm_any.out -> needs_operand_any.a
    connect is_zp.out -> needs_operand_any.b

    node needs_operand_temp: Or
    connect needs_operand_any.out -> needs_operand_temp.a
    connect is_abs_final.out -> needs_operand_temp.b

    node needs_operand_temp2: Or
    connect needs_operand_temp.out -> needs_operand_temp2.a
    connect cmp_jsr.eq -> needs_operand_temp2.b

    node needs_operand_temp3: Or
    connect needs_operand_temp2.out -> needs_operand_temp3.a
    connect is_branch.out -> needs_operand_temp3.b

    // Part 13: Indirect,X also needs to fetch operand (zp base)
    node needs_operand_temp4: Or
    connect needs_operand_temp3.out -> needs_operand_temp4.a
    connect is_ind_x_final.out -> needs_operand_temp4.b

    // Part 14: Indirect,Y also needs to fetch operand (zp pointer address)
    node needs_operand_temp5: Or
    connect needs_operand_temp4.out -> needs_operand_temp5.a
    connect is_ind_y_final.out -> needs_operand_temp5.b

    // Part 17: JMP indirect needs to fetch the 2-byte pointer address
    node needs_operand: Or
    connect needs_operand_temp5.out -> needs_operand.a
    connect cmp_jmp_ind.eq -> needs_operand.b

    node pc_inc_exec_sub0: And
    connect exec_sub0.out -> pc_inc_exec_sub0.a
    connect needs_operand.out -> pc_inc_exec_sub0.b

    node needs_2nd_byte_temp: Or
    connect is_abs_final.out -> needs_2nd_byte_temp.a
    connect cmp_jsr.eq -> needs_2nd_byte_temp.b

    // Part 17: JMP indirect needs 2nd byte for pointer address
    node needs_2nd_byte: Or
    connect needs_2nd_byte_temp.out -> needs_2nd_byte.a
    connect cmp_jmp_ind.eq -> needs_2nd_byte.b

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

    // Part 10: Memory read for zp,X loads (LDA, ADC, SBC, AND, ORA, EOR, CMP)
    // All zp,X instructions that read memory (everything except STA)
    node is_zp_x_load: And
    node not_sta_zp_x: Not
    connect cmp_sta_zp_x.eq -> not_sta_zp_x.in
    connect is_zp_x_final.out -> is_zp_x_load.a
    connect not_sta_zp_x.out -> is_zp_x_load.b

    node mem_read_zp_x: And
    connect exec_sub2.out -> mem_read_zp_x.a
    connect is_zp_x_load.out -> mem_read_zp_x.b

    // Part 11: Memory read for LDX zp,Y
    node mem_read_zp_y: And
    connect exec_sub2.out -> mem_read_zp_y.a
    connect cmp_ldx_zp_y.eq -> mem_read_zp_y.b

    node mem_read_abs_temp: And
    connect exec_sub3.out -> mem_read_abs_temp.a
    connect cmp_lda_abs.eq -> mem_read_abs_temp.b

    node mem_read_abs_x: And
    connect exec_sub3.out -> mem_read_abs_x.a
    connect cmp_lda_abs_x.eq -> mem_read_abs_x.b

    // Part 12: Memory read for abs,Y loads (all except STA)
    node not_sta_abs_y: Not
    connect cmp_sta_abs_y.eq -> not_sta_abs_y.in

    node is_abs_y_load: And
    connect is_abs_y_final.out -> is_abs_y_load.a
    connect not_sta_abs_y.out -> is_abs_y_load.b

    node mem_read_abs_y: And
    connect exec_sub3.out -> mem_read_abs_y.a
    connect is_abs_y_load.out -> mem_read_abs_y.b

    node mem_read_abs_1: Or
    connect mem_read_abs_temp.out -> mem_read_abs_1.a
    connect mem_read_abs_x.out -> mem_read_abs_1.b

    node mem_read_abs: Or
    connect mem_read_abs_1.out -> mem_read_abs.a
    connect mem_read_abs_y.out -> mem_read_abs.b

    // RMW read at sub2 (same timing as LDA ZP)
    node mem_read_rmw: And
    connect exec_sub2.out -> mem_read_rmw.a
    connect is_rmw.out -> mem_read_rmw.b

    node mem_read_signal_temp1: Or
    connect mem_read_zp.out -> mem_read_signal_temp1.a
    connect mem_read_zp_x.out -> mem_read_signal_temp1.b

    // Part 11: Include zp,Y in mem_read chain
    node mem_read_signal_temp1b: Or
    connect mem_read_signal_temp1.out -> mem_read_signal_temp1b.a
    connect mem_read_zp_y.out -> mem_read_signal_temp1b.b

    node mem_read_signal_temp2: Or
    connect mem_read_signal_temp1b.out -> mem_read_signal_temp2.a
    connect mem_read_abs.out -> mem_read_signal_temp2.b

    node mem_read_signal: Or
    connect mem_read_signal_temp2.out -> mem_read_signal.a
    connect mem_read_rmw.out -> mem_read_signal.b
    connect mem_read_signal.out -> mem_read

    // Memory write
    // STX_ZP, STY_ZP, and STA_ZP_X also write to zero page
    node is_store_zp_1: Or
    connect cmp_sta_zp.eq -> is_store_zp_1.a
    connect cmp_stx_zp.eq -> is_store_zp_1.b

    node is_store_zp_2: Or
    connect is_store_zp_1.out -> is_store_zp_2.a
    connect cmp_sty_zp.eq -> is_store_zp_2.b

    node is_store_zp_3: Or
    connect is_store_zp_2.out -> is_store_zp_3.a
    connect cmp_sta_zp_x.eq -> is_store_zp_3.b

    // Part 11: Include STX zp,Y in store chain
    node is_store_zp: Or
    connect is_store_zp_3.out -> is_store_zp.a
    connect cmp_stx_zp_y.eq -> is_store_zp.b

    node mem_write_zp: And
    connect exec_sub2.out -> mem_write_zp.a
    connect is_store_zp.out -> mem_write_zp.b

    // use_x_for_mem and use_y_for_mem for STX/STY
    // Part 11: STX zp,Y also uses X register for mem data
    node is_stx_any: Or
    connect cmp_stx_zp.eq -> is_stx_any.a
    connect cmp_stx_zp_y.eq -> is_stx_any.b

    node use_x_for_mem_signal: And
    connect exec_sub2.out -> use_x_for_mem_signal.a
    connect is_stx_any.out -> use_x_for_mem_signal.b
    connect use_x_for_mem_signal.out -> use_x_for_mem

    node use_y_for_mem_signal: And
    connect exec_sub2.out -> use_y_for_mem_signal.a
    connect cmp_sty_zp.eq -> use_y_for_mem_signal.b
    connect use_y_for_mem_signal.out -> use_y_for_mem

    node mem_write_abs_temp: And
    connect exec_sub3.out -> mem_write_abs_temp.a
    connect cmp_sta_abs.eq -> mem_write_abs_temp.b

    node mem_write_abs_x: And
    connect exec_sub3.out -> mem_write_abs_x.a
    connect cmp_sta_abs_x.eq -> mem_write_abs_x.b

    // Part 12: Memory write for STA abs,Y
    node mem_write_abs_y: And
    connect exec_sub3.out -> mem_write_abs_y.a
    connect cmp_sta_abs_y.eq -> mem_write_abs_y.b

    node mem_write_abs_1: Or
    connect mem_write_abs_temp.out -> mem_write_abs_1.a
    connect mem_write_abs_x.out -> mem_write_abs_1.b

    node mem_write_abs: Or
    connect mem_write_abs_1.out -> mem_write_abs.a
    connect mem_write_abs_y.out -> mem_write_abs.b

    // RMW write at sub3 (one cycle after read)
    node mem_write_rmw: And
    connect exec_sub3.out -> mem_write_rmw.a
    connect is_rmw.out -> mem_write_rmw.b

    // Part 13: Memory write for STA (ind,X) at sub5
    node mem_write_ind_x: And
    connect exec_sub5.out -> mem_write_ind_x.a
    connect cmp_sta_ind_x.eq -> mem_write_ind_x.b

    // Part 14: Memory write for STA (ind,Y) at sub5
    node mem_write_ind_y: And
    connect exec_sub5.out -> mem_write_ind_y.a
    connect cmp_sta_ind_y.eq -> mem_write_ind_y.b

    node mem_write_signal_temp: Or
    connect mem_write_zp.out -> mem_write_signal_temp.a
    connect mem_write_abs.out -> mem_write_signal_temp.b

    node mem_write_signal_temp2: Or
    connect mem_write_signal_temp.out -> mem_write_signal_temp2.a
    connect mem_write_rmw.out -> mem_write_signal_temp2.b

    node mem_write_signal_temp3: Or
    connect mem_write_signal_temp2.out -> mem_write_signal_temp3.a
    connect mem_write_ind_x.out -> mem_write_signal_temp3.b

    node mem_write_signal: Or
    connect mem_write_signal_temp3.out -> mem_write_signal.a
    connect mem_write_ind_y.out -> mem_write_signal.b
    connect mem_write_signal.out -> mem_write

    // Use RMW data for memory write (same timing as mem_write_rmw)
    connect mem_write_rmw.out -> use_rmw_data

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

    // Part 16: PHP also decrements SP at sub0
    node sp_dec_php: And
    connect exec_sub0.out -> sp_dec_php.a
    connect cmp_php.eq -> sp_dec_php.b

    node sp_dec_temp: Or
    connect sp_dec_pha.out -> sp_dec_temp.a
    connect sp_dec_jsr_sub2.out -> sp_dec_temp.b

    node sp_dec_temp2: Or
    connect sp_dec_temp.out -> sp_dec_temp2.a
    connect sp_dec_jsr_sub3.out -> sp_dec_temp2.b

    node sp_dec_signal: Or
    connect sp_dec_temp2.out -> sp_dec_signal.a
    connect sp_dec_php.out -> sp_dec_signal.b
    connect sp_dec_signal.out -> sp_decrement

    // Stack pointer increment
    node sp_inc_pla: And
    connect exec_sub0.out -> sp_inc_pla.a
    connect cmp_pla.eq -> sp_inc_pla.b

    // Part 16: PLP also increments SP at sub0
    node sp_inc_plp: And
    connect exec_sub0.out -> sp_inc_plp.a
    connect cmp_plp.eq -> sp_inc_plp.b

    node sp_inc_rts_sub0: And
    connect exec_sub0.out -> sp_inc_rts_sub0.a
    connect cmp_rts.eq -> sp_inc_rts_sub0.b

    node sp_inc_rts_sub2: And
    connect exec_sub2.out -> sp_inc_rts_sub2.a
    connect cmp_rts.eq -> sp_inc_rts_sub2.b

    node sp_inc_temp: Or
    connect sp_inc_pla.out -> sp_inc_temp.a
    connect sp_inc_rts_sub0.out -> sp_inc_temp.b

    node sp_inc_temp2: Or
    connect sp_inc_temp.out -> sp_inc_temp2.a
    connect sp_inc_rts_sub2.out -> sp_inc_temp2.b

    node sp_inc_temp3: Or
    connect sp_inc_temp2.out -> sp_inc_temp3.a
    connect sp_inc_plp.out -> sp_inc_temp3.b

    // Part 17: RTI increments SP at sub0, sub2, sub4
    node sp_inc_rti_sub0: And
    connect exec_sub0.out -> sp_inc_rti_sub0.a
    connect cmp_rti.eq -> sp_inc_rti_sub0.b

    node sp_inc_rti_sub2: And
    connect exec_sub2.out -> sp_inc_rti_sub2.a
    connect cmp_rti.eq -> sp_inc_rti_sub2.b

    node sp_inc_rti_sub4: And
    connect exec_sub4.out -> sp_inc_rti_sub4.a
    connect cmp_rti.eq -> sp_inc_rti_sub4.b

    node sp_inc_temp4: Or
    connect sp_inc_temp3.out -> sp_inc_temp4.a
    connect sp_inc_rti_sub0.out -> sp_inc_temp4.b

    node sp_inc_temp5: Or
    connect sp_inc_temp4.out -> sp_inc_temp5.a
    connect sp_inc_rti_sub2.out -> sp_inc_temp5.b

    node sp_inc_signal: Or
    connect sp_inc_temp5.out -> sp_inc_signal.a
    connect sp_inc_rti_sub4.out -> sp_inc_signal.b
    connect sp_inc_signal.out -> sp_increment

    // Stack write
    node stack_write_pha: And
    connect exec_sub0.out -> stack_write_pha.a
    connect cmp_pha.eq -> stack_write_pha.b

    // Part 16: PHP also writes to stack at sub0
    node stack_write_php: And
    connect exec_sub0.out -> stack_write_php.a
    connect cmp_php.eq -> stack_write_php.b

    node stack_write_jsr_hi: And
    connect exec_sub2.out -> stack_write_jsr_hi.a
    connect cmp_jsr.eq -> stack_write_jsr_hi.b

    node stack_write_jsr_lo: And
    connect exec_sub3.out -> stack_write_jsr_lo.a
    connect cmp_jsr.eq -> stack_write_jsr_lo.b

    node stack_write_temp: Or
    connect stack_write_pha.out -> stack_write_temp.a
    connect stack_write_jsr_hi.out -> stack_write_temp.b

    node stack_write_temp2: Or
    connect stack_write_temp.out -> stack_write_temp2.a
    connect stack_write_jsr_lo.out -> stack_write_temp2.b

    node stack_write_signal: Or
    connect stack_write_temp2.out -> stack_write_signal.a
    connect stack_write_php.out -> stack_write_signal.b
    connect stack_write_signal.out -> stack_write

    // Use stack data for A
    node use_stack_signal: And
    connect exec_sub2.out -> use_stack_signal.a
    connect cmp_pla.eq -> use_stack_signal.b
    connect use_stack_signal.out -> use_stack_data

    // Part 16: PLP updates all flags at sub2 (when stack data is available)
    node update_flags_plp_signal: And
    connect exec_sub2.out -> update_flags_plp_signal.a
    connect cmp_plp.eq -> update_flags_plp_signal.b
    connect update_flags_plp_signal.out -> update_flags_plp

    // JSR/RTS PC control
    node jsr_load_pc_signal: And
    connect exec_sub4.out -> jsr_load_pc_signal.a
    connect cmp_jsr.eq -> jsr_load_pc_signal.b
    connect jsr_load_pc_signal.out -> jsr_load_pc

    node rts_load_pc_signal: And
    connect exec_sub4.out -> rts_load_pc_signal.a
    connect cmp_rts.eq -> rts_load_pc_signal.b
    connect rts_load_pc_signal.out -> rts_load_pc

    // Part 17: JMP indirect loads PC from pointer at sub4
    node jmp_ind_load_pc_signal: And
    connect exec_sub4.out -> jmp_ind_load_pc_signal.a
    connect cmp_jmp_ind.eq -> jmp_ind_load_pc_signal.b
    connect jmp_ind_load_pc_signal.out -> jmp_ind_load_pc

    // Part 17: RTI loads PC from stack at sub5
    node rti_load_pc_signal: And
    connect exec_sub5.out -> rti_load_pc_signal.a
    connect cmp_rti.eq -> rti_load_pc_signal.b
    connect rti_load_pc_signal.out -> rti_load_pc

    // Part 17: RTI pulls status at sub1
    node rti_pull_p_signal: And
    connect exec_sub1.out -> rti_pull_p_signal.a
    connect cmp_rti.eq -> rti_pull_p_signal.b
    connect rti_pull_p_signal.out -> rti_pull_p

    // Part 17: RTI updates all flags at sub1 (when stack data is available)
    node update_flags_rti_signal: And
    connect exec_sub1.out -> update_flags_rti_signal.a
    connect cmp_rti.eq -> update_flags_rti_signal.b
    connect update_flags_rti_signal.out -> update_flags_rti

    node push_pc_hi_signal: And
    connect exec_sub2.out -> push_pc_hi_signal.a
    connect cmp_jsr.eq -> push_pc_hi_signal.b
    connect push_pc_hi_signal.out -> push_pc_hi

    node push_pc_lo_signal: And
    connect exec_sub3.out -> push_pc_lo_signal.a
    connect cmp_jsr.eq -> push_pc_lo_signal.b
    connect push_pc_lo_signal.out -> push_pc_lo

    node pull_pc_lo_rts: And
    connect exec_sub1.out -> pull_pc_lo_rts.a
    connect cmp_rts.eq -> pull_pc_lo_rts.b

    // Part 17: RTI pulls PC_lo at sub3 (after P is pulled)
    node pull_pc_lo_rti: And
    connect exec_sub3.out -> pull_pc_lo_rti.a
    connect cmp_rti.eq -> pull_pc_lo_rti.b

    node pull_pc_lo_signal: Or
    connect pull_pc_lo_rts.out -> pull_pc_lo_signal.a
    connect pull_pc_lo_rti.out -> pull_pc_lo_signal.b
    connect pull_pc_lo_signal.out -> pull_pc_lo

    node pull_pc_hi_rts: And
    connect exec_sub3.out -> pull_pc_hi_rts.a
    connect cmp_rts.eq -> pull_pc_hi_rts.b

    // Part 17: RTI pulls PC_hi at sub5
    node pull_pc_hi_rti: And
    connect exec_sub5.out -> pull_pc_hi_rti.a
    connect cmp_rti.eq -> pull_pc_hi_rti.b

    node pull_pc_hi_signal: Or
    connect pull_pc_hi_rts.out -> pull_pc_hi_signal.a
    connect pull_pc_hi_rti.out -> pull_pc_hi_signal.b
    connect pull_pc_hi_signal.out -> pull_pc_hi

    // Branch load PC: at sub1 if branch is taken
    node branch_at_sub1: And
    connect exec_sub1.out -> branch_at_sub1.a
    connect branch_taken.out -> branch_at_sub1.b
    connect branch_at_sub1.out -> branch_load_pc

    // Update flags: for instructions that affect N and Z
    // LDA, AND, ORA, EOR, SBC, ADC at sub1
    node update_flags_lda: And
    connect exec_sub1.out -> update_flags_lda.a
    connect is_imm_lda_5.out -> update_flags_lda.b

    // CMP, CPX, CPY at sub1
    node is_any_compare: Or
    connect cmp_cmp_imm.eq -> is_any_compare.a
    connect cmp_cpx_imm.eq -> is_any_compare.b

    node is_any_compare_2: Or
    connect is_any_compare.out -> is_any_compare_2.a
    connect cmp_cpy_imm.eq -> is_any_compare_2.b

    node update_flags_cmp: And
    connect exec_sub1.out -> update_flags_cmp.a
    connect is_any_compare_2.out -> update_flags_cmp.b

    // Part 10: Flag updates for zp,X instructions at sub3
    // All zp,X instructions that update flags (LDA, ADC, SBC, AND, ORA, EOR, CMP)
    // Not STA (no flag update)
    node is_zp_x_flags_1: Or
    connect cmp_lda_zp_x.eq -> is_zp_x_flags_1.a
    connect cmp_adc_zp_x.eq -> is_zp_x_flags_1.b

    node is_zp_x_flags_2: Or
    connect is_zp_x_flags_1.out -> is_zp_x_flags_2.a
    connect cmp_sbc_zp_x.eq -> is_zp_x_flags_2.b

    node is_zp_x_flags_3: Or
    connect is_zp_x_flags_2.out -> is_zp_x_flags_3.a
    connect cmp_and_zp_x.eq -> is_zp_x_flags_3.b

    node is_zp_x_flags_4: Or
    connect is_zp_x_flags_3.out -> is_zp_x_flags_4.a
    connect cmp_ora_zp_x.eq -> is_zp_x_flags_4.b

    node is_zp_x_flags_5: Or
    connect is_zp_x_flags_4.out -> is_zp_x_flags_5.a
    connect cmp_eor_zp_x.eq -> is_zp_x_flags_5.b

    node is_zp_x_flags_6: Or
    connect is_zp_x_flags_5.out -> is_zp_x_flags_6.a
    connect cmp_cmp_zp_x.eq -> is_zp_x_flags_6.b

    // Part 11: LDX zp,Y also updates flags
    node is_zp_xy_flags: Or
    connect is_zp_x_flags_6.out -> is_zp_xy_flags.a
    connect cmp_ldx_zp_y.eq -> is_zp_xy_flags.b

    node update_flags_zp_xy: And
    connect exec_sub3.out -> update_flags_zp_xy.a
    connect is_zp_xy_flags.out -> update_flags_zp_xy.b

    // Part 12: abs,Y flag updates (LDA, ADC, SBC, AND, ORA, EOR, CMP, LDX - not STA)
    node is_abs_y_flags_1: Or
    connect cmp_lda_abs_y.eq -> is_abs_y_flags_1.a
    connect cmp_adc_abs_y.eq -> is_abs_y_flags_1.b

    node is_abs_y_flags_2: Or
    connect is_abs_y_flags_1.out -> is_abs_y_flags_2.a
    connect cmp_sbc_abs_y.eq -> is_abs_y_flags_2.b

    node is_abs_y_flags_3: Or
    connect is_abs_y_flags_2.out -> is_abs_y_flags_3.a
    connect cmp_and_abs_y.eq -> is_abs_y_flags_3.b

    node is_abs_y_flags_4: Or
    connect is_abs_y_flags_3.out -> is_abs_y_flags_4.a
    connect cmp_ora_abs_y.eq -> is_abs_y_flags_4.b

    node is_abs_y_flags_5: Or
    connect is_abs_y_flags_4.out -> is_abs_y_flags_5.a
    connect cmp_eor_abs_y.eq -> is_abs_y_flags_5.b

    node is_abs_y_flags_6: Or
    connect is_abs_y_flags_5.out -> is_abs_y_flags_6.a
    connect cmp_cmp_abs_y.eq -> is_abs_y_flags_6.b

    node is_abs_y_flags: Or
    connect is_abs_y_flags_6.out -> is_abs_y_flags.a
    connect cmp_ldx_abs_y.eq -> is_abs_y_flags.b

    node update_flags_abs_y: And
    connect exec_sub4.out -> update_flags_abs_y.a
    connect is_abs_y_flags.out -> update_flags_abs_y.b

    // Part 13: ind,X flag updates (LDA, ADC, SBC, AND, ORA, EOR, CMP - not STA)
    node is_ind_x_flags_1: Or
    connect cmp_lda_ind_x.eq -> is_ind_x_flags_1.a
    connect cmp_adc_ind_x.eq -> is_ind_x_flags_1.b

    node is_ind_x_flags_2: Or
    connect is_ind_x_flags_1.out -> is_ind_x_flags_2.a
    connect cmp_sbc_ind_x.eq -> is_ind_x_flags_2.b

    node is_ind_x_flags_3: Or
    connect is_ind_x_flags_2.out -> is_ind_x_flags_3.a
    connect cmp_and_ind_x.eq -> is_ind_x_flags_3.b

    node is_ind_x_flags_4: Or
    connect is_ind_x_flags_3.out -> is_ind_x_flags_4.a
    connect cmp_ora_ind_x.eq -> is_ind_x_flags_4.b

    node is_ind_x_flags_5: Or
    connect is_ind_x_flags_4.out -> is_ind_x_flags_5.a
    connect cmp_eor_ind_x.eq -> is_ind_x_flags_5.b

    node is_ind_x_flags: Or
    connect is_ind_x_flags_5.out -> is_ind_x_flags.a
    connect cmp_cmp_ind_x.eq -> is_ind_x_flags.b

    node update_flags_ind_x: And
    connect exec_sub5.out -> update_flags_ind_x.a
    connect is_ind_x_flags.out -> update_flags_ind_x.b

    // Part 14: ind,Y flag updates (LDA, ADC, SBC, AND, ORA, EOR, CMP - not STA)
    node is_ind_y_flags_1: Or
    connect cmp_lda_ind_y.eq -> is_ind_y_flags_1.a
    connect cmp_adc_ind_y.eq -> is_ind_y_flags_1.b

    node is_ind_y_flags_2: Or
    connect is_ind_y_flags_1.out -> is_ind_y_flags_2.a
    connect cmp_sbc_ind_y.eq -> is_ind_y_flags_2.b

    node is_ind_y_flags_3: Or
    connect is_ind_y_flags_2.out -> is_ind_y_flags_3.a
    connect cmp_and_ind_y.eq -> is_ind_y_flags_3.b

    node is_ind_y_flags_4: Or
    connect is_ind_y_flags_3.out -> is_ind_y_flags_4.a
    connect cmp_ora_ind_y.eq -> is_ind_y_flags_4.b

    node is_ind_y_flags_5: Or
    connect is_ind_y_flags_4.out -> is_ind_y_flags_5.a
    connect cmp_eor_ind_y.eq -> is_ind_y_flags_5.b

    node is_ind_y_flags: Or
    connect is_ind_y_flags_5.out -> is_ind_y_flags.a
    connect cmp_cmp_ind_y.eq -> is_ind_y_flags.b

    node update_flags_ind_y: And
    connect exec_sub5.out -> update_flags_ind_y.a
    connect is_ind_y_flags.out -> update_flags_ind_y.b

    // LDY #imm at sub1
    node update_flags_ldy: And
    connect exec_sub1.out -> update_flags_ldy.a
    connect cmp_ldy_imm.eq -> update_flags_ldy.b

    // LDX #imm at sub1
    node update_flags_ldx: And
    connect exec_sub1.out -> update_flags_ldx.a
    connect cmp_ldx_imm.eq -> update_flags_ldx.b

    // INX, INY, DEX, DEY, TXA, TYA at sub0
    node is_reg_inc_dec: Or
    connect cmp_inx.eq -> is_reg_inc_dec.a
    connect cmp_iny.eq -> is_reg_inc_dec.b

    node is_reg_inc_dec_2: Or
    connect is_reg_inc_dec.out -> is_reg_inc_dec_2.a
    connect cmp_dex.eq -> is_reg_inc_dec_2.b

    node is_reg_inc_dec_3: Or
    connect is_reg_inc_dec_2.out -> is_reg_inc_dec_3.a
    connect cmp_dey.eq -> is_reg_inc_dec_3.b

    node is_reg_inc_dec_4: Or
    connect is_reg_inc_dec_3.out -> is_reg_inc_dec_4.a
    connect cmp_txa.eq -> is_reg_inc_dec_4.b

    node is_reg_inc_dec_5: Or
    connect is_reg_inc_dec_4.out -> is_reg_inc_dec_5.a
    connect cmp_tya.eq -> is_reg_inc_dec_5.b

    node is_reg_inc_dec_6: Or
    connect is_reg_inc_dec_5.out -> is_reg_inc_dec_6.a
    connect cmp_tsx.eq -> is_reg_inc_dec_6.b

    // Shift/rotate instructions also update flags at sub0
    node is_reg_inc_dec_7: Or
    connect is_reg_inc_dec_6.out -> is_reg_inc_dec_7.a
    connect cmp_asl_a.eq -> is_reg_inc_dec_7.b

    node is_reg_inc_dec_8: Or
    connect is_reg_inc_dec_7.out -> is_reg_inc_dec_8.a
    connect cmp_lsr_a.eq -> is_reg_inc_dec_8.b

    node is_reg_inc_dec_9: Or
    connect is_reg_inc_dec_8.out -> is_reg_inc_dec_9.a
    connect cmp_rol_a.eq -> is_reg_inc_dec_9.b

    node is_reg_inc_dec_10: Or
    connect is_reg_inc_dec_9.out -> is_reg_inc_dec_10.a
    connect cmp_ror_a.eq -> is_reg_inc_dec_10.b

    node update_flags_inx: And
    connect exec_sub0.out -> update_flags_inx.a
    connect is_reg_inc_dec_10.out -> update_flags_inx.b

    node update_flags_temp: Or
    connect update_flags_lda.out -> update_flags_temp.a
    connect update_flags_cmp.out -> update_flags_temp.b

    node update_flags_temp2: Or
    connect update_flags_temp.out -> update_flags_temp2.a
    connect update_flags_ldy.out -> update_flags_temp2.b

    node update_flags_temp3: Or
    connect update_flags_temp2.out -> update_flags_temp3.a
    connect update_flags_ldx.out -> update_flags_temp3.b

    // INC/DEC memory update flags at sub3 (when result is ready)
    node update_flags_rmw: And
    connect exec_sub3.out -> update_flags_rmw.a
    connect is_rmw.out -> update_flags_rmw.b

    node update_flags_temp4: Or
    connect update_flags_temp3.out -> update_flags_temp4.a
    connect update_flags_inx.out -> update_flags_temp4.b

    node update_flags_temp5: Or
    connect update_flags_temp4.out -> update_flags_temp5.a
    connect update_flags_rmw.out -> update_flags_temp5.b

    node update_flags_temp6: Or
    connect update_flags_temp5.out -> update_flags_temp6.a
    connect update_flags_zp_xy.out -> update_flags_temp6.b

    node update_flags_temp7: Or
    connect update_flags_temp6.out -> update_flags_temp7.a
    connect update_flags_abs_y.out -> update_flags_temp7.b

    // Part 13: Add ind,X to update_flags chain
    node update_flags_temp8: Or
    connect update_flags_temp7.out -> update_flags_temp8.a
    connect update_flags_ind_x.out -> update_flags_temp8.b

    // Part 14: Add ind,Y to update_flags chain
    node update_flags_temp9: Or
    connect update_flags_temp8.out -> update_flags_temp9.a
    connect update_flags_ind_y.out -> update_flags_temp9.b

    // Part 15: BIT instruction updates flags
    // BIT zp: updates at sub1 (zero-page read timing)
    node update_flags_bit_zp: And
    connect exec_sub1.out -> update_flags_bit_zp.a
    connect cmp_bit_zp.eq -> update_flags_bit_zp.b

    // BIT abs: updates at sub2 (absolute read timing)
    node update_flags_bit_abs: And
    connect exec_sub2.out -> update_flags_bit_abs.a
    connect cmp_bit_abs.eq -> update_flags_bit_abs.b

    node update_flags_bit: Or
    connect update_flags_bit_zp.out -> update_flags_bit.a
    connect update_flags_bit_abs.out -> update_flags_bit.b

    node update_flags_signal: Or
    connect update_flags_temp9.out -> update_flags_signal.a
    connect update_flags_bit.out -> update_flags_signal.b
    connect update_flags_signal.out -> update_flags

    // Part 15: BIT also updates V flag from memory bit 6
    connect update_flags_bit.out -> update_v_bit

    // SEC/CLC: update carry only at sub0
    node is_sec_clc: Or
    connect cmp_sec.eq -> is_sec_clc.a
    connect cmp_clc.eq -> is_sec_clc.b

    node update_c_only_signal: And
    connect exec_sub0.out -> update_c_only_signal.a
    connect is_sec_clc.out -> update_c_only_signal.b
    connect update_c_only_signal.out -> update_c_only

    // Set C for SEC
    node set_c_signal: And
    connect exec_sub0.out -> set_c_signal.a
    connect cmp_sec.eq -> set_c_signal.b
    connect set_c_signal.out -> set_c

    // Clear C for CLC
    node clear_c_signal: And
    connect exec_sub0.out -> clear_c_signal.a
    connect cmp_clc.eq -> clear_c_signal.b
    connect clear_c_signal.out -> clear_c

    // Clear V for CLV
    node clear_v_signal: And
    connect exec_sub0.out -> clear_v_signal.a
    connect cmp_clv.eq -> clear_v_signal.b
    connect clear_v_signal.out -> clear_v

    // Part 16: D and I flag controls
    // Set D for SED
    node set_d_signal: And
    connect exec_sub0.out -> set_d_signal.a
    connect cmp_sed.eq -> set_d_signal.b
    connect set_d_signal.out -> set_d

    // Clear D for CLD
    node clear_d_signal: And
    connect exec_sub0.out -> clear_d_signal.a
    connect cmp_cld.eq -> clear_d_signal.b
    connect clear_d_signal.out -> clear_d

    // Set I for SEI
    node set_i_signal: And
    connect exec_sub0.out -> set_i_signal.a
    connect cmp_sei.eq -> set_i_signal.b
    connect set_i_signal.out -> set_i

    // Clear I for CLI
    node clear_i_signal: And
    connect exec_sub0.out -> clear_i_signal.a
    connect cmp_cli.eq -> clear_i_signal.b
    connect clear_i_signal.out -> clear_i

    // Update D: set_d OR clear_d
    node update_d_signal: Or
    connect set_d_signal.out -> update_d_signal.a
    connect clear_d_signal.out -> update_d_signal.b
    connect update_d_signal.out -> update_d

    // Update I: set_i OR clear_i
    node update_i_signal: Or
    connect set_i_signal.out -> update_i_signal.a
    connect clear_i_signal.out -> update_i_signal.b
    connect update_i_signal.out -> update_i

    // SP load for TXS (transfer X to Stack Pointer)
    node sp_load_signal: And
    connect exec_sub0.out -> sp_load_signal.a
    connect cmp_txs.eq -> sp_load_signal.b
    connect sp_load_signal.out -> sp_load

    // Part 13: Indirect,X control signals
    // ptr_lo_load: at sub3 for ind,X or sub2 for ind,Y
    node ptr_lo_load_ind_x: And
    connect exec_sub3.out -> ptr_lo_load_ind_x.a
    connect is_ind_x_final.out -> ptr_lo_load_ind_x.b

    // Part 14: ptr_lo_load at sub2 for ind,Y
    node ptr_lo_load_ind_y: And
    connect exec_sub2.out -> ptr_lo_load_ind_y.a
    connect is_ind_y_final.out -> ptr_lo_load_ind_y.b

    node ptr_lo_load_temp: Or
    connect ptr_lo_load_ind_x.out -> ptr_lo_load_temp.a
    connect ptr_lo_load_ind_y.out -> ptr_lo_load_temp.b

    // Part 17: JMP indirect loads ptr_lo at sub2 (from memory[addr])
    node ptr_lo_load_jmp_ind: And
    connect exec_sub2.out -> ptr_lo_load_jmp_ind.a
    connect cmp_jmp_ind.eq -> ptr_lo_load_jmp_ind.b

    node ptr_lo_load_signal: Or
    connect ptr_lo_load_temp.out -> ptr_lo_load_signal.a
    connect ptr_lo_load_jmp_ind.out -> ptr_lo_load_signal.b
    connect ptr_lo_load_signal.out -> ptr_lo_load

    // ptr_hi_load: at sub4 for ind,X or sub3 for ind,Y
    node ptr_hi_load_ind_x: And
    connect exec_sub4.out -> ptr_hi_load_ind_x.a
    connect is_ind_x_final.out -> ptr_hi_load_ind_x.b

    // Part 14: ptr_hi_load at sub3 for ind,Y
    node ptr_hi_load_ind_y: And
    connect exec_sub3.out -> ptr_hi_load_ind_y.a
    connect is_ind_y_final.out -> ptr_hi_load_ind_y.b

    node ptr_hi_load_temp: Or
    connect ptr_hi_load_ind_x.out -> ptr_hi_load_temp.a
    connect ptr_hi_load_ind_y.out -> ptr_hi_load_temp.b

    // Part 17: JMP indirect loads ptr_hi at sub3 (from memory[addr+1])
    node ptr_hi_load_jmp_ind: And
    connect exec_sub3.out -> ptr_hi_load_jmp_ind.a
    connect cmp_jmp_ind.eq -> ptr_hi_load_jmp_ind.b

    node ptr_hi_load_signal: Or
    connect ptr_hi_load_temp.out -> ptr_hi_load_signal.a
    connect ptr_hi_load_jmp_ind.out -> ptr_hi_load_signal.b
    connect ptr_hi_load_signal.out -> ptr_hi_load

    // ind_x_sub3: memory address should be (operand+X) for reading ptr_lo
    node ind_x_sub3_signal: And
    connect exec_sub3.out -> ind_x_sub3_signal.a
    connect is_ind_x_final.out -> ind_x_sub3_signal.b
    connect ind_x_sub3_signal.out -> ind_x_sub3

    // ind_x_sub4: memory address should be (operand+X+1) for reading ptr_hi
    node ind_x_sub4_signal: And
    connect exec_sub4.out -> ind_x_sub4_signal.a
    connect is_ind_x_final.out -> ind_x_sub4_signal.b
    connect ind_x_sub4_signal.out -> ind_x_sub4

    // ind_x_sub5: memory address should be the pointer value
    node ind_x_sub5_signal: And
    connect exec_sub5.out -> ind_x_sub5_signal.a
    connect is_ind_x_final.out -> ind_x_sub5_signal.b
    connect ind_x_sub5_signal.out -> ind_x_sub5

    // Part 14: Indirect,Y control signals
    // ind_y_sub2: read ptr_lo from zp[operand]
    node ind_y_sub2_signal: And
    connect exec_sub2.out -> ind_y_sub2_signal.a
    connect is_ind_y_final.out -> ind_y_sub2_signal.b
    connect ind_y_sub2_signal.out -> ind_y_sub2

    // ind_y_sub3: read ptr_hi from zp[operand+1]
    node ind_y_sub3_signal: And
    connect exec_sub3.out -> ind_y_sub3_signal.a
    connect is_ind_y_final.out -> ind_y_sub3_signal.b
    connect ind_y_sub3_signal.out -> ind_y_sub3

    // ind_y_sub4: calculate ptr + Y (using ptr_lo_reg + Y via addr_with_y)
    node ind_y_sub4_signal: And
    connect exec_sub4.out -> ind_y_sub4_signal.a
    connect is_ind_y_final.out -> ind_y_sub4_signal.b
    connect ind_y_sub4_signal.out -> ind_y_sub4

    // ind_y_sub5: final memory access at (ptr + Y)
    node ind_y_sub5_signal: And
    connect exec_sub5.out -> ind_y_sub5_signal.a
    connect is_ind_y_final.out -> ind_y_sub5_signal.b
    connect ind_y_sub5_signal.out -> ind_y_sub5

    // Part 17: JMP indirect subcycle signals
    node jmp_ind_sub2_signal: And
    connect exec_sub2.out -> jmp_ind_sub2_signal.a
    connect cmp_jmp_ind.eq -> jmp_ind_sub2_signal.b
    connect jmp_ind_sub2_signal.out -> jmp_ind_sub2

    node jmp_ind_sub3_signal: And
    connect exec_sub3.out -> jmp_ind_sub3_signal.a
    connect cmp_jmp_ind.eq -> jmp_ind_sub3_signal.b
    connect jmp_ind_sub3_signal.out -> jmp_ind_sub3

    // Register A write - LDA, AND, ORA, EOR
    node write_a_imm: And
    connect exec_sub1.out -> write_a_imm.a
    connect is_imm_lda_4.out -> write_a_imm.b

    node write_a_zp: And
    connect exec_sub3.out -> write_a_zp.a
    connect cmp_lda_zp.eq -> write_a_zp.b

    // zp,X instructions that write to A (LDA, ADC, SBC, AND, ORA, EOR)
    // Not STA (store) or CMP (compare only)
    node is_zp_x_write_a_1: Or
    connect cmp_lda_zp_x.eq -> is_zp_x_write_a_1.a
    connect cmp_adc_zp_x.eq -> is_zp_x_write_a_1.b

    node is_zp_x_write_a_2: Or
    connect is_zp_x_write_a_1.out -> is_zp_x_write_a_2.a
    connect cmp_sbc_zp_x.eq -> is_zp_x_write_a_2.b

    node is_zp_x_write_a_3: Or
    connect is_zp_x_write_a_2.out -> is_zp_x_write_a_3.a
    connect cmp_and_zp_x.eq -> is_zp_x_write_a_3.b

    node is_zp_x_write_a_4: Or
    connect is_zp_x_write_a_3.out -> is_zp_x_write_a_4.a
    connect cmp_ora_zp_x.eq -> is_zp_x_write_a_4.b

    node is_zp_x_write_a: Or
    connect is_zp_x_write_a_4.out -> is_zp_x_write_a.a
    connect cmp_eor_zp_x.eq -> is_zp_x_write_a.b

    node write_a_zp_x: And
    connect exec_sub3.out -> write_a_zp_x.a
    connect is_zp_x_write_a.out -> write_a_zp_x.b

    node write_a_abs_temp: And
    connect exec_sub4.out -> write_a_abs_temp.a
    connect cmp_lda_abs.eq -> write_a_abs_temp.b

    node write_a_abs_x: And
    connect exec_sub4.out -> write_a_abs_x.a
    connect cmp_lda_abs_x.eq -> write_a_abs_x.b

    // Part 12: is_abs_y_write_a chain (LDA, ADC, SBC, AND, ORA, EOR - not STA, CMP, LDX)
    node is_abs_y_write_a_1: Or
    connect cmp_lda_abs_y.eq -> is_abs_y_write_a_1.a
    connect cmp_adc_abs_y.eq -> is_abs_y_write_a_1.b

    node is_abs_y_write_a_2: Or
    connect is_abs_y_write_a_1.out -> is_abs_y_write_a_2.a
    connect cmp_sbc_abs_y.eq -> is_abs_y_write_a_2.b

    node is_abs_y_write_a_3: Or
    connect is_abs_y_write_a_2.out -> is_abs_y_write_a_3.a
    connect cmp_and_abs_y.eq -> is_abs_y_write_a_3.b

    node is_abs_y_write_a_4: Or
    connect is_abs_y_write_a_3.out -> is_abs_y_write_a_4.a
    connect cmp_ora_abs_y.eq -> is_abs_y_write_a_4.b

    node is_abs_y_write_a: Or
    connect is_abs_y_write_a_4.out -> is_abs_y_write_a.a
    connect cmp_eor_abs_y.eq -> is_abs_y_write_a.b

    node write_a_abs_y: And
    connect exec_sub4.out -> write_a_abs_y.a
    connect is_abs_y_write_a.out -> write_a_abs_y.b

    // Part 13: is_ind_x_write_a chain (LDA, ADC, SBC, AND, ORA, EOR - not STA or CMP)
    node is_ind_x_write_a_1: Or
    connect cmp_lda_ind_x.eq -> is_ind_x_write_a_1.a
    connect cmp_adc_ind_x.eq -> is_ind_x_write_a_1.b

    node is_ind_x_write_a_2: Or
    connect is_ind_x_write_a_1.out -> is_ind_x_write_a_2.a
    connect cmp_sbc_ind_x.eq -> is_ind_x_write_a_2.b

    node is_ind_x_write_a_3: Or
    connect is_ind_x_write_a_2.out -> is_ind_x_write_a_3.a
    connect cmp_and_ind_x.eq -> is_ind_x_write_a_3.b

    node is_ind_x_write_a_4: Or
    connect is_ind_x_write_a_3.out -> is_ind_x_write_a_4.a
    connect cmp_ora_ind_x.eq -> is_ind_x_write_a_4.b

    node is_ind_x_write_a: Or
    connect is_ind_x_write_a_4.out -> is_ind_x_write_a.a
    connect cmp_eor_ind_x.eq -> is_ind_x_write_a.b

    node write_a_ind_x: And
    connect exec_sub5.out -> write_a_ind_x.a
    connect is_ind_x_write_a.out -> write_a_ind_x.b

    // Part 14: is_ind_y_write_a chain (LDA, ADC, SBC, AND, ORA, EOR - not STA or CMP)
    node is_ind_y_write_a_1: Or
    connect cmp_lda_ind_y.eq -> is_ind_y_write_a_1.a
    connect cmp_adc_ind_y.eq -> is_ind_y_write_a_1.b

    node is_ind_y_write_a_2: Or
    connect is_ind_y_write_a_1.out -> is_ind_y_write_a_2.a
    connect cmp_sbc_ind_y.eq -> is_ind_y_write_a_2.b

    node is_ind_y_write_a_3: Or
    connect is_ind_y_write_a_2.out -> is_ind_y_write_a_3.a
    connect cmp_and_ind_y.eq -> is_ind_y_write_a_3.b

    node is_ind_y_write_a_4: Or
    connect is_ind_y_write_a_3.out -> is_ind_y_write_a_4.a
    connect cmp_ora_ind_y.eq -> is_ind_y_write_a_4.b

    node is_ind_y_write_a: Or
    connect is_ind_y_write_a_4.out -> is_ind_y_write_a.a
    connect cmp_eor_ind_y.eq -> is_ind_y_write_a.b

    node write_a_ind_y: And
    connect exec_sub5.out -> write_a_ind_y.a
    connect is_ind_y_write_a.out -> write_a_ind_y.b

    node write_a_abs_temp2: Or
    connect write_a_abs_temp.out -> write_a_abs_temp2.a
    connect write_a_abs_x.out -> write_a_abs_temp2.b

    node write_a_abs: Or
    connect write_a_abs_temp2.out -> write_a_abs.a
    connect write_a_abs_y.out -> write_a_abs.b

    node write_a_zp_all: Or
    connect write_a_zp.out -> write_a_zp_all.a
    connect write_a_zp_x.out -> write_a_zp_all.b

    node write_a_temp: Or
    connect write_a_imm.out -> write_a_temp.a
    connect write_a_zp_all.out -> write_a_temp.b

    node write_a_temp2: Or
    connect write_a_temp.out -> write_a_temp2.a
    connect write_a_abs.out -> write_a_temp2.b

    node write_a_pla: And
    connect exec_sub2.out -> write_a_pla.a
    connect cmp_pla.eq -> write_a_pla.b

    // TXA, TYA at sub0
    node write_a_txa: And
    connect exec_sub0.out -> write_a_txa.a
    connect cmp_txa.eq -> write_a_txa.b

    node write_a_tya: And
    connect exec_sub0.out -> write_a_tya.a
    connect cmp_tya.eq -> write_a_tya.b

    node write_a_temp3: Or
    connect write_a_temp2.out -> write_a_temp3.a
    connect write_a_pla.out -> write_a_temp3.b

    node write_a_temp4: Or
    connect write_a_temp3.out -> write_a_temp4.a
    connect write_a_txa.out -> write_a_temp4.b

    node write_a_temp5: Or
    connect write_a_temp4.out -> write_a_temp5.a
    connect write_a_tya.out -> write_a_temp5.b

    // Shift/rotate instructions write to A at sub0
    node is_shift_rotate: Or
    connect cmp_asl_a.eq -> is_shift_rotate.a
    connect cmp_lsr_a.eq -> is_shift_rotate.b

    node is_shift_rotate_2: Or
    connect is_shift_rotate.out -> is_shift_rotate_2.a
    connect cmp_rol_a.eq -> is_shift_rotate_2.b

    node is_shift_rotate_all: Or
    connect is_shift_rotate_2.out -> is_shift_rotate_all.a
    connect cmp_ror_a.eq -> is_shift_rotate_all.b

    node write_a_shift: And
    connect exec_sub0.out -> write_a_shift.a
    connect is_shift_rotate_all.out -> write_a_shift.b

    node write_a_temp6: Or
    connect write_a_temp5.out -> write_a_temp6.a
    connect write_a_shift.out -> write_a_temp6.b

    // Part 13: Add ind,X to write_a chain
    node write_a_temp7: Or
    connect write_a_temp6.out -> write_a_temp7.a
    connect write_a_ind_x.out -> write_a_temp7.b

    // Part 14: Add ind,Y to write_a chain
    node write_a_signal: Or
    connect write_a_temp7.out -> write_a_signal.a
    connect write_a_ind_y.out -> write_a_signal.b
    connect write_a_signal.out -> write_a

    // Register X write - TAX, INX, DEX
    node write_x_tax: And
    connect exec_sub0.out -> write_x_tax.a
    connect cmp_tax.eq -> write_x_tax.b

    node write_x_inx: And
    connect exec_sub0.out -> write_x_inx.a
    connect cmp_inx.eq -> write_x_inx.b

    node write_x_dex: And
    connect exec_sub0.out -> write_x_dex.a
    connect cmp_dex.eq -> write_x_dex.b

    node write_x_tsx: And
    connect exec_sub0.out -> write_x_tsx.a
    connect cmp_tsx.eq -> write_x_tsx.b

    // LDX #imm writes at sub1
    node write_x_ldx_imm: And
    connect exec_sub1.out -> write_x_ldx_imm.a
    connect cmp_ldx_imm.eq -> write_x_ldx_imm.b

    // Part 11: LDX zp,Y writes at sub3
    node write_x_ldx_zp_y: And
    connect exec_sub3.out -> write_x_ldx_zp_y.a
    connect cmp_ldx_zp_y.eq -> write_x_ldx_zp_y.b

    // Part 12: LDX abs,Y writes at sub4
    node write_x_ldx_abs_y: And
    connect exec_sub4.out -> write_x_ldx_abs_y.a
    connect cmp_ldx_abs_y.eq -> write_x_ldx_abs_y.b

    node write_x_temp: Or
    connect write_x_tax.out -> write_x_temp.a
    connect write_x_inx.out -> write_x_temp.b

    node write_x_temp2: Or
    connect write_x_temp.out -> write_x_temp2.a
    connect write_x_dex.out -> write_x_temp2.b

    node write_x_temp3: Or
    connect write_x_temp2.out -> write_x_temp3.a
    connect write_x_tsx.out -> write_x_temp3.b

    node write_x_temp4: Or
    connect write_x_temp3.out -> write_x_temp4.a
    connect write_x_ldx_imm.out -> write_x_temp4.b

    node write_x_temp5: Or
    connect write_x_temp4.out -> write_x_temp5.a
    connect write_x_ldx_zp_y.out -> write_x_temp5.b

    node write_x_signal: Or
    connect write_x_temp5.out -> write_x_signal.a
    connect write_x_ldx_abs_y.out -> write_x_signal.b
    connect write_x_signal.out -> write_x

    // Register Y write - INY, DEY, LDY #imm
    node write_y_iny: And
    connect exec_sub0.out -> write_y_iny.a
    connect cmp_iny.eq -> write_y_iny.b

    node write_y_dey: And
    connect exec_sub0.out -> write_y_dey.a
    connect cmp_dey.eq -> write_y_dey.b

    node write_y_ldy_imm: And
    connect exec_sub1.out -> write_y_ldy_imm.a
    connect cmp_ldy_imm.eq -> write_y_ldy_imm.b

    node write_y_temp: Or
    connect write_y_iny.out -> write_y_temp.a
    connect write_y_dey.out -> write_y_temp.b

    node write_y_signal: Or
    connect write_y_temp.out -> write_y_signal.a
    connect write_y_ldy_imm.out -> write_y_signal.b
    connect write_y_signal.out -> write_y
  }
}

// === Complete Stage 6 CPU ===
circuit Stage6CPU {
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
  output reg_y: Bus[8]
  output reg_sp: Bus[8]
  output flag_n: Bit
  output flag_z: Bit
  output flag_c: Bit
  output flag_v: Bit
  output flag_d: Bit
  output flag_i: Bit

  clock clk

  impl {
    // Program counter
    node pc_reg: Register
    connect clk -> pc_reg.clk
    node always_on: Constant(value=1)

    node pc_inc: Incrementer
    connect pc_reg.q -> pc_inc.in

    // ROM - Test program: Stage 6 test (includes PHP/PLP test)
    // $00: SEC           (38)    - Set carry (C=1)
    // $01: SEI           (78)    - Set interrupt disable (I=1)
    // $02: PHP           (08)    - Push processor status to stack
    // $03: CLC           (18)    - Clear carry (C=0)
    // $04: CLI           (58)    - Clear interrupt disable (I=0)
    // $05: PLP           (28)    - Pull processor status (C=1, I=1 restored)
    // $06: LDA #$0F      (A9 0F) - Load 0x0F into A
    // $08: AND #$F0      (29 F0) - A = A AND F0 = 0x00 (Z=1)
    // $0A: ORA #$F0      (09 F0) - A = A OR F0 = 0xF0 (N=1)
    // $0C: INY           (C8)    - Y++ = 1
    // $0D: INY           (C8)    - Y++ = 2
    // $0E: DEX           (CA)    - X-- = FF (from 0, wraps)
    // $0F: NOP           (EA)    - Do nothing
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

    // Program bytes (PHP/PLP test + logic ops)
    node byte_0: Constant(value=56)    // SEC (0x38)
    node byte_1: Constant(value=120)   // SEI (0x78)
    node byte_2: Constant(value=8)     // PHP (0x08)
    node byte_3: Constant(value=24)    // CLC (0x18)
    node byte_4: Constant(value=88)    // CLI (0x58)
    node byte_5: Constant(value=40)    // PLP (0x28)
    node byte_6: Constant(value=169)   // LDA #imm (0xA9)
    node byte_7: Constant(value=15)    // 0x0F
    node byte_8: Constant(value=41)    // AND #imm (0x29)
    node byte_9: Constant(value=240)   // 0xF0
    node byte_10: Constant(value=9)    // ORA #imm (0x09)
    node byte_11: Constant(value=240)  // 0xF0
    node byte_12: Constant(value=200)  // INY (0xC8)
    node byte_13: Constant(value=200)  // INY (0xC8)
    node byte_14: Constant(value=202)  // DEX (0xCA)
    node byte_15: Constant(value=234)  // NOP (0xEA)

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

    // Part 11: Y-indexed addressing
    node addr_with_y: Adder
    connect addr_lo_reg.q -> addr_with_y.a
    connect registers.reg_y -> addr_with_y.b
    connect zero.out -> addr_with_y.carry_in

    // Part 13: Indirect,X address calculation
    // ind_x_zp_addr = (operand + X) & 0xFF - zero-page address where pointer is stored
    node ind_x_zp_addr: Adder
    connect operand_reg.q -> ind_x_zp_addr.a
    connect registers.reg_x -> ind_x_zp_addr.b
    connect zero.out -> ind_x_zp_addr.carry_in

    // ind_x_zp_addr_plus1 = (operand + X + 1) & 0xFF - for reading high byte of pointer
    node ind_x_zp_addr_plus1: Incrementer
    connect ind_x_zp_addr.sum -> ind_x_zp_addr_plus1.in

    // Pointer registers - hold the pointer value read from zero page
    node ptr_lo_reg: Register
    connect clk -> ptr_lo_reg.clk

    node ptr_hi_reg: Register
    connect clk -> ptr_hi_reg.clk

    // Control FSM
    node control: Stage6Control
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

    // SP load: either reset (to 255) or TXS (from X)
    node sp_load_or_reset: Or
    connect reset -> sp_load_or_reset.a
    connect control.sp_load -> sp_load_or_reset.b
    connect sp_load_or_reset.out -> sp.load

    // SP load value: 255 on reset, X register on TXS
    node sp_init: Constant(value=255)
    node sp_load_value_mux: Mux
    connect control.sp_load -> sp_load_value_mux.sel
    connect sp_init.out -> sp_load_value_mux.in0
    connect registers.reg_x -> sp_load_value_mux.in1
    connect sp_load_value_mux.out -> sp.load_value

    // Stack Memory
    node stack: StackMemory
    connect clk -> stack.clk
    connect sp.sp -> stack.addr

    // PC-1 for JSR return address
    node pc_minus_1: Subtractor
    connect pc_reg.q -> pc_minus_1.a
    node one_const: Constant(value=1)
    connect one_const.out -> pc_minus_1.b
    connect zero.out -> pc_minus_1.borrow_in

    // Part 16: Create status byte for PHP (format: NV1BDIZC)
    // Bit 5 is always 1, Bit 4 (B flag) is 1 for PHP
    node const_one: Constant(value=1)
    node status_byte: Combiner8to8
    connect flags.flag_c -> status_byte.bit0    // C = bit 0
    connect flags.flag_z -> status_byte.bit1    // Z = bit 1
    connect flags.flag_i -> status_byte.bit2    // I = bit 2
    connect flags.flag_d -> status_byte.bit3    // D = bit 3
    connect const_one.out -> status_byte.bit4   // B = bit 4 (always 1 for PHP)
    connect const_one.out -> status_byte.bit5   // Unused = bit 5 (always 1)
    connect flags.flag_v -> status_byte.bit6    // V = bit 6
    connect flags.flag_n -> status_byte.bit7    // N = bit 7

    // Stack data input mux
    node stack_data_pha_or_lo: Mux
    connect control.push_pc_lo -> stack_data_pha_or_lo.sel
    connect registers.reg_a -> stack_data_pha_or_lo.in0
    connect pc_minus_1.difference -> stack_data_pha_or_lo.in1

    // Add PHP status byte to stack data mux
    node stack_data_with_php: Mux
    connect control.is_php -> stack_data_with_php.sel
    connect stack_data_pha_or_lo.out -> stack_data_with_php.in0
    connect status_byte.out -> stack_data_with_php.in1

    node stack_data_final: Mux
    connect control.push_pc_hi -> stack_data_final.sel
    connect stack_data_with_php.out -> stack_data_final.in0
    connect zero.out -> stack_data_final.in1

    connect stack_data_final.out -> stack.data_in
    connect control.stack_write -> stack.write_enable

    // Part 16: Split stack byte for PLP (extract individual flags)
    node stack_bits: Splitter8to8
    connect stack.data_out -> stack_bits.in

    // Save stack data to temp registers for RTS
    connect stack.data_out -> pc_lo_temp.data
    connect control.pull_pc_lo -> pc_lo_temp.we
    connect stack.data_out -> pc_hi_temp.data
    connect control.pull_pc_hi -> pc_hi_temp.we

    // Address selection
    // For abs,X or zp,X: use addr_lo_reg + X
    node use_indexed_x_temp: Or
    connect control.is_lda_abs_x -> use_indexed_x_temp.a
    connect control.is_zp_x -> use_indexed_x_temp.b

    // Part 18: Add shift abs,X to indexed X addressing
    node use_indexed_x_temp2: Or
    connect use_indexed_x_temp.out -> use_indexed_x_temp2.a
    connect control.is_shift_abs_x -> use_indexed_x_temp2.b

    // Part 19: Add INC/DEC abs,X to indexed X addressing
    node use_indexed_x_temp3: Or
    connect use_indexed_x_temp2.out -> use_indexed_x_temp3.a
    connect control.is_inc_dec_abs_x -> use_indexed_x_temp3.b

    // Part 21: Add LDY abs,X to indexed X addressing
    node use_indexed_x: Or
    connect use_indexed_x_temp3.out -> use_indexed_x.a
    connect control.is_ldy_abs_x -> use_indexed_x.b

    node effective_addr_x: Mux
    connect use_indexed_x.out -> effective_addr_x.sel
    connect addr_lo_reg.q -> effective_addr_x.in0
    connect addr_with_x.sum -> effective_addr_x.in1

    // Part 11/12: For zp,Y or abs,Y: use addr_lo_reg + Y
    node use_indexed_y: Or
    connect control.is_zp_y -> use_indexed_y.a
    connect control.is_abs_y -> use_indexed_y.b

    node effective_addr_y: Mux
    connect use_indexed_y.out -> effective_addr_y.sel
    connect effective_addr_x.out -> effective_addr_y.in0
    connect addr_with_y.sum -> effective_addr_y.in1

    // Part 12: Handle STA abs,X and STA abs,Y
    node is_sta_abs_xy: Or
    connect control.is_sta_abs_x -> is_sta_abs_xy.a
    connect control.is_sta_abs_y -> is_sta_abs_xy.b

    node sta_abs_addr: Mux
    connect control.is_sta_abs_y -> sta_abs_addr.sel
    connect addr_with_x.sum -> sta_abs_addr.in0
    connect addr_with_y.sum -> sta_abs_addr.in1

    node effective_addr_final: Mux
    connect is_sta_abs_xy.out -> effective_addr_final.sel
    connect effective_addr_y.out -> effective_addr_final.in0
    connect sta_abs_addr.out -> effective_addr_final.in1

    connect registers.reg_x -> addr_with_x.b

    // Part 13: Indirect,X address muxing
    // At sub3: use ind_x_zp_addr (operand + X) to read ptr_lo
    // At sub4: use ind_x_zp_addr_plus1 (operand + X + 1) to read ptr_hi
    // At sub5: use ptr_lo_reg (the target address)
    node ind_x_addr_sub4: Mux
    connect control.ind_x_sub4 -> ind_x_addr_sub4.sel
    connect ind_x_zp_addr.sum -> ind_x_addr_sub4.in0
    connect ind_x_zp_addr_plus1.out -> ind_x_addr_sub4.in1

    node ind_x_addr_sub5: Mux
    connect control.ind_x_sub5 -> ind_x_addr_sub5.sel
    connect ind_x_addr_sub4.out -> ind_x_addr_sub5.in0
    connect ptr_lo_reg.q -> ind_x_addr_sub5.in1

    // Select between normal address and ind,X address
    node use_ind_x_addr: Or
    connect control.ind_x_sub3 -> use_ind_x_addr.a
    connect control.ind_x_sub4 -> use_ind_x_addr.b

    node use_ind_x_addr_all: Or
    connect use_ind_x_addr.out -> use_ind_x_addr_all.a
    connect control.ind_x_sub5 -> use_ind_x_addr_all.b

    // Part 14: Indirect,Y address muxing
    // At sub2: use operand (zp address to read ptr_lo)
    // At sub3: use operand+1 (zp address to read ptr_hi)
    // At sub5: use ptr_lo + Y (final address with Y offset)
    node operand_plus_1: Incrementer
    connect operand_reg.q -> operand_plus_1.in

    // ptr + Y for final address
    node ptr_with_y: Adder
    connect ptr_lo_reg.q -> ptr_with_y.a
    connect registers.reg_y -> ptr_with_y.b
    connect zero.out -> ptr_with_y.carry_in

    // sub3 uses operand+1
    node ind_y_addr_sub3: Mux
    connect control.ind_y_sub3 -> ind_y_addr_sub3.sel
    connect operand_reg.q -> ind_y_addr_sub3.in0
    connect operand_plus_1.out -> ind_y_addr_sub3.in1

    // sub5 uses ptr + Y
    node ind_y_addr_sub5: Mux
    connect control.ind_y_sub5 -> ind_y_addr_sub5.sel
    connect ind_y_addr_sub3.out -> ind_y_addr_sub5.in0
    connect ptr_with_y.sum -> ind_y_addr_sub5.in1

    node use_ind_y_addr: Or
    connect control.ind_y_sub2 -> use_ind_y_addr.a
    connect control.ind_y_sub3 -> use_ind_y_addr.b

    node use_ind_y_addr_all: Or
    connect use_ind_y_addr.out -> use_ind_y_addr_all.a
    connect control.ind_y_sub5 -> use_ind_y_addr_all.b

    // Combine ind,X and ind,Y address selection
    node use_indirect_addr: Or
    connect use_ind_x_addr_all.out -> use_indirect_addr.a
    connect use_ind_y_addr_all.out -> use_indirect_addr.b

    // Select ind,X or ind,Y address
    node indirect_addr: Mux
    connect use_ind_y_addr_all.out -> indirect_addr.sel
    connect ind_x_addr_sub5.out -> indirect_addr.in0
    connect ind_y_addr_sub5.out -> indirect_addr.in1

    node memory_addr_temp: Mux
    connect use_indirect_addr.out -> memory_addr_temp.sel
    connect effective_addr_final.out -> memory_addr_temp.in0
    connect indirect_addr.out -> memory_addr_temp.in1

    // Part 17: JMP indirect address selection
    // sub2: use addr_lo_reg (the pointer address)
    // sub3: use addr_lo_reg + 1 (next byte of pointer)
    node addr_lo_plus_1: Incrementer
    connect addr_lo_reg.q -> addr_lo_plus_1.in

    node jmp_ind_addr: Mux
    connect control.jmp_ind_sub3 -> jmp_ind_addr.sel
    connect addr_lo_reg.q -> jmp_ind_addr.in0
    connect addr_lo_plus_1.out -> jmp_ind_addr.in1

    node use_jmp_ind_addr: Or
    connect control.jmp_ind_sub2 -> use_jmp_ind_addr.a
    connect control.jmp_ind_sub3 -> use_jmp_ind_addr.b

    node memory_addr: Mux
    connect use_jmp_ind_addr.out -> memory_addr.sel
    connect memory_addr_temp.out -> memory_addr.in0
    connect jmp_ind_addr.out -> memory_addr.in1

    // Connect pointer registers
    connect memory.data_out -> ptr_lo_reg.data
    connect control.ptr_lo_load -> ptr_lo_reg.we
    connect memory.data_out -> ptr_hi_reg.data
    connect control.ptr_hi_load -> ptr_hi_reg.we

    // Data Memory
    node memory: SimpleMemory
    connect clk -> memory.clk
    connect memory_addr.out -> memory.addr
    connect control.mem_write -> memory.write_enable

    // Memory data_in mux: select A (default), X (STX), or Y (STY)
    node mem_data_x_mux: Mux
    connect control.use_x_for_mem -> mem_data_x_mux.sel
    connect registers.reg_a -> mem_data_x_mux.in0
    connect registers.reg_x -> mem_data_x_mux.in1

    node mem_data_y_mux: Mux
    connect control.use_y_for_mem -> mem_data_y_mux.sel
    connect mem_data_x_mux.out -> mem_data_y_mux.in0
    connect registers.reg_y -> mem_data_y_mux.in1

    // INC/DEC memory logic for RMW instructions
    node inc_mem: Incrementer
    connect memory.data_out -> inc_mem.in

    node dec_mem: Subtractor
    connect memory.data_out -> dec_mem.a
    connect one_const.out -> dec_mem.b
    connect zero.out -> dec_mem.borrow_in

    // Part 9: Shift/Rotate memory logic for RMW instructions
    // Split memory data into bits for carry extraction
    node mem_bits: Splitter8to8
    connect memory.data_out -> mem_bits.in

    // ASL memory: shift left
    node mem_shift_one: Constant(value=1)
    node asl_mem_result: LeftShifter
    connect memory.data_out -> asl_mem_result.value
    connect mem_shift_one.out -> asl_mem_result.shift

    // LSR memory: shift right
    node lsr_mem_result: RightShifter
    connect memory.data_out -> lsr_mem_result.value
    connect mem_shift_one.out -> lsr_mem_result.shift

    // ROL memory: (M << 1) + C
    node rol_mem_adder: Adder
    connect asl_mem_result.result -> rol_mem_adder.a
    connect zero.out -> rol_mem_adder.b
    connect flags.flag_c -> rol_mem_adder.carry_in

    // ROR memory: (M >> 1) + (C ? 128 : 0)
    node mem_c_times_128: Constant(value=128)
    node ror_mem_add_val: Mux
    connect flags.flag_c -> ror_mem_add_val.sel
    connect zero.out -> ror_mem_add_val.in0
    connect mem_c_times_128.out -> ror_mem_add_val.in1

    node ror_mem_adder: Adder
    connect lsr_mem_result.result -> ror_mem_adder.a
    connect ror_mem_add_val.out -> ror_mem_adder.b
    connect zero.out -> ror_mem_adder.carry_in

    // RMW result mux chain: INC, DEC, ASL, LSR, ROL, ROR
    node rmw_inc_or_dec: Mux
    connect control.is_inc_zp -> rmw_inc_or_dec.sel
    connect dec_mem.difference -> rmw_inc_or_dec.in0
    connect inc_mem.out -> rmw_inc_or_dec.in1

    node rmw_or_asl: Mux
    connect control.is_asl_zp -> rmw_or_asl.sel
    connect rmw_inc_or_dec.out -> rmw_or_asl.in0
    connect asl_mem_result.result -> rmw_or_asl.in1

    node rmw_or_lsr: Mux
    connect control.is_lsr_zp -> rmw_or_lsr.sel
    connect rmw_or_asl.out -> rmw_or_lsr.in0
    connect lsr_mem_result.result -> rmw_or_lsr.in1

    node rmw_or_rol: Mux
    connect control.is_rol_zp -> rmw_or_rol.sel
    connect rmw_or_lsr.out -> rmw_or_rol.in0
    connect rol_mem_adder.sum -> rmw_or_rol.in1

    node rmw_result: Mux
    connect control.is_ror_zp -> rmw_result.sel
    connect rmw_or_rol.out -> rmw_result.in0
    connect ror_mem_adder.sum -> rmw_result.in1

    // Final memory data mux: use RMW result when writing back
    node mem_data_rmw_mux: Mux
    connect control.use_rmw_data -> mem_data_rmw_mux.sel
    connect mem_data_y_mux.out -> mem_data_rmw_mux.in0
    connect rmw_result.out -> mem_data_rmw_mux.in1

    connect mem_data_rmw_mux.out -> memory.data_in

    // Incrementer for INX
    node inc_x: Incrementer
    connect registers.reg_x -> inc_x.in

    // Decrementer for DEX
    node dec_x: Subtractor
    connect registers.reg_x -> dec_x.a
    connect one_const.out -> dec_x.b
    connect zero.out -> dec_x.borrow_in

    // Incrementer for INY
    node inc_y: Incrementer
    connect registers.reg_y -> inc_y.in

    // Decrementer for DEY
    node dec_y: Subtractor
    connect registers.reg_y -> dec_y.a
    connect one_const.out -> dec_y.b
    connect zero.out -> dec_y.borrow_in

    // Incrementer for RTS PC+1 fix
    node rts_pc_plus1: Incrementer
    connect pc_lo_temp.q -> rts_pc_plus1.in

    // Branch target calculation: PC + offset
    node branch_adder: Adder
    connect pc_reg.q -> branch_adder.a
    connect operand_reg.q -> branch_adder.b
    connect zero.out -> branch_adder.carry_in

    // ALU operand B - select between immediate (operand_reg.q) and memory (for zp,X)
    // For zp,X instructions, ALU gets its operand from memory.data_out
    node is_zp_x_alu: Or
    connect control.is_adc_zp_x -> is_zp_x_alu.a
    connect control.is_sbc_zp_x -> is_zp_x_alu.b

    node is_zp_x_alu_2: Or
    connect is_zp_x_alu.out -> is_zp_x_alu_2.a
    connect control.is_and_zp_x -> is_zp_x_alu_2.b

    node is_zp_x_alu_3: Or
    connect is_zp_x_alu_2.out -> is_zp_x_alu_3.a
    connect control.is_ora_zp_x -> is_zp_x_alu_3.b

    node is_zp_x_alu_4: Or
    connect is_zp_x_alu_3.out -> is_zp_x_alu_4.a
    connect control.is_eor_zp_x -> is_zp_x_alu_4.b

    node is_zp_x_alu_5: Or
    connect is_zp_x_alu_4.out -> is_zp_x_alu_5.a
    connect control.is_cmp_zp_x -> is_zp_x_alu_5.b

    // Part 12: Add abs,Y ALU operations
    node is_abs_y_alu_1: Or
    connect control.is_adc_abs_y -> is_abs_y_alu_1.a
    connect control.is_sbc_abs_y -> is_abs_y_alu_1.b

    node is_abs_y_alu_2: Or
    connect is_abs_y_alu_1.out -> is_abs_y_alu_2.a
    connect control.is_and_abs_y -> is_abs_y_alu_2.b

    node is_abs_y_alu_3: Or
    connect is_abs_y_alu_2.out -> is_abs_y_alu_3.a
    connect control.is_ora_abs_y -> is_abs_y_alu_3.b

    node is_abs_y_alu_4: Or
    connect is_abs_y_alu_3.out -> is_abs_y_alu_4.a
    connect control.is_eor_abs_y -> is_abs_y_alu_4.b

    node is_abs_y_alu: Or
    connect is_abs_y_alu_4.out -> is_abs_y_alu.a
    connect control.is_cmp_abs_y -> is_abs_y_alu.b

    // Part 13: Indirect,X ALU operations (ADC, SBC, AND, ORA, EOR, CMP)
    node is_ind_x_alu_1: Or
    connect control.is_adc_ind_x -> is_ind_x_alu_1.a
    connect control.is_sbc_ind_x -> is_ind_x_alu_1.b

    node is_ind_x_alu_2: Or
    connect is_ind_x_alu_1.out -> is_ind_x_alu_2.a
    connect control.is_and_ind_x -> is_ind_x_alu_2.b

    node is_ind_x_alu_3: Or
    connect is_ind_x_alu_2.out -> is_ind_x_alu_3.a
    connect control.is_ora_ind_x -> is_ind_x_alu_3.b

    node is_ind_x_alu_4: Or
    connect is_ind_x_alu_3.out -> is_ind_x_alu_4.a
    connect control.is_eor_ind_x -> is_ind_x_alu_4.b

    node is_ind_x_alu: Or
    connect is_ind_x_alu_4.out -> is_ind_x_alu.a
    connect control.is_cmp_ind_x -> is_ind_x_alu.b

    // Part 14: Indirect,Y ALU operations (ADC, SBC, AND, ORA, EOR, CMP)
    node is_ind_y_alu_1: Or
    connect control.is_adc_ind_y -> is_ind_y_alu_1.a
    connect control.is_sbc_ind_y -> is_ind_y_alu_1.b

    node is_ind_y_alu_2: Or
    connect is_ind_y_alu_1.out -> is_ind_y_alu_2.a
    connect control.is_and_ind_y -> is_ind_y_alu_2.b

    node is_ind_y_alu_3: Or
    connect is_ind_y_alu_2.out -> is_ind_y_alu_3.a
    connect control.is_ora_ind_y -> is_ind_y_alu_3.b

    node is_ind_y_alu_4: Or
    connect is_ind_y_alu_3.out -> is_ind_y_alu_4.a
    connect control.is_eor_ind_y -> is_ind_y_alu_4.b

    node is_ind_y_alu: Or
    connect is_ind_y_alu_4.out -> is_ind_y_alu.a
    connect control.is_cmp_ind_y -> is_ind_y_alu.b

    // Combine zp,X, abs,Y, ind,X, and ind,Y for memory-based ALU operand
    node is_mem_alu_temp: Or
    connect is_zp_x_alu_5.out -> is_mem_alu_temp.a
    connect is_abs_y_alu.out -> is_mem_alu_temp.b

    node is_mem_alu_temp2: Or
    connect is_mem_alu_temp.out -> is_mem_alu_temp2.a
    connect is_ind_x_alu.out -> is_mem_alu_temp2.b

    node is_mem_alu: Or
    connect is_mem_alu_temp2.out -> is_mem_alu.a
    connect is_ind_y_alu.out -> is_mem_alu.b

    node alu_b_operand: Mux
    connect is_mem_alu.out -> alu_b_operand.sel
    connect operand_reg.q -> alu_b_operand.in0
    connect memory.data_out -> alu_b_operand.in1

    // ALU operations for AND, ORA, EOR
    node and_result: BusAnd
    connect registers.reg_a -> and_result.a
    connect alu_b_operand.out -> and_result.b

    node ora_result: BusOr
    connect registers.reg_a -> ora_result.a
    connect alu_b_operand.out -> ora_result.b

    node eor_result: BusXor
    connect registers.reg_a -> eor_result.a
    connect alu_b_operand.out -> eor_result.b

    // SBC: A - M - !C (borrow_in = NOT carry)
    node not_carry: Not
    connect flags.flag_c -> not_carry.in

    node sbc_result: Subtractor
    connect registers.reg_a -> sbc_result.a
    connect alu_b_operand.out -> sbc_result.b
    connect not_carry.out -> sbc_result.borrow_in

    // ADC: A + M + C (carry_in = carry)
    node adc_result: Adder
    connect registers.reg_a -> adc_result.a
    connect alu_b_operand.out -> adc_result.b
    connect flags.flag_c -> adc_result.carry_in

    // Part 22: V flag computation for ADC/SBC
    // V (overflow) = (A[7] == M[7]) AND (result[7] != A[7]) for ADC
    // V (overflow) = (A[7] != M[7]) AND (result[7] != A[7]) for SBC

    // Split operand and results to extract bit 7
    node operand_bits: Splitter8to8
    connect alu_b_operand.out -> operand_bits.in

    node adc_result_bits: Splitter8to8
    connect adc_result.sum -> adc_result_bits.in

    node sbc_result_bits: Splitter8to8
    connect sbc_result.difference -> sbc_result_bits.in

    // Split A register to get bit 7 (reusing a_bits defined below)
    node a_reg_bits: Splitter8to8
    connect registers.reg_a -> a_reg_bits.in

    // ADC overflow: V = (A[7] == M[7]) AND (result[7] != A[7])
    // Step 1: a_sign_xor_m = A[7] XOR M[7]
    node adc_a_xor_m: Xor
    connect a_reg_bits.bit7 -> adc_a_xor_m.a
    connect operand_bits.bit7 -> adc_a_xor_m.b

    // Step 2: same_sign = NOT(A[7] XOR M[7])
    node adc_same_sign: Not
    connect adc_a_xor_m.out -> adc_same_sign.in

    // Step 3: a_xor_result = A[7] XOR result[7]
    node adc_a_xor_result: Xor
    connect a_reg_bits.bit7 -> adc_a_xor_result.a
    connect adc_result_bits.bit7 -> adc_a_xor_result.b

    // Step 4: V_adc = same_sign AND (A[7] XOR result[7])
    node v_adc: And
    connect adc_same_sign.out -> v_adc.a
    connect adc_a_xor_result.out -> v_adc.b

    // SBC overflow: V = (A[7] != M[7]) AND (result[7] != A[7])
    // Step 1: diff_sign = A[7] XOR M[7] (already computed as adc_a_xor_m)

    // Step 2: a_xor_sbc_result = A[7] XOR sbc_result[7]
    node sbc_a_xor_result: Xor
    connect a_reg_bits.bit7 -> sbc_a_xor_result.a
    connect sbc_result_bits.bit7 -> sbc_a_xor_result.b

    // Step 3: V_sbc = diff_sign AND (A[7] XOR result[7])
    node v_sbc: And
    connect adc_a_xor_m.out -> v_sbc.a
    connect sbc_a_xor_result.out -> v_sbc.b

    // Shift/Rotate operations
    // Split A into individual bits for carry flag extraction
    node a_bits: Splitter8to8
    connect registers.reg_a -> a_bits.in

    // ASL: shift left, bit 0 = 0 (use LeftShifter with shift=1)
    node shift_one: Constant(value=1)
    node asl_result: LeftShifter
    connect registers.reg_a -> asl_result.value
    connect shift_one.out -> asl_result.shift

    // LSR: shift right, bit 7 = 0 (use RightShifter with shift=1)
    node lsr_result: RightShifter
    connect registers.reg_a -> lsr_result.value
    connect shift_one.out -> lsr_result.shift

    // ROL: shift left, bit 0 = old C
    // ROL result = (A << 1) + C (since C is 0 or 1)
    node rol_adder: Adder
    connect asl_result.result -> rol_adder.a
    connect zero.out -> rol_adder.b
    connect flags.flag_c -> rol_adder.carry_in

    // ROR: shift right, bit 7 = old C
    // ROR result = (A >> 1) + (C ? 128 : 0)
    node c_times_128: Constant(value=128)
    node ror_add_val: Mux
    connect flags.flag_c -> ror_add_val.sel
    connect zero.out -> ror_add_val.in0
    connect c_times_128.out -> ror_add_val.in1

    node ror_adder: Adder
    connect lsr_result.result -> ror_adder.a
    connect ror_add_val.out -> ror_adder.b
    connect zero.out -> ror_adder.carry_in

    // Data source for A register - now with AND/ORA/EOR/SBC/ADC/shifts
    // Combine immediate, zp,X, abs,Y, and ind,X selectors for ALU ops
    node is_and_any_temp: Or
    connect control.is_and_imm -> is_and_any_temp.a
    connect control.is_and_zp_x -> is_and_any_temp.b

    node is_and_any_temp2: Or
    connect is_and_any_temp.out -> is_and_any_temp2.a
    connect control.is_and_abs_y -> is_and_any_temp2.b

    node is_and_any_temp3: Or
    connect is_and_any_temp2.out -> is_and_any_temp3.a
    connect control.is_and_ind_x -> is_and_any_temp3.b

    node is_and_any: Or
    connect is_and_any_temp3.out -> is_and_any.a
    connect control.is_and_ind_y -> is_and_any.b

    node is_ora_any_temp: Or
    connect control.is_ora_imm -> is_ora_any_temp.a
    connect control.is_ora_zp_x -> is_ora_any_temp.b

    node is_ora_any_temp2: Or
    connect is_ora_any_temp.out -> is_ora_any_temp2.a
    connect control.is_ora_abs_y -> is_ora_any_temp2.b

    node is_ora_any_temp3: Or
    connect is_ora_any_temp2.out -> is_ora_any_temp3.a
    connect control.is_ora_ind_x -> is_ora_any_temp3.b

    node is_ora_any: Or
    connect is_ora_any_temp3.out -> is_ora_any.a
    connect control.is_ora_ind_y -> is_ora_any.b

    node is_eor_any_temp: Or
    connect control.is_eor_imm -> is_eor_any_temp.a
    connect control.is_eor_zp_x -> is_eor_any_temp.b

    node is_eor_any_temp2: Or
    connect is_eor_any_temp.out -> is_eor_any_temp2.a
    connect control.is_eor_abs_y -> is_eor_any_temp2.b

    node is_eor_any_temp3: Or
    connect is_eor_any_temp2.out -> is_eor_any_temp3.a
    connect control.is_eor_ind_x -> is_eor_any_temp3.b

    node is_eor_any: Or
    connect is_eor_any_temp3.out -> is_eor_any.a
    connect control.is_eor_ind_y -> is_eor_any.b

    node is_sbc_any_temp: Or
    connect control.is_sbc_imm -> is_sbc_any_temp.a
    connect control.is_sbc_zp_x -> is_sbc_any_temp.b

    node is_sbc_any_temp2: Or
    connect is_sbc_any_temp.out -> is_sbc_any_temp2.a
    connect control.is_sbc_abs_y -> is_sbc_any_temp2.b

    node is_sbc_any_temp3: Or
    connect is_sbc_any_temp2.out -> is_sbc_any_temp3.a
    connect control.is_sbc_ind_x -> is_sbc_any_temp3.b

    node is_sbc_any: Or
    connect is_sbc_any_temp3.out -> is_sbc_any.a
    connect control.is_sbc_ind_y -> is_sbc_any.b

    node is_adc_any_temp: Or
    connect control.is_adc_imm -> is_adc_any_temp.a
    connect control.is_adc_zp_x -> is_adc_any_temp.b

    node is_adc_any_temp2: Or
    connect is_adc_any_temp.out -> is_adc_any_temp2.a
    connect control.is_adc_abs_y -> is_adc_any_temp2.b

    node is_adc_any_temp3: Or
    connect is_adc_any_temp2.out -> is_adc_any_temp3.a
    connect control.is_adc_ind_x -> is_adc_any_temp3.b

    node is_adc_any: Or
    connect is_adc_any_temp3.out -> is_adc_any.a
    connect control.is_adc_ind_y -> is_adc_any.b

    // Part 22: Combined ADC or SBC signal for V flag update
    node is_adc_or_sbc_any: Or
    connect is_adc_any.out -> is_adc_or_sbc_any.a
    connect is_sbc_any.out -> is_adc_or_sbc_any.b

    node is_lda_zp_any: Or
    connect control.is_lda_zp -> is_lda_zp_any.a
    connect control.is_lda_zp_x -> is_lda_zp_any.b

    node result_a_lda_or_and: Mux
    connect is_and_any.out -> result_a_lda_or_and.sel
    connect operand_reg.q -> result_a_lda_or_and.in0
    connect and_result.out -> result_a_lda_or_and.in1

    node result_a_or_ora: Mux
    connect is_ora_any.out -> result_a_or_ora.sel
    connect result_a_lda_or_and.out -> result_a_or_ora.in0
    connect ora_result.out -> result_a_or_ora.in1

    node result_a_or_eor: Mux
    connect is_eor_any.out -> result_a_or_eor.sel
    connect result_a_or_ora.out -> result_a_or_eor.in0
    connect eor_result.out -> result_a_or_eor.in1

    // SBC: A = A - M - !C
    node result_a_or_sbc: Mux
    connect is_sbc_any.out -> result_a_or_sbc.sel
    connect result_a_or_eor.out -> result_a_or_sbc.in0
    connect sbc_result.difference -> result_a_or_sbc.in1

    // ADC: A = A + M + C
    node result_a_or_adc: Mux
    connect is_adc_any.out -> result_a_or_adc.sel
    connect result_a_or_sbc.out -> result_a_or_adc.in0
    connect adc_result.sum -> result_a_or_adc.in1

    node result_a_imm_zp: Mux
    connect is_lda_zp_any.out -> result_a_imm_zp.sel
    connect result_a_or_adc.out -> result_a_imm_zp.in0
    connect memory.data_out -> result_a_imm_zp.in1

    node result_a_abs: Mux
    connect control.is_lda_abs -> result_a_abs.sel
    connect result_a_imm_zp.out -> result_a_abs.in0
    connect memory.data_out -> result_a_abs.in1

    node result_a_abs_x: Mux
    connect control.is_lda_abs_x -> result_a_abs_x.sel
    connect result_a_abs.out -> result_a_abs_x.in0
    connect memory.data_out -> result_a_abs_x.in1

    // Part 12: LDA abs,Y result
    node result_a_abs_y: Mux
    connect control.is_lda_abs_y -> result_a_abs_y.sel
    connect result_a_abs_x.out -> result_a_abs_y.in0
    connect memory.data_out -> result_a_abs_y.in1

    // Part 13: LDA (ind,X) result
    node result_a_ind_x: Mux
    connect control.is_lda_ind_x -> result_a_ind_x.sel
    connect result_a_abs_y.out -> result_a_ind_x.in0
    connect memory.data_out -> result_a_ind_x.in1

    // Part 14: LDA (ind,Y) result
    node result_a_ind_y: Mux
    connect control.is_lda_ind_y -> result_a_ind_y.sel
    connect result_a_ind_x.out -> result_a_ind_y.in0
    connect memory.data_out -> result_a_ind_y.in1

    node result_a_stack: Mux
    connect control.use_stack_data -> result_a_stack.sel
    connect result_a_ind_y.out -> result_a_stack.in0
    connect stack.data_out -> result_a_stack.in1

    // TXA: A = X
    node result_a_txa: Mux
    connect control.is_txa -> result_a_txa.sel
    connect result_a_stack.out -> result_a_txa.in0
    connect registers.reg_x -> result_a_txa.in1

    // TYA: A = Y
    node result_a_tya: Mux
    connect control.is_tya -> result_a_tya.sel
    connect result_a_txa.out -> result_a_tya.in0
    connect registers.reg_y -> result_a_tya.in1

    // Shift/Rotate: ASL, LSR, ROL, ROR
    node result_a_asl: Mux
    connect control.is_asl_a -> result_a_asl.sel
    connect result_a_tya.out -> result_a_asl.in0
    connect asl_result.result -> result_a_asl.in1

    node result_a_lsr: Mux
    connect control.is_lsr_a -> result_a_lsr.sel
    connect result_a_asl.out -> result_a_lsr.in0
    connect lsr_result.result -> result_a_lsr.in1

    node result_a_rol: Mux
    connect control.is_rol_a -> result_a_rol.sel
    connect result_a_lsr.out -> result_a_rol.in0
    connect rol_adder.sum -> result_a_rol.in1

    node result_a: Mux
    connect control.is_ror_a -> result_a.sel
    connect result_a_rol.out -> result_a.in0
    connect ror_adder.sum -> result_a.in1

    connect result_a.out -> registers.data_a

    // Data source for X register - TAX, INX, DEX, TSX
    node result_x_tax_or_inx: Mux
    connect control.is_tax -> result_x_tax_or_inx.sel
    connect inc_x.out -> result_x_tax_or_inx.in0
    connect registers.reg_a -> result_x_tax_or_inx.in1

    node result_x_dex: Mux
    connect control.is_dex -> result_x_dex.sel
    connect result_x_tax_or_inx.out -> result_x_dex.in0
    connect dec_x.difference -> result_x_dex.in1

    // TSX: X = SP
    node result_x_tsx: Mux
    connect control.is_tsx -> result_x_tsx.sel
    connect result_x_dex.out -> result_x_tsx.in0
    connect sp.sp -> result_x_tsx.in1

    // LDX #imm: X = operand
    node result_x_ldx_imm: Mux
    connect control.is_ldx_imm -> result_x_ldx_imm.sel
    connect result_x_tsx.out -> result_x_ldx_imm.in0
    connect operand_reg.q -> result_x_ldx_imm.in1

    // Part 11: LDX zp,Y: X = memory
    node result_x_ldx_zp_y: Mux
    connect control.is_ldx_zp_y -> result_x_ldx_zp_y.sel
    connect result_x_ldx_imm.out -> result_x_ldx_zp_y.in0
    connect memory.data_out -> result_x_ldx_zp_y.in1

    // Part 12: LDX abs,Y: X = memory
    node result_x: Mux
    connect control.is_ldx_abs_y -> result_x.sel
    connect result_x_ldx_zp_y.out -> result_x.in0
    connect memory.data_out -> result_x.in1

    connect result_x.out -> registers.data_x

    // Data source for Y register - INY, DEY, LDY #imm
    node result_y_inc_dec: Mux
    connect control.is_dey -> result_y_inc_dec.sel
    connect inc_y.out -> result_y_inc_dec.in0
    connect dec_y.difference -> result_y_inc_dec.in1

    // LDY #imm: Y = operand
    node result_y: Mux
    connect control.is_ldy_imm -> result_y.sel
    connect result_y_inc_dec.out -> result_y.in0
    connect operand_reg.q -> result_y.in1

    connect result_y.out -> registers.data_y

    // Comparator for CMP: A - operand (works for both imm and zp,X via alu_b_operand)
    node cmp_sub: Subtractor
    connect registers.reg_a -> cmp_sub.a
    connect alu_b_operand.out -> cmp_sub.b
    connect zero.out -> cmp_sub.borrow_in

    // Comparator for CPX: X - operand
    node cpx_sub: Subtractor
    connect registers.reg_x -> cpx_sub.a
    connect operand_reg.q -> cpx_sub.b
    connect zero.out -> cpx_sub.borrow_in

    // Comparator for CPY: Y - operand
    node cpy_sub: Subtractor
    connect registers.reg_y -> cpy_sub.a
    connect operand_reg.q -> cpy_sub.b
    connect zero.out -> cpy_sub.borrow_in

    // Flag calculation - compute result value for flags
    // For LDA/AND/ORA/EOR: use result_a
    // For CMP: use cmp_sub.difference
    // For INX/DEX: use result_x
    // For INY/DEY: use result_y

    node const_128: Constant(value=128)

    // Get value to test for flags (X operations: INX, DEX, TSX, LDX)
    node is_any_x_op_1: Or
    connect control.is_inx -> is_any_x_op_1.a
    connect control.is_dex -> is_any_x_op_1.b

    node is_any_x_op_2: Or
    connect is_any_x_op_1.out -> is_any_x_op_2.a
    connect control.is_tsx -> is_any_x_op_2.b

    node is_any_x_op_3: Or
    connect is_any_x_op_2.out -> is_any_x_op_3.a
    connect control.is_ldx_imm -> is_any_x_op_3.b

    // Part 11: LDX zp,Y also uses X result for flags
    node is_any_x_op: Or
    connect is_any_x_op_3.out -> is_any_x_op.a
    connect control.is_ldx_zp_y -> is_any_x_op.b

    node is_any_y_op: Or
    connect control.is_iny -> is_any_y_op.a
    connect control.is_dey -> is_any_y_op.b

    // Value for flag calculation: select between result_a, cmp result, x result, y result
    node is_cmp_any_temp: Or
    connect control.is_cmp_imm -> is_cmp_any_temp.a
    connect control.is_cmp_zp_x -> is_cmp_any_temp.b

    node is_cmp_any_temp2: Or
    connect is_cmp_any_temp.out -> is_cmp_any_temp2.a
    connect control.is_cmp_abs_y -> is_cmp_any_temp2.b

    node is_cmp_any_temp3: Or
    connect is_cmp_any_temp2.out -> is_cmp_any_temp3.a
    connect control.is_cmp_ind_x -> is_cmp_any_temp3.b

    node is_cmp_any: Or
    connect is_cmp_any_temp3.out -> is_cmp_any.a
    connect control.is_cmp_ind_y -> is_cmp_any.b

    node flag_value_1: Mux
    connect is_cmp_any.out -> flag_value_1.sel
    connect result_a.out -> flag_value_1.in0
    connect cmp_sub.difference -> flag_value_1.in1

    // CPX uses cpx_sub.difference
    node flag_value_2: Mux
    connect control.is_cpx_imm -> flag_value_2.sel
    connect flag_value_1.out -> flag_value_2.in0
    connect cpx_sub.difference -> flag_value_2.in1

    // CPY uses cpy_sub.difference
    node flag_value_3: Mux
    connect control.is_cpy_imm -> flag_value_3.sel
    connect flag_value_2.out -> flag_value_3.in0
    connect cpy_sub.difference -> flag_value_3.in1

    node flag_value_4: Mux
    connect is_any_x_op.out -> flag_value_4.sel
    connect flag_value_3.out -> flag_value_4.in0
    connect result_x.out -> flag_value_4.in1

    node flag_value_5: Mux
    connect is_any_y_op.out -> flag_value_5.sel
    connect flag_value_4.out -> flag_value_5.in0
    connect result_y.out -> flag_value_5.in1

    // RMW operations use the incremented/decremented memory value for flags
    node flag_value_rmw: Mux
    connect control.mem_rmw -> flag_value_rmw.sel
    connect flag_value_5.out -> flag_value_rmw.in0
    connect rmw_result.out -> flag_value_rmw.in1

    // Part 15: BIT uses A AND memory for Z flag calculation
    // and_result already computes A AND operand (memory)
    // Combine BIT zp and BIT abs for flag selection
    node is_bit_any: Or
    connect control.is_bit_zp -> is_bit_any.a
    connect control.is_bit_abs -> is_bit_any.b

    node flag_value: Mux
    connect is_bit_any.out -> flag_value.sel
    connect flag_value_rmw.out -> flag_value.in0
    connect and_result.out -> flag_value.in1

    // N flag: bit 7 of result (value >= 128)
    node n_check: Comparator
    connect flag_value.out -> n_check.a
    connect const_128.out -> n_check.b
    node n_flag_normal: Or
    connect n_check.gt -> n_flag_normal.a
    connect n_check.eq -> n_flag_normal.b

    // Part 15: BIT uses memory bit 7 for N flag (not result bit 7)
    node n_flag_val: Mux
    connect is_bit_any.out -> n_flag_val.sel
    connect n_flag_normal.out -> n_flag_val.in0
    connect mem_bits.bit7 -> n_flag_val.in1

    // Z flag: result == 0
    node z_check: Comparator
    connect flag_value.out -> z_check.a
    connect zero.out -> z_check.b

    // C flag for CMP: NOT borrow_out (from correct subtractor)
    node not_borrow_cmp: Not
    connect cmp_sub.borrow_out -> not_borrow_cmp.in

    node not_borrow_cpx: Not
    connect cpx_sub.borrow_out -> not_borrow_cpx.in

    node not_borrow_cpy: Not
    connect cpy_sub.borrow_out -> not_borrow_cpy.in

    // Select correct carry based on which compare instruction
    node c_cmp_or_cpx: Mux
    connect control.is_cpx_imm -> c_cmp_or_cpx.sel
    connect not_borrow_cmp.out -> c_cmp_or_cpx.in0
    connect not_borrow_cpx.out -> c_cmp_or_cpx.in1

    node c_compare: Mux
    connect control.is_cpy_imm -> c_compare.sel
    connect c_cmp_or_cpx.out -> c_compare.in0
    connect not_borrow_cpy.out -> c_compare.in1

    // SBC also sets carry (C = NOT borrow)
    node not_borrow_sbc: Not
    connect sbc_result.borrow_out -> not_borrow_sbc.in

    node c_with_sbc: Mux
    connect is_sbc_any.out -> c_with_sbc.sel
    connect c_compare.out -> c_with_sbc.in0
    connect not_borrow_sbc.out -> c_with_sbc.in1

    // ADC also sets carry (C = carry_out)
    node c_with_adc: Mux
    connect is_adc_any.out -> c_with_adc.sel
    connect c_with_sbc.out -> c_with_adc.in0
    connect adc_result.carry_out -> c_with_adc.in1

    // Shift/rotate carry flags:
    // ASL: C = old bit 7 (a_bits.bit7)
    node c_with_asl: Mux
    connect control.is_asl_a -> c_with_asl.sel
    connect c_with_adc.out -> c_with_asl.in0
    connect a_bits.bit7 -> c_with_asl.in1

    // LSR: C = old bit 0 (a_bits.bit0)
    node c_with_lsr: Mux
    connect control.is_lsr_a -> c_with_lsr.sel
    connect c_with_asl.out -> c_with_lsr.in0
    connect a_bits.bit0 -> c_with_lsr.in1

    // ROL: C = old bit 7 (a_bits.bit7)
    node c_with_rol: Mux
    connect control.is_rol_a -> c_with_rol.sel
    connect c_with_lsr.out -> c_with_rol.in0
    connect a_bits.bit7 -> c_with_rol.in1

    // ROR: C = old bit 0 (a_bits.bit0)
    node c_with_ror: Mux
    connect control.is_ror_a -> c_with_ror.sel
    connect c_with_rol.out -> c_with_ror.in0
    connect a_bits.bit0 -> c_with_ror.in1

    // Part 9: Shift/rotate memory carry flags
    // ASL zp: C = old bit 7 (mem_bits.bit7)
    node c_with_asl_zp: Mux
    connect control.is_asl_zp -> c_with_asl_zp.sel
    connect c_with_ror.out -> c_with_asl_zp.in0
    connect mem_bits.bit7 -> c_with_asl_zp.in1

    // LSR zp: C = old bit 0 (mem_bits.bit0)
    node c_with_lsr_zp: Mux
    connect control.is_lsr_zp -> c_with_lsr_zp.sel
    connect c_with_asl_zp.out -> c_with_lsr_zp.in0
    connect mem_bits.bit0 -> c_with_lsr_zp.in1

    // ROL zp: C = old bit 7 (mem_bits.bit7)
    node c_with_rol_zp: Mux
    connect control.is_rol_zp -> c_with_rol_zp.sel
    connect c_with_lsr_zp.out -> c_with_rol_zp.in0
    connect mem_bits.bit7 -> c_with_rol_zp.in1

    // ROR zp: C = old bit 0 (mem_bits.bit0)
    node c_with_ror_zp: Mux
    connect control.is_ror_zp -> c_with_ror_zp.sel
    connect c_with_rol_zp.out -> c_with_ror_zp.in0
    connect mem_bits.bit0 -> c_with_ror_zp.in1

    // Carry flag value - either from compare/SBC/ADC/shift or SEC/CLC
    node c_from_sec: Mux
    connect control.set_c -> c_from_sec.sel
    connect c_with_ror_zp.out -> c_from_sec.in0
    node const_true: Constant(value=1)
    connect const_true.out -> c_from_sec.in1

    // Final C value
    node c_value: Mux
    connect control.clear_c -> c_value.sel
    connect c_from_sec.out -> c_value.in0
    connect zero.out -> c_value.in1

    // Flag updates - Part 16: PLP updates all flags, Part 17: RTI also updates all flags
    node update_flags_from_stack: Or
    connect control.update_flags_plp -> update_flags_from_stack.a
    connect control.update_flags_rti -> update_flags_from_stack.b

    node update_n_signal: Or
    connect control.update_flags -> update_n_signal.a
    connect update_flags_from_stack.out -> update_n_signal.b
    connect update_n_signal.out -> flags.update_n

    node update_z_signal: Or
    connect control.update_flags -> update_z_signal.a
    connect update_flags_from_stack.out -> update_z_signal.b
    connect update_z_signal.out -> flags.update_z

    // C flag updated by: update_flags (for CMP) or update_c_only (for SEC/CLC) or PLP
    node update_c_temp: Or
    connect control.update_flags -> update_c_temp.a
    connect control.update_c_only -> update_c_temp.b

    node update_c_signal: Or
    connect update_c_temp.out -> update_c_signal.a
    connect update_flags_from_stack.out -> update_c_signal.b
    connect update_c_signal.out -> flags.update_c

    // V flag updated by CLV (clear) or BIT (set from memory bit 6) or PLP or ADC/SBC
    node update_v_temp: Or
    connect control.clear_v -> update_v_temp.a
    connect control.update_v_bit -> update_v_temp.b

    // Part 22: V flag also updated by ADC/SBC
    node update_v_temp2: Or
    connect update_v_temp.out -> update_v_temp2.a
    connect is_adc_or_sbc_any.out -> update_v_temp2.b

    node update_v_signal: Or
    connect update_v_temp2.out -> update_v_signal.a
    connect update_flags_from_stack.out -> update_v_signal.b
    connect update_v_signal.out -> flags.update_v

    // Part 15: new_v is memory bit 6 for BIT, otherwise 0 (for CLV)
    node new_v_temp: Mux
    connect control.update_v_bit -> new_v_temp.sel
    connect zero.out -> new_v_temp.in0
    connect mem_bits.bit6 -> new_v_temp.in1

    // Part 22: ADC sets V from computed overflow
    node new_v_after_adc: Mux
    connect is_adc_any.out -> new_v_after_adc.sel
    connect new_v_temp.out -> new_v_after_adc.in0
    connect v_adc.out -> new_v_after_adc.in1

    // Part 22: SBC sets V from computed overflow
    node new_v_after_sbc: Mux
    connect is_sbc_any.out -> new_v_after_sbc.sel
    connect new_v_after_adc.out -> new_v_after_sbc.in0
    connect v_sbc.out -> new_v_after_sbc.in1

    // Part 16: PLP/RTI sets V from stack bit 6
    node new_v_value: Mux
    connect update_flags_from_stack.out -> new_v_value.sel
    connect new_v_after_sbc.out -> new_v_value.in0
    connect stack_bits.bit6 -> new_v_value.in1

    // Part 16: PLP/RTI sets N from stack bit 7
    node new_n_value: Mux
    connect update_flags_from_stack.out -> new_n_value.sel
    connect n_flag_val.out -> new_n_value.in0
    connect stack_bits.bit7 -> new_n_value.in1

    // Part 16: PLP/RTI sets Z from stack bit 1
    node new_z_value: Mux
    connect update_flags_from_stack.out -> new_z_value.sel
    connect z_check.eq -> new_z_value.in0
    connect stack_bits.bit1 -> new_z_value.in1

    // Part 16: PLP/RTI sets C from stack bit 0
    node new_c_value: Mux
    connect update_flags_from_stack.out -> new_c_value.sel
    connect c_value.out -> new_c_value.in0
    connect stack_bits.bit0 -> new_c_value.in1

    connect new_n_value.out -> flags.new_n
    connect new_z_value.out -> flags.new_z
    connect new_c_value.out -> flags.new_c
    connect new_v_value.out -> flags.new_v

    // Part 16: D and I flag updates (PLP/RTI)
    node update_d_signal: Or
    connect control.update_d -> update_d_signal.a
    connect update_flags_from_stack.out -> update_d_signal.b
    connect update_d_signal.out -> flags.update_d

    node update_i_signal: Or
    connect control.update_i -> update_i_signal.a
    connect update_flags_from_stack.out -> update_i_signal.b
    connect update_i_signal.out -> flags.update_i

    // Part 16: PLP/RTI sets D from stack bit 3, I from stack bit 2
    node new_d_value: Mux
    connect update_flags_from_stack.out -> new_d_value.sel
    connect control.set_d -> new_d_value.in0
    connect stack_bits.bit3 -> new_d_value.in1

    node new_i_value: Mux
    connect update_flags_from_stack.out -> new_i_value.sel
    connect control.set_i -> new_i_value.in0
    connect stack_bits.bit2 -> new_i_value.in1

    connect new_d_value.out -> flags.new_d
    connect new_i_value.out -> flags.new_i

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

    // Part 17: JMP indirect loads PC from pointer (ptr_lo_reg holds target address)
    node pc_after_jmp_ind: Mux
    connect control.jmp_ind_load_pc -> pc_after_jmp_ind.sel
    connect pc_after_jsr.out -> pc_after_jmp_ind.in0
    connect ptr_lo_reg.q -> pc_after_jmp_ind.in1

    // Part 17: RTI loads PC from stack (no +1 unlike RTS)
    // Use the combined PC value from pc_lo_temp and pc_hi_temp
    // For 8-bit PC, just use pc_lo_temp
    node pc_after_rti: Mux
    connect control.rti_load_pc -> pc_after_rti.sel
    connect pc_after_jmp_ind.out -> pc_after_rti.in0
    connect pc_lo_temp.q -> pc_after_rti.in1

    connect pc_after_rti.out -> pc_reg.data
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
    connect registers.reg_y -> reg_y
    connect sp.sp -> reg_sp
    connect flags.flag_n -> flag_n
    connect flags.flag_z -> flag_z
    connect flags.flag_c -> flag_c
    connect flags.flag_v -> flag_v
    connect flags.flag_d -> flag_d
    connect flags.flag_i -> flag_i
  }
}

// === TEST CIRCUIT ===
circuit Stage6Test {
  clock clk

  impl {
    node cpu: Stage6CPU
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

    node d_y: HexDisplay
    connect cpu.reg_y -> d_y.in

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
