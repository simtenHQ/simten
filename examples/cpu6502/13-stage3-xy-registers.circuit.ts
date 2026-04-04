// Auto-generated from DSL

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

const Stage3Control = component('Stage3Control')
  .in('reset', bit)
  .in('current_opcode', bus(8))
  .out('current_state', bus(8))
  .out('exec_subcycle', bus(8))
  .out('pc_increment', bit)
  .out('ir_load', bit)
  .out('operand_load', bit)
  .out('write_a', bit)
  .out('write_x', bit)
  .out('write_y', bit)
  .out('is_lda', bit)
  .out('is_adc', bit)
  .out('is_tax', bit)
  .out('is_tay', bit)
  .out('is_txa', bit)
  .out('is_tya', bit)
  .out('is_inx', bit)
  .out('is_dex', bit)
  .out('is_iny', bit)
  .out('is_dey', bit)
  .node('state_reg', Register)
  .node('subcycle_reg', Register)
  .node('STATE_FETCH', Constant, { value: 0 })
  .node('STATE_DECODE', Constant, { value: 1 })
  .node('STATE_EXECUTE', Constant, { value: 2 })
  .node('is_fetch', Comparator)
  .node('is_decode', Comparator)
  .node('is_execute', Comparator)
  .node('LDA_IMM', Constant, { value: 169 })
  .node('ADC_IMM', Constant, { value: 105 })
  .node('TAX', Constant, { value: 170 })
  .node('TAY', Constant, { value: 168 })
  .node('TXA', Constant, { value: 138 })
  .node('TYA', Constant, { value: 152 })
  .node('INX', Constant, { value: 232 })
  .node('DEX', Constant, { value: 202 })
  .node('INY', Constant, { value: 200 })
  .node('DEY', Constant, { value: 136 })
  .node('cmp_lda', Comparator)
  .node('cmp_adc', Comparator)
  .node('cmp_tax', Comparator)
  .node('cmp_tay', Comparator)
  .node('cmp_txa', Comparator)
  .node('cmp_tya', Comparator)
  .node('cmp_inx', Comparator)
  .node('cmp_dex', Comparator)
  .node('cmp_iny', Comparator)
  .node('cmp_dey', Comparator)
  .node('needs_operand', Or)
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('inc_subcycle', Incrementer)
  .node('subcycle_increment', Mux)
  .node('always_on', Constant, { value: 1 })
  .node('is_subcycle_0', Comparator)
  .node('is_subcycle_1', Comparator)
  .node('next_from_fetch', Mux)
  .node('next_from_decode', Mux)
  .node('exec_done_2cycle', And)
  .node('exec_done_1cycle', And)
  .node('is_1cycle', Or)
  .node('is_1cycle_2', Or)
  .node('is_1cycle_3', Or)
  .node('is_1cycle_4', Or)
  .node('is_1cycle_5', Or)
  .node('is_1cycle_6', Or)
  .node('is_1cycle_final', Or)
  .node('exec_done_1cycle_check', And)
  .node('exec_done', Or)
  .node('next_from_execute', Mux)
  .node('next_state', Mux)
  .node('exec_subcycle_0', And)
  .node('exec_subcycle_0_needs_operand', And)
  .node('pc_inc_signal', Or)
  .node('operand_load_signal', And)
  .node('exec_subcycle_1', And)
  .node('write_a_2cycle', And)
  .node('write_a_txa', And)
  .node('write_a_tya', And)
  .node('write_a_transfer', Or)
  .node('write_a_signal', Or)
  .node('write_x_tax', And)
  .node('write_x_inx', And)
  .node('write_x_dex', And)
  .node('write_x_temp', Or)
  .node('write_x_signal', Or)
  .node('write_y_tay', And)
  .node('write_y_iny', And)
  .node('write_y_dey', And)
  .node('write_y_temp', Or)
  .node('write_y_signal', Or)
  .connect(({ in: inp, out, state_reg, subcycle_reg, STATE_FETCH, STATE_DECODE, STATE_EXECUTE, is_fetch, is_decode, is_execute, LDA_IMM, ADC_IMM, TAX, TAY, TXA, TYA, INX, DEX, INY, DEY, cmp_lda, cmp_adc, cmp_tax, cmp_tay, cmp_txa, cmp_tya, cmp_inx, cmp_dex, cmp_iny, cmp_dey, needs_operand, zero, one, inc_subcycle, subcycle_increment, always_on, is_subcycle_0, is_subcycle_1, next_from_fetch, next_from_decode, exec_done_2cycle, exec_done_1cycle, is_1cycle, is_1cycle_2, is_1cycle_3, is_1cycle_4, is_1cycle_5, is_1cycle_6, is_1cycle_final, exec_done_1cycle_check, exec_done, next_from_execute, next_state, exec_subcycle_0, exec_subcycle_0_needs_operand, pc_inc_signal, operand_load_signal, exec_subcycle_1, write_a_2cycle, write_a_txa, write_a_tya, write_a_transfer, write_a_signal, write_x_tax, write_x_inx, write_x_dex, write_x_temp, write_x_signal, write_y_tay, write_y_iny, write_y_dey, write_y_temp, write_y_signal }) => [
    state_reg.q.to(is_fetch.a, is_decode.a, is_execute.a, next_from_fetch.in0, out.current_state),
    STATE_FETCH.out.to(is_fetch.b, next_from_execute.in1, next_state.in1),
    STATE_DECODE.out.to(is_decode.b, next_from_fetch.in1),
    STATE_EXECUTE.out.to(is_execute.b, next_from_decode.in1),
    inp.current_opcode.to(cmp_lda.a, cmp_adc.a, cmp_tax.a, cmp_tay.a, cmp_txa.a, cmp_tya.a, cmp_inx.a, cmp_dex.a, cmp_iny.a, cmp_dey.a),
    LDA_IMM.out.to(cmp_lda.b),
    cmp_lda.eq.to(out.is_lda, needs_operand.a),
    ADC_IMM.out.to(cmp_adc.b),
    cmp_adc.eq.to(out.is_adc, needs_operand.b),
    TAX.out.to(cmp_tax.b),
    cmp_tax.eq.to(out.is_tax, is_1cycle.a, write_x_tax.b),
    TAY.out.to(cmp_tay.b),
    cmp_tay.eq.to(out.is_tay, is_1cycle.b, write_y_tay.b),
    TXA.out.to(cmp_txa.b),
    cmp_txa.eq.to(out.is_txa, is_1cycle_2.b, write_a_txa.b),
    TYA.out.to(cmp_tya.b),
    cmp_tya.eq.to(out.is_tya, is_1cycle_3.b, write_a_tya.b),
    INX.out.to(cmp_inx.b),
    cmp_inx.eq.to(out.is_inx, is_1cycle_4.b, write_x_inx.b),
    DEX.out.to(cmp_dex.b),
    cmp_dex.eq.to(out.is_dex, is_1cycle_5.b, write_x_dex.b),
    INY.out.to(cmp_iny.b),
    cmp_iny.eq.to(out.is_iny, is_1cycle_6.b, write_y_iny.b),
    DEY.out.to(cmp_dey.b),
    cmp_dey.eq.to(out.is_dey, is_1cycle_final.b, write_y_dey.b),
    subcycle_reg.q.to(inc_subcycle.in, out.exec_subcycle, is_subcycle_0.a, is_subcycle_1.a),
    is_execute.eq.to(subcycle_increment.sel, exec_done_2cycle.a, exec_done_1cycle.a, exec_subcycle_0.a, exec_subcycle_1.a),
    zero.out.to(subcycle_increment.in0, is_subcycle_0.b),
    inc_subcycle.out.to(subcycle_increment.in1),
    subcycle_increment.out.to(subcycle_reg.data),
    always_on.out.to(subcycle_reg.we, state_reg.we),
    one.out.to(is_subcycle_1.b),
    is_fetch.eq.to(next_from_fetch.sel, pc_inc_signal.a, out.ir_load),
    is_decode.eq.to(next_from_decode.sel),
    next_from_fetch.out.to(next_from_decode.in0),
    is_subcycle_1.eq.to(exec_done_2cycle.b, exec_subcycle_1.b),
    is_subcycle_0.eq.to(exec_done_1cycle.b, exec_subcycle_0.b),
    is_1cycle.out.to(is_1cycle_2.a),
    is_1cycle_2.out.to(is_1cycle_3.a),
    is_1cycle_3.out.to(is_1cycle_4.a),
    is_1cycle_4.out.to(is_1cycle_5.a),
    is_1cycle_5.out.to(is_1cycle_6.a),
    is_1cycle_6.out.to(is_1cycle_final.a),
    exec_done_1cycle.out.to(exec_done_1cycle_check.a),
    is_1cycle_final.out.to(exec_done_1cycle_check.b),
    exec_done_2cycle.out.to(exec_done.a),
    exec_done_1cycle_check.out.to(exec_done.b),
    exec_done.out.to(next_from_execute.sel),
    next_from_decode.out.to(next_from_execute.in0),
    inp.reset.to(next_state.sel),
    next_from_execute.out.to(next_state.in0),
    next_state.out.to(state_reg.data),
    exec_subcycle_0.out.to(exec_subcycle_0_needs_operand.a, operand_load_signal.a, write_a_txa.a, write_a_tya.a, write_x_tax.a, write_x_inx.a, write_x_dex.a, write_y_tay.a, write_y_iny.a, write_y_dey.a),
    needs_operand.out.to(exec_subcycle_0_needs_operand.b, operand_load_signal.b, write_a_2cycle.b),
    exec_subcycle_0_needs_operand.out.to(pc_inc_signal.b),
    pc_inc_signal.out.to(out.pc_increment),
    operand_load_signal.out.to(out.operand_load),
    exec_subcycle_1.out.to(write_a_2cycle.a),
    write_a_txa.out.to(write_a_transfer.a),
    write_a_tya.out.to(write_a_transfer.b),
    write_a_2cycle.out.to(write_a_signal.a),
    write_a_transfer.out.to(write_a_signal.b),
    write_a_signal.out.to(out.write_a),
    write_x_tax.out.to(write_x_temp.a),
    write_x_inx.out.to(write_x_temp.b),
    write_x_temp.out.to(write_x_signal.a),
    write_x_dex.out.to(write_x_signal.b),
    write_x_signal.out.to(out.write_x),
    write_y_tay.out.to(write_y_temp.a),
    write_y_iny.out.to(write_y_temp.b),
    write_y_temp.out.to(write_y_signal.a),
    write_y_dey.out.to(write_y_signal.b),
    write_y_signal.out.to(out.write_y),
  ])
  .build()

