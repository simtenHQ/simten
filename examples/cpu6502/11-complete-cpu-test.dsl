// Complete 6502 CPU Stage 2 - All in One File for Testing
// This has ALL components in a single file so you can load and test it

// === ALU ===
circuit ALU {
  input a: Bus[8]
  input b: Bus[8]
  input op: Bus[3]
  input carry_in: Bit

  output result: Bus[8]
  output carry_out: Bit
  output zero: Bit
  output negative: Bit

  impl {
    node adder: Adder
    connect a -> adder.a
    connect b -> adder.b
    connect carry_in -> adder.carry_in

    node subtractor: Subtractor
    connect a -> subtractor.a
    connect b -> subtractor.b
    connect carry_in -> subtractor.borrow_in

    node and_op: BusAnd
    connect a -> and_op.a
    connect b -> and_op.b

    node or_op: BusOr
    connect a -> or_op.a
    connect b -> or_op.b

    node xor_op: BusXor
    connect a -> xor_op.a
    connect b -> xor_op.b

    node op_0: Constant(value=0)
    node op_1: Constant(value=1)
    node op_2: Constant(value=2)
    node op_3: Constant(value=3)
    node op_4: Constant(value=4)

    node is_add: Comparator
    connect op -> is_add.a
    connect op_0.out -> is_add.b

    node is_sub: Comparator
    connect op -> is_sub.a
    connect op_1.out -> is_sub.b

    node is_and: Comparator
    connect op -> is_and.a
    connect op_2.out -> is_and.b

    node is_or: Comparator
    connect op -> is_or.a
    connect op_3.out -> is_or.b

    node is_xor: Comparator
    connect op -> is_xor.a
    connect op_4.out -> is_xor.b

    node mux1: Mux
    connect is_sub.eq -> mux1.sel
    connect adder.sum -> mux1.in0
    connect subtractor.difference -> mux1.in1

    node mux2: Mux
    connect is_and.eq -> mux2.sel
    connect mux1.out -> mux2.in0
    connect and_op.out -> mux2.in1

    node mux3: Mux
    connect is_or.eq -> mux3.sel
    connect mux2.out -> mux3.in0
    connect or_op.out -> mux3.in1

    node mux4: Mux
    connect is_xor.eq -> mux4.sel
    connect mux3.out -> mux4.in0
    connect xor_op.out -> mux4.in1

    connect mux4.out -> result

    node mux_carry: Mux
    connect is_sub.eq -> mux_carry.sel
    connect adder.carry_out -> mux_carry.in0
    connect subtractor.borrow_out -> mux_carry.in1
    connect mux_carry.out -> carry_out

    node zero_cmp: Comparator
    connect result -> zero_cmp.a
    connect op_0.out -> zero_cmp.b
    connect zero_cmp.eq -> zero

    node threshold: Constant(value=127)
    node neg_cmp: Comparator
    connect result -> neg_cmp.a
    connect threshold.out -> neg_cmp.b
    connect neg_cmp.gt -> negative
  }
}

// === Program Counter ===
circuit ProgramCounter {
  input load: Bit
  input load_addr_low: Bus[8]
  input load_addr_high: Bus[8]
  input increment: Bit

  output pc_low: Bus[8]
  output pc_high: Bus[8]

  clock clk

  impl {
    node pcl_reg: Register
    connect clk -> pcl_reg.clk

    node pch_reg: Register
    connect clk -> pch_reg.clk

    node inc_low: Incrementer
    connect pcl_reg.q -> inc_low.in

    node max_byte: Constant(value=255)
    node will_overflow: Comparator
    connect pcl_reg.q -> will_overflow.a
    connect max_byte.out -> will_overflow.b

    node inc_high: Incrementer
    connect pch_reg.q -> inc_high.in

    node high_inc_mux: Mux
    connect will_overflow.eq -> high_inc_mux.sel
    connect pch_reg.q -> high_inc_mux.in0
    connect inc_high.out -> high_inc_mux.in1

    node low_load_or_inc: Mux
    connect increment -> low_load_or_inc.sel
    connect pcl_reg.q -> low_load_or_inc.in0
    connect inc_low.out -> low_load_or_inc.in1

    node low_final: Mux
    connect load -> low_final.sel
    connect low_load_or_inc.out -> low_final.in0
    connect load_addr_low -> low_final.in1

    connect low_final.out -> pcl_reg.data

    node high_load_or_inc: Mux
    connect increment -> high_load_or_inc.sel
    connect pch_reg.q -> high_load_or_inc.in0
    connect high_inc_mux.out -> high_load_or_inc.in1

    node high_final: Mux
    connect load -> high_final.sel
    connect high_load_or_inc.out -> high_final.in0
    connect load_addr_high -> high_final.in1

    connect high_final.out -> pch_reg.data

    node always_on: Constant(value=1)
    connect always_on.out -> pcl_reg.we
    connect always_on.out -> pch_reg.we

    connect pcl_reg.q -> pc_low
    connect pch_reg.q -> pc_high
  }
}

