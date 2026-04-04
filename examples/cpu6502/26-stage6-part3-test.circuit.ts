// Auto-generated from DSL

const Part3TestCPU = component('Part3TestCPU')
  .in('reset', bit)
  .out('pc', bus(8))
  .out('reg_a', bus(8))
  .out('reg_x', bus(8))
  .out('reg_y', bus(8))
  .out('reg_sp', bus(8))
  .out('flag_n', bit)
  .out('flag_z', bit)
  .out('flag_c', bit)
  .out('flag_v', bit)
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
  .node('byte_0', Constant, { value: 162 })
  .node('byte_1', Constant, { value: 66 })
  .node('byte_2', Constant, { value: 154 })
  .node('byte_3', Constant, { value: 186 })
  .node('byte_4', Constant, { value: 162 })
  .node('byte_5', Constant, { value: 0 })
  .node('byte_6', Constant, { value: 186 })
  .node('byte_7', Constant, { value: 162 })
  .node('byte_8', Constant, { value: 128 })
  .node('byte_9', Constant, { value: 154 })
  .node('byte_10', Constant, { value: 186 })
  .node('byte_11', Constant, { value: 184 })
  .node('byte_12', Constant, { value: 234 })
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
  .node('sp_reg', Register, { initial: 255 })
  .node('flag_n_reg', Register, { initial: 0 })
  .node('flag_z_reg', Register, { initial: 0 })
  .node('flag_c_reg', Register, { initial: 0 })
  .node('flag_v_reg', Register, { initial: 1 })
  .node('state_reg', Register)
  .node('subcycle_reg', Register)
  .node('STATE_FETCH', Constant, { value: 0 })
  .node('STATE_DECODE', Constant, { value: 1 })
  .node('STATE_EXECUTE', Constant, { value: 2 })
  .node('is_fetch', Comparator)
  .node('is_decode', Comparator)
  .node('is_execute', Comparator)
  .node('LDX_IMM', Constant, { value: 162 })
  .node('TXS', Constant, { value: 154 })
  .node('TSX', Constant, { value: 186 })
  .node('CLV', Constant, { value: 184 })
  .node('NOP', Constant, { value: 234 })
  .node('cmp_ldx_imm', Comparator)
  .node('cmp_txs', Comparator)
  .node('cmp_tsx', Comparator)
  .node('cmp_clv', Comparator)
  .node('cmp_nop', Comparator)
  .node('is_sub0', Comparator)
  .node('is_sub1', Comparator)
  .node('inc_subcycle', Incrementer)
  .node('subcycle_next', Mux)
  .node('exec_sub0', And)
  .node('exec_sub1', And)
  .node('is_1cyc_1', Or)
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
  .node('x_from_ldx', Mux)
  .node('x_data', Mux)
  .node('write_x_ldx', And)
  .node('write_x_tsx', And)
  .node('write_x', Or)
  .node('sp_load_txs', And)
  .node('sp_next', Mux)
  .node('const_128', Constant, { value: 128 })
  .node('update_ldx', And)
  .node('update_tsx', And)
  .node('update_nz', Or)
  .node('n_check', Comparator)
  .node('n_val', Or)
  .node('z_check', Comparator)
  .node('update_clv', And)
  .connect(({ in: inp, out, pc_reg, always_on, pc_inc, zero, one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve, thirteen, fourteen, fifteen, byte_0, byte_1, byte_2, byte_3, byte_4, byte_5, byte_6, byte_7, byte_8, byte_9, byte_10, byte_11, byte_12, byte_13, byte_14, byte_15, at_0, at_1, at_2, at_3, at_4, at_5, at_6, at_7, at_8, at_9, at_10, at_11, at_12, at_13, at_14, at_15, mux1, mux2, mux3, mux4, mux5, mux6, mux7, mux8, mux9, mux10, mux11, mux12, mux13, mux14, mux15, ir, operand_reg, regA, regX, regY, sp_reg, flag_n_reg, flag_z_reg, flag_c_reg, flag_v_reg, state_reg, subcycle_reg, STATE_FETCH, STATE_DECODE, STATE_EXECUTE, is_fetch, is_decode, is_execute, LDX_IMM, TXS, TSX, CLV, NOP, cmp_ldx_imm, cmp_txs, cmp_tsx, cmp_clv, cmp_nop, is_sub0, is_sub1, inc_subcycle, subcycle_next, exec_sub0, exec_sub1, is_1cyc_1, is_1cyc_2, is_1cycle, done_imm, done_1cyc, exec_done, next_from_fetch, next_from_decode, next_from_execute, next_state, needs_operand, pc_inc_fetch, pc_next, x_from_ldx, x_data, write_x_ldx, write_x_tsx, write_x, sp_load_txs, sp_next, const_128, update_ldx, update_tsx, update_nz, n_check, n_val, z_check, update_clv }) => [
    pc_reg.q.to(pc_inc.in, at_0.a, at_1.a, at_2.a, at_3.a, at_4.a, at_5.a, at_6.a, at_7.a, at_8.a, at_9.a, at_10.a, at_11.a, at_12.a, at_13.a, at_14.a, at_15.a, pc_next.in0, out.pc),
    zero.out.to(at_0.b, is_sub0.b, subcycle_next.in0, z_check.b, flag_v_reg.data, flag_c_reg.we, flag_c_reg.data),
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
    always_on.out.to(sp_reg.we, subcycle_reg.we, state_reg.we, pc_reg.we),
    state_reg.q.to(is_fetch.a, is_decode.a, is_execute.a, next_from_fetch.in0),
    STATE_FETCH.out.to(is_fetch.b, next_from_execute.in1, next_state.in1),
    STATE_DECODE.out.to(is_decode.b, next_from_fetch.in1),
    STATE_EXECUTE.out.to(is_execute.b, next_from_decode.in1),
    ir.q.to(cmp_ldx_imm.a, cmp_txs.a, cmp_tsx.a, cmp_clv.a, cmp_nop.a),
    LDX_IMM.out.to(cmp_ldx_imm.b),
    TXS.out.to(cmp_txs.b),
    TSX.out.to(cmp_tsx.b),
    CLV.out.to(cmp_clv.b),
    NOP.out.to(cmp_nop.b),
    subcycle_reg.q.to(is_sub0.a, is_sub1.a, inc_subcycle.in),
    is_execute.eq.to(subcycle_next.sel, exec_sub0.a, exec_sub1.a),
    inc_subcycle.out.to(subcycle_next.in1),
    subcycle_next.out.to(subcycle_reg.data),
    is_sub0.eq.to(exec_sub0.b),
    is_sub1.eq.to(exec_sub1.b),
    cmp_txs.eq.to(is_1cyc_1.a, sp_load_txs.b),
    cmp_tsx.eq.to(is_1cyc_1.b, x_data.sel, write_x_tsx.b, update_tsx.b),
    is_1cyc_1.out.to(is_1cyc_2.a),
    cmp_clv.eq.to(is_1cyc_2.b, update_clv.b),
    is_1cyc_2.out.to(is_1cycle.a),
    cmp_nop.eq.to(is_1cycle.b),
    exec_sub1.out.to(done_imm.a, write_x_ldx.a, update_ldx.a),
    cmp_ldx_imm.eq.to(done_imm.b, needs_operand.b, x_from_ldx.sel, write_x_ldx.b, update_ldx.b),
    exec_sub0.out.to(done_1cyc.a, needs_operand.a, write_x_tsx.a, sp_load_txs.a, update_tsx.a, update_clv.a),
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
    regX.q.to(x_from_ldx.in0, sp_next.in1, out.reg_x),
    operand_reg.q.to(x_from_ldx.in1),
    x_from_ldx.out.to(x_data.in0),
    sp_reg.q.to(x_data.in1, sp_next.in0, out.reg_sp),
    x_data.out.to(regX.data, n_check.a, z_check.a),
    write_x_ldx.out.to(write_x.a),
    write_x_tsx.out.to(write_x.b),
    write_x.out.to(regX.we),
    sp_load_txs.out.to(sp_next.sel),
    sp_next.out.to(sp_reg.data),
    update_ldx.out.to(update_nz.a),
    update_tsx.out.to(update_nz.b),
    const_128.out.to(n_check.b),
    n_check.gt.to(n_val.a),
    n_check.eq.to(n_val.b),
    update_nz.out.to(flag_n_reg.we, flag_z_reg.we),
    n_val.out.to(flag_n_reg.data),
    z_check.eq.to(flag_z_reg.data),
    update_clv.out.to(flag_v_reg.we),
    regA.q.to(out.reg_a),
    regY.q.to(out.reg_y),
    flag_n_reg.q.to(out.flag_n),
    flag_z_reg.q.to(out.flag_z),
    flag_c_reg.q.to(out.flag_c),
    flag_v_reg.q.to(out.flag_v),
  ])
  .build()

const Part3Test = component('Part3Test')
  .node('cpu', Part3TestCPU)
  .node('reset_input', Input)
  .node('d_pc', HexDisplay)
  .node('d_x', HexDisplay)
  .node('d_sp', HexDisplay)
  .connect(({ in: inp, out, cpu, reset_input, d_pc, d_x, d_sp }) => [
    reset_input.out.to(cpu.reset),
    cpu.pc.to(d_pc.in),
    cpu.reg_x.to(d_x.in),
    cpu.reg_sp.to(d_sp.in),
  ])
  .build()
