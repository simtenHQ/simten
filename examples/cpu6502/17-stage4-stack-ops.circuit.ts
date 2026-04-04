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

const StackPointer = component('StackPointer')
  .in('decrement', bit)
  .in('increment', bit)
  .in('load', bit)
  .in('load_value', bus(8))
  .out('sp', bus(8))
  .node('sp_reg', Register, { initial: 255 })
  .node('always_on', Constant, { value: 1 })
  .node('one', Constant, { value: 1 })
  .node('init_value', Constant, { value: 255 })
  .node('dec', Subtractor)
  .node('zero_bit', Constant, { value: 0 })
  .node('inc', Adder)
  .node('mux_inc', Mux)
  .node('mux_dec', Mux)
  .node('mux_load', Mux)
  .connect(({ in: inp, out, sp_reg, always_on, one, init_value, dec, zero_bit, inc, mux_inc, mux_dec, mux_load }) => [
    always_on.out.to(sp_reg.we),
    sp_reg.q.to(dec.a, inc.a, mux_inc.in0, out.sp),
    one.out.to(dec.b, inc.b),
    zero_bit.out.to(dec.borrow_in, inc.carry_in),
    inp.increment.to(mux_inc.sel),
    inc.sum.to(mux_inc.in1),
    inp.decrement.to(mux_dec.sel),
    mux_inc.out.to(mux_dec.in0),
    dec.difference.to(mux_dec.in1),
    inp.load.to(mux_load.sel),
    mux_dec.out.to(mux_load.in0),
    inp.load_value.to(mux_load.in1),
    mux_load.out.to(sp_reg.data),
  ])
  .build()

