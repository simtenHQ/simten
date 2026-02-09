// Stage 6 Part 6 Test: ASL, LSR, ROL, ROR (Accumulator mode)
// Tests:
// - ASL A (0x0A) - Arithmetic Shift Left Accumulator
// - LSR A (0x4A) - Logical Shift Right Accumulator
// - ROL A (0x2A) - Rotate Left through Carry Accumulator
// - ROR A (0x6A) - Rotate Right through Carry Accumulator

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
  input write_a: Bit

  output reg_a: Bus[8]

  clock clk

  impl {
    node regA: Register
    connect clk -> regA.clk
    connect data_a -> regA.data
    connect write_a -> regA.we
    connect regA.q -> reg_a
  }
}

// === Simplified Control for Part 6 Test ===
circuit Part6Control {
  input current_state: Bus[8]
  input current_opcode: Bus[8]
  input subcycle: Bus[8]
  input flag_c: Bit

  output next_state: Bus[8]
  output next_subcycle: Bus[8]
  output pc_increment: Bit
  output ir_load: Bit
  output operand_load: Bit
  output write_a: Bit
  output update_flags: Bit
  output update_c_only: Bit
  output set_c: Bit
  output clear_c: Bit
  output is_asl_a: Bit
  output is_lsr_a: Bit
  output is_rol_a: Bit
  output is_ror_a: Bit
  output is_lda_imm: Bit

  clock clk

  impl {
    // States
    node STATE_FETCH: Constant(value=0)
    node STATE_DECODE: Constant(value=1)
    node STATE_EXECUTE: Constant(value=2)

    // Subcycle constants
    node SUB0: Constant(value=0)
    node SUB1: Constant(value=1)

    // Instruction opcodes
    node LDA_IMM: Constant(value=169)  // 0xA9
    node SEC: Constant(value=56)       // 0x38
    node CLC: Constant(value=24)       // 0x18
    node ASL_A: Constant(value=10)     // 0x0A
    node LSR_A: Constant(value=74)     // 0x4A
    node ROL_A: Constant(value=42)     // 0x2A
    node ROR_A: Constant(value=106)    // 0x6A

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

    node exec_sub0: And
    connect is_execute.eq -> exec_sub0.a
    connect at_sub0.eq -> exec_sub0.b

    node exec_sub1: And
    connect is_execute.eq -> exec_sub1.a
    connect at_sub1.eq -> exec_sub1.b

    // Instruction comparators
    node cmp_lda_imm: Comparator
    connect current_opcode -> cmp_lda_imm.a
    connect LDA_IMM.out -> cmp_lda_imm.b
    connect cmp_lda_imm.eq -> is_lda_imm

    node cmp_sec: Comparator
    connect current_opcode -> cmp_sec.a
    connect SEC.out -> cmp_sec.b

    node cmp_clc: Comparator
    connect current_opcode -> cmp_clc.a
    connect CLC.out -> cmp_clc.b

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

    // 1-cycle instructions
    node is_1cycle_1: Or
    connect cmp_sec.eq -> is_1cycle_1.a
    connect cmp_clc.eq -> is_1cycle_1.b

    node is_1cycle_2: Or
    connect is_1cycle_1.out -> is_1cycle_2.a
    connect cmp_asl_a.eq -> is_1cycle_2.b

    node is_1cycle_3: Or
    connect is_1cycle_2.out -> is_1cycle_3.a
    connect cmp_lsr_a.eq -> is_1cycle_3.b

    node is_1cycle_4: Or
    connect is_1cycle_3.out -> is_1cycle_4.a
    connect cmp_rol_a.eq -> is_1cycle_4.b

    node is_1cycle: Or
    connect is_1cycle_4.out -> is_1cycle.a
    connect cmp_ror_a.eq -> is_1cycle.b

    // Immediate instructions
    node is_imm: Or
    connect cmp_lda_imm.eq -> is_imm.a
    connect cmp_lda_imm.eq -> is_imm.b

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

    // Done conditions
    node done_1cycle: And
    connect exec_sub0.out -> done_1cycle.a
    connect is_1cycle.out -> done_1cycle.b

    node done_imm: And
    connect exec_sub1.out -> done_imm.a
    connect is_imm.out -> done_imm.b

    node done: Or
    connect done_1cycle.out -> done.a
    connect done_imm.out -> done.b

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
    connect is_imm.out -> pc_inc_exec.b

    node pc_inc_signal: Or
    connect pc_inc_fetch.out -> pc_inc_signal.a
    connect pc_inc_exec.out -> pc_inc_signal.b
    connect pc_inc_signal.out -> pc_increment

    // IR load
    connect is_fetch.eq -> ir_load

    // Operand load for LDA
    node operand_load_signal: And
    connect exec_sub0.out -> operand_load_signal.a
    connect is_imm.out -> operand_load_signal.b
    connect operand_load_signal.out -> operand_load

    // Write A - LDA at sub1, shift/rotate at sub0
    node write_a_lda: And
    connect exec_sub1.out -> write_a_lda.a
    connect cmp_lda_imm.eq -> write_a_lda.b

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

    node write_a_signal: Or
    connect write_a_lda.out -> write_a_signal.a
    connect write_a_shift.out -> write_a_signal.b
    connect write_a_signal.out -> write_a

    // Update flags - LDA at sub1, shift/rotate at sub0
    node update_flags_lda: And
    connect exec_sub1.out -> update_flags_lda.a
    connect cmp_lda_imm.eq -> update_flags_lda.b

    node update_flags_shift: And
    connect exec_sub0.out -> update_flags_shift.a
    connect is_shift_rotate_all.out -> update_flags_shift.b

    node update_flags_signal: Or
    connect update_flags_lda.out -> update_flags_signal.a
    connect update_flags_shift.out -> update_flags_signal.b
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

// === Part 6 Test CPU ===
circuit Part6TestCPU {
  input reset: Bit

  output pc: Bus[8]
  output reg_a: Bus[8]
  output flag_c: Bit
  output flag_z: Bit
  output flag_n: Bit

  clock clk

  impl {
    // Program counter
    node pc_reg: Register
    connect clk -> pc_reg.clk

    node pc_inc: Incrementer
    connect pc_reg.q -> pc_inc.in

    // ROM - Test program for shift/rotate
    // Test 1: ASL
    // $00: LDA #$41      (A9 41) - A = 0b01000001 = 0x41
    // $02: ASL A         (0A)    - A = 0b10000010 = 0x82, C=0
    // $03: ASL A         (0A)    - A = 0b00000100 = 0x04, C=1 (bit 7 was 1)
    //
    // Test 2: LSR
    // $04: LDA #$82      (A9 82) - A = 0b10000010 = 0x82
    // $06: LSR A         (4A)    - A = 0b01000001 = 0x41, C=0
    // $07: LSR A         (4A)    - A = 0b00100000 = 0x20, C=1 (bit 0 was 1)
    //
    // Test 3: ROL with C=0
    // $08: CLC           (18)    - Clear carry
    // $09: LDA #$80      (A9 80) - A = 0b10000000
    // $0B: ROL A         (2A)    - A = 0b00000000, C=1 (bit 7 shifted to C)
    //
    // Test 4: ROL with C=1
    // $0C: SEC           (38)    - Set carry
    // $0D: LDA #$00      (A9 00) - A = 0x00
    // $0F: ROL A         (2A)    - A = 0b00000001 = 0x01, C=0 (C rotated to bit 0)
    //
    // Test 5: ROR with C=1
    // $10: SEC           (38)    - Set carry
    // $11: LDA #$01      (A9 01) - A = 0b00000001
    // $13: ROR A         (6A)    - A = 0b10000000 = 0x80, C=1 (bit 0 to C, C to bit 7)

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
    node eighteen: Constant(value=18)
    node nineteen: Constant(value=19)
    node twenty: Constant(value=20)

    // Program bytes
    node byte_0: Constant(value=169)   // LDA #imm
    node byte_1: Constant(value=65)    // 0x41
    node byte_2: Constant(value=10)    // ASL A
    node byte_3: Constant(value=10)    // ASL A
    node byte_4: Constant(value=169)   // LDA #imm
    node byte_5: Constant(value=130)   // 0x82
    node byte_6: Constant(value=74)    // LSR A
    node byte_7: Constant(value=74)    // LSR A
    node byte_8: Constant(value=24)    // CLC
    node byte_9: Constant(value=169)   // LDA #imm
    node byte_10: Constant(value=128)  // 0x80
    node byte_11: Constant(value=42)   // ROL A
    node byte_12: Constant(value=56)   // SEC
    node byte_13: Constant(value=169)  // LDA #imm
    node byte_14: Constant(value=0)    // 0x00
    node byte_15: Constant(value=42)   // ROL A
    node byte_16: Constant(value=56)   // SEC
    node byte_17: Constant(value=169)  // LDA #imm
    node byte_18: Constant(value=1)    // 0x01
    node byte_19: Constant(value=106)  // ROR A

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

    node at_18: Comparator
    connect pc_reg.q -> at_18.a
    connect eighteen.out -> at_18.b

    node at_19: Comparator
    connect pc_reg.q -> at_19.a
    connect nineteen.out -> at_19.b

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

    node mux17: Mux
    connect at_17.eq -> mux17.sel
    connect mux16.out -> mux17.in0
    connect byte_17.out -> mux17.in1

    node mux18: Mux
    connect at_18.eq -> mux18.sel
    connect mux17.out -> mux18.in0
    connect byte_18.out -> mux18.in1

    node rom_out: Mux
    connect at_19.eq -> rom_out.sel
    connect mux18.out -> rom_out.in0
    connect byte_19.out -> rom_out.in1

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

    // Control unit
    node control: Part6Control
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

    // Split A into individual bits for shift operations
    node a_bits: Splitter8to8
    connect registers.reg_a -> a_bits.in

    // ASL: A << 1
    node shift_one: Constant(value=1)
    node asl_result: LeftShifter
    connect registers.reg_a -> asl_result.value
    connect shift_one.out -> asl_result.shift

    // LSR: A >> 1
    node lsr_result: RightShifter
    connect registers.reg_a -> lsr_result.value
    connect shift_one.out -> lsr_result.shift

    // ROL: (A << 1) + C
    node rol_adder: Adder
    connect asl_result.result -> rol_adder.a
    connect zero.out -> rol_adder.b
    connect flags.flag_c -> rol_adder.carry_in

    // ROR: (A >> 1) + (C ? 128 : 0)
    node c_times_128: Constant(value=128)
    node ror_add_val: Mux
    connect flags.flag_c -> ror_add_val.sel
    connect zero.out -> ror_add_val.in0
    connect c_times_128.out -> ror_add_val.in1

    node ror_adder: Adder
    connect lsr_result.result -> ror_adder.a
    connect ror_add_val.out -> ror_adder.b
    connect zero.out -> ror_adder.carry_in

    // A register data source mux
    // LDA: operand, ASL/LSR/ROL/ROR: shift result
    node result_a_lda: Mux
    connect control.is_asl_a -> result_a_lda.sel
    connect operand_reg.q -> result_a_lda.in0
    connect asl_result.result -> result_a_lda.in1

    node result_a_lsr: Mux
    connect control.is_lsr_a -> result_a_lsr.sel
    connect result_a_lda.out -> result_a_lsr.in0
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
    connect control.write_a -> registers.write_a

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

    // PC control
    node pc_next: Mux
    connect control.pc_increment -> pc_next.sel
    connect pc_reg.q -> pc_next.in0
    connect pc_inc.out -> pc_next.in1

    connect always_on.out -> pc_reg.we
    connect pc_next.out -> pc_reg.data

    // Flag logic
    // N flag = bit 7 of result
    node split_result: Splitter8to8
    connect result_a.out -> split_result.in
    connect split_result.bit7 -> flags.new_n

    // Z flag = result == 0
    node z_check: Comparator
    connect result_a.out -> z_check.a
    connect zero.out -> z_check.b
    connect z_check.eq -> flags.new_z

    // C flag logic for shift/rotate
    // ASL/ROL: C = old bit 7
    // LSR/ROR: C = old bit 0

    node is_shift_left: Or
    connect control.is_asl_a -> is_shift_left.a
    connect control.is_rol_a -> is_shift_left.b

    node c_from_shift: Mux
    connect is_shift_left.out -> c_from_shift.sel
    connect a_bits.bit0 -> c_from_shift.in0
    connect a_bits.bit7 -> c_from_shift.in1

    // SEC/CLC override
    node c_from_sec: Mux
    connect control.set_c -> c_from_sec.sel
    connect c_from_shift.out -> c_from_sec.in0
    connect always_on.out -> c_from_sec.in1

    node c_value: Mux
    connect control.clear_c -> c_value.sel
    connect c_from_sec.out -> c_value.in0
    connect zero.out -> c_value.in1

    connect c_value.out -> flags.new_c
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
    connect flags.flag_c -> flag_c
    connect flags.flag_z -> flag_z
    connect flags.flag_n -> flag_n
  }
}

// === Top-level Test Circuit ===
circuit Part6Test {
  output pc: Bus[8]
  output reg_a: Bus[8]
  output flag_c: Bit
  output flag_z: Bit
  output flag_n: Bit

  clock clk

  impl {
    node zero: Constant(value=0)

    node cpu: Part6TestCPU
    connect clk -> cpu.clk
    connect zero.out -> cpu.reset

    connect cpu.pc -> pc
    connect cpu.reg_a -> reg_a
    connect cpu.flag_c -> flag_c
    connect cpu.flag_z -> flag_z
    connect cpu.flag_n -> flag_n
  }
}
