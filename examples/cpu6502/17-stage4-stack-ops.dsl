// Stage 4 Stack Operations: PHA and PLA Instructions
// PHA (0x48) - Push Accumulator to stack
// PLA (0x68) - Pull Accumulator from stack
//
// This file extends the Stage 3 CPU with stack operations.
// Imports: StackPointer, StackMemory from 16-stage4-memory.dsl

// === Simple Memory Controller (from Stage 3) ===
circuit SimpleMemory {
  input addr: Bus[8]
  input data_in: Bus[8]
  input write_enable: Bit

  output data_out: Bus[8]

  clock clk

  impl {
    // 256 bytes of RAM using registers
    // Addresses $10-$15 for testing
    node zero: Constant(value=0)
    node addr_10: Constant(value=16)  // 0x10
    node addr_11: Constant(value=17)  // 0x11
    node addr_12: Constant(value=18)  // 0x12
    node addr_13: Constant(value=19)  // 0x13
    node addr_14: Constant(value=20)  // 0x14
    node addr_15: Constant(value=21)  // 0x15

    // Address comparators
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

    // Memory cells
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

    // Write enable for each cell
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

    // Read mux cascade
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

// === Register File (from Stage 3) ===
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
    node init_value: Constant(value=255)

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

// === Stack Control FSM ===
// Extends CompleteControl with PHA/PLA instructions
circuit StackControl {
  input reset: Bit
  input current_opcode: Bus[8]

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

  // Stack control signals
  output sp_decrement: Bit
  output sp_increment: Bit
  output stack_write: Bit
  output use_stack_data: Bit   // Use stack data for A register

  // Instruction decode outputs
  output is_lda_imm: Bit      // A9
  output is_lda_zp: Bit       // A5
  output is_lda_abs: Bit      // AD
  output is_lda_abs_x: Bit    // BD
  output is_sta_zp: Bit       // 85
  output is_sta_abs: Bit      // 8D
  output is_sta_abs_x: Bit    // 9D
  output is_tax: Bit          // AA
  output is_inx: Bit          // E8
  output is_pha: Bit          // 48
  output is_pla: Bit          // 68

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

    // Instruction decode (including new stack ops)
    node LDA_IMM: Constant(value=169)   // A9
    node LDA_ZP: Constant(value=165)    // A5
    node LDA_ABS: Constant(value=173)   // AD
    node LDA_ABS_X: Constant(value=189) // BD
    node STA_ZP: Constant(value=133)    // 85
    node STA_ABS: Constant(value=141)   // 8D
    node STA_ABS_X: Constant(value=157) // 9D
    node TAX: Constant(value=170)       // AA
    node INX: Constant(value=232)       // E8
    node PHA: Constant(value=72)        // 48
    node PLA: Constant(value=104)       // 68

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

    // Categorize instructions by cycle count and type
    node is_imm: Or
    connect cmp_lda_imm.eq -> is_imm.a
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

    // Stack operations (PHA: 2 cycles in execute, PLA: 3 cycles in execute)
    node is_stack_op: Or
    connect cmp_pha.eq -> is_stack_op.a
    connect cmp_pla.eq -> is_stack_op.b

    // Subcycle management
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)
    node three: Constant(value=3)
    node four: Constant(value=4)

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

    // Done conditions
    node done_imm: And
    connect exec_sub1.out -> done_imm.a
    connect is_imm.out -> done_imm.b

    node done_zp: And
    connect exec_sub3.out -> done_zp.a
    connect is_zp.out -> done_zp.b

    node done_abs: And
    connect exec_sub4.out -> done_abs.a
    connect is_abs_final.out -> done_abs.b

    node done_1cyc: And
    connect exec_sub0.out -> done_1cyc.a
    connect is_1cycle.out -> done_1cyc.b

    // PHA done at sub1 (sub0: write to stack + decrement SP)
    node done_pha: And
    connect exec_sub1.out -> done_pha.a
    connect cmp_pha.eq -> done_pha.b

    // PLA done at sub2 (sub0: increment SP, sub1: read from stack, sub2: load A)
    node done_pla: And
    connect exec_sub2.out -> done_pla.a
    connect cmp_pla.eq -> done_pla.b

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

    node exec_done: Or
    connect exec_done_temp4.out -> exec_done.a
    connect done_pla.out -> exec_done.b

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
    node needs_operand_any: Or
    connect is_imm.out -> needs_operand_any.a
    connect is_zp.out -> needs_operand_any.b

    node needs_operand: Or
    connect needs_operand_any.out -> needs_operand.a
    connect is_abs_final.out -> needs_operand.b

    // PC increment
    node pc_inc_exec_sub0: And
    connect exec_sub0.out -> pc_inc_exec_sub0.a
    connect needs_operand.out -> pc_inc_exec_sub0.b

    node pc_inc_exec_sub1: And
    connect exec_sub1.out -> pc_inc_exec_sub1.a
    connect is_abs_final.out -> pc_inc_exec_sub1.b

    node pc_inc_temp: Or
    connect is_fetch.eq -> pc_inc_temp.a
    connect pc_inc_exec_sub0.out -> pc_inc_temp.b

    node pc_inc_signal: Or
    connect pc_inc_temp.out -> pc_inc_signal.a
    connect pc_inc_exec_sub1.out -> pc_inc_signal.b
    connect pc_inc_signal.out -> pc_increment

    // IR loads during FETCH
    connect is_fetch.eq -> ir_load

    // Operand load
    node operand_load_signal: And
    connect exec_sub0.out -> operand_load_signal.a
    connect needs_operand.out -> operand_load_signal.b
    connect operand_load_signal.out -> operand_load

    // Address loads
    node addr_lo_load_signal: And
    connect exec_sub0.out -> addr_lo_load_signal.a
    connect needs_operand.out -> addr_lo_load_signal.b
    connect addr_lo_load_signal.out -> addr_lo_load

    node addr_hi_load_signal: And
    connect exec_sub1.out -> addr_hi_load_signal.a
    connect is_abs_final.out -> addr_hi_load_signal.b
    connect addr_hi_load_signal.out -> addr_hi_load

    // Memory read (data memory, not stack)
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

    // Memory write (data memory)
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

    // Stack pointer decrement: PHA at sub0
    node sp_dec_signal: And
    connect exec_sub0.out -> sp_dec_signal.a
    connect cmp_pha.eq -> sp_dec_signal.b
    connect sp_dec_signal.out -> sp_decrement

    // Stack pointer increment: PLA at sub0
    node sp_inc_signal: And
    connect exec_sub0.out -> sp_inc_signal.a
    connect cmp_pla.eq -> sp_inc_signal.b
    connect sp_inc_signal.out -> sp_increment

    // Stack write: PHA at sub0 (write A to stack[SP] before decrement takes effect)
    node stack_write_signal: And
    connect exec_sub0.out -> stack_write_signal.a
    connect cmp_pha.eq -> stack_write_signal.b
    connect stack_write_signal.out -> stack_write

    // Use stack data for A: PLA at sub2
    node use_stack_signal: And
    connect exec_sub2.out -> use_stack_signal.a
    connect cmp_pla.eq -> use_stack_signal.b
    connect use_stack_signal.out -> use_stack_data

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

    // PLA writes to A at sub2
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

    // Y register (no writes in this subset)
    connect zero.out -> write_y
  }
}