const StackMemory = component('StackMemory')
  .in('addr', bus(8))
  .in('data_in', bus(8))
  .in('write_enable', bit)
  .out('data_out', bus(8))
  .node('zero', Constant, { value: 0 })
  .node('addr_f0', Constant, { value: 240 })
  .node('addr_f1', Constant, { value: 241 })
  .node('addr_f2', Constant, { value: 242 })
  .node('addr_f3', Constant, { value: 243 })
  .node('addr_f4', Constant, { value: 244 })
  .node('addr_f5', Constant, { value: 245 })
  .node('addr_f6', Constant, { value: 246 })
  .node('addr_f7', Constant, { value: 247 })
  .node('addr_f8', Constant, { value: 248 })
  .node('addr_f9', Constant, { value: 249 })
  .node('addr_fa', Constant, { value: 250 })
  .node('addr_fb', Constant, { value: 251 })
  .node('addr_fc', Constant, { value: 252 })
  .node('addr_fd', Constant, { value: 253 })
  .node('addr_fe', Constant, { value: 254 })
  .node('addr_ff', Constant, { value: 255 })
  .node('at_f0', Comparator)
  .node('at_f1', Comparator)
  .node('at_f2', Comparator)
  .node('at_f3', Comparator)
  .node('at_f4', Comparator)
  .node('at_f5', Comparator)
  .node('at_f6', Comparator)
  .node('at_f7', Comparator)
  .node('at_f8', Comparator)
  .node('at_f9', Comparator)
  .node('at_fa', Comparator)
  .node('at_fb', Comparator)
  .node('at_fc', Comparator)
  .node('at_fd', Comparator)
  .node('at_fe', Comparator)
  .node('at_ff', Comparator)
  .node('mem_f0', Register)
  .node('mem_f1', Register)
  .node('mem_f2', Register)
  .node('mem_f3', Register)
  .node('mem_f4', Register)
  .node('mem_f5', Register)
  .node('mem_f6', Register)
  .node('mem_f7', Register)
  .node('mem_f8', Register)
  .node('mem_f9', Register)
  .node('mem_fa', Register)
  .node('mem_fb', Register)
  .node('mem_fc', Register)
  .node('mem_fd', Register)
  .node('mem_fe', Register)
  .node('mem_ff', Register)
  .node('we_f0', And)
  .node('we_f1', And)
  .node('we_f2', And)
  .node('we_f3', And)
  .node('we_f4', And)
  .node('we_f5', And)
  .node('we_f6', And)
  .node('we_f7', And)
  .node('we_f8', And)
  .node('we_f9', And)
  .node('we_fa', And)
  .node('we_fb', And)
  .node('we_fc', And)
  .node('we_fd', And)
  .node('we_fe', And)
  .node('we_ff', And)
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
  .node('mux16', Mux)
  .connect(({ in: inp, out, zero, addr_f0, addr_f1, addr_f2, addr_f3, addr_f4, addr_f5, addr_f6, addr_f7, addr_f8, addr_f9, addr_fa, addr_fb, addr_fc, addr_fd, addr_fe, addr_ff, at_f0, at_f1, at_f2, at_f3, at_f4, at_f5, at_f6, at_f7, at_f8, at_f9, at_fa, at_fb, at_fc, at_fd, at_fe, at_ff, mem_f0, mem_f1, mem_f2, mem_f3, mem_f4, mem_f5, mem_f6, mem_f7, mem_f8, mem_f9, mem_fa, mem_fb, mem_fc, mem_fd, mem_fe, mem_ff, we_f0, we_f1, we_f2, we_f3, we_f4, we_f5, we_f6, we_f7, we_f8, we_f9, we_fa, we_fb, we_fc, we_fd, we_fe, we_ff, mux1, mux2, mux3, mux4, mux5, mux6, mux7, mux8, mux9, mux10, mux11, mux12, mux13, mux14, mux15, mux16 }) => [
    inp.addr.to(at_f0.a, at_f1.a, at_f2.a, at_f3.a, at_f4.a, at_f5.a, at_f6.a, at_f7.a, at_f8.a, at_f9.a, at_fa.a, at_fb.a, at_fc.a, at_fd.a, at_fe.a, at_ff.a),
    addr_f0.out.to(at_f0.b),
    addr_f1.out.to(at_f1.b),
    addr_f2.out.to(at_f2.b),
    addr_f3.out.to(at_f3.b),
    addr_f4.out.to(at_f4.b),
    addr_f5.out.to(at_f5.b),
    addr_f6.out.to(at_f6.b),
    addr_f7.out.to(at_f7.b),
    addr_f8.out.to(at_f8.b),
    addr_f9.out.to(at_f9.b),
    addr_fa.out.to(at_fa.b),
    addr_fb.out.to(at_fb.b),
    addr_fc.out.to(at_fc.b),
    addr_fd.out.to(at_fd.b),
    addr_fe.out.to(at_fe.b),
    addr_ff.out.to(at_ff.b),
    inp.data_in.to(mem_f0.data, mem_f1.data, mem_f2.data, mem_f3.data, mem_f4.data, mem_f5.data, mem_f6.data, mem_f7.data, mem_f8.data, mem_f9.data, mem_fa.data, mem_fb.data, mem_fc.data, mem_fd.data, mem_fe.data, mem_ff.data),
    inp.write_enable.to(we_f0.a, we_f1.a, we_f2.a, we_f3.a, we_f4.a, we_f5.a, we_f6.a, we_f7.a, we_f8.a, we_f9.a, we_fa.a, we_fb.a, we_fc.a, we_fd.a, we_fe.a, we_ff.a),
    at_f0.eq.to(we_f0.b, mux1.sel),
    we_f0.out.to(mem_f0.we),
    at_f1.eq.to(we_f1.b, mux2.sel),
    we_f1.out.to(mem_f1.we),
    at_f2.eq.to(we_f2.b, mux3.sel),
    we_f2.out.to(mem_f2.we),
    at_f3.eq.to(we_f3.b, mux4.sel),
    we_f3.out.to(mem_f3.we),
    at_f4.eq.to(we_f4.b, mux5.sel),
    we_f4.out.to(mem_f4.we),
    at_f5.eq.to(we_f5.b, mux6.sel),
    we_f5.out.to(mem_f5.we),
    at_f6.eq.to(we_f6.b, mux7.sel),
    we_f6.out.to(mem_f6.we),
    at_f7.eq.to(we_f7.b, mux8.sel),
    we_f7.out.to(mem_f7.we),
    at_f8.eq.to(we_f8.b, mux9.sel),
    we_f8.out.to(mem_f8.we),
    at_f9.eq.to(we_f9.b, mux10.sel),
    we_f9.out.to(mem_f9.we),
    at_fa.eq.to(we_fa.b, mux11.sel),
    we_fa.out.to(mem_fa.we),
    at_fb.eq.to(we_fb.b, mux12.sel),
    we_fb.out.to(mem_fb.we),
    at_fc.eq.to(we_fc.b, mux13.sel),
    we_fc.out.to(mem_fc.we),
    at_fd.eq.to(we_fd.b, mux14.sel),
    we_fd.out.to(mem_fd.we),
    at_fe.eq.to(we_fe.b, mux15.sel),
    we_fe.out.to(mem_fe.we),
    at_ff.eq.to(we_ff.b, mux16.sel),
    we_ff.out.to(mem_ff.we),
    zero.out.to(mux1.in0),
    mem_f0.q.to(mux1.in1),
    mux1.out.to(mux2.in0),
    mem_f1.q.to(mux2.in1),
    mux2.out.to(mux3.in0),
    mem_f2.q.to(mux3.in1),
    mux3.out.to(mux4.in0),
    mem_f3.q.to(mux4.in1),
    mux4.out.to(mux5.in0),
    mem_f4.q.to(mux5.in1),
    mux5.out.to(mux6.in0),
    mem_f5.q.to(mux6.in1),
    mux6.out.to(mux7.in0),
    mem_f6.q.to(mux7.in1),
    mux7.out.to(mux8.in0),
    mem_f7.q.to(mux8.in1),
    mux8.out.to(mux9.in0),
    mem_f8.q.to(mux9.in1),
    mux9.out.to(mux10.in0),
    mem_f9.q.to(mux10.in1),
    mux10.out.to(mux11.in0),
    mem_fa.q.to(mux11.in1),
    mux11.out.to(mux12.in0),
    mem_fb.q.to(mux12.in1),
    mux12.out.to(mux13.in0),
    mem_fc.q.to(mux13.in1),
    mux13.out.to(mux14.in0),
    mem_fd.q.to(mux14.in1),
    mux14.out.to(mux15.in0),
    mem_fe.q.to(mux15.in1),
    mux15.out.to(mux16.in0),
    mem_ff.q.to(mux16.in1),
    mux16.out.to(out.data_out),
  ])
  .build()

