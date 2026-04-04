// Auto-generated from DSL

const ALU = component('ALU')
  .in('a', bus(8))
  .in('b', bus(8))
  .in('op', bus(3))
  .in('carry_in', bit)
  .out('result', bus(8))
  .out('carry_out', bit)
  .out('zero', bit)
  .out('negative', bit)
  .node('adder', Adder)
  .node('subtractor', Subtractor)
  .node('and_op', BusAnd)
  .node('or_op', BusOr)
  .node('xor_op', BusXor)
  .node('op_0', Constant, { value: 0 })
  .node('op_1', Constant, { value: 1 })
  .node('op_2', Constant, { value: 2 })
  .node('op_3', Constant, { value: 3 })
  .node('op_4', Constant, { value: 4 })
  .node('is_add', Comparator)
  .node('is_sub', Comparator)
  .node('is_and', Comparator)
  .node('is_or', Comparator)
  .node('is_xor', Comparator)
  .node('mux1', Mux)
  .node('mux2', Mux)
  .node('mux3', Mux)
  .node('mux4', Mux)
  .node('mux_carry', Mux)
  .node('zero_cmp', Comparator)
  .node('threshold', Constant, { value: 127 })
  .node('neg_cmp', Comparator)
  .connect(({ in: inp, out, adder, subtractor, and_op, or_op, xor_op, op_0, op_1, op_2, op_3, op_4, is_add, is_sub, is_and, is_or, is_xor, mux1, mux2, mux3, mux4, mux_carry, zero_cmp, threshold, neg_cmp }) => [
    inp.a.to(adder.a, subtractor.a, and_op.a, or_op.a, xor_op.a),
    inp.b.to(adder.b, subtractor.b, and_op.b, or_op.b, xor_op.b),
    inp.carry_in.to(adder.carry_in, subtractor.borrow_in),
    inp.op.to(is_add.a, is_sub.a, is_and.a, is_or.a, is_xor.a),
    op_0.out.to(is_add.b, zero_cmp.b),
    op_1.out.to(is_sub.b),
    op_2.out.to(is_and.b),
    op_3.out.to(is_or.b),
    op_4.out.to(is_xor.b),
    is_sub.eq.to(mux1.sel, mux_carry.sel),
    adder.sum.to(mux1.in0),
    subtractor.difference.to(mux1.in1),
    is_and.eq.to(mux2.sel),
    mux1.out.to(mux2.in0),
    and_op.out.to(mux2.in1),
    is_or.eq.to(mux3.sel),
    mux2.out.to(mux3.in0),
    or_op.out.to(mux3.in1),
    is_xor.eq.to(mux4.sel),
    mux3.out.to(mux4.in0),
    xor_op.out.to(mux4.in1),
    mux4.out.to(out.result),
    adder.carry_out.to(mux_carry.in0),
    subtractor.borrow_out.to(mux_carry.in1),
    mux_carry.out.to(out.carry_out),
    out.result.to(zero_cmp.a, neg_cmp.a),
    zero_cmp.eq.to(out.zero),
    threshold.out.to(neg_cmp.b),
    neg_cmp.gt.to(out.negative),
  ])
  .build()

const ProgramCounter = component('ProgramCounter')
  .in('load', bit)
  .in('load_addr_low', bus(8))
  .in('load_addr_high', bus(8))
  .in('increment', bit)
  .out('pc_low', bus(8))
  .out('pc_high', bus(8))
  .node('pcl_reg', Register)
  .node('pch_reg', Register)
  .node('inc_low', Incrementer)
  .node('max_byte', Constant, { value: 255 })
  .node('will_overflow', Comparator)
  .node('inc_high', Incrementer)
  .node('high_inc_mux', Mux)
  .node('low_load_or_inc', Mux)
  .node('low_final', Mux)
  .node('high_load_or_inc', Mux)
  .node('high_final', Mux)
  .node('always_on', Constant, { value: 1 })
  .connect(({ in: inp, out, pcl_reg, pch_reg, inc_low, max_byte, will_overflow, inc_high, high_inc_mux, low_load_or_inc, low_final, high_load_or_inc, high_final, always_on }) => [
    pcl_reg.q.to(inc_low.in, will_overflow.a, low_load_or_inc.in0, out.pc_low),
    max_byte.out.to(will_overflow.b),
    pch_reg.q.to(inc_high.in, high_inc_mux.in0, high_load_or_inc.in0, out.pc_high),
    will_overflow.eq.to(high_inc_mux.sel),
    inc_high.out.to(high_inc_mux.in1),
    inp.increment.to(low_load_or_inc.sel, high_load_or_inc.sel),
    inc_low.out.to(low_load_or_inc.in1),
    inp.load.to(low_final.sel, high_final.sel),
    low_load_or_inc.out.to(low_final.in0),
    inp.load_addr_low.to(low_final.in1),
    low_final.out.to(pcl_reg.data),
    high_inc_mux.out.to(high_load_or_inc.in1),
    high_load_or_inc.out.to(high_final.in0),
    inp.load_addr_high.to(high_final.in1),
    high_final.out.to(pch_reg.data),
    always_on.out.to(pcl_reg.we, pch_reg.we),
  ])
  .build()