// === Stack CPU ===
// CPU with PHA/PLA support
circuit StackCPU {
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

  clock clk

  impl {
    // Program counter
    node pc_reg: Register
    connect clk -> pc_reg.clk
    node always_on: Constant(value=1)
    connect always_on.out -> pc_reg.we

    node pc_inc: Incrementer
    connect pc_reg.q -> pc_inc.in

    // ROM with test program: LDA #$42, PHA, LDA #$00, PLA
    // After: A should be $42, stack should have been used
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)
    node three: Constant(value=3)
    node four: Constant(value=4)
    node five: Constant(value=5)
    node six: Constant(value=6)
    node seven: Constant(value=7)

    // Program: A9 42 48 A9 00 68 (LDA #$42, PHA, LDA #$00, PLA)
    node byte_0: Constant(value=169)  // A9 - LDA #imm
    node byte_1: Constant(value=66)   // 42 - operand ($42)
    node byte_2: Constant(value=72)   // 48 - PHA
    node byte_3: Constant(value=169)  // A9 - LDA #imm
    node byte_4: Constant(value=0)    // 00 - operand ($00)
    node byte_5: Constant(value=104)  // 68 - PLA
    node byte_6: Constant(value=0)    // padding
    node byte_7: Constant(value=0)

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

    // Address registers
    node addr_lo_reg: Register
    connect clk -> addr_lo_reg.clk
    connect mux7.out -> addr_lo_reg.data

    node addr_hi_reg: Register
    connect clk -> addr_hi_reg.clk
    connect mux7.out -> addr_hi_reg.data

    // For indexed addressing
    node addr_with_x: Adder
    connect addr_lo_reg.q -> addr_with_x.a
    connect zero.out -> addr_with_x.carry_in

    // Control FSM
    node control: StackControl
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
    connect control.addr_lo_load -> addr_lo_reg.we
    connect control.addr_hi_load -> addr_hi_reg.we

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
    // Initialize SP to 0xFF on reset
    connect reset -> sp.load
    node sp_init: Constant(value=255)
    connect sp_init.out -> sp.load_value

    // Stack Memory
    node stack: StackMemory
    connect clk -> stack.clk
    connect sp.sp -> stack.addr
    connect registers.reg_a -> stack.data_in
    connect control.stack_write -> stack.write_enable

    // Select address for indexed mode
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

    // Data source for A register
    // Immediate: operand_reg
    // Zero-page/Absolute: memory
    // PLA: stack
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

    // Final mux: select between data memory sources and stack
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
  }
}

// === TEST CIRCUIT ===
circuit StackOpsTest {
  clock clk

  impl {
    node cpu: StackCPU
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
  }
}
