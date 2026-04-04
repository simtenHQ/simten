// Auto-generated from DSL

const SimpleMemory = component('SimpleMemory')
  .in('addr', bus(8))
  .in('data_in', bus(8))
  .in('write_enable', bit)
  .out('data_out', bus(8))
  .node('zero', Constant, { value: 0 })
  .node('addr_10', Constant, { value: 16 })
  .node('addr_11', Constant, { value: 17 })
  .node('addr_12', Constant, { value: 18 })
  .node('at_10', Comparator)
  .node('at_11', Comparator)
  .node('at_12', Comparator)
  .node('mem_10', Register)
  .node('mem_11', Register)
  .node('mem_12', Register)
  .node('we_10', And)
  .node('we_11', And)
  .node('we_12', And)
  .node('mux1', Mux)
  .node('mux2', Mux)
  .node('mux3', Mux)
  .connect(({ in: inp, out, zero, addr_10, addr_11, addr_12, at_10, at_11, at_12, mem_10, mem_11, mem_12, we_10, we_11, we_12, mux1, mux2, mux3 }) => [
    inp.addr.to(at_10.a, at_11.a, at_12.a),
    addr_10.out.to(at_10.b),
    addr_11.out.to(at_11.b),
    addr_12.out.to(at_12.b),
    inp.data_in.to(mem_10.data, mem_11.data, mem_12.data),
    inp.write_enable.to(we_10.a, we_11.a, we_12.a),
    at_10.eq.to(we_10.b, mux1.sel),
    we_10.out.to(mem_10.we),
    at_11.eq.to(we_11.b, mux2.sel),
    we_11.out.to(mem_11.we),
    at_12.eq.to(we_12.b, mux3.sel),
    we_12.out.to(mem_12.we),
    zero.out.to(mux1.in0),
    mem_10.q.to(mux1.in1),
    mux1.out.to(mux2.in0),
    mem_11.q.to(mux2.in1),
    mux2.out.to(mux3.in0),
    mem_12.q.to(mux3.in1),
    mux3.out.to(out.data_out),
  ])
  .build()

const RegisterFile = component('RegisterFile')
  .in('write_a', bit)
  .in('write_x', bit)
  .in('write_y', bit)
  .in('data_a', bus(8))
  .in('data_x', bus(8))
  .in('data_y', bus(8))
  .out('reg_a', bus(8))
  .out('reg_x', bus(8))
  .out('reg_y', bus(8))
  .node('regA', Register)
  .node('regX', Register)
  .node('regY', Register)
  .connect(({ in: inp, out, regA, regX, regY }) => [
    inp.data_a.to(regA.data),
    inp.data_x.to(regX.data),
    inp.data_y.to(regY.data),
    inp.write_a.to(regA.we),
    inp.write_x.to(regX.we),
    inp.write_y.to(regY.we),
    regA.q.to(out.reg_a),
    regX.q.to(out.reg_x),
    regY.q.to(out.reg_y),
  ])
  .build()