const StackControl = component('StackControl')
  .in('reset', bit)
  .in('current_opcode', bus(8))
  .out('current_state', bus(8))
  .out('exec_subcycle', bus(8))
  .out('pc_increment', bit)
  .out('ir_load', bit)
  .out('operand_load', bit)
  .out('addr_lo_load', bit)
  .out('addr_hi_load', bit)
  .out('mem_read', bit)
  .out('mem_write', bit)
  .out('write_a', bit)
  .out('write_x', bit)
  .out('write_y', bit)
  .out('sp_decrement', bit)
  .out('sp_increment', bit)
  .out('stack_write', bit)
  .out('use_stack_data', bit)
  .out('is_lda_imm', bit)
  .out('is_lda_zp', bit)
  .out('is_lda_abs', bit)
  .out('is_lda_abs_x', bit)
  .out('is_sta_zp', bit)
  .out('is_sta_abs', bit)
  .out('is_sta_abs_x', bit)
  .out('is_tax', bit)
  .out('is_inx', bit)
  .out('is_pha', bit)
  .out('is_pla', bit)
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
  .node('LDA_ABS', Constant, { value: 173 })
  .node('LDA_ABS_X', Constant, { value: 189 })
  .node('STA_ZP', Constant, { value: 133 })
  .node('STA_ABS', Constant, { value: 141 })
  .node('STA_ABS_X', Constant, { value: 157 })
  .node('TAX', Constant, { value: 170 })
  .node('INX', Constant, { value: 232 })
  .node('PHA', Constant, { value: 72 })
  .node('PLA', Constant, { value: 104 })
  .node('cmp_lda_imm', Comparator)
  .node('cmp_lda_zp', Comparator)
  .node('cmp_lda_abs', Comparator)
  .node('cmp_lda_abs_x', Comparator)
  .node('cmp_sta_zp', Comparator)
  .node('cmp_sta_abs', Comparator)
  .node('cmp_sta_abs_x', Comparator)
  .node('cmp_tax', Comparator)
  .node('cmp_inx', Comparator)
  .node('cmp_pha', Comparator)
  .node('cmp_pla', Comparator)
  .node('is_imm', Or)
  .node('is_zp', Or)
  .node('is_abs_temp', Or)
  .node('is_abs', Or)
  .node('is_abs_final', Or)
  .node('is_1cycle', Or)
  .node('is_stack_op', Or)
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('two', Constant, { value: 2 })
  .node('three', Constant, { value: 3 })
  .node('four', Constant, { value: 4 })
  .node('inc_subcycle', Incrementer)
  .node('subcycle_increment', Mux)
  .node('always_on', Constant, { value: 1 })
  .node('is_sub0', Comparator)
  .node('is_sub1', Comparator)
  .node('is_sub2', Comparator)
  .node('is_sub3', Comparator)
  .node('is_sub4', Comparator)
  .node('next_from_fetch', Mux)
  .node('next_from_decode', Mux)
  .node('exec_sub0', And)
  .node('exec_sub1', And)
  .node('exec_sub2', And)
  .node('exec_sub3', And)
  .node('exec_sub4', And)
  .node('done_imm', And)
  .node('done_zp', And)
  .node('done_abs', And)
  .node('done_1cyc', And)
  .node('done_pha', And)
  .node('done_pla', And)
  .node('exec_done_temp1', Or)
  .node('exec_done_temp2', Or)
  .node('exec_done_temp3', Or)
  .node('exec_done_temp4', Or)
  .node('exec_done', Or)
  .node('next_from_execute', Mux)
  .node('next_state', Mux)
  .node('needs_operand_any', Or)
  .node('needs_operand', Or)
  .node('pc_inc_exec_sub0', And)
  .node('pc_inc_exec_sub1', And)
  .node('pc_inc_temp', Or)
  .node('pc_inc_signal', Or)
  .node('operand_load_signal', And)
  .node('addr_lo_load_signal', And)
  .node('addr_hi_load_signal', And)
  .node('is_load', Or)
  .node('is_load_final', Or)
  .node('mem_read_zp', And)
  .node('mem_read_abs_temp', And)
  .node('mem_read_abs_x', And)
  .node('mem_read_abs', Or)
  .node('mem_read_signal', Or)
  .node('mem_write_zp', And)
  .node('mem_write_abs_temp', And)
  .node('mem_write_abs_x', And)
  .node('mem_write_abs', Or)
  .node('mem_write_signal', Or)
  .node('sp_dec_signal', And)
  .node('sp_inc_signal', And)
  .node('stack_write_signal', And)
  .node('use_stack_signal', And)
  .node('write_a_imm', And)
  .node('write_a_zp', And)
  .node('write_a_abs_temp', And)
  .node('write_a_abs_x', And)
  .node('write_a_abs', Or)
  .node('write_a_temp', Or)
  .node('write_a_temp2', Or)
  .node('write_a_pla', And)
  .node('write_a_signal', Or)
  .node('write_x_tax', And)
  .node('write_x_inx', And)
  .node('write_x_signal', Or)
  .connect(({ in: inp, out, state_reg, subcycle_reg, STATE_FETCH, STATE_DECODE, STATE_EXECUTE, is_fetch, is_decode, is_execute, LDA_IMM, LDA_ZP, LDA_ABS, LDA_ABS_X, STA_ZP, STA_ABS, STA_ABS_X, TAX, INX, PHA, PLA, cmp_lda_imm, cmp_lda_zp, cmp_lda_abs, cmp_lda_abs_x, cmp_sta_zp, cmp_sta_abs, cmp_sta_abs_x, cmp_tax, cmp_inx, cmp_pha, cmp_pla, is_imm, is_zp, is_abs_temp, is_abs, is_abs_final, is_1cycle, is_stack_op, zero, one, two, three, four, inc_subcycle, subcycle_increment, always_on, is_sub0, is_sub1, is_sub2, is_sub3, is_sub4, next_from_fetch, next_from_decode, exec_sub0, exec_sub1, exec_sub2, exec_sub3, exec_sub4, done_imm, done_zp, done_abs, done_1cyc, done_pha, done_pla, exec_done_temp1, exec_done_temp2, exec_done_temp3, exec_done_temp4, exec_done, next_from_execute, next_state, needs_operand_any, needs_operand, pc_inc_exec_sub0, pc_inc_exec_sub1, pc_inc_temp, pc_inc_signal, operand_load_signal, addr_lo_load_signal, addr_hi_load_signal, is_load, is_load_final, mem_read_zp, mem_read_abs_temp, mem_read_abs_x, mem_read_abs, mem_read_signal, mem_write_zp, mem_write_abs_temp, mem_write_abs_x, mem_write_abs, mem_write_signal, sp_dec_signal, sp_inc_signal, stack_write_signal, use_stack_signal, write_a_imm, write_a_zp, write_a_abs_temp, write_a_abs_x, write_a_abs, write_a_temp, write_a_temp2, write_a_pla, write_a_signal, write_x_tax, write_x_inx, write_x_signal }) => [
    state_reg.q.to(is_fetch.a, is_decode.a, is_execute.a, next_from_fetch.in0, out.current_state),
    STATE_FETCH.out.to(is_fetch.b, next_from_execute.in1, next_state.in1),
    STATE_DECODE.out.to(is_decode.b, next_from_fetch.in1),
    STATE_EXECUTE.out.to(is_execute.b, next_from_decode.in1),
    inp.current_opcode.to(cmp_lda_imm.a, cmp_lda_zp.a, cmp_lda_abs.a, cmp_lda_abs_x.a, cmp_sta_zp.a, cmp_sta_abs.a, cmp_sta_abs_x.a, cmp_tax.a, cmp_inx.a, cmp_pha.a, cmp_pla.a),
    LDA_IMM.out.to(cmp_lda_imm.b),
    cmp_lda_imm.eq.to(out.is_lda_imm, is_imm.a, is_imm.b, write_a_imm.b),
    LDA_ZP.out.to(cmp_lda_zp.b),
    cmp_lda_zp.eq.to(out.is_lda_zp, is_zp.a, is_load.a, mem_read_zp.b, write_a_zp.b),
    LDA_ABS.out.to(cmp_lda_abs.b),
    cmp_lda_abs.eq.to(out.is_lda_abs, is_abs_temp.a, is_load.b, mem_read_abs_temp.b, write_a_abs_temp.b),
    LDA_ABS_X.out.to(cmp_lda_abs_x.b),
    cmp_lda_abs_x.eq.to(out.is_lda_abs_x, is_abs.b, is_load_final.b, mem_read_abs_x.b, write_a_abs_x.b),
    STA_ZP.out.to(cmp_sta_zp.b),
    cmp_sta_zp.eq.to(out.is_sta_zp, is_zp.b, mem_write_zp.b),
    STA_ABS.out.to(cmp_sta_abs.b),
    cmp_sta_abs.eq.to(out.is_sta_abs, is_abs_temp.b, mem_write_abs_temp.b),
    STA_ABS_X.out.to(cmp_sta_abs_x.b),
    cmp_sta_abs_x.eq.to(out.is_sta_abs_x, is_abs_final.b, mem_write_abs_x.b),
    TAX.out.to(cmp_tax.b),
    cmp_tax.eq.to(out.is_tax, is_1cycle.a, write_x_tax.b),
    INX.out.to(cmp_inx.b),
    cmp_inx.eq.to(out.is_inx, is_1cycle.b, write_x_inx.b),
    PHA.out.to(cmp_pha.b),
    cmp_pha.eq.to(out.is_pha, is_stack_op.a, done_pha.b, sp_dec_signal.b, stack_write_signal.b),
    PLA.out.to(cmp_pla.b),
    cmp_pla.eq.to(out.is_pla, is_stack_op.b, done_pla.b, sp_inc_signal.b, use_stack_signal.b, write_a_pla.b),
    is_abs_temp.out.to(is_abs.a),
    is_abs.out.to(is_abs_final.a),
    subcycle_reg.q.to(inc_subcycle.in, out.exec_subcycle, is_sub0.a, is_sub1.a, is_sub2.a, is_sub3.a, is_sub4.a),
    is_execute.eq.to(subcycle_increment.sel, exec_sub0.a, exec_sub1.a, exec_sub2.a, exec_sub3.a, exec_sub4.a),
    zero.out.to(subcycle_increment.in0, is_sub0.b, out.write_y),
    inc_subcycle.out.to(subcycle_increment.in1),
    subcycle_increment.out.to(subcycle_reg.data),
    always_on.out.to(subcycle_reg.we, state_reg.we),
    one.out.to(is_sub1.b),
    two.out.to(is_sub2.b),
    three.out.to(is_sub3.b),
    four.out.to(is_sub4.b),
    is_fetch.eq.to(next_from_fetch.sel, pc_inc_temp.a, out.ir_load),
    is_decode.eq.to(next_from_decode.sel),
    next_from_fetch.out.to(next_from_decode.in0),
    is_sub0.eq.to(exec_sub0.b),
    is_sub1.eq.to(exec_sub1.b),
    is_sub2.eq.to(exec_sub2.b),
    is_sub3.eq.to(exec_sub3.b),
    is_sub4.eq.to(exec_sub4.b),
    exec_sub1.out.to(done_imm.a, done_pha.a, pc_inc_exec_sub1.a, addr_hi_load_signal.a, write_a_imm.a),
    is_imm.out.to(done_imm.b, needs_operand_any.a),
    exec_sub3.out.to(done_zp.a, mem_read_abs_temp.a, mem_read_abs_x.a, mem_write_abs_temp.a, mem_write_abs_x.a, write_a_zp.a),
    is_zp.out.to(done_zp.b, needs_operand_any.b),
    exec_sub4.out.to(done_abs.a, write_a_abs_temp.a, write_a_abs_x.a),
    is_abs_final.out.to(done_abs.b, needs_operand.b, pc_inc_exec_sub1.b, addr_hi_load_signal.b),
    exec_sub0.out.to(done_1cyc.a, pc_inc_exec_sub0.a, operand_load_signal.a, addr_lo_load_signal.a, sp_dec_signal.a, sp_inc_signal.a, stack_write_signal.a, write_x_tax.a, write_x_inx.a),
    is_1cycle.out.to(done_1cyc.b),
    exec_sub2.out.to(done_pla.a, mem_read_zp.a, mem_write_zp.a, use_stack_signal.a, write_a_pla.a),
    done_imm.out.to(exec_done_temp1.a),
    done_zp.out.to(exec_done_temp1.b),
    exec_done_temp1.out.to(exec_done_temp2.a),
    done_abs.out.to(exec_done_temp2.b),
    exec_done_temp2.out.to(exec_done_temp3.a),
    done_1cyc.out.to(exec_done_temp3.b),
    exec_done_temp3.out.to(exec_done_temp4.a),
    done_pha.out.to(exec_done_temp4.b),
    exec_done_temp4.out.to(exec_done.a),
    done_pla.out.to(exec_done.b),
    exec_done.out.to(next_from_execute.sel),
    next_from_decode.out.to(next_from_execute.in0),
    inp.reset.to(next_state.sel),
    next_from_execute.out.to(next_state.in0),
    next_state.out.to(state_reg.data),
    needs_operand_any.out.to(needs_operand.a),
    needs_operand.out.to(pc_inc_exec_sub0.b, operand_load_signal.b, addr_lo_load_signal.b),
    pc_inc_exec_sub0.out.to(pc_inc_temp.b),
    pc_inc_temp.out.to(pc_inc_signal.a),
    pc_inc_exec_sub1.out.to(pc_inc_signal.b),
    pc_inc_signal.out.to(out.pc_increment),
    operand_load_signal.out.to(out.operand_load),
    addr_lo_load_signal.out.to(out.addr_lo_load),
    addr_hi_load_signal.out.to(out.addr_hi_load),
    is_load.out.to(is_load_final.a),
    mem_read_abs_temp.out.to(mem_read_abs.a),
    mem_read_abs_x.out.to(mem_read_abs.b),
    mem_read_zp.out.to(mem_read_signal.a),
    mem_read_abs.out.to(mem_read_signal.b),
    mem_read_signal.out.to(out.mem_read),
    mem_write_abs_temp.out.to(mem_write_abs.a),
    mem_write_abs_x.out.to(mem_write_abs.b),
    mem_write_zp.out.to(mem_write_signal.a),
    mem_write_abs.out.to(mem_write_signal.b),
    mem_write_signal.out.to(out.mem_write),
    sp_dec_signal.out.to(out.sp_decrement),
    sp_inc_signal.out.to(out.sp_increment),
    stack_write_signal.out.to(out.stack_write),
    use_stack_signal.out.to(out.use_stack_data),
    write_a_abs_temp.out.to(write_a_abs.a),
    write_a_abs_x.out.to(write_a_abs.b),
    write_a_imm.out.to(write_a_temp.a),
    write_a_zp.out.to(write_a_temp.b),
    write_a_temp.out.to(write_a_temp2.a),
    write_a_abs.out.to(write_a_temp2.b),
    write_a_temp2.out.to(write_a_signal.a),
    write_a_pla.out.to(write_a_signal.b),
    write_a_signal.out.to(out.write_a),
    write_x_tax.out.to(write_x_signal.a),
    write_x_inx.out.to(write_x_signal.b),
    write_x_signal.out.to(out.write_x),
  ])
  .build()

