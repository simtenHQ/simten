// Stage 6 Part 5 Test: ADC, STX, STY
// Tests:
// - ADC #imm (0x69) - Add with Carry
// - STX zp (0x86) - Store X to zero page
// - STY zp (0x84) - Store Y to zero page

// Import base components from main Stage 6 file
// (SimpleMemory, StackPointer, StackMemory, FlagRegister, RegisterFile, Stage6Control)

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

    node out_mux1: Mux
    connect at_11.eq -> out_mux1.sel
    connect mem_10.q -> out_mux1.in0
    connect mem_11.q -> out_mux1.in1

    node out_mux2: Mux
    connect at_12.eq -> out_mux2.sel
    connect out_mux1.out -> out_mux2.in0
    connect mem_12.q -> out_mux2.in1

    node out_mux3: Mux
    connect at_13.eq -> out_mux3.sel
    connect out_mux2.out -> out_mux3.in0
    connect mem_13.q -> out_mux3.in1

    node out_mux4: Mux
    connect at_14.eq -> out_mux4.sel
    connect out_mux3.out -> out_mux4.in0
    connect mem_14.q -> out_mux4.in1

    node out_mux5: Mux
    connect at_15.eq -> out_mux5.sel
    connect out_mux4.out -> out_mux5.in0
    connect mem_15.q -> out_mux5.in1

    node out_mux6: Mux
    connect at_20.eq -> out_mux6.sel
    connect out_mux5.out -> out_mux6.in0
    connect mem_20.q -> out_mux6.in1

    node out_mux7: Mux
    connect at_21.eq -> out_mux7.sel
    connect out_mux6.out -> out_mux7.in0
    connect mem_21.q -> out_mux7.in1

    connect out_mux7.out -> data_out
  }
}

// === Flag Register ===
circuit FlagRegister {
  input new_n: Bit
  input new_z: Bit
  input new_c: Bit
  input new_v: Bit
  input update_n: Bit
  input update_z: Bit
  input update_c: Bit
  input update_v: Bit

  output flag_n: Bit
  output flag_z: Bit
  output flag_c: Bit
  output flag_v: Bit

  clock clk

  impl {
    node reg_n: Register
    node reg_z: Register
    node reg_c: Register
    node reg_v: Register

    connect clk -> reg_n.clk
    connect clk -> reg_z.clk
    connect clk -> reg_c.clk
    connect clk -> reg_v.clk

    connect new_n -> reg_n.data
    connect new_z -> reg_z.data
    connect new_c -> reg_c.data
    connect new_v -> reg_v.data

    connect update_n -> reg_n.we
    connect update_z -> reg_z.we
    connect update_c -> reg_c.we
    connect update_v -> reg_v.we

    connect reg_n.q -> flag_n
    connect reg_z.q -> flag_z
    connect reg_c.q -> flag_c
    connect reg_v.q -> flag_v
  }
}

