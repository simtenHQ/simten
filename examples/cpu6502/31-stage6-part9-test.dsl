// Stage 6 Part 9 Test: ASL, LSR, ROL, ROR (zero page memory modes)
// Tests:
// - ASL zp (0x06) - Arithmetic Shift Left zero page
// - LSR zp (0x46) - Logical Shift Right zero page
// - ROL zp (0x26) - Rotate Left zero page
// - ROR zp (0x66) - Rotate Right zero page

// === Simple Memory ===
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

    node at_10: Comparator
    connect addr -> at_10.a
    connect addr_10.out -> at_10.b

    node at_11: Comparator
    connect addr -> at_11.a
    connect addr_11.out -> at_11.b

    node mem_10: Register
    node mem_11: Register

    connect clk -> mem_10.clk
    connect clk -> mem_11.clk

    connect data_in -> mem_10.data
    connect data_in -> mem_11.data

    node we_10: And
    connect write_enable -> we_10.a
    connect at_10.eq -> we_10.b

    node we_11: And
    connect write_enable -> we_11.a
    connect at_11.eq -> we_11.b

    connect we_10.out -> mem_10.we
    connect we_11.out -> mem_11.we

    node out_10: Mux
    connect at_10.eq -> out_10.sel
    connect zero.out -> out_10.in0
    connect mem_10.q -> out_10.in1

    node out_11: Mux
    connect at_11.eq -> out_11.sel
    connect out_10.out -> out_11.in0
    connect mem_11.q -> out_11.in1

    connect out_11.out -> data_out
  }
}

// === Flag Register ===
circuit FlagRegister {
  input new_n: Bit
  input new_z: Bit
  input new_c: Bit
  input update_n: Bit
  input update_z: Bit
  input update_c: Bit

  output flag_n: Bit
  output flag_z: Bit
  output flag_c: Bit

  clock clk

  impl {
    node reg_n: Register
    node reg_z: Register
    node reg_c: Register

    connect clk -> reg_n.clk
    connect clk -> reg_z.clk
    connect clk -> reg_c.clk

    connect new_n -> reg_n.data
    connect new_z -> reg_z.data
    connect new_c -> reg_c.data

    connect update_n -> reg_n.we
    connect update_z -> reg_z.we
    connect update_c -> reg_c.we

    connect reg_n.q -> flag_n
    connect reg_z.q -> flag_z
    connect reg_c.q -> flag_c
  }
}

// === Part 9 Test CPU ===
// Test program:
//   $00: LDA #$41     (A9 41) - Load 0x41 into A
//   $02: STA $10      (85 10) - Store at $10
//   $04: ASL $10      (06 10) - $10 = 0x82, C=0
//   $06: LDA $10      (A5 10) - A = 0x82
//   $08: ASL $10      (06 10) - $10 = 0x04, C=1
//   $0A: LDA #$82     (A9 82) - A = 0x82
//   $0C: STA $10      (85 10) - Store at $10
//   $0E: LSR $10      (46 10) - $10 = 0x41, C=0
//   $10: LDA $10      (A5 10) - A = 0x41
//   $12: SEC          (38)    - Set carry for ROL test
//   $13: LDA #$80     (A9 80) - A = 0x80
//   $15: STA $10      (85 10) - Store at $10
//   $17: ROL $10      (26 10) - $10 = 0x01 (with C=1), C=1
//   $19: LDA $10      (A5 10) - A = 0x01
//   $1B: SEC          (38)    - Set carry for ROR test
//   $1C: LDA #$01     (A9 01) - A = 0x01
//   $1E: STA $10      (85 10) - Store at $10
//   $20: ROR $10      (66 10) - $10 = 0x80 (with C=1), C=1

