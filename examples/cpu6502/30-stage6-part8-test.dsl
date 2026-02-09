// Stage 6 Part 8 Test: INC zp, DEC zp (Memory increment/decrement)
// Tests:
// - INC zp (0xE6) - Increment Memory
// - DEC zp (0xC6) - Decrement Memory

// === Simple Memory (same as main DSL) ===
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

// === Part 8 Test Circuit ===
// Test program:
//   $00: LDA #$05    (A9 05) - Load 5 into A
//   $02: STA $10     (85 10) - Store 5 at address $10
//   $04: INC $10     (E6 10) - Increment $10 to 6
//   $06: LDA $10     (A5 10) - Load $10 into A (should be 6)
//   $08: DEC $10     (C6 10) - Decrement $10 to 5
//   $0A: LDA $10     (A5 10) - Load $10 into A (should be 5)
//   $0C: LDA #$00    (A9 00) - Load 0 into A
//   $0E: STA $11     (85 11) - Store 0 at address $11
//   $10: DEC $11     (C6 11) - Decrement $11 to 0xFF (wrap)
//   $12: LDA $11     (A5 11) - Load $11 into A (should be 0xFF, N=1)
//   $14: INC $11     (E6 11) - Increment $11 to 0x00 (Z=1)

circuit Part8TestCPU {
  input reset: Bit

  output pc: Bus[8]
  output reg_a: Bus[8]
  output mem_10: Bus[8]
  output mem_11: Bus[8]
  output flag_n: Bit
  output flag_z: Bit

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

    // State machine: FETCH(0), DECODE(1), EXECUTE(2)
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

    // Instruction register
    node ir_reg: Register
    connect clk -> ir_reg.clk
    connect is_fetch.eq -> ir_reg.we

    // Operand register (address for ZP instructions)
    node operand_reg: Register
    connect clk -> operand_reg.clk

    // A register
    node a_reg: Register
    connect clk -> a_reg.clk

    // Flag registers
    node n_reg: Register
    node z_reg: Register
    connect clk -> n_reg.clk
    connect clk -> z_reg.clk

    // ROM - Test program
    // $00: A9 05  LDA #$05
    // $02: 85 10  STA $10
    // $04: E6 10  INC $10
    // $06: A5 10  LDA $10
    // $08: C6 10  DEC $10
    // $0A: A5 10  LDA $10
    // $0C: A9 00  LDA #$00
    // $0E: 85 11  STA $11
    // $10: C6 11  DEC $11
    // $12: A5 11  LDA $11
    // $14: E6 11  INC $11
    node byte_00: Constant(value=169)  // LDA #imm
    node byte_01: Constant(value=5)    // $05
    node byte_02: Constant(value=133)  // STA zp
    node byte_03: Constant(value=16)   // $10
    node byte_04: Constant(value=230)  // INC zp
    node byte_05: Constant(value=16)   // $10
    node byte_06: Constant(value=165)  // LDA zp
    node byte_07: Constant(value=16)   // $10
    node byte_08: Constant(value=198)  // DEC zp
    node byte_09: Constant(value=16)   // $10
    node byte_0A: Constant(value=165)  // LDA zp
    node byte_0B: Constant(value=16)   // $10
    node byte_0C: Constant(value=169)  // LDA #imm
    node byte_0D: Constant(value=0)    // $00
    node byte_0E: Constant(value=133)  // STA zp
    node byte_0F: Constant(value=17)   // $11
    node byte_10: Constant(value=198)  // DEC zp
    node byte_11: Constant(value=17)   // $11
    node byte_12: Constant(value=165)  // LDA zp
    node byte_13: Constant(value=17)   // $11
    node byte_14: Constant(value=230)  // INC zp
    node byte_15: Constant(value=17)   // $11

    // PC comparators
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

    node at_00: Comparator
    connect pc_reg.q -> at_00.a
    connect zero.out -> at_00.b

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

    node rom: Mux
    connect at_15.eq -> rom.sel
    connect mux_14.out -> rom.in0
    connect byte_15.out -> rom.in1

    connect rom.out -> ir_reg.data

    // Instruction decode
    node LDA_IMM: Constant(value=169)  // 0xA9
    node LDA_ZP: Constant(value=165)   // 0xA5
    node STA_ZP: Constant(value=133)   // 0x85
    node INC_ZP: Constant(value=230)   // 0xE6
    node DEC_ZP: Constant(value=198)   // 0xC6

    node cmp_lda_imm: Comparator
    connect ir_reg.q -> cmp_lda_imm.a
    connect LDA_IMM.out -> cmp_lda_imm.b

    node cmp_lda_zp: Comparator
    connect ir_reg.q -> cmp_lda_zp.a
    connect LDA_ZP.out -> cmp_lda_zp.b

    node cmp_sta_zp: Comparator
    connect ir_reg.q -> cmp_sta_zp.a
    connect STA_ZP.out -> cmp_sta_zp.b

    node cmp_inc_zp: Comparator
    connect ir_reg.q -> cmp_inc_zp.a
    connect INC_ZP.out -> cmp_inc_zp.b

    node cmp_dec_zp: Comparator
    connect ir_reg.q -> cmp_dec_zp.a
    connect DEC_ZP.out -> cmp_dec_zp.b

    // is_rmw = INC or DEC
    node is_rmw: Or
    connect cmp_inc_zp.eq -> is_rmw.a
    connect cmp_dec_zp.eq -> is_rmw.b

    // is_zp = LDA_ZP or STA_ZP or INC_ZP or DEC_ZP
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

    node done_temp: Or
    connect done_lda_imm.out -> done_temp.a
    connect done_zp.out -> done_temp.b

    node exec_done: Or
    connect done_temp.out -> exec_done.a
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

    // PC increment: FETCH, or sub0 for all ZP/IMM instructions
    node needs_operand: Or
    connect cmp_lda_imm.eq -> needs_operand.a
    connect is_zp.out -> needs_operand.b

    node pc_inc_sub0: And
    connect exec_sub0.out -> pc_inc_sub0.a
    connect needs_operand.out -> pc_inc_sub0.b

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

    // Operand load at sub0 for ZP instructions
    node operand_load: And
    connect exec_sub0.out -> operand_load.a
    connect needs_operand.out -> operand_load.b

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

    // INC/DEC logic
    node inc_mem: Incrementer
    connect memory.data_out -> inc_mem.in

    node dec_mem: Subtractor
    connect memory.data_out -> dec_mem.a
    connect one.out -> dec_mem.b
    connect zero.out -> dec_mem.borrow_in

    // Select INC or DEC result
    node rmw_result: Mux
    connect cmp_inc_zp.eq -> rmw_result.sel
    connect dec_mem.difference -> rmw_result.in0
    connect inc_mem.out -> rmw_result.in1

    // Memory data_in: A for STA, rmw_result for INC/DEC
    node mem_data_in: Mux
    connect is_rmw.out -> mem_data_in.sel
    connect a_reg.q -> mem_data_in.in0
    connect rmw_result.out -> mem_data_in.in1

    connect mem_data_in.out -> memory.data_in

    // A register load
    // LDA_IMM at sub1, LDA_ZP at sub3
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

    // A data source: operand for LDA_IMM, memory for LDA_ZP
    node a_data: Mux
    connect cmp_lda_zp.eq -> a_data.sel
    connect operand_reg.q -> a_data.in0
    connect memory.data_out -> a_data.in1

    connect a_data.out -> a_reg.data

    // Flag updates for INC/DEC at sub3
    node update_flags: And
    connect exec_sub3.out -> update_flags.a
    connect is_rmw.out -> update_flags.b

    connect update_flags.out -> n_reg.we
    connect update_flags.out -> z_reg.we

    // N flag: bit 7 of rmw_result (value >= 128)
    node const_128: Constant(value=128)
    node n_check: Comparator
    connect rmw_result.out -> n_check.a
    connect const_128.out -> n_check.b

    node n_flag_val: Or
    connect n_check.gt -> n_flag_val.a
    connect n_check.eq -> n_flag_val.b

    connect n_flag_val.out -> n_reg.data

    // Z flag: rmw_result == 0
    node z_check: Comparator
    connect rmw_result.out -> z_check.a
    connect zero.out -> z_check.b

    connect z_check.eq -> z_reg.data

    // Outputs
    connect pc_reg.q -> pc
    connect a_reg.q -> reg_a
    connect memory.data_out -> mem_10
    connect memory.data_out -> mem_11
    connect n_reg.q -> flag_n
    connect z_reg.q -> flag_z
  }
}

// === Test Circuit ===
circuit Part8Test {
  output pc: Bus[8]
  output reg_a: Bus[8]
  output flag_n: Bit
  output flag_z: Bit

  clock clk

  impl {
    node zero: Constant(value=0)

    node cpu: Part8TestCPU
    connect clk -> cpu.clk
    connect zero.out -> cpu.reset

    connect cpu.pc -> pc
    connect cpu.reg_a -> reg_a
    connect cpu.flag_n -> flag_n
    connect cpu.flag_z -> flag_z
  }
}