const StackCPU = component('StackCPU')
  .in('reset', bit)
  .out('pc', bus(8))
  .out('instruction', bus(8))
  .out('operand', bus(8))
  .out('address', bus(8))
  .out('mem_data', bus(8))
  .out('stack_data', bus(8))
  .out('current_state', bus(8))
  .out('subcycle', bus(8))
  .out('reg_a', bus(8))
  .out('reg_x', bus(8))
  .out('reg_sp', bus(8))
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
  .node('byte_1', Constant, { value: 66 })
  .node('byte_2', Constant, { value: 72 })
  .node('byte_3', Constant, { value: 169 })
  .node('byte_4', Constant, { value: 0 })
  .node('byte_5', Constant, { value: 104 })
  .node('byte_6', Constant, { value: 0 })
  .node('byte_7', Constant, { value: 0 })
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
  .node('addr_lo_reg', Register)
  .node('addr_hi_reg', Register)
  .node('addr_with_x', Adder)
  .node('control', StackControl)
  .node('pc_next', Mux)
  .node('registers', RegisterFile)
  .node('sp', StackPointer)
  .node('sp_init', Constant, { value: 255 })
  .node('stack', StackMemory)
  .node('effective_addr', Mux)
  .node('effective_addr_final', Mux)
  .node('memory', SimpleMemory)
  .node('inc_x', Incrementer)
  .node('result_a_imm_zp', Mux)
  .node('result_a_abs', Mux)
  .node('result_a_abs_x', Mux)
  .node('result_a', Mux)
  .node('result_x', Mux)
  .connect(({ in: inp, out, pc_reg, always_on, pc_inc, zero, one, two, three, four, five, six, seven, byte_0, byte_1, byte_2, byte_3, byte_4, byte_5, byte_6, byte_7, at_0, at_1, at_2, at_3, at_4, at_5, at_6, at_7, mux1, mux2, mux3, mux4, mux5, mux6, mux7, ir, operand_reg, addr_lo_reg, addr_hi_reg, addr_with_x, control, pc_next, registers, sp, sp_init, stack, effective_addr, effective_addr_final, memory, inc_x, result_a_imm_zp, result_a_abs, result_a_abs_x, result_a, result_x }) => [
    always_on.out.to(pc_reg.we),
    pc_reg.q.to(pc_inc.in, at_0.a, at_1.a, at_2.a, at_3.a, at_4.a, at_5.a, at_6.a, at_7.a, pc_next.in0, out.pc),
    zero.out.to(at_0.b, addr_with_x.carry_in, registers.data_y),
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
    mux7.out.to(ir.data, operand_reg.data, addr_lo_reg.data, addr_hi_reg.data),
    addr_lo_reg.q.to(addr_with_x.a, effective_addr.in0),
    inp.reset.to(control.reset, sp.load),
    ir.q.to(control.current_opcode, out.instruction),
    control.pc_increment.to(pc_next.sel),
    pc_inc.out.to(pc_next.in1),
    pc_next.out.to(pc_reg.data),
    control.ir_load.to(ir.we),
    control.operand_load.to(operand_reg.we),
    control.addr_lo_load.to(addr_lo_reg.we),
    control.addr_hi_load.to(addr_hi_reg.we),
    control.write_a.to(registers.write_a),
    control.write_x.to(registers.write_x),
    control.write_y.to(registers.write_y),
    control.sp_decrement.to(sp.decrement),
    control.sp_increment.to(sp.increment),
    sp_init.out.to(sp.load_value),
    sp.sp.to(stack.addr, out.reg_sp),
    registers.reg_a.to(stack.data_in, memory.data_in, result_x.in1, out.reg_a),
    control.stack_write.to(stack.write_enable),
    control.is_lda_abs_x.to(effective_addr.sel, result_a_abs_x.sel),
    addr_with_x.sum.to(effective_addr.in1, effective_addr_final.in1),
    control.is_sta_abs_x.to(effective_addr_final.sel),
    effective_addr.out.to(effective_addr_final.in0),
    registers.reg_x.to(addr_with_x.b, inc_x.in, out.reg_x),
    effective_addr_final.out.to(memory.addr, out.address),
    control.mem_write.to(memory.write_enable),
    control.is_lda_zp.to(result_a_imm_zp.sel),
    operand_reg.q.to(result_a_imm_zp.in0, out.operand),
    memory.data_out.to(result_a_imm_zp.in1, result_a_abs.in1, result_a_abs_x.in1, out.mem_data),
    control.is_lda_abs.to(result_a_abs.sel),
    result_a_imm_zp.out.to(result_a_abs.in0),
    result_a_abs.out.to(result_a_abs_x.in0),
    control.use_stack_data.to(result_a.sel),
    result_a_abs_x.out.to(result_a.in0),
    stack.data_out.to(result_a.in1, out.stack_data),
    result_a.out.to(registers.data_a),
    control.is_tax.to(result_x.sel),
    inc_x.out.to(result_x.in0),
    result_x.out.to(registers.data_x),
    control.current_state.to(out.current_state),
    control.exec_subcycle.to(out.subcycle),
  ])
  .build()

