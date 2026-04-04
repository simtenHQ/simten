// Auto-generated from DSL

const Part2TestCPU = component('Part2TestCPU')
  .in('reset', bit)
  .out('pc', bus(8))
  .out('reg_a', bus(8))
  .out('reg_x', bus(8))
  .out('reg_y', bus(8))
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
  .node('eight', Constant, { value: 8 })
  .node('nine', Constant, { value: 9 })
  .node('ten', Constant, { value: 10 })
  .node('eleven', Constant, { value: 11 })
  .node('twelve', Constant, { value: 12 })
  .node('thirteen', Constant, { value: 13 })
  .node('fourteen', Constant, { value: 14 })
  .node('fifteen', Constant, { value: 15 })
  .node('byte_0', Constant, { value: 160 })
  .node('byte_1', Constant, { value: 66 })
  .node('byte_2', Constant, { value: 152 })
  .node('byte_3', Constant, { value: 170 })
  .node('byte_4', Constant, { value: 169 })
  .node('byte_5', Constant, { value: 0 })
  .node('byte_6', Constant, { value: 138 })
  .node('byte_7', Constant, { value: 224 })
  .node('byte_8', Constant, { value: 66 })
  .node('byte_9', Constant, { value: 192 })
  .node('byte_10', Constant, { value: 66 })
  .node('byte_11', Constant, { value: 224 })
  .node('byte_12', Constant, { value: 80 })
  .node('byte_13', Constant, { value: 234 })
  .node('byte_14', Constant, { value: 234 })
  .node('byte_15', Constant, { value: 234 })
  .node('at_0', Comparator)
  .node('at_1', Comparator)
  .node('at_2', Comparator)
  .node('at_3', Comparator)
  .node('at_4', Comparator)
  .node('at_5', Comparator)
  .node('at_6', Comparator)
  .node('at_7', Comparator)
  .node('at_8', Comparator)
  .node('at_9', Comparator)
  .node('at_10', Comparator)
  .node('at_11', Comparator)
  .node('at_12', Comparator)
  .node('at_13', Comparator)
  .node('at_14', Comparator)
  .node('at_15', Comparator)
  .node('mux1', Mux)
  .node('mux2', Mux)
  .node('mux3', Mux)
  .node('mux4', Mux)
  .node('mux5', Mux)
  .node('mux6', Mux)
  .node('mux7', Mux)
  .node('mux8', Mux)
  .node('mux9', Mux)
  .node('mux10', Mux)
  .node('mux11', Mux)
  .node('mux12', Mux)
  .node('mux13', Mux)
  .node('mux14', Mux)
  .node('mux15', Mux)
  .node('ir', Register)
  .node('operand_reg', Register)
  .node('regA', Register)
  .node('regX', Register)
  .node('regY', Register)
  .node('flag_n_reg', Register, { initial: 0 })
  .node('flag_z_reg', Register, { initial: 0 })
  .node('flag_c_reg', Register, { initial: 0 })
  .node('state_reg', Register)
  .node('subcycle_reg', Register)
  .node('STATE_FETCH', Constant, { value: 0 })
  .node('STATE_DECODE', Constant, { value: 1 })
  .node('STATE_EXECUTE', Constant, { value: 2 })
  .node('is_fetch', Comparator)
  .node('is_decode', Comparator)
  .node('is_execute', Comparator)
  .node('LDY_IMM', Constant, { value: 160 })
  .node('TYA', Constant, { value: 152 })
  .node('TAX', Constant, { value: 170 })
  .node('LDA_IMM', Constant, { value: 169 })
  .node('TXA', Constant, { value: 138 })
  .node('CPX_IMM', Constant, { value: 224 })
  .node('CPY_IMM', Constant, { value: 192 })
  .node('NOP', Constant, { value: 234 })
  .node('cmp_ldy_imm', Comparator)
  .node('cmp_tya', Comparator)
  .node('cmp_tax', Comparator)
  .node('cmp_lda_imm', Comparator)
  .node('cmp_txa', Comparator)
  .node('cmp_cpx_imm', Comparator)
  .node('cmp_cpy_imm', Comparator)
  .node('cmp_nop', Comparator)
  .node('is_sub0', Comparator)
  .node('is_sub1', Comparator)
  .node('inc_subcycle', Incrementer)
  .node('subcycle_next', Mux)
  .node('exec_sub0', And)
  .node('exec_sub1', And)
  .node('is_imm', Or)
  .node('is_imm_2', Or)
  .node('is_imm_any', Or)
  .node('is_1cyc', Or)
  .node('is_1cyc_2', Or)
  .node('is_1cycle', Or)
  .node('done_imm', And)
  .node('done_1cyc', And)
  .node('exec_done', Or)
  .node('next_from_fetch', Mux)
  .node('next_from_decode', Mux)
  .node('next_from_execute', Mux)
  .node('next_state', Mux)
  .node('needs_operand', And)
  .node('pc_inc_fetch', Or)
  .node('pc_next', Mux)
  .node('a_from_lda', Mux)
  .node('a_from_txa', Mux)
  .node('a_data', Mux)
  .node('write_a_lda', And)
  .node('write_a_txa', And)
  .node('write_a_tya', And)
  .node('write_a_1', Or)
  .node('write_a', Or)
  .node('write_x_tax', And)
  .node('write_y_ldy', And)
  .node('cpx_sub', Subtractor)
  .node('cpy_sub', Subtractor)
  .node('const_128', Constant, { value: 128 })
  .node('flag_val_cpx', Mux)
  .node('flag_val', Mux)
  .node('n_check', Comparator)
  .node('n_val', Or)
  .node('z_check', Comparator)
  .node('not_borrow_cpx', Not)
  .node('not_borrow_cpy', Not)
  .node('c_val', Mux)
  .node('update_ldy', And)
  .node('update_txa', And)
  .node('update_tya', And)
  .node('update_cpx', And)
  .node('update_cpy', And)
  .node('update_nz_1', Or)
  .node('update_nz_2', Or)
  .node('update_nz_3', Or)
  .node('update_nz', Or)
  .node('update_c', Or)
  .connect(({ in: inp, out, pc_reg, always_on, pc_inc, zero, one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve, thirteen, fourteen, fifteen, byte_0, byte_1, byte_2, byte_3, byte_4, byte_5, byte_6, byte_7, byte_8, byte_9, byte_10, byte_11, byte_12, byte_13, byte_14, byte_15, at_0, at_1, at_2, at_3, at_4, at_5, at_6, at_7, at_8, at_9, at_10, at_11, at_12, at_13, at_14, at_15, mux1, mux2, mux3, mux4, mux5, mux6, mux7, mux8, mux9, mux10, mux11, mux12, mux13, mux14, mux15, ir, operand_reg, regA, regX, regY, flag_n_reg, flag_z_reg, flag_c_reg, state_reg, subcycle_reg, STATE_FETCH, STATE_DECODE, STATE_EXECUTE, is_fetch, is_decode, is_execute, LDY_IMM, TYA, TAX, LDA_IMM, TXA, CPX_IMM, CPY_IMM, NOP, cmp_ldy_imm, cmp_tya, cmp_tax, cmp_lda_imm, cmp_txa, cmp_cpx_imm, cmp_cpy_imm, cmp_nop, is_sub0, is_sub1, inc_subcycle, subcycle_next, exec_sub0, exec_sub1, is_imm, is_imm_2, is_imm_any, is_1cyc, is_1cyc_2, is_1cycle, done_imm, done_1cyc, exec_done, next_from_fetch, next_from_decode, next_from_execute, next_state, needs_operand, pc_inc_fetch, pc_next, a_from_lda, a_from_txa, a_data, write_a_lda, write_a_txa, write_a_tya, write_a_1, write_a, write_x_tax, write_y_ldy, cpx_sub, cpy_sub, const_128, flag_val_cpx, flag_val, n_check, n_val, z_check, not_borrow_cpx, not_borrow_cpy, c_val, update_ldy, update_txa, update_tya, update_cpx, update_cpy, update_nz_1, update_nz_2, update_nz_3, update_nz, update_c }) => [
    pc_reg.q.to(pc_inc.in, at_0.a, at_1.a, at_2.a, at_3.a, at_4.a, at_5.a, at_6.a, at_7.a, at_8.a, at_9.a, at_10.a, at_11.a, at_12.a, at_13.a, at_14.a, at_15.a, pc_next.in0, out.pc),
    zero.out.to(at_0.b, is_sub0.b, subcycle_next.in0, cpx_sub.borrow_in, cpy_sub.borrow_in, z_check.b),
    one.out.to(at_1.b, is_sub1.b),
    two.out.to(at_2.b),
    three.out.to(at_3.b),
    four.out.to(at_4.b),
    five.out.to(at_5.b),
    six.out.to(at_6.b),
    seven.out.to(at_7.b),
    eight.out.to(at_8.b),
    nine.out.to(at_9.b),
    ten.out.to(at_10.b),
    eleven.out.to(at_11.b),
    twelve.out.to(at_12.b),
    thirteen.out.to(at_13.b),
    fourteen.out.to(at_14.b),
    fifteen.out.to(at_15.b),
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
    at_9.eq.to(mux9.sel),
    mux8.out.to(mux9.in0),
    byte_9.out.to(mux9.in1),
    at_10.eq.to(mux10.sel),
    mux9.out.to(mux10.in0),
    byte_10.out.to(mux10.in1),
    at_11.eq.to(mux11.sel),
    mux10.out.to(mux11.in0),
    byte_11.out.to(mux11.in1),
    at_12.eq.to(mux12.sel),
    mux11.out.to(mux12.in0),
    byte_12.out.to(mux12.in1),
    at_13.eq.to(mux13.sel),
    mux12.out.to(mux13.in0),
    byte_13.out.to(mux13.in1),
    at_14.eq.to(mux14.sel),
    mux13.out.to(mux14.in0),
    byte_14.out.to(mux14.in1),
    at_15.eq.to(mux15.sel),
    mux14.out.to(mux15.in0),
    byte_15.out.to(mux15.in1),
    mux15.out.to(ir.data, operand_reg.data),
    state_reg.q.to(is_fetch.a, is_decode.a, is_execute.a, next_from_fetch.in0),
    STATE_FETCH.out.to(is_fetch.b, next_from_execute.in1, next_state.in1),
    STATE_DECODE.out.to(is_decode.b, next_from_fetch.in1),
    STATE_EXECUTE.out.to(is_execute.b, next_from_decode.in1),
    ir.q.to(cmp_ldy_imm.a, cmp_tya.a, cmp_tax.a, cmp_lda_imm.a, cmp_txa.a, cmp_cpx_imm.a, cmp_cpy_imm.a, cmp_nop.a),
    LDY_IMM.out.to(cmp_ldy_imm.b),
    TYA.out.to(cmp_tya.b),
    TAX.out.to(cmp_tax.b),
    LDA_IMM.out.to(cmp_lda_imm.b),
    TXA.out.to(cmp_txa.b),
    CPX_IMM.out.to(cmp_cpx_imm.b),
    CPY_IMM.out.to(cmp_cpy_imm.b),
    NOP.out.to(cmp_nop.b),
    subcycle_reg.q.to(is_sub0.a, is_sub1.a, inc_subcycle.in),
    is_execute.eq.to(subcycle_next.sel, exec_sub0.a, exec_sub1.a),
    inc_subcycle.out.to(subcycle_next.in1),
    subcycle_next.out.to(subcycle_reg.data),
    always_on.out.to(subcycle_reg.we, state_reg.we, pc_reg.we),
    is_sub0.eq.to(exec_sub0.b),
    is_sub1.eq.to(exec_sub1.b),
    cmp_ldy_imm.eq.to(is_imm.a, write_y_ldy.b, update_ldy.b),
    cmp_lda_imm.eq.to(is_imm.b, a_from_lda.sel, write_a_lda.b),
    is_imm.out.to(is_imm_2.a),
    cmp_cpx_imm.eq.to(is_imm_2.b, flag_val_cpx.sel, update_cpx.b),
    is_imm_2.out.to(is_imm_any.a),
    cmp_cpy_imm.eq.to(is_imm_any.b, flag_val.sel, c_val.sel, update_cpy.b),
    cmp_tya.eq.to(is_1cyc.a, a_data.sel, write_a_tya.b, update_tya.b),
    cmp_tax.eq.to(is_1cyc.b, write_x_tax.b),
    is_1cyc.out.to(is_1cyc_2.a),
    cmp_txa.eq.to(is_1cyc_2.b, a_from_txa.sel, write_a_txa.b, update_txa.b),
    is_1cyc_2.out.to(is_1cycle.a),
    cmp_nop.eq.to(is_1cycle.b),
    exec_sub1.out.to(done_imm.a, write_a_lda.a, write_y_ldy.a, update_ldy.a, update_cpx.a, update_cpy.a),
    is_imm_any.out.to(done_imm.b, needs_operand.b),
    exec_sub0.out.to(done_1cyc.a, needs_operand.a, write_a_txa.a, write_a_tya.a, write_x_tax.a, update_txa.a, update_tya.a),
    is_1cycle.out.to(done_1cyc.b),
    done_imm.out.to(exec_done.a),
    done_1cyc.out.to(exec_done.b),
    is_fetch.eq.to(next_from_fetch.sel, pc_inc_fetch.a, ir.we),
    is_decode.eq.to(next_from_decode.sel),
    next_from_fetch.out.to(next_from_decode.in0),
    exec_done.out.to(next_from_execute.sel),
    next_from_decode.out.to(next_from_execute.in0),
    inp.reset.to(next_state.sel),
    next_from_execute.out.to(next_state.in0),
    next_state.out.to(state_reg.data),
    needs_operand.out.to(pc_inc_fetch.b, operand_reg.we),
    pc_inc_fetch.out.to(pc_next.sel),
    pc_inc.out.to(pc_next.in1),
    pc_next.out.to(pc_reg.data),
    regA.q.to(a_from_lda.in0, regX.data, out.reg_a),
    operand_reg.q.to(a_from_lda.in1, regY.data, cpx_sub.b, cpy_sub.b),
    a_from_lda.out.to(a_from_txa.in0),
    regX.q.to(a_from_txa.in1, cpx_sub.a, out.reg_x),
    a_from_txa.out.to(a_data.in0),
    regY.q.to(a_data.in1, cpy_sub.a, out.reg_y),
    a_data.out.to(regA.data, flag_val_cpx.in0),
    write_a_lda.out.to(write_a_1.a),
    write_a_txa.out.to(write_a_1.b),
    write_a_1.out.to(write_a.a),
    write_a_tya.out.to(write_a.b),
    write_a.out.to(regA.we),
    write_x_tax.out.to(regX.we),
    write_y_ldy.out.to(regY.we),
    cpx_sub.difference.to(flag_val_cpx.in1),
    flag_val_cpx.out.to(flag_val.in0),
    cpy_sub.difference.to(flag_val.in1),
    flag_val.out.to(n_check.a, z_check.a),
    const_128.out.to(n_check.b),
    n_check.gt.to(n_val.a),
    n_check.eq.to(n_val.b),
    cpx_sub.borrow_out.to(not_borrow_cpx.in),
    cpy_sub.borrow_out.to(not_borrow_cpy.in),
    not_borrow_cpx.out.to(c_val.in0),
    not_borrow_cpy.out.to(c_val.in1),
    update_ldy.out.to(update_nz_1.a),
    update_txa.out.to(update_nz_1.b),
    update_nz_1.out.to(update_nz_2.a),
    update_tya.out.to(update_nz_2.b),
    update_nz_2.out.to(update_nz_3.a),
    update_cpx.out.to(update_nz_3.b, update_c.a),
    update_nz_3.out.to(update_nz.a),
    update_cpy.out.to(update_nz.b, update_c.b),
    update_nz.out.to(flag_n_reg.we, flag_z_reg.we),
    update_c.out.to(flag_c_reg.we),
    n_val.out.to(flag_n_reg.data),
    z_check.eq.to(flag_z_reg.data),
    c_val.out.to(flag_c_reg.data),
    flag_n_reg.q.to(out.flag_n),
    flag_z_reg.q.to(out.flag_z),
    flag_c_reg.q.to(out.flag_c),
  ])
  .build()

const Part2Test = component('Part2Test')
  .node('cpu', Part2TestCPU)
  .node('reset_input', Input)
  .node('d_pc', HexDisplay)
  .node('d_a', HexDisplay)
  .node('d_x', HexDisplay)
  .node('d_y', HexDisplay)
  .connect(({ in: inp, out, cpu, reset_input, d_pc, d_a, d_x, d_y }) => [
    reset_input.out.to(cpu.reset),
    cpu.pc.to(d_pc.in),
    cpu.reg_a.to(d_a.in),
    cpu.reg_x.to(d_x.in),
    cpu.reg_y.to(d_y.in),
  ])
  .build()