const InstructionDecoder = component('InstructionDecoder')
  .in('opcode', bus(8))
  .out('is_LDA_imm', bit)
  .out('is_ADC_imm', bit)
  .out('is_STA_abs', bit)
  .out('is_JMP_abs', bit)
  .out('is_BRK', bit)
  .out('addr_mode', bus(2))
  .out('cycles', bus(3))
  .node('val_LDA', Constant, { value: 169 })
  .node('val_ADC', Constant, { value: 105 })
  .node('val_STA', Constant, { value: 141 })
  .node('val_JMP', Constant, { value: 76 })
  .node('val_BRK', Constant, { value: 0 })
  .node('cmp_LDA', Comparator)
  .node('cmp_ADC', Comparator)
  .node('cmp_STA', Comparator)
  .node('cmp_JMP', Comparator)
  .node('cmp_BRK', Comparator)
  .node('mode_implied', Constant, { value: 0 })
  .node('mode_immediate', Constant, { value: 1 })
  .node('mode_absolute', Constant, { value: 2 })
  .node('is_immediate', Or)
  .node('is_absolute', Or)
  .node('mode_mux1', Mux)
  .node('mode_mux2', Mux)
  .node('cycles_1', Constant, { value: 1 })
  .node('cycles_2', Constant, { value: 2 })
  .node('cycles_3', Constant, { value: 3 })
  .node('cycles_4', Constant, { value: 4 })
  .node('cycle_mux1', Mux)
  .node('cycle_mux2', Mux)
  .node('cycle_mux3', Mux)
  .connect(({ in: inp, out, val_LDA, val_ADC, val_STA, val_JMP, val_BRK, cmp_LDA, cmp_ADC, cmp_STA, cmp_JMP, cmp_BRK, mode_implied, mode_immediate, mode_absolute, is_immediate, is_absolute, mode_mux1, mode_mux2, cycles_1, cycles_2, cycles_3, cycles_4, cycle_mux1, cycle_mux2, cycle_mux3 }) => [
    inp.opcode.to(cmp_LDA.a, cmp_ADC.a, cmp_STA.a, cmp_JMP.a, cmp_BRK.a),
    val_LDA.out.to(cmp_LDA.b),
    cmp_LDA.eq.to(out.is_LDA_imm),
    val_ADC.out.to(cmp_ADC.b),
    cmp_ADC.eq.to(out.is_ADC_imm),
    val_STA.out.to(cmp_STA.b),
    cmp_STA.eq.to(out.is_STA_abs),
    val_JMP.out.to(cmp_JMP.b),
    cmp_JMP.eq.to(out.is_JMP_abs),
    val_BRK.out.to(cmp_BRK.b),
    cmp_BRK.eq.to(out.is_BRK),
    out.is_LDA_imm.to(is_immediate.a),
    out.is_ADC_imm.to(is_immediate.b),
    out.is_STA_abs.to(is_absolute.a, cycle_mux3.sel),
    out.is_JMP_abs.to(is_absolute.b, cycle_mux2.sel),
    is_absolute.out.to(mode_mux1.sel),
    mode_implied.out.to(mode_mux1.in0),
    mode_absolute.out.to(mode_mux1.in1),
    is_immediate.out.to(mode_mux2.sel, cycle_mux1.sel),
    mode_mux1.out.to(mode_mux2.in0),
    mode_immediate.out.to(mode_mux2.in1),
    mode_mux2.out.to(out.addr_mode),
    cycles_1.out.to(cycle_mux1.in0),
    cycles_2.out.to(cycle_mux1.in1),
    cycle_mux1.out.to(cycle_mux2.in0),
    cycles_3.out.to(cycle_mux2.in1),
    cycle_mux2.out.to(cycle_mux3.in0),
    cycles_4.out.to(cycle_mux3.in1),
    cycle_mux3.out.to(out.cycles),
  ])
  .build()