const StackOpsTest = component('StackOpsTest')
  .node('cpu', StackCPU)
  .node('reset_input', Input)
  .node('d_pc', HexDisplay)
  .node('d_instruction', HexDisplay)
  .node('d_operand', HexDisplay)
  .node('d_address', HexDisplay)
  .node('d_mem_data', HexDisplay)
  .node('d_stack_data', HexDisplay)
  .node('d_state', HexDisplay)
  .node('d_subcycle', HexDisplay)
  .node('d_a', HexDisplay)
  .node('d_x', HexDisplay)
  .node('d_sp', HexDisplay)
  .connect(({ in: inp, out, cpu, reset_input, d_pc, d_instruction, d_operand, d_address, d_mem_data, d_stack_data, d_state, d_subcycle, d_a, d_x, d_sp }) => [
    reset_input.out.to(cpu.reset),
    cpu.pc.to(d_pc.in),
    cpu.instruction.to(d_instruction.in),
    cpu.operand.to(d_operand.in),
    cpu.address.to(d_address.in),
    cpu.mem_data.to(d_mem_data.in),
    cpu.stack_data.to(d_stack_data.in),
    cpu.current_state.to(d_state.in),
    cpu.subcycle.to(d_subcycle.in),
    cpu.reg_a.to(d_a.in),
    cpu.reg_x.to(d_x.in),
    cpu.reg_sp.to(d_sp.in),
  ])
  .build()