circuit Part9TestCPU {
  input reset: Bit

  output pc: Bus[8]
  output reg_a: Bus[8]
  output flag_n: Bit
  output flag_z: Bit
  output flag_c: Bit

  clock clk

  impl {
    // Constants
    node zero: Constant(value=0)
    node one: Constant(value=1)

    // Program counter
    node pc_reg: Register
    connect clk -> pc_reg.clk

    node pc_inc: Incrementer
    connect pc_reg.q -> pc_inc.in

    // State machine
    node state_reg: Register
    connect clk -> state_reg.clk
    node always_on: Constant(value=1)
    connect always_on.out -> state_reg.we

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

    // Subcycle counter
    node subcycle_reg: Register
    connect clk -> subcycle_reg.clk
    connect always_on.out -> subcycle_reg.we

    node sub_inc: Incrementer
    connect subcycle_reg.q -> sub_inc.in

    node subcycle_next: Mux
    connect is_execute.eq -> subcycle_next.sel
    connect zero.out -> subcycle_next.in0
    connect sub_inc.out -> subcycle_next.in1

    connect subcycle_next.out -> subcycle_reg.data

    // Subcycle comparators
    node two: Constant(value=2)
    node three: Constant(value=3)
    node four: Constant(value=4)

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

    // Registers
    node ir_reg: Register
    connect clk -> ir_reg.clk
    connect is_fetch.eq -> ir_reg.we

    node operand_reg: Register
    connect clk -> operand_reg.clk

    node a_reg: Register
    connect clk -> a_reg.clk

    // Flags
    node flags: FlagRegister
    connect clk -> flags.clk

    // ROM - Test program
    node byte_00: Constant(value=169)  // LDA #imm
    node byte_01: Constant(value=65)   // $41
    node byte_02: Constant(value=133)  // STA zp
    node byte_03: Constant(value=16)   // $10
    node byte_04: Constant(value=6)    // ASL zp
    node byte_05: Constant(value=16)   // $10
    node byte_06: Constant(value=165)  // LDA zp
    node byte_07: Constant(value=16)   // $10
    node byte_08: Constant(value=6)    // ASL zp
    node byte_09: Constant(value=16)   // $10
    node byte_0A: Constant(value=169)  // LDA #imm
    node byte_0B: Constant(value=130)  // $82
    node byte_0C: Constant(value=133)  // STA zp
    node byte_0D: Constant(value=16)   // $10
    node byte_0E: Constant(value=70)   // LSR zp
    node byte_0F: Constant(value=16)   // $10
    node byte_10: Constant(value=165)  // LDA zp
    node byte_11: Constant(value=16)   // $10
    node byte_12: Constant(value=56)   // SEC
    node byte_13: Constant(value=169)  // LDA #imm
    node byte_14: Constant(value=128)  // $80
    node byte_15: Constant(value=133)  // STA zp
    node byte_16: Constant(value=16)   // $10
    node byte_17: Constant(value=38)   // ROL zp
    node byte_18: Constant(value=16)   // $10
    node byte_19: Constant(value=165)  // LDA zp
    node byte_1A: Constant(value=16)   // $10
    node byte_1B: Constant(value=56)   // SEC
    node byte_1C: Constant(value=169)  // LDA #imm
    node byte_1D: Constant(value=1)    // $01
    node byte_1E: Constant(value=133)  // STA zp
    node byte_1F: Constant(value=16)   // $10
    node byte_20: Constant(value=102)  // ROR zp
    node byte_21: Constant(value=16)   // $10
    node byte_22: Constant(value=165)  // LDA zp
    node byte_23: Constant(value=16)   // $10

    // PC comparators and ROM mux
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
    node twentyone: Constant(value=21)
    node twentytwo: Constant(value=22)
    node twentythree: Constant(value=23)
    node twentyfour: Constant(value=24)
    node twentyfive: Constant(value=25)
    node twentysix: Constant(value=26)
    node twentyseven: Constant(value=27)
    node twentyeight: Constant(value=28)
    node twentynine: Constant(value=29)
    node thirty: Constant(value=30)
    node thirtyone: Constant(value=31)
    node thirtytwo: Constant(value=32)
    node thirtythree: Constant(value=33)
    node thirtyfour: Constant(value=34)
    node thirtyfive: Constant(value=35)

    node at_01: Comparator
    connect pc_reg.q -> at_01.a
    connect one.out -> at_01.b

    node at_02: Comparator
    connect pc_reg.q -> at_02.a
    connect two.out -> at_02.b

    node at_03: Comparator
    connect pc_reg.q -> at_03.a
    connect three.out -> at_03.b

    node at_04: Comparator
    connect pc_reg.q -> at_04.a
    connect four.out -> at_04.b

    node at_05: Comparator
    connect pc_reg.q -> at_05.a
    connect five.out -> at_05.b

    node at_06: Comparator
    connect pc_reg.q -> at_06.a
    connect six.out -> at_06.b

    node at_07: Comparator
    connect pc_reg.q -> at_07.a
    connect seven.out -> at_07.b

    node at_08: Comparator
    connect pc_reg.q -> at_08.a
    connect eight.out -> at_08.b

    node at_09: Comparator
    connect pc_reg.q -> at_09.a
    connect nine.out -> at_09.b

    node at_0A: Comparator
    connect pc_reg.q -> at_0A.a
    connect ten.out -> at_0A.b

    node at_0B: Comparator
    connect pc_reg.q -> at_0B.a
    connect eleven.out -> at_0B.b

    node at_0C: Comparator
    connect pc_reg.q -> at_0C.a
    connect twelve.out -> at_0C.b

    node at_0D: Comparator
    connect pc_reg.q -> at_0D.a
    connect thirteen.out -> at_0D.b

    node at_0E: Comparator
    connect pc_reg.q -> at_0E.a
    connect fourteen.out -> at_0E.b

    node at_0F: Comparator
    connect pc_reg.q -> at_0F.a
    connect fifteen.out -> at_0F.b

    node at_10: Comparator
    connect pc_reg.q -> at_10.a
    connect sixteen.out -> at_10.b

    node at_11: Comparator
    connect pc_reg.q -> at_11.a
    connect seventeen.out -> at_11.b

    node at_12: Comparator
    connect pc_reg.q -> at_12.a
    connect eighteen.out -> at_12.b

    node at_13: Comparator
    connect pc_reg.q -> at_13.a
    connect nineteen.out -> at_13.b

    node at_14: Comparator
    connect pc_reg.q -> at_14.a
    connect twenty.out -> at_14.b

    node at_15: Comparator
    connect pc_reg.q -> at_15.a
    connect twentyone.out -> at_15.b

    node at_16: Comparator
    connect pc_reg.q -> at_16.a
    connect twentytwo.out -> at_16.b

    node at_17: Comparator
    connect pc_reg.q -> at_17.a
    connect twentythree.out -> at_17.b

    node at_18: Comparator
    connect pc_reg.q -> at_18.a
    connect twentyfour.out -> at_18.b

    node at_19: Comparator
    connect pc_reg.q -> at_19.a
    connect twentyfive.out -> at_19.b

    node at_1A: Comparator
    connect pc_reg.q -> at_1A.a
    connect twentysix.out -> at_1A.b

    node at_1B: Comparator
    connect pc_reg.q -> at_1B.a
    connect twentyseven.out -> at_1B.b

    node at_1C: Comparator
    connect pc_reg.q -> at_1C.a
    connect twentyeight.out -> at_1C.b

    node at_1D: Comparator
    connect pc_reg.q -> at_1D.a
    connect twentynine.out -> at_1D.b

    node at_1E: Comparator
    connect pc_reg.q -> at_1E.a
    connect thirty.out -> at_1E.b

    node at_1F: Comparator
    connect pc_reg.q -> at_1F.a
    connect thirtyone.out -> at_1F.b

    node at_20: Comparator
    connect pc_reg.q -> at_20.a
    connect thirtytwo.out -> at_20.b

    node at_21: Comparator
    connect pc_reg.q -> at_21.a
    connect thirtythree.out -> at_21.b

    node at_22: Comparator
    connect pc_reg.q -> at_22.a
    connect thirtyfour.out -> at_22.b

    node at_23: Comparator
    connect pc_reg.q -> at_23.a
    connect thirtyfive.out -> at_23.b

    // ROM mux cascade
    node mux_01: Mux
    connect at_01.eq -> mux_01.sel
    connect byte_00.out -> mux_01.in0
    connect byte_01.out -> mux_01.in1

    node mux_02: Mux
    connect at_02.eq -> mux_02.sel
    connect mux_01.out -> mux_02.in0
    connect byte_02.out -> mux_02.in1

    node mux_03: Mux
    connect at_03.eq -> mux_03.sel
    connect mux_02.out -> mux_03.in0
    connect byte_03.out -> mux_03.in1

    node mux_04: Mux
    connect at_04.eq -> mux_04.sel
    connect mux_03.out -> mux_04.in0
    connect byte_04.out -> mux_04.in1

    node mux_05: Mux
    connect at_05.eq -> mux_05.sel
    connect mux_04.out -> mux_05.in0
    connect byte_05.out -> mux_05.in1

    node mux_06: Mux
    connect at_06.eq -> mux_06.sel
    connect mux_05.out -> mux_06.in0
    connect byte_06.out -> mux_06.in1

    node mux_07: Mux
    connect at_07.eq -> mux_07.sel
    connect mux_06.out -> mux_07.in0
    connect byte_07.out -> mux_07.in1

    node mux_08: Mux
    connect at_08.eq -> mux_08.sel
    connect mux_07.out -> mux_08.in0
    connect byte_08.out -> mux_08.in1

    node mux_09: Mux
    connect at_09.eq -> mux_09.sel
    connect mux_08.out -> mux_09.in0
    connect byte_09.out -> mux_09.in1

    node mux_0A: Mux
    connect at_0A.eq -> mux_0A.sel
    connect mux_09.out -> mux_0A.in0
    connect byte_0A.out -> mux_0A.in1

    node mux_0B: Mux
    connect at_0B.eq -> mux_0B.sel
    connect mux_0A.out -> mux_0B.in0
    connect byte_0B.out -> mux_0B.in1

    node mux_0C: Mux
    connect at_0C.eq -> mux_0C.sel
    connect mux_0B.out -> mux_0C.in0
    connect byte_0C.out -> mux_0C.in1

    node mux_0D: Mux
    connect at_0D.eq -> mux_0D.sel
    connect mux_0C.out -> mux_0D.in0
    connect byte_0D.out -> mux_0D.in1

    node mux_0E: Mux
    connect at_0E.eq -> mux_0E.sel
    connect mux_0D.out -> mux_0E.in0
    connect byte_0E.out -> mux_0E.in1

    node mux_0F: Mux
    connect at_0F.eq -> mux_0F.sel
    connect mux_0E.out -> mux_0F.in0
    connect byte_0F.out -> mux_0F.in1

    node mux_10: Mux
    connect at_10.eq -> mux_10.sel
    connect mux_0F.out -> mux_10.in0
    connect byte_10.out -> mux_10.in1

    node mux_11: Mux
    connect at_11.eq -> mux_11.sel
    connect mux_10.out -> mux_11.in0
    connect byte_11.out -> mux_11.in1

    node mux_12: Mux
    connect at_12.eq -> mux_12.sel
    connect mux_11.out -> mux_12.in0
    connect byte_12.out -> mux_12.in1

    node mux_13: Mux
    connect at_13.eq -> mux_13.sel
    connect mux_12.out -> mux_13.in0
    connect byte_13.out -> mux_13.in1

    node mux_14: Mux
    connect at_14.eq -> mux_14.sel
    connect mux_13.out -> mux_14.in0
    connect byte_14.out -> mux_14.in1

    node mux_15: Mux
    connect at_15.eq -> mux_15.sel
    connect mux_14.out -> mux_15.in0
    connect byte_15.out -> mux_15.in1

    node mux_16: Mux
    connect at_16.eq -> mux_16.sel
    connect mux_15.out -> mux_16.in0
    connect byte_16.out -> mux_16.in1

    node mux_17: Mux
    connect at_17.eq -> mux_17.sel
    connect mux_16.out -> mux_17.in0
    connect byte_17.out -> mux_17.in1

    node mux_18: Mux
    connect at_18.eq -> mux_18.sel
    connect mux_17.out -> mux_18.in0
    connect byte_18.out -> mux_18.in1

    node mux_19: Mux
    connect at_19.eq -> mux_19.sel
    connect mux_18.out -> mux_19.in0
    connect byte_19.out -> mux_19.in1

    node mux_1A: Mux
    connect at_1A.eq -> mux_1A.sel
    connect mux_19.out -> mux_1A.in0
    connect byte_1A.out -> mux_1A.in1

    node mux_1B: Mux
    connect at_1B.eq -> mux_1B.sel
    connect mux_1A.out -> mux_1B.in0
    connect byte_1B.out -> mux_1B.in1

    node mux_1C: Mux
    connect at_1C.eq -> mux_1C.sel
    connect mux_1B.out -> mux_1C.in0
    connect byte_1C.out -> mux_1C.in1

    node mux_1D: Mux
    connect at_1D.eq -> mux_1D.sel
    connect mux_1C.out -> mux_1D.in0
    connect byte_1D.out -> mux_1D.in1

    node mux_1E: Mux
    connect at_1E.eq -> mux_1E.sel
    connect mux_1D.out -> mux_1E.in0
    connect byte_1E.out -> mux_1E.in1

    node mux_1F: Mux
    connect at_1F.eq -> mux_1F.sel
    connect mux_1E.out -> mux_1F.in0
    connect byte_1F.out -> mux_1F.in1

    node mux_20: Mux
    connect at_20.eq -> mux_20.sel
    connect mux_1F.out -> mux_20.in0
    connect byte_20.out -> mux_20.in1

    node mux_21: Mux
    connect at_21.eq -> mux_21.sel
    connect mux_20.out -> mux_21.in0
    connect byte_21.out -> mux_21.in1

    node mux_22: Mux
    connect at_22.eq -> mux_22.sel
    connect mux_21.out -> mux_22.in0
    connect byte_22.out -> mux_22.in1

    node rom: Mux
    connect at_23.eq -> rom.sel
    connect mux_22.out -> rom.in0
    connect byte_23.out -> rom.in1

    connect rom.out -> ir_reg.data

    // Instruction decode
    node LDA_IMM: Constant(value=169)
    node LDA_ZP: Constant(value=165)
    node STA_ZP: Constant(value=133)
    node SEC: Constant(value=56)
    node ASL_ZP: Constant(value=6)
    node LSR_ZP: Constant(value=70)
    node ROL_ZP: Constant(value=38)
    node ROR_ZP: Constant(value=102)

    node cmp_lda_imm: Comparator
    connect ir_reg.q -> cmp_lda_imm.a
    connect LDA_IMM.out -> cmp_lda_imm.b

    node cmp_lda_zp: Comparator
    connect ir_reg.q -> cmp_lda_zp.a
    connect LDA_ZP.out -> cmp_lda_zp.b

    node cmp_sta_zp: Comparator
    connect ir_reg.q -> cmp_sta_zp.a
    connect STA_ZP.out -> cmp_sta_zp.b

    node cmp_sec: Comparator
    connect ir_reg.q -> cmp_sec.a
    connect SEC.out -> cmp_sec.b

    node cmp_asl_zp: Comparator
    connect ir_reg.q -> cmp_asl_zp.a
    connect ASL_ZP.out -> cmp_asl_zp.b

    node cmp_lsr_zp: Comparator
    connect ir_reg.q -> cmp_lsr_zp.a
    connect LSR_ZP.out -> cmp_lsr_zp.b

    node cmp_rol_zp: Comparator
    connect ir_reg.q -> cmp_rol_zp.a
    connect ROL_ZP.out -> cmp_rol_zp.b

    node cmp_ror_zp: Comparator
    connect ir_reg.q -> cmp_ror_zp.a
    connect ROR_ZP.out -> cmp_ror_zp.b

    // is_rmw: ASL, LSR, ROL, ROR
    node is_rmw_1: Or
    connect cmp_asl_zp.eq -> is_rmw_1.a
    connect cmp_lsr_zp.eq -> is_rmw_1.b

    node is_rmw_2: Or
    connect cmp_rol_zp.eq -> is_rmw_2.a
    connect cmp_ror_zp.eq -> is_rmw_2.b

    node is_rmw: Or
    connect is_rmw_1.out -> is_rmw.a
    connect is_rmw_2.out -> is_rmw.b

    // is_zp: LDA_ZP, STA_ZP, RMW
    node is_zp_1: Or
    connect cmp_lda_zp.eq -> is_zp_1.a
    connect cmp_sta_zp.eq -> is_zp_1.b

    node is_zp: Or
    connect is_zp_1.out -> is_zp.a
    connect is_rmw.out -> is_zp.b

    // Exec subcycle checks
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
    node done_lda_imm: And
    connect exec_sub1.out -> done_lda_imm.a
    connect cmp_lda_imm.eq -> done_lda_imm.b

    // SEC is 1-cycle
    node done_sec: And
    connect exec_sub0.out -> done_sec.a
    connect cmp_sec.eq -> done_sec.b

    // Non-RMW ZP done at sub3
    node not_rmw: Not
    connect is_rmw.out -> not_rmw.in

    node is_zp_non_rmw: And
    connect is_zp.out -> is_zp_non_rmw.a
    connect not_rmw.out -> is_zp_non_rmw.b

    node done_zp: And
    connect exec_sub3.out -> done_zp.a
    connect is_zp_non_rmw.out -> done_zp.b

    // RMW done at sub4
    node done_rmw: And
    connect exec_sub4.out -> done_rmw.a
    connect is_rmw.out -> done_rmw.b

    node done_temp1: Or
    connect done_lda_imm.out -> done_temp1.a
    connect done_sec.out -> done_temp1.b

    node done_temp2: Or
    connect done_temp1.out -> done_temp2.a
    connect done_zp.out -> done_temp2.b

    node exec_done: Or
    connect done_temp2.out -> exec_done.a
    connect done_rmw.out -> exec_done.b

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

    // PC control
    node needs_operand_1: Or
    connect cmp_lda_imm.eq -> needs_operand_1.a
    connect is_zp.out -> needs_operand_1.b

    node pc_inc_sub0: And
    connect exec_sub0.out -> pc_inc_sub0.a
    connect needs_operand_1.out -> pc_inc_sub0.b

    node pc_inc_signal: Or
    connect is_fetch.eq -> pc_inc_signal.a
    connect pc_inc_sub0.out -> pc_inc_signal.b

    node pc_next: Mux
    connect pc_inc_signal.out -> pc_next.sel
    connect pc_reg.q -> pc_next.in0
    connect pc_inc.out -> pc_next.in1

    node pc_reset: Mux
    connect reset -> pc_reset.sel
    connect pc_next.out -> pc_reset.in0
    connect zero.out -> pc_reset.in1

    connect pc_reset.out -> pc_reg.data
    connect always_on.out -> pc_reg.we

    // Operand load
    node operand_load: And
    connect exec_sub0.out -> operand_load.a
    connect needs_operand_1.out -> operand_load.b

    connect operand_load.out -> operand_reg.we
    connect rom.out -> operand_reg.data

    // Memory
    node memory: SimpleMemory
    connect clk -> memory.clk
    connect operand_reg.q -> memory.addr

    // Memory read at sub2 for LDA_ZP and RMW
    node is_load_or_rmw: Or
    connect cmp_lda_zp.eq -> is_load_or_rmw.a
    connect is_rmw.out -> is_load_or_rmw.b

    node mem_read: And
    connect exec_sub2.out -> mem_read.a
    connect is_load_or_rmw.out -> mem_read.b

    // Memory write at sub2 for STA_ZP
    node mem_write_sta: And
    connect exec_sub2.out -> mem_write_sta.a
    connect cmp_sta_zp.eq -> mem_write_sta.b

    // Memory write at sub3 for RMW
    node mem_write_rmw: And
    connect exec_sub3.out -> mem_write_rmw.a
    connect is_rmw.out -> mem_write_rmw.b

    node mem_write: Or
    connect mem_write_sta.out -> mem_write.a
    connect mem_write_rmw.out -> mem_write.b

    connect mem_write.out -> memory.write_enable

    // Shift/Rotate logic
    node mem_bits: Splitter8to8
    connect memory.data_out -> mem_bits.in

    node mem_shift_one: Constant(value=1)

    // ASL: shift left
    node asl_mem: LeftShifter
    connect memory.data_out -> asl_mem.value
    connect mem_shift_one.out -> asl_mem.shift

    // LSR: shift right
    node lsr_mem: RightShifter
    connect memory.data_out -> lsr_mem.value
    connect mem_shift_one.out -> lsr_mem.shift

    // ROL: (M << 1) + C
    node rol_mem: Adder
    connect asl_mem.result -> rol_mem.a
    connect zero.out -> rol_mem.b
    connect flags.flag_c -> rol_mem.carry_in

    // ROR: (M >> 1) + (C ? 128 : 0)
    node c_times_128: Constant(value=128)
    node ror_add_val: Mux
    connect flags.flag_c -> ror_add_val.sel
    connect zero.out -> ror_add_val.in0
    connect c_times_128.out -> ror_add_val.in1

    node ror_mem: Adder
    connect lsr_mem.result -> ror_mem.a
    connect ror_add_val.out -> ror_mem.b
    connect zero.out -> ror_mem.carry_in

    // RMW result mux
    node rmw_asl_or_lsr: Mux
    connect cmp_asl_zp.eq -> rmw_asl_or_lsr.sel
    connect lsr_mem.result -> rmw_asl_or_lsr.in0
    connect asl_mem.result -> rmw_asl_or_lsr.in1

    node rmw_or_rol: Mux
    connect cmp_rol_zp.eq -> rmw_or_rol.sel
    connect rmw_asl_or_lsr.out -> rmw_or_rol.in0
    connect rol_mem.sum -> rmw_or_rol.in1

    node rmw_result: Mux
    connect cmp_ror_zp.eq -> rmw_result.sel
    connect rmw_or_rol.out -> rmw_result.in0
    connect ror_mem.sum -> rmw_result.in1

    // Memory data_in mux
    node mem_data_in: Mux
    connect is_rmw.out -> mem_data_in.sel
    connect a_reg.q -> mem_data_in.in0
    connect rmw_result.out -> mem_data_in.in1

    connect mem_data_in.out -> memory.data_in

    // A register load
    node load_a_imm: And
    connect exec_sub1.out -> load_a_imm.a
    connect cmp_lda_imm.eq -> load_a_imm.b

    node load_a_zp: And
    connect exec_sub3.out -> load_a_zp.a
    connect cmp_lda_zp.eq -> load_a_zp.b

    node load_a: Or
    connect load_a_imm.out -> load_a.a
    connect load_a_zp.out -> load_a.b

    connect load_a.out -> a_reg.we

    node a_data: Mux
    connect cmp_lda_zp.eq -> a_data.sel
    connect operand_reg.q -> a_data.in0
    connect memory.data_out -> a_data.in1

    connect a_data.out -> a_reg.data

    // Flag updates
    // RMW updates N, Z, C at sub3
    node update_nz_rmw: And
    connect exec_sub3.out -> update_nz_rmw.a
    connect is_rmw.out -> update_nz_rmw.b

    connect update_nz_rmw.out -> flags.update_n
    connect update_nz_rmw.out -> flags.update_z

    // C flag: SEC or shift/rotate
    node update_c_sec: And
    connect exec_sub0.out -> update_c_sec.a
    connect cmp_sec.eq -> update_c_sec.b

    node update_c: Or
    connect update_c_sec.out -> update_c.a
    connect update_nz_rmw.out -> update_c.b

    connect update_c.out -> flags.update_c

    // N flag: bit 7 of result
    node const_128: Constant(value=128)
    node n_check: Comparator
    connect rmw_result.out -> n_check.a
    connect const_128.out -> n_check.b

    node n_flag_val: Or
    connect n_check.gt -> n_flag_val.a
    connect n_check.eq -> n_flag_val.b

    connect n_flag_val.out -> flags.new_n

    // Z flag: result == 0
    node z_check: Comparator
    connect rmw_result.out -> z_check.a
    connect zero.out -> z_check.b

    connect z_check.eq -> flags.new_z

    // C flag value: SEC=1, ASL/ROL=bit7, LSR/ROR=bit0
    node c_from_asl_rol: Mux
    connect cmp_asl_zp.eq -> c_from_asl_rol.sel
    connect zero.out -> c_from_asl_rol.in0
    connect mem_bits.bit7 -> c_from_asl_rol.in1

    node c_with_rol: Mux
    connect cmp_rol_zp.eq -> c_with_rol.sel
    connect c_from_asl_rol.out -> c_with_rol.in0
    connect mem_bits.bit7 -> c_with_rol.in1

    node c_with_lsr: Mux
    connect cmp_lsr_zp.eq -> c_with_lsr.sel
    connect c_with_rol.out -> c_with_lsr.in0
    connect mem_bits.bit0 -> c_with_lsr.in1

    node c_with_ror: Mux
    connect cmp_ror_zp.eq -> c_with_ror.sel
    connect c_with_lsr.out -> c_with_ror.in0
    connect mem_bits.bit0 -> c_with_ror.in1

    // SEC sets C=1
    node const_true: Constant(value=1)
    node c_from_sec: Mux
    connect cmp_sec.eq -> c_from_sec.sel
    connect c_with_ror.out -> c_from_sec.in0
    connect const_true.out -> c_from_sec.in1

    connect c_from_sec.out -> flags.new_c

    // Outputs
    connect pc_reg.q -> pc
    connect a_reg.q -> reg_a
    connect flags.flag_n -> flag_n
    connect flags.flag_z -> flag_z
    connect flags.flag_c -> flag_c
  }
}

// === Test Circuit ===
circuit Part9Test {
  output pc: Bus[8]
  output reg_a: Bus[8]
  output flag_n: Bit
  output flag_z: Bit
  output flag_c: Bit

  clock clk

  impl {
    node zero: Constant(value=0)

    node cpu: Part9TestCPU
    connect clk -> cpu.clk
    connect zero.out -> cpu.reset

    connect cpu.pc -> pc
    connect cpu.reg_a -> reg_a
    connect cpu.flag_n -> flag_n
    connect cpu.flag_z -> flag_z
    connect cpu.flag_c -> flag_c
  }
}