const MemoryControl = component('MemoryControl')
  .in('reset', bit)
  .in('current_opcode', bus(8))
  .out('current_state', bus(8))
  .out('exec_subcycle', bus(8))
  .out('pc_increment', bit)
  .out('ir_load', bit)
  .out('operand_load', bit)
  .out('addr_load', bit)
  .out('mem_read', bit)
  .out('mem_write', bit)
  .out('write_a', bit)
  .out('write_x', bit)
  .out('write_y', bit)
  .out('is_lda_imm', bit)
  .out('is_lda_zp', bit)
  .out('is_sta_zp', bit)
  .out('is_tax', bit)
  .out('is_inx', bit)
  .node('state_reg', Register)
  .node('subcycle_reg', Register)
  .node('STATE_FETCH', Constant, { value: 0 })
  .node('STATE_DECODE', Constant, { value: 1 })
  .node('STATE_EXECUTE', Constant, { value: 2 })
  .node('is_fetch', Comparator)
  .node('is_decode', Comparator)
  .node('is_execute', Comparator)
  .node('LDA_IMM', Constant, { value: 169 })
  .node('LDA_ZP', Constant, { value: 165 })
  .node('STA_ZP', Constant, { value: 133 })
  .node('TAX', Constant, { value: 170 })
  .node('INX', Constant, { value: 232 })
  .node('cmp_lda_imm', Comparator)
  .node('cmp_lda_zp', Comparator)
  .node('cmp_sta_zp', Comparator)
  .node('cmp_tax', Comparator)
  .node('cmp_inx', Comparator)
  .node('needs_operand_imm', Or)
  .node('is_zp_mode', Or)
  .node('is_1cycle', Or)
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('two', Constant, { value: 2 })
  .node('inc_subcycle', Incrementer)
  .node('subcycle_increment', Mux)
  .node('always_on', Constant, { value: 1 })
  .node('is_subcycle_0', Comparator)
  .node('is_subcycle_1', Comparator)
  .node('is_subcycle_2', Comparator)
  .node('next_from_fetch', Mux)
  .node('next_from_decode', Mux)
  .node('exec_done_imm', And)
  .node('exec_done_imm_check', And)
  .node('exec_done_zp', And)
  .node('exec_done_zp_check', And)
  .node('exec_done_1cycle', And)
  .node('exec_done_1cycle_check', And)
  .node('exec_done_temp', Or)
  .node('exec_done', Or)
  .node('next_from_execute', Mux)
  .node('next_state', Mux)
  .node('exec_subcycle_0', And)
  .node('needs_operand', Or)
  .node('exec_subcycle_0_needs_operand', And)
  .node('pc_inc_signal', Or)
  .node('operand_load_signal', And)
  .node('addr_load_signal', And)
  .node('exec_subcycle_1', And)
  .node('mem_read_signal', And)
  .node('mem_write_signal', And)
  .node('write_a_imm', And)
  .node('exec_subcycle_2', And)
  .node('write_a_zp', And)
  .node('write_a_signal', Or)
  .node('write_x_tax', And)
  .node('write_x_inx', And)
  .node('write_x_signal', Or)
  .connect(({ in: inp, out, state_reg, subcycle_reg, STATE_FETCH, STATE_DECODE, STATE_EXECUTE, is_fetch, is_decode, is_execute, LDA_IMM, LDA_ZP, STA_ZP, TAX, INX, cmp_lda_imm, cmp_lda_zp, cmp_sta_zp, cmp_tax, cmp_inx, needs_operand_imm, is_zp_mode, is_1cycle, zero, one, two, inc_subcycle, subcycle_increment, always_on, is_subcycle_0, is_subcycle_1, is_subcycle_2, next_from_fetch, next_from_decode, exec_done_imm, exec_done_imm_check, exec_done_zp, exec_done_zp_check, exec_done_1cycle, exec_done_1cycle_check, exec_done_temp, exec_done, next_from_execute, next_state, exec_subcycle_0, needs_operand, exec_subcycle_0_needs_operand, pc_inc_signal, operand_load_signal, addr_load_signal, exec_subcycle_1, mem_read_signal, mem_write_signal, write_a_imm, exec_subcycle_2, write_a_zp, write_a_signal, write_x_tax, write_x_inx, write_x_signal }) => [
    state_reg.q.to(is_fetch.a, is_decode.a, is_execute.a, next_from_fetch.in0, out.current_state),
    STATE_FETCH.out.to(is_fetch.b, next_from_execute.in1, next_state.in1),
    STATE_DECODE.out.to(is_decode.b, next_from_fetch.in1),
    STATE_EXECUTE.out.to(is_execute.b, next_from_decode.in1),
    inp.current_opcode.to(cmp_lda_imm.a, cmp_lda_zp.a, cmp_sta_zp.a, cmp_tax.a, cmp_inx.a),
    LDA_IMM.out.to(cmp_lda_imm.b),
    cmp_lda_imm.eq.to(out.is_lda_imm, needs_operand_imm.a, needs_operand_imm.b, write_a_imm.b),
    LDA_ZP.out.to(cmp_lda_zp.b),
    cmp_lda_zp.eq.to(out.is_lda_zp, is_zp_mode.a, mem_read_signal.b, write_a_zp.b),
    STA_ZP.out.to(cmp_sta_zp.b),
    cmp_sta_zp.eq.to(out.is_sta_zp, is_zp_mode.b, mem_write_signal.b),
    TAX.out.to(cmp_tax.b),
    cmp_tax.eq.to(out.is_tax, is_1cycle.a, write_x_tax.b),
    INX.out.to(cmp_inx.b),
    cmp_inx.eq.to(out.is_inx, is_1cycle.b, write_x_inx.b),
    subcycle_reg.q.to(inc_subcycle.in, out.exec_subcycle, is_subcycle_0.a, is_subcycle_1.a, is_subcycle_2.a),
    is_execute.eq.to(subcycle_increment.sel, exec_done_imm.a, exec_done_zp.a, exec_done_1cycle.a, exec_subcycle_0.a, exec_subcycle_1.a, exec_subcycle_2.a),
    zero.out.to(subcycle_increment.in0, is_subcycle_0.b, out.write_y),
    inc_subcycle.out.to(subcycle_increment.in1),
    subcycle_increment.out.to(subcycle_reg.data),
    always_on.out.to(subcycle_reg.we, state_reg.we),
    one.out.to(is_subcycle_1.b),
    two.out.to(is_subcycle_2.b),
    is_fetch.eq.to(next_from_fetch.sel, pc_inc_signal.a, out.ir_load),
    is_decode.eq.to(next_from_decode.sel),
    next_from_fetch.out.to(next_from_decode.in0),
    is_subcycle_1.eq.to(exec_done_imm.b, exec_subcycle_1.b),
    exec_done_imm.out.to(exec_done_imm_check.a),
    needs_operand_imm.out.to(exec_done_imm_check.b, needs_operand.a),
    is_subcycle_2.eq.to(exec_done_zp.b, exec_subcycle_2.b),
    exec_done_zp.out.to(exec_done_zp_check.a),
    is_zp_mode.out.to(exec_done_zp_check.b, needs_operand.b, addr_load_signal.b),
    is_subcycle_0.eq.to(exec_done_1cycle.b, exec_subcycle_0.b),
    exec_done_1cycle.out.to(exec_done_1cycle_check.a),
    is_1cycle.out.to(exec_done_1cycle_check.b),
    exec_done_imm_check.out.to(exec_done_temp.a),
    exec_done_zp_check.out.to(exec_done_temp.b),
    exec_done_temp.out.to(exec_done.a),
    exec_done_1cycle_check.out.to(exec_done.b),
    exec_done.out.to(next_from_execute.sel),
    next_from_decode.out.to(next_from_execute.in0),
    inp.reset.to(next_state.sel),
    next_from_execute.out.to(next_state.in0),
    next_state.out.to(state_reg.data),
    exec_subcycle_0.out.to(exec_subcycle_0_needs_operand.a, operand_load_signal.a, addr_load_signal.a, write_x_tax.a, write_x_inx.a),
    needs_operand.out.to(exec_subcycle_0_needs_operand.b, operand_load_signal.b),
    exec_subcycle_0_needs_operand.out.to(pc_inc_signal.b),
    pc_inc_signal.out.to(out.pc_increment),
    operand_load_signal.out.to(out.operand_load),
    addr_load_signal.out.to(out.addr_load),
    exec_subcycle_1.out.to(mem_read_signal.a, mem_write_signal.a, write_a_imm.a),
    mem_read_signal.out.to(out.mem_read),
    mem_write_signal.out.to(out.mem_write),
    exec_subcycle_2.out.to(write_a_zp.a),
    write_a_imm.out.to(write_a_signal.a),
    write_a_zp.out.to(write_a_signal.b),
    write_a_signal.out.to(out.write_a),
    write_x_tax.out.to(write_x_signal.a),
    write_x_inx.out.to(write_x_signal.b),
    write_x_signal.out.to(out.write_x),
  ])
  .build()