const CPUControl = component('CPUControl')
  .in('reset', bit)
  .in('instr_cycles', bus(3))
  .in('is_BRK', bit)
  .out('current_state', bus(3))
  .out('cycle_num', bus(3))
  .out('pc_increment', bit)
  .out('mem_read', bit)
  .out('mem_write', bit)
  .out('alu_enable', bit)
  .out('reg_write', bit)
  .out('halted', bit)
  .node('state_reg', Register)
  .node('cycle_reg', Register)
  .node('halt_reg', Register)
  .node('STATE_FETCH', Constant, { value: 0 })
  .node('STATE_DECODE', Constant, { value: 1 })
  .node('STATE_EXECUTE', Constant, { value: 2 })
  .node('is_fetch', Comparator)
  .node('is_decode', Comparator)
  .node('is_execute', Comparator)
  .node('inc_cycle', Incrementer)
  .node('cycle_done', Comparator)
  .node('cycle_reset_or_inc', Mux)
  .node('always_on', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .node('exec_done', And)
  .node('next_if_fetch', Mux)
  .node('next_if_decode', Mux)
  .node('next_if_execute', Mux)
  .node('handle_reset', Mux)
  .node('set_halt', Or)
  .node('halt_value', Mux)
  .node('mem_read_sig', Or)
  .connect(({ in: inp, out, state_reg, cycle_reg, halt_reg, STATE_FETCH, STATE_DECODE, STATE_EXECUTE, is_fetch, is_decode, is_execute, inc_cycle, cycle_done, cycle_reset_or_inc, always_on, zero, exec_done, next_if_fetch, next_if_decode, next_if_execute, handle_reset, set_halt, halt_value, mem_read_sig }) => [
    state_reg.q.to(is_fetch.a, is_decode.a, is_execute.a, next_if_fetch.in0, out.current_state),
    STATE_FETCH.out.to(is_fetch.b, cycle_reset_or_inc.in1, next_if_execute.in1, handle_reset.in1),
    STATE_DECODE.out.to(is_decode.b, next_if_fetch.in1),
    STATE_EXECUTE.out.to(is_execute.b, next_if_decode.in1),
    cycle_reg.q.to(inc_cycle.in, cycle_done.a, out.cycle_num),
    inp.instr_cycles.to(cycle_done.b),
    is_fetch.eq.to(cycle_reset_or_inc.sel, next_if_fetch.sel, out.pc_increment, mem_read_sig.a),
    inc_cycle.out.to(cycle_reset_or_inc.in0),
    cycle_reset_or_inc.out.to(cycle_reg.data),
    always_on.out.to(cycle_reg.we, state_reg.we, halt_reg.we),
    is_execute.eq.to(exec_done.a, out.mem_write, out.alu_enable, out.reg_write),
    cycle_done.eq.to(exec_done.b),
    is_decode.eq.to(next_if_decode.sel, mem_read_sig.b),
    next_if_fetch.out.to(next_if_decode.in0),
    exec_done.out.to(next_if_execute.sel),
    next_if_decode.out.to(next_if_execute.in0),
    inp.reset.to(handle_reset.sel, halt_value.sel),
    next_if_execute.out.to(handle_reset.in0),
    handle_reset.out.to(state_reg.data),
    halt_reg.q.to(set_halt.a, out.halted),
    inp.is_BRK.to(set_halt.b),
    set_halt.out.to(halt_value.in0),
    zero.out.to(halt_value.in1),
    halt_value.out.to(halt_reg.data),
    mem_read_sig.out.to(out.mem_read),
  ])
  .build()

const SimpleROM = component('SimpleROM')
  .in('addr', bus(8))
  .out('data', bus(8))
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('two', Constant, { value: 2 })
  .node('three', Constant, { value: 3 })
  .node('four', Constant, { value: 4 })
  .node('five', Constant, { value: 5 })
  .node('six', Constant, { value: 6 })
  .node('seven', Constant, { value: 7 })
  .node('at_0', Comparator)
  .node('at_1', Comparator)
  .node('at_2', Comparator)
  .node('at_3', Comparator)
  .node('at_4', Comparator)
  .node('at_5', Comparator)
  .node('at_6', Comparator)
  .node('at_7', Comparator)
  .node('byte_0', Constant, { value: 169 })
  .node('byte_1', Constant, { value: 66 })
  .node('byte_2', Constant, { value: 105 })
  .node('byte_3', Constant, { value: 8 })
  .node('byte_4', Constant, { value: 141 })
  .node('byte_5', Constant, { value: 254 })
  .node('byte_6', Constant, { value: 0 })
  .node('byte_7', Constant, { value: 0 })
  .node('mux1', Mux)
  .node('mux2', Mux)
  .node('mux3', Mux)
  .node('mux4', Mux)
  .node('mux5', Mux)
  .node('mux6', Mux)
  .node('mux7', Mux)
  .connect(({ in: inp, out, zero, one, two, three, four, five, six, seven, at_0, at_1, at_2, at_3, at_4, at_5, at_6, at_7, byte_0, byte_1, byte_2, byte_3, byte_4, byte_5, byte_6, byte_7, mux1, mux2, mux3, mux4, mux5, mux6, mux7 }) => [
    inp.addr.to(at_0.a, at_1.a, at_2.a, at_3.a, at_4.a, at_5.a, at_6.a, at_7.a),
    zero.out.to(at_0.b),
    one.out.to(at_1.b),
    two.out.to(at_2.b),
    three.out.to(at_3.b),
    four.out.to(at_4.b),
    five.out.to(at_5.b),
    six.out.to(at_6.b),
    seven.out.to(at_7.b),
    at_1.eq.to(mux1.sel),
    byte_0.out.to(mux1.in0),
    byte_1.out.to(mux1.in1),
    at_2.eq.to(mux2.sel),
    mux1.out.to(mux2.in0),
    byte_2.out.to(mux2.in1),
    at_3.eq.to(mux3.sel),
    mux2.out.to(mux3.in0),
    byte_3.out.to(mux3.in1),
    at_4.eq.to(mux4.sel),
    mux3.out.to(mux4.in0),
    byte_4.out.to(mux4.in1),
    at_5.eq.to(mux5.sel),
    mux4.out.to(mux5.in0),
    byte_5.out.to(mux5.in1),
    at_6.eq.to(mux6.sel),
    mux5.out.to(mux6.in0),
    byte_6.out.to(mux6.in1),
    at_7.eq.to(mux7.sel),
    mux6.out.to(mux7.in0),
    byte_7.out.to(mux7.in1),
    mux7.out.to(out.data),
  ])
  .build()

const CompleteCPU = component('CompleteCPU')
  .in('reset', bit)
  .out('pc_low', bus(8))
  .out('pc_high', bus(8))
  .out('instruction', bus(8))
  .out('current_state', bus(3))
  .out('reg_a', bus(8))
  .out('halted', bit)
  .node('pc_reg', ProgramCounter)
  .node('decoder', InstructionDecoder)
  .node('control', CPUControl)
  .node('alu', ALU)
  .node('rom', SimpleROM)
  .node('regA', Register)
  .node('zero', Constant, { value: 0 })
  .connect(({ in: inp, out, pc_reg, decoder, control, alu, rom, regA, zero }) => [
    pc_reg.pc_low.to(rom.addr, out.pc_low),
    rom.data.to(decoder.opcode, out.instruction, alu.b),
    decoder.cycles.to(control.instr_cycles),
    decoder.is_BRK.to(control.is_BRK),
    inp.reset.to(control.reset),
    control.pc_increment.to(pc_reg.increment),
    zero.out.to(pc_reg.load, pc_reg.load_addr_low, pc_reg.load_addr_high, alu.op, alu.carry_in),
    regA.q.to(alu.a, out.reg_a),
    alu.result.to(regA.data),
    control.reg_write.to(regA.we),
    pc_reg.pc_high.to(out.pc_high),
    control.current_state.to(out.current_state),
    control.halted.to(out.halted),
  ])
  .build()

const FullCPUTest = component('FullCPUTest')
  .node('cpu', CompleteCPU)
  .node('reset_input', Input)
  .node('d_pc', HexDisplay)
  .node('d_instruction', HexDisplay)
  .node('d_state', HexDisplay)
  .node('d_reg_a', HexDisplay)
  .node('d_halted', Led)
  .connect(({ in: inp, out, cpu, reset_input, d_pc, d_instruction, d_state, d_reg_a, d_halted }) => [
    reset_input.out.to(cpu.reset),
    cpu.pc_low.to(d_pc.in),
    cpu.instruction.to(d_instruction.in),
    cpu.current_state.to(d_state.in),
    cpu.reg_a.to(d_reg_a.in),
    cpu.halted.to(d_halted.in),
  ])
  .build()