// === Instruction Decoder ===
circuit InstructionDecoder {
  input opcode: Bus[8]

  output is_LDA_imm: Bit
  output is_ADC_imm: Bit
  output is_STA_abs: Bit
  output is_JMP_abs: Bit
  output is_BRK: Bit

  output addr_mode: Bus[2]
  output cycles: Bus[3]

  impl {
    node val_LDA: Constant(value=169)
    node val_ADC: Constant(value=105)
    node val_STA: Constant(value=141)
    node val_JMP: Constant(value=76)
    node val_BRK: Constant(value=0)

    node cmp_LDA: Comparator
    connect opcode -> cmp_LDA.a
    connect val_LDA.out -> cmp_LDA.b
    connect cmp_LDA.eq -> is_LDA_imm

    node cmp_ADC: Comparator
    connect opcode -> cmp_ADC.a
    connect val_ADC.out -> cmp_ADC.b
    connect cmp_ADC.eq -> is_ADC_imm

    node cmp_STA: Comparator
    connect opcode -> cmp_STA.a
    connect val_STA.out -> cmp_STA.b
    connect cmp_STA.eq -> is_STA_abs

    node cmp_JMP: Comparator
    connect opcode -> cmp_JMP.a
    connect val_JMP.out -> cmp_JMP.b
    connect cmp_JMP.eq -> is_JMP_abs

    node cmp_BRK: Comparator
    connect opcode -> cmp_BRK.a
    connect val_BRK.out -> cmp_BRK.b
    connect cmp_BRK.eq -> is_BRK

    node mode_implied: Constant(value=0)
    node mode_immediate: Constant(value=1)
    node mode_absolute: Constant(value=2)

    node is_immediate: Or
    connect is_LDA_imm -> is_immediate.a
    connect is_ADC_imm -> is_immediate.b

    node is_absolute: Or
    connect is_STA_abs -> is_absolute.a
    connect is_JMP_abs -> is_absolute.b

    node mode_mux1: Mux
    connect is_absolute.out -> mode_mux1.sel
    connect mode_implied.out -> mode_mux1.in0
    connect mode_absolute.out -> mode_mux1.in1

    node mode_mux2: Mux
    connect is_immediate.out -> mode_mux2.sel
    connect mode_mux1.out -> mode_mux2.in0
    connect mode_immediate.out -> mode_mux2.in1

    connect mode_mux2.out -> addr_mode

    node cycles_1: Constant(value=1)
    node cycles_2: Constant(value=2)
    node cycles_3: Constant(value=3)
    node cycles_4: Constant(value=4)

    node cycle_mux1: Mux
    connect is_immediate.out -> cycle_mux1.sel
    connect cycles_1.out -> cycle_mux1.in0
    connect cycles_2.out -> cycle_mux1.in1

    node cycle_mux2: Mux
    connect is_JMP_abs -> cycle_mux2.sel
    connect cycle_mux1.out -> cycle_mux2.in0
    connect cycles_3.out -> cycle_mux2.in1

    node cycle_mux3: Mux
    connect is_STA_abs -> cycle_mux3.sel
    connect cycle_mux2.out -> cycle_mux3.in0
    connect cycles_4.out -> cycle_mux3.in1

    connect cycle_mux3.out -> cycles
  }
}

// === Control FSM ===
circuit CPUControl {
  input reset: Bit
  input instr_cycles: Bus[3]
  input is_BRK: Bit

  output current_state: Bus[3]
  output cycle_num: Bus[3]
  output pc_increment: Bit
  output mem_read: Bit
  output mem_write: Bit
  output alu_enable: Bit
  output reg_write: Bit
  output halted: Bit

  clock clk

  impl {
    node state_reg: Register
    connect clk -> state_reg.clk

    node cycle_reg: Register
    connect clk -> cycle_reg.clk

    node halt_reg: Register
    connect clk -> halt_reg.clk

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

    node inc_cycle: Incrementer
    connect cycle_reg.q -> inc_cycle.in

    node cycle_done: Comparator
    connect cycle_reg.q -> cycle_done.a
    connect instr_cycles -> cycle_done.b

    node cycle_reset_or_inc: Mux
    connect is_fetch.eq -> cycle_reset_or_inc.sel
    connect inc_cycle.out -> cycle_reset_or_inc.in0
    connect STATE_FETCH.out -> cycle_reset_or_inc.in1

    connect cycle_reset_or_inc.out -> cycle_reg.data

    node always_on: Constant(value=1)
    node zero: Constant(value=0)
    connect always_on.out -> cycle_reg.we

    connect cycle_reg.q -> cycle_num

    node exec_done: And
    connect is_execute.eq -> exec_done.a
    connect cycle_done.eq -> exec_done.b

    node next_if_fetch: Mux
    connect is_fetch.eq -> next_if_fetch.sel
    connect state_reg.q -> next_if_fetch.in0
    connect STATE_DECODE.out -> next_if_fetch.in1

    node next_if_decode: Mux
    connect is_decode.eq -> next_if_decode.sel
    connect next_if_fetch.out -> next_if_decode.in0
    connect STATE_EXECUTE.out -> next_if_decode.in1

    node next_if_execute: Mux
    connect exec_done.out -> next_if_execute.sel
    connect next_if_decode.out -> next_if_execute.in0
    connect STATE_FETCH.out -> next_if_execute.in1

    node handle_reset: Mux
    connect reset -> handle_reset.sel
    connect next_if_execute.out -> handle_reset.in0
    connect STATE_FETCH.out -> handle_reset.in1

    connect handle_reset.out -> state_reg.data
    connect always_on.out -> state_reg.we

    connect state_reg.q -> current_state

    node set_halt: Or
    connect halt_reg.q -> set_halt.a
    connect is_BRK -> set_halt.b

    node halt_value: Mux
    connect reset -> halt_value.sel
    connect set_halt.out -> halt_value.in0
    connect zero.out -> halt_value.in1

    connect halt_value.out -> halt_reg.data
    connect always_on.out -> halt_reg.we

    connect halt_reg.q -> halted

    connect is_fetch.eq -> pc_increment

    node mem_read_sig: Or
    connect is_fetch.eq -> mem_read_sig.a
    connect is_decode.eq -> mem_read_sig.b
    connect mem_read_sig.out -> mem_read

    connect is_execute.eq -> mem_write
    connect is_execute.eq -> alu_enable
    connect is_execute.eq -> reg_write
  }
}