const MemoryCPU = component('MemoryCPU')
  .in('reset', bit)
  .out('pc', bus(8))
  .out('instruction', bus(8))
  .out('operand', bus(8))
  .out('address', bus(8))
  .out('mem_data', bus(8))
  .out('current_state', bus(8))
  .out('subcycle', bus(8))
  .out('reg_a', bus(8))
  .out('reg_x', bus(8))
  .node('pc_reg', Register)
  .node('always_on', Constant, { value: 1 })
  .node('pc_inc', Incrementer)
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('two', Constant, { value: 2 })
  .node('three', Constant, { value: 3 })
  .node('four', Constant, { value: 4 })
  .node('five', Constant, { value: 5 })
  .node('six', Constant, { value: 6 })
  .node('seven', Constant, { value: 7 })
  .node('eight', Constant, { value: 8 })
  .node('at_0', Comparator)
  .node('at_1', Comparator)
  .node('at_2', Comparator)
  .node('at_3', Comparator)
  .node('at_4', Comparator)
  .node('at_5', Comparator)
  .node('at_6', Comparator)
  .node('at_7', Comparator)
  .node('at_8', Comparator)
  .node('byte_0', Constant, { value: 169 })
  .node('byte_1', Constant, { value: 66 })
  .node('byte_2', Constant, { value: 133 })
  .node('byte_3', Constant, { value: 16 })
  .node('byte_4', Constant, { value: 165 })
  .node('byte_5', Constant, { value: 16 })
  .node('byte_6', Constant, { value: 170 })
  .node('byte_7', Constant, { value: 232 })
  .node('byte_8', Constant, { value: 0 })
  .node('mux1', Mux)
  .node('mux2', Mux)
  .node('mux3', Mux)
  .node('mux4', Mux)
  .node('mux5', Mux)
  .node('mux6', Mux)
  .node('mux7', Mux)
  .node('mux8', Mux)
  .node('ir', Register)
  .node('operand_reg', Register)
  .node('addr_reg', Register)
  .node('control', MemoryControl)
  .node('pc_next', Mux)
  .node('memory', SimpleMemory)
  .node('registers', RegisterFile)
  .node('inc_x', Incrementer)
  .node('result_a', Mux)
  .node('result_x', Mux)
  .connect(({ in: inp, out, pc_reg, always_on, pc_inc, zero, one, two, three, four, five, six, seven, eight, at_0, at_1, at_2, at_3, at_4, at_5, at_6, at_7, at_8, byte_0, byte_1, byte_2, byte_3, byte_4, byte_5, byte_6, byte_7, byte_8, mux1, mux2, mux3, mux4, mux5, mux6, mux7, mux8, ir, operand_reg, addr_reg, control, pc_next, memory, registers, inc_x, result_a, result_x }) => [
    always_on.out.to(pc_reg.we),
    pc_reg.q.to(pc_inc.in, at_0.a, at_1.a, at_2.a, at_3.a, at_4.a, at_5.a, at_6.a, at_7.a, at_8.a, pc_next.in0, out.pc),
    zero.out.to(at_0.b, registers.data_y),
    one.out.to(at_1.b),
    two.out.to(at_2.b),
    three.out.to(at_3.b),
    four.out.to(at_4.b),
    five.out.to(at_5.b),
    six.out.to(at_6.b),
    seven.out.to(at_7.b),
    eight.out.to(at_8.b),
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
    at_8.eq.to(mux8.sel),
    mux7.out.to(mux8.in0),
    byte_8.out.to(mux8.in1),
    mux8.out.to(ir.data, operand_reg.data, addr_reg.data),
    inp.reset.to(control.reset),
    ir.q.to(control.current_opcode, out.instruction),
    control.pc_increment.to(pc_next.sel),
    pc_inc.out.to(pc_next.in1),
    pc_next.out.to(pc_reg.data),
    control.ir_load.to(ir.we),
    control.operand_load.to(operand_reg.we),
    control.addr_load.to(addr_reg.we),
    addr_reg.q.to(memory.addr, out.address),
    control.mem_write.to(memory.write_enable),
    control.write_a.to(registers.write_a),
    control.write_x.to(registers.write_x),
    control.write_y.to(registers.write_y),
    registers.reg_a.to(memory.data_in, result_x.in1, out.reg_a),
    registers.reg_x.to(inc_x.in, out.reg_x),
    control.is_lda_zp.to(result_a.sel),
    operand_reg.q.to(result_a.in0),
    memory.data_out.to(result_a.in1, out.mem_data),
    result_a.out.to(registers.data_a),
    control.is_tax.to(result_x.sel),
    inc_x.out.to(result_x.in0),
    result_x.out.to(registers.data_x),
    control.current_state.to(out.current_state),
    control.exec_subcycle.to(out.subcycle),
  ])
  .build()

const MemoryTest = component('MemoryTest')
  .node('cpu', MemoryCPU)
  .node('reset_input', Input)
  .node('d_pc', HexDisplay)
  .node('d_instruction', HexDisplay)
  .node('d_address', HexDisplay)
  .node('d_mem_data', HexDisplay)
  .node('d_state', HexDisplay)
  .node('d_subcycle', HexDisplay)
  .node('d_a', HexDisplay)
  .node('d_x', HexDisplay)
  .connect(({ in: inp, out, cpu, reset_input, d_pc, d_instruction, d_address, d_mem_data, d_state, d_subcycle, d_a, d_x }) => [
    reset_input.out.to(cpu.reset),
    cpu.pc.to(d_pc.in),
    cpu.instruction.to(d_instruction.in),
    cpu.address.to(d_address.in),
    cpu.mem_data.to(d_mem_data.in),
    cpu.current_state.to(d_state.in),
    cpu.subcycle.to(d_subcycle.in),
    cpu.reg_a.to(d_a.in),
    cpu.reg_x.to(d_x.in),
  ])
  .build()