const Stage3CPU = component('Stage3CPU')
  .in('reset', bit)
  .out('pc', bus(8))
  .out('instruction', bus(8))
  .out('operand', bus(8))
  .out('current_state', bus(8))
  .out('subcycle', bus(8))
  .out('reg_a', bus(8))
  .out('reg_x', bus(8))
  .out('reg_y', bus(8))
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
  .node('byte_2', Constant, { value: 170 })
  .node('byte_3', Constant, { value: 232 })
  .node('byte_4', Constant, { value: 152 })
  .node('byte_5', Constant, { value: 0 })
  .node('byte_6', Constant, { value: 0 })
  .node('byte_7', Constant, { value: 0 })
  .node('mux1', Mux)
  .node('mux2', Mux)
  .node('mux3', Mux)
  .node('mux4', Mux)
  .node('mux5', Mux)
  .node('mux6', Mux)
  .node('mux7', Mux)
  .node('ir', Register)
  .node('operand_reg', Register)
  .node('control', Stage3Control)
  .node('pc_next', Mux)
  .node('registers', RegisterFile)
  .node('adder', Adder)
  .node('inc_x', Incrementer)
  .node('dec_x', Subtractor)
  .node('inc_y', Incrementer)
  .node('dec_y', Subtractor)
  .node('result_a_lda_adc', Mux)
  .node('result_a_txa', Mux)
  .node('result_a', Mux)
  .node('result_x_inx_dex', Mux)
  .node('result_x', Mux)
  .node('result_y_iny_dey', Mux)
  .node('result_y', Mux)
  .connect(({ in: inp, out, pc_reg, always_on, pc_inc, zero, one, two, three, four, five, six, seven, at_0, at_1, at_2, at_3, at_4, at_5, at_6, at_7, byte_0, byte_1, byte_2, byte_3, byte_4, byte_5, byte_6, byte_7, mux1, mux2, mux3, mux4, mux5, mux6, mux7, ir, operand_reg, control, pc_next, registers, adder, inc_x, dec_x, inc_y, dec_y, result_a_lda_adc, result_a_txa, result_a, result_x_inx_dex, result_x, result_y_iny_dey, result_y }) => [
    always_on.out.to(pc_reg.we),
    pc_reg.q.to(pc_inc.in, at_0.a, at_1.a, at_2.a, at_3.a, at_4.a, at_5.a, at_6.a, at_7.a, pc_next.in0, out.pc),
    zero.out.to(at_0.b, adder.carry_in, dec_x.borrow_in, dec_y.borrow_in),
    one.out.to(at_1.b, dec_x.b, dec_y.b),
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
    mux7.out.to(ir.data, operand_reg.data),
    inp.reset.to(control.reset),
    ir.q.to(control.current_opcode, out.instruction),
    control.pc_increment.to(pc_next.sel),
    pc_inc.out.to(pc_next.in1),
    pc_next.out.to(pc_reg.data),
    control.ir_load.to(ir.we),
    control.operand_load.to(operand_reg.we),
    control.write_a.to(registers.write_a),
    control.write_x.to(registers.write_x),
    control.write_y.to(registers.write_y),
    registers.reg_a.to(adder.a, result_x.in1, result_y.in1, out.reg_a),
    operand_reg.q.to(adder.b, result_a_lda_adc.in1, out.operand),
    registers.reg_x.to(inc_x.in, dec_x.a, result_a_txa.in1, out.reg_x),
    registers.reg_y.to(inc_y.in, dec_y.a, result_a.in1, out.reg_y),
    control.is_lda.to(result_a_lda_adc.sel),
    adder.sum.to(result_a_lda_adc.in0),
    control.is_txa.to(result_a_txa.sel),
    result_a_lda_adc.out.to(result_a_txa.in0),
    control.is_tya.to(result_a.sel),
    result_a_txa.out.to(result_a.in0),
    result_a.out.to(registers.data_a),
    control.is_dex.to(result_x_inx_dex.sel),
    inc_x.out.to(result_x_inx_dex.in0),
    dec_x.difference.to(result_x_inx_dex.in1),
    control.is_tax.to(result_x.sel),
    result_x_inx_dex.out.to(result_x.in0),
    result_x.out.to(registers.data_x),
    control.is_dey.to(result_y_iny_dey.sel),
    inc_y.out.to(result_y_iny_dey.in0),
    dec_y.difference.to(result_y_iny_dey.in1),
    control.is_tay.to(result_y.sel),
    result_y_iny_dey.out.to(result_y.in0),
    result_y.out.to(registers.data_y),
    control.current_state.to(out.current_state),
    control.exec_subcycle.to(out.subcycle),
  ])
  .build()

const Stage3XYTest = component('Stage3XYTest')
  .node('cpu', Stage3CPU)
  .node('reset_input', Input)
  .node('d_pc', HexDisplay)
  .node('d_instruction', HexDisplay)
  .node('d_operand', HexDisplay)
  .node('d_state', HexDisplay)
  .node('d_subcycle', HexDisplay)
  .node('d_a', HexDisplay)
  .node('d_x', HexDisplay)
  .node('d_y', HexDisplay)
  .connect(({ in: inp, out, cpu, reset_input, d_pc, d_instruction, d_operand, d_state, d_subcycle, d_a, d_x, d_y }) => [
    reset_input.out.to(cpu.reset),
    cpu.pc.to(d_pc.in),
    cpu.instruction.to(d_instruction.in),
    cpu.operand.to(d_operand.in),
    cpu.current_state.to(d_state.in),
    cpu.subcycle.to(d_subcycle.in),
    cpu.reg_a.to(d_a.in),
    cpu.reg_x.to(d_x.in),
    cpu.reg_y.to(d_y.in),
  ])
  .build()
