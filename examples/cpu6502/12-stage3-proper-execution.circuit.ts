// Auto-generated from DSL

const InstructionRegister = component('InstructionRegister')
  .in('opcode', bus(8))
  .in('load', bit)
  .out('current_opcode', bus(8))
  .node('ir', Register)
  .connect(({ in: inp, out, ir }) => [
    inp.opcode.to(ir.data),
    inp.load.to(ir.we),
    ir.q.to(out.current_opcode),
  ])
  .build()

const EnhancedControl = component('EnhancedControl')
  .in('reset', bit)
  .in('current_opcode', bus(8))
  .out('current_state', bus(3))
  .out('exec_subcycle', bus(3))
  .out('pc_increment', bit)
  .out('ir_load', bit)
  .out('operand_load', bit)
  .out('reg_write', bit)
  .out('is_lda', bit)
  .out('is_adc', bit)
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
  .node('cmp_lda', Comparator)
  .node('cmp_adc', Comparator)
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('two', Constant, { value: 2 })
  .node('inc_subcycle', Incrementer)
  .node('subcycle_increment', Mux)
  .node('always_on', Constant, { value: 1 })
  .node('is_subcycle_0', Comparator)
  .node('is_subcycle_1', Comparator)
  .node('next_from_fetch', Mux)
  .node('next_from_decode', Mux)
  .node('exec_done', And)
  .node('next_from_execute', Mux)
  .node('next_state', Mux)
  .node('exec_subcycle_0', And)
  .node('pc_inc_signal', Or)
  .node('exec_subcycle_1', And)
  .connect(({ in: inp, out, state_reg, subcycle_reg, STATE_FETCH, STATE_DECODE, STATE_EXECUTE, is_fetch, is_decode, is_execute, LDA_IMM, ADC_IMM, cmp_lda, cmp_adc, zero, one, two, inc_subcycle, subcycle_increment, always_on, is_subcycle_0, is_subcycle_1, next_from_fetch, next_from_decode, exec_done, next_from_execute, next_state, exec_subcycle_0, pc_inc_signal, exec_subcycle_1 }) => [
    state_reg.q.to(is_fetch.a, is_decode.a, is_execute.a, next_from_fetch.in0, out.current_state),
    STATE_FETCH.out.to(is_fetch.b, next_from_execute.in1, next_state.in1),
    STATE_DECODE.out.to(is_decode.b, next_from_fetch.in1),
    STATE_EXECUTE.out.to(is_execute.b, next_from_decode.in1),
    inp.current_opcode.to(cmp_lda.a, cmp_adc.a),
    LDA_IMM.out.to(cmp_lda.b),
    cmp_lda.eq.to(out.is_lda),
    ADC_IMM.out.to(cmp_adc.b),
    cmp_adc.eq.to(out.is_adc),
    subcycle_reg.q.to(inc_subcycle.in, out.exec_subcycle, is_subcycle_0.a, is_subcycle_1.a),
    is_execute.eq.to(subcycle_increment.sel, exec_done.a, exec_subcycle_0.a, exec_subcycle_1.a),
    zero.out.to(subcycle_increment.in0, is_subcycle_0.b),
    inc_subcycle.out.to(subcycle_increment.in1),
    subcycle_increment.out.to(subcycle_reg.data),
    always_on.out.to(subcycle_reg.we, state_reg.we),
    one.out.to(is_subcycle_1.b),
    is_fetch.eq.to(next_from_fetch.sel, pc_inc_signal.a, out.ir_load),
    is_decode.eq.to(next_from_decode.sel),
    next_from_fetch.out.to(next_from_decode.in0),
    is_subcycle_1.eq.to(exec_done.b, exec_subcycle_1.b),
    exec_done.out.to(next_from_execute.sel),
    next_from_decode.out.to(next_from_execute.in0),
    inp.reset.to(next_state.sel),
    next_from_execute.out.to(next_state.in0),
    next_state.out.to(state_reg.data),
    is_subcycle_0.eq.to(exec_subcycle_0.b),
    exec_subcycle_0.out.to(pc_inc_signal.b, out.operand_load),
    pc_inc_signal.out.to(out.pc_increment),
    exec_subcycle_1.out.to(out.reg_write),
  ])
  .build()

