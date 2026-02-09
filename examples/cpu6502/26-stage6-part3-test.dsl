// Stage 6 Part 3 Test: TXS, TSX, CLV
// Test program to verify the new instructions work correctly

circuit Part3TestCPU {
  input reset: Bit

  output pc: Bus[8]
  output reg_a: Bus[8]
  output reg_x: Bus[8]
  output reg_y: Bus[8]
  output reg_sp: Bus[8]
  output flag_n: Bit
  output flag_z: Bit
  output flag_c: Bit
  output flag_v: Bit

  clock clk

  impl {
    // Program counter
    node pc_reg: Register
    connect clk -> pc_reg.clk
    node always_on: Constant(value=1)

    node pc_inc: Incrementer
    connect pc_reg.q -> pc_inc.in

    // ROM - Test program for Part 3 instructions
    // $00: LDX #$42     (A2 42) - Load X with 0x42
    // $02: TXS          (9A)    - SP = X = 0x42
    // $03: TSX          (BA)    - X = SP = 0x42 (should set flags based on 0x42)
    // $04: LDX #$00     (A2 00) - X = 0 (so we can verify TSX worked)
    // $06: TSX          (BA)    - X = SP = 0x42
    // $07: LDX #$80     (A2 80) - X = 0x80
    // $09: TXS          (9A)    - SP = 0x80
    // $0A: TSX          (BA)    - X = SP = 0x80 (should set N=1)
    // $0B: CLV          (B8)    - Clear V flag (V=0)
    // $0C: NOP          (EA)
    // $0D: NOP          (EA)
    // $0E: NOP          (EA)
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
    node byte_2: Constant(value=154)   // 9A - TXS
    node byte_3: Constant(value=186)   // BA - TSX
    node byte_4: Constant(value=162)   // A2 - LDX #imm
    node byte_5: Constant(value=0)     // 00 - operand
    node byte_6: Constant(value=186)   // BA - TSX
    node byte_7: Constant(value=162)   // A2 - LDX #imm
    node byte_8: Constant(value=128)   // 80 - operand
    node byte_9: Constant(value=154)   // 9A - TXS
    node byte_10: Constant(value=186)  // BA - TSX
    node byte_11: Constant(value=184)  // B8 - CLV
    node byte_12: Constant(value=234)  // EA - NOP
    node byte_13: Constant(value=234)  // EA - NOP
    node byte_14: Constant(value=234)  // EA - NOP
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

    // Stack Pointer
    node sp_reg: Register(initial=255)
    connect clk -> sp_reg.clk
    connect always_on.out -> sp_reg.we

    // Flag registers
    node flag_n_reg: Register(initial=0)
    node flag_z_reg: Register(initial=0)
    node flag_c_reg: Register(initial=0)
    node flag_v_reg: Register(initial=1)  // Start with V=1 to test CLV
    connect clk -> flag_n_reg.clk
    connect clk -> flag_z_reg.clk
    connect clk -> flag_c_reg.clk
    connect clk -> flag_v_reg.clk

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
    node TXS: Constant(value=154)      // 0x9A
    node TSX: Constant(value=186)      // 0xBA
    node CLV: Constant(value=184)      // 0xB8
    node NOP: Constant(value=234)      // 0xEA

    node cmp_ldx_imm: Comparator
    connect ir.q -> cmp_ldx_imm.a
    connect LDX_IMM.out -> cmp_ldx_imm.b

    node cmp_txs: Comparator
    connect ir.q -> cmp_txs.a
    connect TXS.out -> cmp_txs.b

    node cmp_tsx: Comparator
    connect ir.q -> cmp_tsx.a
    connect TSX.out -> cmp_tsx.b

    node cmp_clv: Comparator
    connect ir.q -> cmp_clv.a
    connect CLV.out -> cmp_clv.b

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

    // 1-cycle instructions: TXS, TSX, CLV, NOP
    node is_1cyc_1: Or
    connect cmp_txs.eq -> is_1cyc_1.a
    connect cmp_tsx.eq -> is_1cyc_1.b

    node is_1cyc_2: Or
    connect is_1cyc_1.out -> is_1cyc_2.a
    connect cmp_clv.eq -> is_1cyc_2.b

    node is_1cycle: Or
    connect is_1cyc_2.out -> is_1cycle.a
    connect cmp_nop.eq -> is_1cycle.b

    // Done conditions
    node done_imm: And
    connect exec_sub1.out -> done_imm.a
    connect cmp_ldx_imm.eq -> done_imm.b

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
    node needs_operand: And
    connect exec_sub0.out -> needs_operand.a
    connect cmp_ldx_imm.eq -> needs_operand.b

    node pc_inc_fetch: Or
    connect is_fetch.eq -> pc_inc_fetch.a
    connect needs_operand.out -> pc_inc_fetch.b

    node pc_next: Mux
    connect pc_inc_fetch.out -> pc_next.sel
    connect pc_reg.q -> pc_next.in0
    connect pc_inc.out -> pc_next.in1

    connect pc_next.out -> pc_reg.data
    connect always_on.out -> pc_reg.we

    // IR load
    connect is_fetch.eq -> ir.we

    // Operand load
    connect needs_operand.out -> operand_reg.we

    // Register X data source: LDX #imm or TSX
    node x_from_ldx: Mux
    connect cmp_ldx_imm.eq -> x_from_ldx.sel
    connect regX.q -> x_from_ldx.in0
    connect operand_reg.q -> x_from_ldx.in1

    node x_data: Mux
    connect cmp_tsx.eq -> x_data.sel
    connect x_from_ldx.out -> x_data.in0
    connect sp_reg.q -> x_data.in1

    connect x_data.out -> regX.data

    // Write X: LDX #imm at sub1, TSX at sub0
    node write_x_ldx: And
    connect exec_sub1.out -> write_x_ldx.a
    connect cmp_ldx_imm.eq -> write_x_ldx.b

    node write_x_tsx: And
    connect exec_sub0.out -> write_x_tsx.a
    connect cmp_tsx.eq -> write_x_tsx.b

    node write_x: Or
    connect write_x_ldx.out -> write_x.a
    connect write_x_tsx.out -> write_x.b

    connect write_x.out -> regX.we

    // Stack Pointer: TXS loads from X
    node sp_load_txs: And
    connect exec_sub0.out -> sp_load_txs.a
    connect cmp_txs.eq -> sp_load_txs.b

    // SP next value: either current, or X (for TXS)
    node sp_next: Mux
    connect sp_load_txs.out -> sp_next.sel
    connect sp_reg.q -> sp_next.in0
    connect regX.q -> sp_next.in1

    connect sp_next.out -> sp_reg.data

    // Flag updates
    node const_128: Constant(value=128)

    // TSX and LDX affect N/Z flags
    node update_ldx: And
    connect exec_sub1.out -> update_ldx.a
    connect cmp_ldx_imm.eq -> update_ldx.b

    node update_tsx: And
    connect exec_sub0.out -> update_tsx.a
    connect cmp_tsx.eq -> update_tsx.b

    node update_nz: Or
    connect update_ldx.out -> update_nz.a
    connect update_tsx.out -> update_nz.b

    // N flag: bit 7 of result
    node n_check: Comparator
    connect x_data.out -> n_check.a
    connect const_128.out -> n_check.b

    node n_val: Or
    connect n_check.gt -> n_val.a
    connect n_check.eq -> n_val.b

    // Z flag: result == 0
    node z_check: Comparator
    connect x_data.out -> z_check.a
    connect zero.out -> z_check.b

    connect update_nz.out -> flag_n_reg.we
    connect update_nz.out -> flag_z_reg.we
    connect n_val.out -> flag_n_reg.data
    connect z_check.eq -> flag_z_reg.data

    // CLV: clear V flag
    node update_clv: And
    connect exec_sub0.out -> update_clv.a
    connect cmp_clv.eq -> update_clv.b

    connect update_clv.out -> flag_v_reg.we
    connect zero.out -> flag_v_reg.data

    // C flag not modified in this test
    connect zero.out -> flag_c_reg.we
    connect zero.out -> flag_c_reg.data

    // Outputs
    connect pc_reg.q -> pc
    connect regA.q -> reg_a
    connect regX.q -> reg_x
    connect regY.q -> reg_y
    connect sp_reg.q -> reg_sp
    connect flag_n_reg.q -> flag_n
    connect flag_z_reg.q -> flag_z
    connect flag_c_reg.q -> flag_c
    connect flag_v_reg.q -> flag_v
  }
}

// === TEST CIRCUIT ===
circuit Part3Test {
  clock clk

  impl {
    node cpu: Part3TestCPU
    connect clk -> cpu.clk

    node reset_input: Input
    connect reset_input.out -> cpu.reset

    node d_pc: HexDisplay
    connect cpu.pc -> d_pc.in

    node d_x: HexDisplay
    connect cpu.reg_x -> d_x.in

    node d_sp: HexDisplay
    connect cpu.reg_sp -> d_sp.in
  }
}