// === Simple ROM ===
circuit SimpleROM {
  input addr: Bus[8]
  output data: Bus[8]

  impl {
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)
    node three: Constant(value=3)
    node four: Constant(value=4)
    node five: Constant(value=5)
    node six: Constant(value=6)
    node seven: Constant(value=7)

    node at_0: Comparator
    connect addr -> at_0.a
    connect zero.out -> at_0.b

    node at_1: Comparator
    connect addr -> at_1.a
    connect one.out -> at_1.b

    node at_2: Comparator
    connect addr -> at_2.a
    connect two.out -> at_2.b

    node at_3: Comparator
    connect addr -> at_3.a
    connect three.out -> at_3.b

    node at_4: Comparator
    connect addr -> at_4.a
    connect four.out -> at_4.b

    node at_5: Comparator
    connect addr -> at_5.a
    connect five.out -> at_5.b

    node at_6: Comparator
    connect addr -> at_6.a
    connect six.out -> at_6.b

    node at_7: Comparator
    connect addr -> at_7.a
    connect seven.out -> at_7.b

    node byte_0: Constant(value=169)
    node byte_1: Constant(value=66)
    node byte_2: Constant(value=105)
    node byte_3: Constant(value=8)
    node byte_4: Constant(value=141)
    node byte_5: Constant(value=254)
    node byte_6: Constant(value=0)
    node byte_7: Constant(value=0)

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

    connect mux7.out -> data
  }
}

// === Complete CPU Integration ===
circuit CompleteCPU {
  input reset: Bit

  output pc_low: Bus[8]
  output pc_high: Bus[8]
  output instruction: Bus[8]
  output current_state: Bus[3]
  output reg_a: Bus[8]
  output halted: Bit

  clock clk

  impl {
    node pc_reg: ProgramCounter
    node decoder: InstructionDecoder
    node control: CPUControl
    node alu: ALU
    node rom: SimpleROM

    node regA: Register
    connect clk -> regA.clk

    node zero: Constant(value=0)

    connect pc_reg.pc_low -> rom.addr
    connect rom.data -> decoder.opcode
    connect rom.data -> instruction

    connect decoder.cycles -> control.instr_cycles
    connect decoder.is_BRK -> control.is_BRK
    connect reset -> control.reset

    connect control.pc_increment -> pc_reg.increment
    connect zero.out -> pc_reg.load
    connect zero.out -> pc_reg.load_addr_low
    connect zero.out -> pc_reg.load_addr_high

    connect regA.q -> alu.a
    connect rom.data -> alu.b
    connect zero.out -> alu.op
    connect zero.out -> alu.carry_in

    connect alu.result -> regA.data
    connect control.reg_write -> regA.we

    connect clk -> pc_reg.clk
    connect clk -> control.clk

    connect pc_reg.pc_low -> pc_low
    connect pc_reg.pc_high -> pc_high
    connect control.current_state -> current_state
    connect regA.q -> reg_a
    connect control.halted -> halted
  }
}

// === TEST CIRCUIT - Load This! ===
circuit FullCPUTest {
  clock clk

  impl {
    node cpu: CompleteCPU
    connect clk -> cpu.clk

    node reset_input: Input
    connect reset_input.out -> cpu.reset

    node d_pc: HexDisplay
    connect cpu.pc_low -> d_pc.in

    node d_instruction: HexDisplay
    connect cpu.instruction -> d_instruction.in

    node d_state: HexDisplay
    connect cpu.current_state -> d_state.in

    node d_reg_a: HexDisplay
    connect cpu.reg_a -> d_reg_a.in

    node d_halted: Led
    connect cpu.halted -> d_halted.in
  }
}