const EnhancedCPU = component('EnhancedCPU')
  .in('reset', bit)
  .out('pc', bus(8))
  .out('instruction', bus(8))
  .out('operand', bus(8))
  .out('current_state', bus(3))
  .out('subcycle', bus(3))
  .out('reg_a', bus(8))
  .node('pc_reg', Register)
  .node('always_on', Constant, { value: 1 })
  .node('pc_inc', Incrementer)
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('two', Constant, { value: 2 })
  .node('three', Constant, { value: 3 })
  .node('four', Constant, { value: 4 })
  .node('five', Constant, { value: 5 })
  .node('at_0', Comparator)
  .node('at_1', Comparator)
  .node('at_2', Comparator)
  .node('at_3', Comparator)
  .node('at_4', Comparator)
  .node('at_5', Comparator)
  .node('byte_0', Constant, { value: 169 })
  .node('byte_1', Constant, { value: 66 })
  .node('byte_2', Constant, { value: 105 })
  .node('byte_3', Constant, { value: 8 })
  .node('byte_4', Constant, { value: 0 })
  .node('byte_5', Constant, { value: 0 })
  .node('mux1', Mux)
  .node('mux2', Mux)
  .node('mux3', Mux)
  .node('mux4', Mux)
  .node('mux5', Mux)
  .node('ir', Register)
  .node('operand_reg', Register)
  .node('control', EnhancedControl)
  .node('pc_next', Mux)
  .node('reg_a_internal', Register)
  .node('adder', Adder)
  .node('result', Mux)
  .connect(({ in: inp, out, pc_reg, always_on, pc_inc, zero, one, two, three, four, five, at_0, at_1, at_2, at_3, at_4, at_5, byte_0, byte_1, byte_2, byte_3, byte_4, byte_5, mux1, mux2, mux3, mux4, mux5, ir, operand_reg, control, pc_next, reg_a_internal, adder, result }) => [
    always_on.out.to(pc_reg.we),
    pc_reg.q.to(pc_inc.in, at_0.a, at_1.a, at_2.a, at_3.a, at_4.a, at_5.a, pc_next.in0, out.pc),
    zero.out.to(at_0.b, adder.carry_in),
    one.out.to(at_1.b),
    two.out.to(at_2.b),
    three.out.to(at_3.b),
    four.out.to(at_4.b),
    five.out.to(at_5.b),
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
    mux5.out.to(ir.data, operand_reg.data),
    inp.reset.to(control.reset),
    ir.q.to(control.current_opcode, out.instruction),
    control.pc_increment.to(pc_next.sel),
    pc_inc.out.to(pc_next.in1),
    pc_next.out.to(pc_reg.data),
    control.ir_load.to(ir.we),
    control.operand_load.to(operand_reg.we),
    control.reg_write.to(reg_a_internal.we),
    reg_a_internal.q.to(adder.a, out.reg_a),
    operand_reg.q.to(adder.b, result.in1, out.operand),
    control.is_lda.to(result.sel),
    adder.sum.to(result.in0),
    result.out.to(reg_a_internal.data),
    control.current_state.to(out.current_state),
    control.exec_subcycle.to(out.subcycle),
  ])
  .build()

const Stage3Test = component('Stage3Test')
  .node('cpu', EnhancedCPU)
  .node('reset_input', Input)
  .node('d_pc', HexDisplay)
  .node('d_instruction', HexDisplay)
  .node('d_operand', HexDisplay)
  .node('d_state', HexDisplay)
  .node('d_subcycle', HexDisplay)
  .node('d_a', HexDisplay)
  .connect(({ in: inp, out, cpu, reset_input, d_pc, d_instruction, d_operand, d_state, d_subcycle, d_a }) => [
    reset_input.out.to(cpu.reset),
    cpu.pc.to(d_pc.in),
    cpu.instruction.to(d_instruction.in),
    cpu.operand.to(d_operand.in),
    cpu.current_state.to(d_state.in),
    cpu.subcycle.to(d_subcycle.in),
    cpu.reg_a.to(d_a.in),
  ])
  .build()