// === Register File ===
circuit RegisterFile {
  input data_a: Bus[8]
  input data_x: Bus[8]
  input data_y: Bus[8]
  input write_a: Bit
  input write_x: Bit
  input write_y: Bit

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

// === Simplified Control for Part 5 Test ===
circuit Part5Control {
  input current_state: Bus[8]
  input current_opcode: Bus[8]
  input subcycle: Bus[8]
  input flag_c: Bit

  output next_state: Bus[8]
  output next_subcycle: Bus[8]
  output pc_increment: Bit
  output ir_load: Bit
  output operand_load: Bit
  output addr_lo_load: Bit
  output write_a: Bit
  output write_x: Bit
  output write_y: Bit
  output mem_write: Bit
  output update_flags: Bit
  output update_c_only: Bit
  output set_c: Bit
  output clear_c: Bit
  output is_adc_imm: Bit
  output is_stx_zp: Bit
  output is_sty_zp: Bit
  output use_x_for_mem: Bit
  output use_y_for_mem: Bit

  clock clk

  impl {
    // States
    node STATE_FETCH: Constant(value=0)
    node STATE_DECODE: Constant(value=1)
    node STATE_EXECUTE: Constant(value=2)

    // Subcycle constants
    node SUB0: Constant(value=0)
    node SUB1: Constant(value=1)
    node SUB2: Constant(value=2)

    // Instruction opcodes
    node LDA_IMM: Constant(value=169)  // 0xA9
    node LDX_IMM: Constant(value=162)  // 0xA2
    node LDY_IMM: Constant(value=160)  // 0xA0
    node ADC_IMM: Constant(value=105)  // 0x69
    node STX_ZP: Constant(value=134)   // 0x86
    node STY_ZP: Constant(value=132)   // 0x84
    node SEC: Constant(value=56)       // 0x38
    node CLC: Constant(value=24)       // 0x18

    // State comparators
    node is_fetch: Comparator
    connect current_state -> is_fetch.a
    connect STATE_FETCH.out -> is_fetch.b

    node is_decode: Comparator
    connect current_state -> is_decode.a
    connect STATE_DECODE.out -> is_decode.b

    node is_execute: Comparator
    connect current_state -> is_execute.a
    connect STATE_EXECUTE.out -> is_execute.b

    // Subcycle comparators
    node at_sub0: Comparator
    connect subcycle -> at_sub0.a
    connect SUB0.out -> at_sub0.b

    node at_sub1: Comparator
    connect subcycle -> at_sub1.a
    connect SUB1.out -> at_sub1.b

    node at_sub2: Comparator
    connect subcycle -> at_sub2.a
    connect SUB2.out -> at_sub2.b

    node exec_sub0: And
    connect is_execute.eq -> exec_sub0.a
    connect at_sub0.eq -> exec_sub0.b

    node exec_sub1: And
    connect is_execute.eq -> exec_sub1.a
    connect at_sub1.eq -> exec_sub1.b

    node exec_sub2: And
    connect is_execute.eq -> exec_sub2.a
    connect at_sub2.eq -> exec_sub2.b

    // Instruction comparators
    node cmp_lda_imm: Comparator
    connect current_opcode -> cmp_lda_imm.a
    connect LDA_IMM.out -> cmp_lda_imm.b

    node cmp_ldx_imm: Comparator
    connect current_opcode -> cmp_ldx_imm.a
    connect LDX_IMM.out -> cmp_ldx_imm.b

    node cmp_ldy_imm: Comparator
    connect current_opcode -> cmp_ldy_imm.a
    connect LDY_IMM.out -> cmp_ldy_imm.b

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

    node cmp_sec: Comparator
    connect current_opcode -> cmp_sec.a
    connect SEC.out -> cmp_sec.b

    node cmp_clc: Comparator
    connect current_opcode -> cmp_clc.a
    connect CLC.out -> cmp_clc.b

    // Immediate mode instructions
    node is_imm_1: Or
    connect cmp_lda_imm.eq -> is_imm_1.a
    connect cmp_ldx_imm.eq -> is_imm_1.b

    node is_imm_2: Or
    connect is_imm_1.out -> is_imm_2.a
    connect cmp_ldy_imm.eq -> is_imm_2.b

    node is_imm: Or
    connect is_imm_2.out -> is_imm.a
    connect cmp_adc_imm.eq -> is_imm.b

    // Zero page instructions
    node is_zp: Or
    connect cmp_stx_zp.eq -> is_zp.a
    connect cmp_sty_zp.eq -> is_zp.b

    // 1-cycle instructions
    node is_1cycle: Or
    connect cmp_sec.eq -> is_1cycle.a
    connect cmp_clc.eq -> is_1cycle.b

    // Instructions that need operand
    node needs_operand: Or
    connect is_imm.out -> needs_operand.a
    connect is_zp.out -> needs_operand.b

    // State machine
    node one: Constant(value=1)
    node zero: Constant(value=0)

    // Next state logic
    node go_to_decode: Mux
    connect is_fetch.eq -> go_to_decode.sel
    connect current_state -> go_to_decode.in0
    connect STATE_DECODE.out -> go_to_decode.in1

    node go_to_execute: Mux
    connect is_decode.eq -> go_to_execute.sel
    connect go_to_decode.out -> go_to_execute.in0
    connect STATE_EXECUTE.out -> go_to_execute.in1

    // Done conditions for execute state
    node done_1cycle: And
    connect exec_sub0.out -> done_1cycle.a
    connect is_1cycle.out -> done_1cycle.b

    node done_imm: And
    connect exec_sub1.out -> done_imm.a
    connect is_imm.out -> done_imm.b

    node done_zp: And
    connect exec_sub2.out -> done_zp.a
    connect is_zp.out -> done_zp.b

    node done_temp: Or
    connect done_1cycle.out -> done_temp.a
    connect done_imm.out -> done_temp.b

    node done: Or
    connect done_temp.out -> done.a
    connect done_zp.out -> done.b

    node go_to_fetch: Mux
    connect done.out -> go_to_fetch.sel
    connect go_to_execute.out -> go_to_fetch.in0
    connect STATE_FETCH.out -> go_to_fetch.in1

    connect go_to_fetch.out -> next_state

    // Subcycle logic
    node inc_subcycle: Incrementer
    connect subcycle -> inc_subcycle.in

    node reset_subcycle: Mux
    connect done.out -> reset_subcycle.sel
    connect inc_subcycle.out -> reset_subcycle.in0
    connect zero.out -> reset_subcycle.in1

    node keep_subcycle: Mux
    connect is_execute.eq -> keep_subcycle.sel
    connect zero.out -> keep_subcycle.in0
    connect reset_subcycle.out -> keep_subcycle.in1

    connect keep_subcycle.out -> next_subcycle

    // PC increment
    node pc_inc_fetch: And
    connect is_fetch.eq -> pc_inc_fetch.a
    connect one.out -> pc_inc_fetch.b

    node pc_inc_exec: And
    connect exec_sub0.out -> pc_inc_exec.a
    connect needs_operand.out -> pc_inc_exec.b

    node pc_inc_signal: Or
    connect pc_inc_fetch.out -> pc_inc_signal.a
    connect pc_inc_exec.out -> pc_inc_signal.b
    connect pc_inc_signal.out -> pc_increment

    // IR load
    connect is_fetch.eq -> ir_load

    // Operand load
    node operand_load_signal: And
    connect exec_sub0.out -> operand_load_signal.a
    connect needs_operand.out -> operand_load_signal.b
    connect operand_load_signal.out -> operand_load

    // Address load (same as operand for ZP)
    connect operand_load_signal.out -> addr_lo_load

    // Write A - LDA #imm or ADC #imm at sub1
    node is_write_a: Or
    connect cmp_lda_imm.eq -> is_write_a.a
    connect cmp_adc_imm.eq -> is_write_a.b

    node write_a_signal: And
    connect exec_sub1.out -> write_a_signal.a
    connect is_write_a.out -> write_a_signal.b
    connect write_a_signal.out -> write_a

    // Write X - LDX #imm at sub1
    node write_x_signal: And
    connect exec_sub1.out -> write_x_signal.a
    connect cmp_ldx_imm.eq -> write_x_signal.b
    connect write_x_signal.out -> write_x

    // Write Y - LDY #imm at sub1
    node write_y_signal: And
    connect exec_sub1.out -> write_y_signal.a
    connect cmp_ldy_imm.eq -> write_y_signal.b
    connect write_y_signal.out -> write_y

    // Memory write - STX zp or STY zp at sub2
    node mem_write_signal: And
    connect exec_sub2.out -> mem_write_signal.a
    connect is_zp.out -> mem_write_signal.b
    connect mem_write_signal.out -> mem_write

    // Use X for memory (STX)
    node use_x_signal: And
    connect exec_sub2.out -> use_x_signal.a
    connect cmp_stx_zp.eq -> use_x_signal.b
    connect use_x_signal.out -> use_x_for_mem

    // Use Y for memory (STY)
    node use_y_signal: And
    connect exec_sub2.out -> use_y_signal.a
    connect cmp_sty_zp.eq -> use_y_signal.b
    connect use_y_signal.out -> use_y_for_mem

    // Update flags - LDA, LDX, LDY, ADC at sub1
    node is_update_flags_1: Or
    connect cmp_lda_imm.eq -> is_update_flags_1.a
    connect cmp_ldx_imm.eq -> is_update_flags_1.b

    node is_update_flags_2: Or
    connect is_update_flags_1.out -> is_update_flags_2.a
    connect cmp_ldy_imm.eq -> is_update_flags_2.b

    node is_update_flags: Or
    connect is_update_flags_2.out -> is_update_flags.a
    connect cmp_adc_imm.eq -> is_update_flags.b

    node update_flags_signal: And
    connect exec_sub1.out -> update_flags_signal.a
    connect is_update_flags.out -> update_flags_signal.b
    connect update_flags_signal.out -> update_flags

    // SEC/CLC at sub0
    node is_sec_clc: Or
    connect cmp_sec.eq -> is_sec_clc.a
    connect cmp_clc.eq -> is_sec_clc.b

    node update_c_only_signal: And
    connect exec_sub0.out -> update_c_only_signal.a
    connect is_sec_clc.out -> update_c_only_signal.b
    connect update_c_only_signal.out -> update_c_only

    node set_c_signal: And
    connect exec_sub0.out -> set_c_signal.a
    connect cmp_sec.eq -> set_c_signal.b
    connect set_c_signal.out -> set_c

    node clear_c_signal: And
    connect exec_sub0.out -> clear_c_signal.a
    connect cmp_clc.eq -> clear_c_signal.b
    connect clear_c_signal.out -> clear_c
  }
}

// === Part 5 Test CPU ===
circuit Part5TestCPU {
  input reset: Bit

  output pc: Bus[8]
  output reg_a: Bus[8]
  output reg_x: Bus[8]
  output reg_y: Bus[8]
  output flag_c: Bit
  output flag_z: Bit
  output flag_n: Bit
  output mem_10: Bus[8]
  output mem_11: Bus[8]

  clock clk

  impl {
    // Program counter
    node pc_reg: Register
    connect clk -> pc_reg.clk

    node pc_inc: Incrementer
    connect pc_reg.q -> pc_inc.in

    // ROM - Test program for ADC, STX, STY
    // $00: CLC           (18)    - Clear carry for clean start
    // $01: LDA #$10      (A9 10) - A = 0x10
    // $03: ADC #$05      (69 05) - A = 0x10 + 0x05 = 0x15, C=0
    // $05: ADC #$05      (69 05) - A = 0x15 + 0x05 = 0x1A, C=0
    // $07: SEC           (38)    - Set carry
    // $08: ADC #$05      (69 05) - A = 0x1A + 0x05 + 1 = 0x20, C=0
    // $0A: LDX #$42      (A2 42) - X = 0x42
    // $0C: STX $10       (86 10) - mem[$10] = X = 0x42
    // $0E: LDY #$55      (A0 55) - Y = 0x55
    // $10: STY $11       (84 11) - mem[$11] = Y = 0x55
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
    node sixteen: Constant(value=16)
    node seventeen: Constant(value=17)

    // Program bytes
    node byte_0: Constant(value=24)    // CLC
    node byte_1: Constant(value=169)   // LDA #imm
    node byte_2: Constant(value=16)    // 0x10
    node byte_3: Constant(value=105)   // ADC #imm
    node byte_4: Constant(value=5)     // 0x05
    node byte_5: Constant(value=105)   // ADC #imm
    node byte_6: Constant(value=5)     // 0x05
    node byte_7: Constant(value=56)    // SEC
    node byte_8: Constant(value=105)   // ADC #imm
    node byte_9: Constant(value=5)     // 0x05
    node byte_10: Constant(value=162)  // LDX #imm
    node byte_11: Constant(value=66)   // 0x42
    node byte_12: Constant(value=134)  // STX zp
    node byte_13: Constant(value=16)   // addr $10
    node byte_14: Constant(value=160)  // LDY #imm
    node byte_15: Constant(value=85)   // 0x55
    node byte_16: Constant(value=132)  // STY zp
    node byte_17: Constant(value=17)   // addr $11

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

    node at_16: Comparator
    connect pc_reg.q -> at_16.a
    connect sixteen.out -> at_16.b

    node at_17: Comparator
    connect pc_reg.q -> at_17.a
    connect seventeen.out -> at_17.b

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

    node mux16: Mux
    connect at_16.eq -> mux16.sel
    connect mux15.out -> mux16.in0
    connect byte_16.out -> mux16.in1

    node rom_out: Mux
    connect at_17.eq -> rom_out.sel
    connect mux16.out -> rom_out.in0
    connect byte_17.out -> rom_out.in1

    // State and subcycle registers
    node state_reg: Register
    node subcycle_reg: Register
    connect clk -> state_reg.clk
    connect clk -> subcycle_reg.clk

    // Instruction register
    node ir_reg: Register
    connect clk -> ir_reg.clk

    // Operand register
    node operand_reg: Register
    connect clk -> operand_reg.clk

    // Address register
    node addr_reg: Register
    connect clk -> addr_reg.clk

    // Control unit
    node control: Part5Control
    connect clk -> control.clk
    connect state_reg.q -> control.current_state
    connect ir_reg.q -> control.current_opcode
    connect subcycle_reg.q -> control.subcycle

    // Register file
    node registers: RegisterFile
    connect clk -> registers.clk

    // Flags
    node flags: FlagRegister
    connect clk -> flags.clk
    connect flags.flag_c -> control.flag_c

    // Data memory
    node memory: SimpleMemory
    connect clk -> memory.clk
    connect addr_reg.q -> memory.addr
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

    connect mem_data_y_mux.out -> memory.data_in

    // ADC: A + M + C
    node adc_result: Adder
    connect registers.reg_a -> adc_result.a
    connect operand_reg.q -> adc_result.b
    connect flags.flag_c -> adc_result.carry_in

    // A register data source
    node result_a_adc: Mux
    connect control.is_adc_imm -> result_a_adc.sel
    connect operand_reg.q -> result_a_adc.in0
    connect adc_result.sum -> result_a_adc.in1

    connect result_a_adc.out -> registers.data_a
    connect control.write_a -> registers.write_a

    // X register data source (just operand for LDX)
    connect operand_reg.q -> registers.data_x
    connect control.write_x -> registers.write_x

    // Y register data source (just operand for LDY)
    connect operand_reg.q -> registers.data_y
    connect control.write_y -> registers.write_y

    // State machine wiring
    node always_on: Constant(value=1)
    connect always_on.out -> state_reg.we
    connect control.next_state -> state_reg.data
    connect always_on.out -> subcycle_reg.we
    connect control.next_subcycle -> subcycle_reg.data

    // IR load
    connect control.ir_load -> ir_reg.we
    connect rom_out.out -> ir_reg.data

    // Operand load
    connect control.operand_load -> operand_reg.we
    connect rom_out.out -> operand_reg.data

    // Address load
    connect control.addr_lo_load -> addr_reg.we
    connect rom_out.out -> addr_reg.data

    // PC control
    node pc_next: Mux
    connect control.pc_increment -> pc_next.sel
    connect pc_reg.q -> pc_next.in0
    connect pc_inc.out -> pc_next.in1

    connect always_on.out -> pc_reg.we
    connect pc_next.out -> pc_reg.data

    // Flag logic
    // N flag = bit 7 of result (use Splitter8to8 to extract bit 7)
    node split_a: Splitter8to8
    connect result_a_adc.out -> split_a.in

    node split_operand: Splitter8to8
    connect operand_reg.q -> split_operand.in

    // Select N based on which register is being written
    node n_value_x: Mux
    connect control.write_x -> n_value_x.sel
    connect split_a.bit7 -> n_value_x.in0
    connect split_operand.bit7 -> n_value_x.in1

    node n_value: Mux
    connect control.write_y -> n_value.sel
    connect n_value_x.out -> n_value.in0
    connect split_operand.bit7 -> n_value.in1

    connect n_value.out -> flags.new_n

    // Z flag = result == 0 (use Comparator with zero)
    node z_check_a: Comparator
    connect result_a_adc.out -> z_check_a.a
    connect zero.out -> z_check_a.b

    node z_check_operand: Comparator
    connect operand_reg.q -> z_check_operand.a
    connect zero.out -> z_check_operand.b

    node z_value_x: Mux
    connect control.write_x -> z_value_x.sel
    connect z_check_a.eq -> z_value_x.in0
    connect z_check_operand.eq -> z_value_x.in1

    node z_value: Mux
    connect control.write_y -> z_value.sel
    connect z_value_x.out -> z_value.in0
    connect z_check_operand.eq -> z_value.in1

    connect z_value.out -> flags.new_z

    // C flag - from ADC or SEC/CLC
    node c_from_adc: Mux
    connect control.is_adc_imm -> c_from_adc.sel
    connect flags.flag_c -> c_from_adc.in0
    connect adc_result.carry_out -> c_from_adc.in1

    node c_from_sec: Mux
    connect control.set_c -> c_from_sec.sel
    connect c_from_adc.out -> c_from_sec.in0
    connect always_on.out -> c_from_sec.in1

    node c_value: Mux
    connect control.clear_c -> c_value.sel
    connect c_from_sec.out -> c_value.in0
    connect zero.out -> c_value.in1

    connect c_value.out -> flags.new_c

    // V flag (not used in this test)
    connect zero.out -> flags.new_v

    // Flag updates
    connect control.update_flags -> flags.update_n
    connect control.update_flags -> flags.update_z

    node update_c_signal: Or
    connect control.update_flags -> update_c_signal.a
    connect control.update_c_only -> update_c_signal.b
    connect update_c_signal.out -> flags.update_c

    connect zero.out -> flags.update_v

    // Outputs
    connect pc_reg.q -> pc
    connect registers.reg_a -> reg_a
    connect registers.reg_x -> reg_x
    connect registers.reg_y -> reg_y
    connect flags.flag_c -> flag_c
    connect flags.flag_z -> flag_z
    connect flags.flag_n -> flag_n

    // Memory outputs - read addresses $10 and $11
    node addr_10: Constant(value=16)
    node addr_11: Constant(value=17)

    node at_addr_10: Comparator
    connect addr_reg.q -> at_addr_10.a
    connect addr_10.out -> at_addr_10.b

    node at_addr_11: Comparator
    connect addr_reg.q -> at_addr_11.a
    connect addr_11.out -> at_addr_11.b

    // We need to expose memory contents - use the memory output
    connect memory.data_out -> mem_10
    connect memory.data_out -> mem_11
  }
}

// === Top-level Test Circuit ===
circuit Part5Test {
  output pc: Bus[8]
  output reg_a: Bus[8]
  output reg_x: Bus[8]
  output reg_y: Bus[8]
  output flag_c: Bit
  output flag_z: Bit
  output flag_n: Bit

  clock clk

  impl {
    node zero: Constant(value=0)

    node cpu: Part5TestCPU
    connect clk -> cpu.clk
    connect zero.out -> cpu.reset

    connect cpu.pc -> pc
    connect cpu.reg_a -> reg_a
    connect cpu.reg_x -> reg_x
    connect cpu.reg_y -> reg_y
    connect cpu.flag_c -> flag_c
    connect cpu.flag_z -> flag_z
    connect cpu.flag_n -> flag_n
  }
}
