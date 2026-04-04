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
  .node('addr_13', Constant, { value: 19 })
  .node('addr_14', Constant, { value: 20 })
  .node('addr_15', Constant, { value: 21 })
  .node('at_10', Comparator)
  .node('at_11', Comparator)
  .node('at_12', Comparator)
  .node('at_13', Comparator)
  .node('at_14', Comparator)
  .node('at_15', Comparator)
  .node('mem_10', Register)
  .node('mem_11', Register)
  .node('mem_12', Register)
  .node('mem_13', Register)
  .node('mem_14', Register)
  .node('mem_15', Register)
  .node('we_10', And)
  .node('we_11', And)
  .node('we_12', And)
  .node('we_13', And)
  .node('we_14', And)
  .node('we_15', And)
  .node('mux1', Mux)
  .node('mux2', Mux)
  .node('mux3', Mux)
  .node('mux4', Mux)
  .node('mux5', Mux)
  .node('mux6', Mux)
  .connect(({ in: inp, out, zero, addr_10, addr_11, addr_12, addr_13, addr_14, addr_15, at_10, at_11, at_12, at_13, at_14, at_15, mem_10, mem_11, mem_12, mem_13, mem_14, mem_15, we_10, we_11, we_12, we_13, we_14, we_15, mux1, mux2, mux3, mux4, mux5, mux6 }) => [
    inp.addr.to(at_10.a, at_11.a, at_12.a, at_13.a, at_14.a, at_15.a),
    addr_10.out.to(at_10.b),
    addr_11.out.to(at_11.b),
    addr_12.out.to(at_12.b),
    addr_13.out.to(at_13.b),
    addr_14.out.to(at_14.b),
    addr_15.out.to(at_15.b),
    inp.data_in.to(mem_10.data, mem_11.data, mem_12.data, mem_13.data, mem_14.data, mem_15.data),
    inp.write_enable.to(we_10.a, we_11.a, we_12.a, we_13.a, we_14.a, we_15.a),
    at_10.eq.to(we_10.b, mux1.sel),
    we_10.out.to(mem_10.we),
    at_11.eq.to(we_11.b, mux2.sel),
    we_11.out.to(mem_11.we),
    at_12.eq.to(we_12.b, mux3.sel),
    we_12.out.to(mem_12.we),
    at_13.eq.to(we_13.b, mux4.sel),
    we_13.out.to(mem_13.we),
    at_14.eq.to(we_14.b, mux5.sel),
    we_14.out.to(mem_14.we),
    at_15.eq.to(we_15.b, mux6.sel),
    we_15.out.to(mem_15.we),
    zero.out.to(mux1.in0),
    mem_10.q.to(mux1.in1),
    mux1.out.to(mux2.in0),
    mem_11.q.to(mux2.in1),
    mux2.out.to(mux3.in0),
    mem_12.q.to(mux3.in1),
    mux3.out.to(mux4.in0),
    mem_13.q.to(mux4.in1),
    mux4.out.to(mux5.in0),
    mem_14.q.to(mux5.in1),
    mux5.out.to(mux6.in0),
    mem_15.q.to(mux6.in1),
    mux6.out.to(out.data_out),
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

const FlagRegister = component('FlagRegister')
  .in('update_n', bit)
  .in('update_z', bit)
  .in('update_c', bit)
  .in('update_v', bit)
  .in('new_n', bit)
  .in('new_z', bit)
  .in('new_c', bit)
  .in('new_v', bit)
  .out('flag_n', bit)
  .out('flag_z', bit)
  .out('flag_c', bit)
  .out('flag_v', bit)
  .node('reg_n', Register, { initial: 0 })
  .node('reg_z', Register, { initial: 0 })
  .node('reg_c', Register, { initial: 0 })
  .node('reg_v', Register, { initial: 0 })
  .connect(({ in: inp, out, reg_n, reg_z, reg_c, reg_v }) => [
    inp.update_n.to(reg_n.we),
    inp.new_n.to(reg_n.data),
    reg_n.q.to(out.flag_n),
    inp.update_z.to(reg_z.we),
    inp.new_z.to(reg_z.data),
    reg_z.q.to(out.flag_z),
    inp.update_c.to(reg_c.we),
    inp.new_c.to(reg_c.data),
    reg_c.q.to(out.flag_c),
    inp.update_v.to(reg_v.we),
    inp.new_v.to(reg_v.data),
    reg_v.q.to(out.flag_v),
  ])
  .build()

const CompareControl = component('CompareControl')
  .in('reset', bit)
  .in('current_opcode', bus(8))
  .out('current_state', bus(8))
  .out('exec_subcycle', bus(8))
  .out('pc_increment', bit)
  .out('ir_load', bit)
  .out('operand_load', bit)
  .out('write_a', bit)
  .out('update_flags', bit)
  .out('is_lda_imm', bit)
  .out('is_cmp_imm', bit)
  .node('state_reg', Register)
  .node('subcycle_reg', Register)
  .node('STATE_FETCH', Constant, { value: 0 })
  .node('STATE_DECODE', Constant, { value: 1 })
  .node('STATE_EXECUTE', Constant, { value: 2 })
  .node('is_fetch', Comparator)
  .node('is_decode', Comparator)
  .node('is_execute', Comparator)
  .node('LDA_IMM', Constant, { value: 169 })
  .node('CMP_IMM', Constant, { value: 201 })
  .node('cmp_lda_imm', Comparator)
  .node('cmp_cmp_imm', Comparator)
  .node('is_imm', Or)
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('inc_subcycle', Incrementer)
  .node('subcycle_increment', Mux)
  .node('always_on', Constant, { value: 1 })
  .node('is_sub0', Comparator)
  .node('is_sub1', Comparator)
  .node('exec_sub0', And)
  .node('exec_sub1', And)
  .node('next_from_fetch', Mux)
  .node('next_from_decode', Mux)
  .node('done_imm', And)
  .node('next_from_execute', Mux)
  .node('next_state', Mux)
  .node('pc_inc_sub0', And)
  .node('pc_inc_signal', Or)
  .node('operand_load_signal', And)
  .node('write_a_signal', And)
  .node('update_flags_lda', And)
  .node('update_flags_cmp', And)
  .node('update_flags_signal', Or)
  .connect(({ in: inp, out, state_reg, subcycle_reg, STATE_FETCH, STATE_DECODE, STATE_EXECUTE, is_fetch, is_decode, is_execute, LDA_IMM, CMP_IMM, cmp_lda_imm, cmp_cmp_imm, is_imm, zero, one, inc_subcycle, subcycle_increment, always_on, is_sub0, is_sub1, exec_sub0, exec_sub1, next_from_fetch, next_from_decode, done_imm, next_from_execute, next_state, pc_inc_sub0, pc_inc_signal, operand_load_signal, write_a_signal, update_flags_lda, update_flags_cmp, update_flags_signal }) => [
    state_reg.q.to(is_fetch.a, is_decode.a, is_execute.a, next_from_fetch.in0, out.current_state),
    STATE_FETCH.out.to(is_fetch.b, next_from_execute.in1, next_state.in1),
    STATE_DECODE.out.to(is_decode.b, next_from_fetch.in1),
    STATE_EXECUTE.out.to(is_execute.b, next_from_decode.in1),
    inp.current_opcode.to(cmp_lda_imm.a, cmp_cmp_imm.a),
    LDA_IMM.out.to(cmp_lda_imm.b),
    cmp_lda_imm.eq.to(out.is_lda_imm, is_imm.a, write_a_signal.b, update_flags_lda.b),
    CMP_IMM.out.to(cmp_cmp_imm.b),
    cmp_cmp_imm.eq.to(out.is_cmp_imm, is_imm.b, update_flags_cmp.b),
    subcycle_reg.q.to(inc_subcycle.in, out.exec_subcycle, is_sub0.a, is_sub1.a),
    is_execute.eq.to(subcycle_increment.sel, exec_sub0.a, exec_sub1.a),
    zero.out.to(subcycle_increment.in0, is_sub0.b),
    inc_subcycle.out.to(subcycle_increment.in1),
    subcycle_increment.out.to(subcycle_reg.data),
    always_on.out.to(subcycle_reg.we, state_reg.we),
    one.out.to(is_sub1.b),
    is_sub0.eq.to(exec_sub0.b),
    is_sub1.eq.to(exec_sub1.b),
    is_fetch.eq.to(next_from_fetch.sel, pc_inc_signal.a, out.ir_load),
    is_decode.eq.to(next_from_decode.sel),
    next_from_fetch.out.to(next_from_decode.in0),
    exec_sub1.out.to(done_imm.a, write_a_signal.a, update_flags_lda.a, update_flags_cmp.a),
    is_imm.out.to(done_imm.b, pc_inc_sub0.b, operand_load_signal.b),
    done_imm.out.to(next_from_execute.sel),
    next_from_decode.out.to(next_from_execute.in0),
    inp.reset.to(next_state.sel),
    next_from_execute.out.to(next_state.in0),
    next_state.out.to(state_reg.data),
    exec_sub0.out.to(pc_inc_sub0.a, operand_load_signal.a),
    pc_inc_sub0.out.to(pc_inc_signal.b),
    pc_inc_signal.out.to(out.pc_increment),
    operand_load_signal.out.to(out.operand_load),
    write_a_signal.out.to(out.write_a),
    update_flags_lda.out.to(update_flags_signal.a),
    update_flags_cmp.out.to(update_flags_signal.b),
    update_flags_signal.out.to(out.update_flags),
  ])
  .build()

const CompareCPU = component('CompareCPU')
  .in('reset', bit)
  .out('pc', bus(8))
  .out('instruction', bus(8))
  .out('operand', bus(8))
  .out('current_state', bus(8))
  .out('subcycle', bus(8))
  .out('reg_a', bus(8))
  .out('flag_n', bit)
  .out('flag_z', bit)
  .out('flag_c', bit)
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
  .node('byte_0', Constant, { value: 169 })
  .node('byte_1', Constant, { value: 5 })
  .node('byte_2', Constant, { value: 201 })
  .node('byte_3', Constant, { value: 5 })
  .node('byte_4', Constant, { value: 201 })
  .node('byte_5', Constant, { value: 3 })
  .node('byte_6', Constant, { value: 201 })
  .node('byte_7', Constant, { value: 16 })
  .node('at_0', Comparator)
  .node('at_1', Comparator)
  .node('at_2', Comparator)
  .node('at_3', Comparator)
  .node('at_4', Comparator)
  .node('at_5', Comparator)
  .node('at_6', Comparator)
  .node('at_7', Comparator)
  .node('mux1', Mux)
  .node('mux2', Mux)
  .node('mux3', Mux)
  .node('mux4', Mux)
  .node('mux5', Mux)
  .node('mux6', Mux)
  .node('mux7', Mux)
  .node('ir', Register)
  .node('operand_reg', Register)
  .node('control', CompareControl)
  .node('pc_next', Mux)
  .node('reg_a_reg', Register)
  .node('cmp_sub', Subtractor)
  .node('const_128', Constant, { value: 128 })
  .node('cmp_n', Comparator)
  .node('n_gte', Or)
  .node('cmp_z', Comparator)
  .node('not_borrow', Not)
  .node('flags', FlagRegister)
  .node('lda_n', Comparator)
  .node('lda_n_gte', Or)
  .node('n_source', Mux)
  .node('lda_z', Comparator)
  .node('z_source', Mux)
  .connect(({ in: inp, out, pc_reg, always_on, pc_inc, zero, one, two, three, four, five, six, seven, byte_0, byte_1, byte_2, byte_3, byte_4, byte_5, byte_6, byte_7, at_0, at_1, at_2, at_3, at_4, at_5, at_6, at_7, mux1, mux2, mux3, mux4, mux5, mux6, mux7, ir, operand_reg, control, pc_next, reg_a_reg, cmp_sub, const_128, cmp_n, n_gte, cmp_z, not_borrow, flags, lda_n, lda_n_gte, n_source, lda_z, z_source }) => [
    always_on.out.to(pc_reg.we),
    pc_reg.q.to(pc_inc.in, at_0.a, at_1.a, at_2.a, at_3.a, at_4.a, at_5.a, at_6.a, at_7.a, pc_next.in0, out.pc),
    zero.out.to(at_0.b, cmp_sub.borrow_in, cmp_z.b, flags.update_v, lda_z.b, flags.new_v),
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
    mux7.out.to(ir.data, operand_reg.data),
    inp.reset.to(control.reset),
    ir.q.to(control.current_opcode, out.instruction),
    control.pc_increment.to(pc_next.sel),
    pc_inc.out.to(pc_next.in1),
    pc_next.out.to(pc_reg.data),
    control.ir_load.to(ir.we),
    control.operand_load.to(operand_reg.we),
    control.write_a.to(reg_a_reg.we),
    operand_reg.q.to(reg_a_reg.data, cmp_sub.b, lda_n.a, lda_z.a, out.operand),
    reg_a_reg.q.to(cmp_sub.a, out.reg_a),
    cmp_sub.difference.to(cmp_n.a, cmp_z.a),
    const_128.out.to(cmp_n.b, lda_n.b),
    cmp_n.gt.to(n_gte.a),
    cmp_n.eq.to(n_gte.b),
    cmp_sub.borrow_out.to(not_borrow.in),
    control.update_flags.to(flags.update_n, flags.update_z, flags.update_c),
    lda_n.gt.to(lda_n_gte.a),
    lda_n.eq.to(lda_n_gte.b),
    control.is_cmp_imm.to(n_source.sel, z_source.sel),
    lda_n_gte.out.to(n_source.in0),
    n_gte.out.to(n_source.in1),
    n_source.out.to(flags.new_n),
    lda_z.eq.to(z_source.in0),
    cmp_z.eq.to(z_source.in1),
    z_source.out.to(flags.new_z),
    not_borrow.out.to(flags.new_c),
    control.current_state.to(out.current_state),
    control.exec_subcycle.to(out.subcycle),
    flags.flag_n.to(out.flag_n),
    flags.flag_z.to(out.flag_z),
    flags.flag_c.to(out.flag_c),
  ])
  .build()

const CompareTest = component('CompareTest')
  .node('cpu', CompareCPU)
  .node('reset_input', Input)
  .node('d_pc', HexDisplay)
  .node('d_instruction', HexDisplay)
  .node('d_operand', HexDisplay)
  .node('d_state', HexDisplay)
  .node('d_subcycle', HexDisplay)
  .node('d_a', HexDisplay)
  .node('d_n', HexDisplay)
  .node('d_z', HexDisplay)
  .node('d_c', HexDisplay)
  .connect(({ in: inp, out, cpu, reset_input, d_pc, d_instruction, d_operand, d_state, d_subcycle, d_a, d_n, d_z, d_c }) => [
    reset_input.out.to(cpu.reset),
    cpu.pc.to(d_pc.in),
    cpu.instruction.to(d_instruction.in),
    cpu.operand.to(d_operand.in),
    cpu.current_state.to(d_state.in),
    cpu.subcycle.to(d_subcycle.in),
    cpu.reg_a.to(d_a.in),
    cpu.flag_n.to(d_n.in),
    cpu.flag_z.to(d_z.in),
    cpu.flag_c.to(d_c.in),
  ])
  .build()
