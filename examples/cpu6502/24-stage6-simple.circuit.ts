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
  .node('addr_20', Constant, { value: 32 })
  .node('addr_21', Constant, { value: 33 })
  .node('at_10', Comparator)
  .node('at_11', Comparator)
  .node('at_12', Comparator)
  .node('at_13', Comparator)
  .node('at_14', Comparator)
  .node('at_15', Comparator)
  .node('at_20', Comparator)
  .node('at_21', Comparator)
  .node('mem_10', Register)
  .node('mem_11', Register)
  .node('mem_12', Register)
  .node('mem_13', Register)
  .node('mem_14', Register)
  .node('mem_15', Register)
  .node('mem_20', Register)
  .node('mem_21', Register)
  .node('we_10', And)
  .node('we_11', And)
  .node('we_12', And)
  .node('we_13', And)
  .node('we_14', And)
  .node('we_15', And)
  .node('we_20', And)
  .node('we_21', And)
  .node('mux1', Mux)
  .node('mux2', Mux)
  .node('mux3', Mux)
  .node('mux4', Mux)
  .node('mux5', Mux)
  .node('mux6', Mux)
  .node('mux7', Mux)
  .node('mux8', Mux)
  .connect(({ in: inp, out, zero, addr_10, addr_11, addr_12, addr_13, addr_14, addr_15, addr_20, addr_21, at_10, at_11, at_12, at_13, at_14, at_15, at_20, at_21, mem_10, mem_11, mem_12, mem_13, mem_14, mem_15, mem_20, mem_21, we_10, we_11, we_12, we_13, we_14, we_15, we_20, we_21, mux1, mux2, mux3, mux4, mux5, mux6, mux7, mux8 }) => [
    inp.addr.to(at_10.a, at_11.a, at_12.a, at_13.a, at_14.a, at_15.a, at_20.a, at_21.a),
    addr_10.out.to(at_10.b),
    addr_11.out.to(at_11.b),
    addr_12.out.to(at_12.b),
    addr_13.out.to(at_13.b),
    addr_14.out.to(at_14.b),
    addr_15.out.to(at_15.b),
    addr_20.out.to(at_20.b),
    addr_21.out.to(at_21.b),
    inp.data_in.to(mem_10.data, mem_11.data, mem_12.data, mem_13.data, mem_14.data, mem_15.data, mem_20.data, mem_21.data),
    inp.write_enable.to(we_10.a, we_11.a, we_12.a, we_13.a, we_14.a, we_15.a, we_20.a, we_21.a),
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
    at_20.eq.to(we_20.b, mux7.sel),
    we_20.out.to(mem_20.we),
    at_21.eq.to(we_21.b, mux8.sel),
    we_21.out.to(mem_21.we),
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
    mux6.out.to(mux7.in0),
    mem_20.q.to(mux7.in1),
    mux7.out.to(mux8.in0),
    mem_21.q.to(mux8.in1),
    mux8.out.to(out.data_out),
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
  .node('dec', Subtractor)
  .node('zero_bit', Constant, { value: 0 })
  .node('inc', Adder)
  .node('mux_inc', Mux)
  .node('mux_dec', Mux)
  .node('mux_load', Mux)
  .connect(({ in: inp, out, sp_reg, always_on, one, dec, zero_bit, inc, mux_inc, mux_dec, mux_load }) => [
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

const FlagRegister = component('FlagRegister')
  .in('update_n', bit)
  .in('update_z', bit)
  .in('update_c', bit)
  .in('update_v', bit)
  .in('update_d', bit)
  .in('update_i', bit)
  .in('new_n', bit)
  .in('new_z', bit)
  .in('new_c', bit)
  .in('new_v', bit)
  .in('new_d', bit)
  .in('new_i', bit)
  .out('flag_n', bit)
  .out('flag_z', bit)
  .out('flag_c', bit)
  .out('flag_v', bit)
  .out('flag_d', bit)
  .out('flag_i', bit)
  .node('reg_n', Register, { initial: 0 })
  .node('reg_z', Register, { initial: 0 })
  .node('reg_c', Register, { initial: 0 })
  .node('reg_v', Register, { initial: 0 })
  .node('reg_d', Register, { initial: 0 })
  .node('reg_i', Register, { initial: 0 })
  .connect(({ in: inp, out, reg_n, reg_z, reg_c, reg_v, reg_d, reg_i }) => [
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
    inp.update_d.to(reg_d.we),
    inp.new_d.to(reg_d.data),
    reg_d.q.to(out.flag_d),
    inp.update_i.to(reg_i.we),
    inp.new_i.to(reg_i.data),
    reg_i.q.to(out.flag_i),
  ])
  .build()

const Stage6Control = component('Stage6Control')
  .in('reset', bit)
  .in('current_opcode', bus(8))
  .in('flag_n', bit)
  .in('flag_z', bit)
  .in('flag_c', bit)
  .in('flag_v', bit)
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
  .out('jsr_load_pc', bit)
  .out('rts_load_pc', bit)
  .out('push_pc_hi', bit)
  .out('push_pc_lo', bit)
  .out('pull_pc_lo', bit)
  .out('pull_pc_hi', bit)
  .out('branch_load_pc', bit)
  .out('update_flags', bit)
  .out('update_c_only', bit)
  .out('set_c', bit)
  .out('clear_c', bit)
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
  .out('is_jsr', bit)
  .out('is_rts', bit)
  .out('is_cmp_imm', bit)
  .out('is_beq', bit)
  .out('is_bne', bit)
  .out('is_bcc', bit)
  .out('is_bcs', bit)
  .out('is_bmi', bit)
  .out('is_bpl', bit)
  .out('is_bvc', bit)
  .out('is_bvs', bit)
  .out('is_sec', bit)
  .out('is_clc', bit)
  .out('is_nop', bit)
  .out('is_and_imm', bit)
  .out('is_ora_imm', bit)
  .out('is_eor_imm', bit)
  .out('is_iny', bit)
  .out('is_dex', bit)
  .out('is_dey', bit)
  .out('is_txa', bit)
  .out('is_tya', bit)
  .out('is_ldy_imm', bit)
  .out('is_cpx_imm', bit)
  .out('is_cpy_imm', bit)
  .out('is_txs', bit)
  .out('is_tsx', bit)
  .out('is_clv', bit)
  .out('clear_v', bit)
  .out('sp_load', bit)
  .out('set_d', bit)
  .out('clear_d', bit)
  .out('set_i', bit)
  .out('clear_i', bit)
  .out('update_d', bit)
  .out('update_i', bit)
  .out('is_php', bit)
  .out('is_plp', bit)
  .out('update_flags_plp', bit)
  .out('is_ldx_imm', bit)
  .out('is_sbc_imm', bit)
  .out('is_adc_imm', bit)
  .out('is_stx_zp', bit)
  .out('is_sty_zp', bit)
  .out('use_x_for_mem', bit)
  .out('use_y_for_mem', bit)
  .out('is_asl_a', bit)
  .out('is_lsr_a', bit)
  .out('is_rol_a', bit)
  .out('is_ror_a', bit)
  .out('is_sei', bit)
  .out('is_cli', bit)
  .out('is_sed', bit)
  .out('is_cld', bit)
  .out('is_inc_zp', bit)
  .out('is_dec_zp', bit)
  .out('mem_rmw', bit)
  .out('use_rmw_data', bit)
  .out('is_asl_zp', bit)
  .out('is_lsr_zp', bit)
  .out('is_rol_zp', bit)
  .out('is_ror_zp', bit)
  .out('is_lda_zp_x', bit)
  .out('is_sta_zp_x', bit)
  .out('is_adc_zp_x', bit)
  .out('is_sbc_zp_x', bit)
  .out('is_and_zp_x', bit)
  .out('is_ora_zp_x', bit)
  .out('is_eor_zp_x', bit)
  .out('is_cmp_zp_x', bit)
  .out('is_zp_x', bit)
  .out('is_ldx_zp_y', bit)
  .out('is_stx_zp_y', bit)
  .out('is_zp_y', bit)
  .out('is_lda_abs_y', bit)
  .out('is_sta_abs_y', bit)
  .out('is_adc_abs_y', bit)
  .out('is_sbc_abs_y', bit)
  .out('is_and_abs_y', bit)
  .out('is_ora_abs_y', bit)
  .out('is_eor_abs_y', bit)
  .out('is_cmp_abs_y', bit)
  .out('is_ldx_abs_y', bit)
  .out('is_abs_y', bit)
  .out('is_lda_ind_x', bit)
  .out('is_sta_ind_x', bit)
  .out('is_adc_ind_x', bit)
  .out('is_sbc_ind_x', bit)
  .out('is_and_ind_x', bit)
  .out('is_ora_ind_x', bit)
  .out('is_eor_ind_x', bit)
  .out('is_cmp_ind_x', bit)
  .out('is_ind_x', bit)
  .out('ptr_lo_load', bit)
  .out('ptr_hi_load', bit)
  .out('ind_x_sub3', bit)
  .out('ind_x_sub4', bit)
  .out('ind_x_sub5', bit)
  .out('is_lda_ind_y', bit)
  .out('is_sta_ind_y', bit)
  .out('is_adc_ind_y', bit)
  .out('is_sbc_ind_y', bit)
  .out('is_and_ind_y', bit)
  .out('is_ora_ind_y', bit)
  .out('is_eor_ind_y', bit)
  .out('is_cmp_ind_y', bit)
  .out('is_ind_y', bit)
  .out('ind_y_sub2', bit)
  .out('ind_y_sub3', bit)
  .out('ind_y_sub4', bit)
  .out('ind_y_sub5', bit)
  .out('is_bit_zp', bit)
  .out('is_bit_abs', bit)
  .out('update_v_bit', bit)
  .out('is_jmp_ind', bit)
  .out('is_rti', bit)
  .out('jmp_ind_load_pc', bit)
  .out('rti_load_pc', bit)
  .out('rti_pull_p', bit)
  .out('update_flags_rti', bit)
  .out('jmp_ind_sub2', bit)
  .out('jmp_ind_sub3', bit)
  .out('is_asl_zp_x', bit)
  .out('is_lsr_zp_x', bit)
  .out('is_rol_zp_x', bit)
  .out('is_ror_zp_x', bit)
  .out('is_asl_abs', bit)
  .out('is_lsr_abs', bit)
  .out('is_rol_abs', bit)
  .out('is_ror_abs', bit)
  .out('is_asl_abs_x', bit)
  .out('is_lsr_abs_x', bit)
  .out('is_rol_abs_x', bit)
  .out('is_ror_abs_x', bit)
  .out('is_shift_zp_x', bit)
  .out('is_shift_abs', bit)
  .out('is_shift_abs_x', bit)
  .out('is_inc_zp_x', bit)
  .out('is_dec_zp_x', bit)
  .out('is_inc_abs', bit)
  .out('is_dec_abs', bit)
  .out('is_inc_abs_x', bit)
  .out('is_dec_abs_x', bit)
  .out('is_inc_dec_zp_x', bit)
  .out('is_inc_dec_abs', bit)
  .out('is_inc_dec_abs_x', bit)
  .out('is_cpx_zp', bit)
  .out('is_cpy_zp', bit)
  .out('is_cpx_abs', bit)
  .out('is_cpy_abs', bit)
  .out('is_ldx_zp', bit)
  .out('is_ldx_abs', bit)
  .out('is_ldy_zp', bit)
  .out('is_ldy_zp_x', bit)
  .out('is_ldy_abs', bit)
  .out('is_ldy_abs_x', bit)
  .out('is_stx_abs', bit)
  .out('is_sty_zp_x', bit)
  .out('is_sty_abs', bit)
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
  .node('JSR', Constant, { value: 32 })
  .node('RTS', Constant, { value: 96 })
  .node('CMP_IMM', Constant, { value: 201 })
  .node('BEQ', Constant, { value: 240 })
  .node('BNE', Constant, { value: 208 })
  .node('BCC', Constant, { value: 144 })
  .node('BCS', Constant, { value: 176 })
  .node('BMI', Constant, { value: 48 })
  .node('BPL', Constant, { value: 16 })
  .node('BVC', Constant, { value: 80 })
  .node('BVS', Constant, { value: 112 })
  .node('SEC', Constant, { value: 56 })
  .node('CLC', Constant, { value: 24 })
  .node('NOP', Constant, { value: 234 })
  .node('AND_IMM', Constant, { value: 41 })
  .node('ORA_IMM', Constant, { value: 9 })
  .node('EOR_IMM', Constant, { value: 73 })
  .node('INY', Constant, { value: 200 })
  .node('DEX', Constant, { value: 202 })
  .node('DEY', Constant, { value: 136 })
  .node('TXA', Constant, { value: 138 })
  .node('TYA', Constant, { value: 152 })
  .node('LDY_IMM', Constant, { value: 160 })
  .node('CPX_IMM', Constant, { value: 224 })
  .node('CPY_IMM', Constant, { value: 192 })
  .node('TXS', Constant, { value: 154 })
  .node('TSX', Constant, { value: 186 })
  .node('CLV', Constant, { value: 184 })
  .node('LDX_IMM', Constant, { value: 162 })
  .node('SBC_IMM', Constant, { value: 233 })
  .node('ADC_IMM', Constant, { value: 105 })
  .node('STX_ZP', Constant, { value: 134 })
  .node('STY_ZP', Constant, { value: 132 })
  .node('ASL_A', Constant, { value: 10 })
  .node('LSR_A', Constant, { value: 74 })
  .node('ROL_A', Constant, { value: 42 })
  .node('ROR_A', Constant, { value: 106 })
  .node('SEI', Constant, { value: 120 })
  .node('CLI', Constant, { value: 88 })
  .node('SED', Constant, { value: 248 })
  .node('CLD', Constant, { value: 216 })
  .node('INC_ZP', Constant, { value: 230 })
  .node('DEC_ZP', Constant, { value: 198 })
  .node('ASL_ZP', Constant, { value: 6 })
  .node('LSR_ZP', Constant, { value: 70 })
  .node('ROL_ZP', Constant, { value: 38 })
  .node('ROR_ZP', Constant, { value: 102 })
  .node('LDA_ZP_X', Constant, { value: 181 })
  .node('STA_ZP_X', Constant, { value: 149 })
  .node('ADC_ZP_X', Constant, { value: 117 })
  .node('SBC_ZP_X', Constant, { value: 245 })
  .node('AND_ZP_X', Constant, { value: 53 })
  .node('ORA_ZP_X', Constant, { value: 21 })
  .node('EOR_ZP_X', Constant, { value: 85 })
  .node('CMP_ZP_X', Constant, { value: 213 })
  .node('LDX_ZP_Y', Constant, { value: 182 })
  .node('STX_ZP_Y', Constant, { value: 150 })
  .node('LDA_ABS_Y', Constant, { value: 185 })
  .node('STA_ABS_Y', Constant, { value: 153 })
  .node('ADC_ABS_Y', Constant, { value: 121 })
  .node('SBC_ABS_Y', Constant, { value: 249 })
  .node('AND_ABS_Y', Constant, { value: 57 })
  .node('ORA_ABS_Y', Constant, { value: 25 })
  .node('EOR_ABS_Y', Constant, { value: 89 })
  .node('CMP_ABS_Y', Constant, { value: 217 })
  .node('LDX_ABS_Y', Constant, { value: 190 })
  .node('LDA_IND_X', Constant, { value: 161 })
  .node('STA_IND_X', Constant, { value: 129 })
  .node('ADC_IND_X', Constant, { value: 97 })
  .node('SBC_IND_X', Constant, { value: 225 })
  .node('AND_IND_X', Constant, { value: 33 })
  .node('ORA_IND_X', Constant, { value: 1 })
  .node('EOR_IND_X', Constant, { value: 65 })
  .node('CMP_IND_X', Constant, { value: 193 })
  .node('LDA_IND_Y', Constant, { value: 177 })
  .node('STA_IND_Y', Constant, { value: 145 })
  .node('ADC_IND_Y', Constant, { value: 113 })
  .node('SBC_IND_Y', Constant, { value: 241 })
  .node('AND_IND_Y', Constant, { value: 49 })
  .node('ORA_IND_Y', Constant, { value: 17 })
  .node('EOR_IND_Y', Constant, { value: 81 })
  .node('CMP_IND_Y', Constant, { value: 209 })
  .node('BIT_ZP', Constant, { value: 36 })
  .node('BIT_ABS', Constant, { value: 44 })
  .node('PHP', Constant, { value: 8 })
  .node('PLP', Constant, { value: 40 })
  .node('JMP_IND', Constant, { value: 108 })
  .node('RTI', Constant, { value: 64 })
  .node('ASL_ZP_X', Constant, { value: 22 })
  .node('LSR_ZP_X', Constant, { value: 86 })
  .node('ROL_ZP_X', Constant, { value: 54 })
  .node('ROR_ZP_X', Constant, { value: 118 })
  .node('ASL_ABS', Constant, { value: 14 })
  .node('LSR_ABS', Constant, { value: 78 })
  .node('ROL_ABS', Constant, { value: 46 })
  .node('ROR_ABS', Constant, { value: 110 })
  .node('ASL_ABS_X', Constant, { value: 30 })
  .node('LSR_ABS_X', Constant, { value: 94 })
  .node('ROL_ABS_X', Constant, { value: 62 })
  .node('ROR_ABS_X', Constant, { value: 126 })
  .node('INC_ZP_X', Constant, { value: 246 })
  .node('DEC_ZP_X', Constant, { value: 214 })
  .node('INC_ABS', Constant, { value: 238 })
  .node('DEC_ABS', Constant, { value: 206 })
  .node('INC_ABS_X', Constant, { value: 254 })
  .node('DEC_ABS_X', Constant, { value: 222 })
  .node('CPX_ZP', Constant, { value: 228 })
  .node('CPY_ZP', Constant, { value: 196 })
  .node('CPX_ABS', Constant, { value: 236 })
  .node('CPY_ABS', Constant, { value: 204 })
  .node('LDX_ZP', Constant, { value: 166 })
  .node('LDX_ABS', Constant, { value: 174 })
  .node('LDY_ZP', Constant, { value: 164 })
  .node('LDY_ZP_X', Constant, { value: 180 })
  .node('LDY_ABS', Constant, { value: 172 })
  .node('LDY_ABS_X', Constant, { value: 188 })
  .node('STX_ABS', Constant, { value: 142 })
  .node('STY_ZP_X', Constant, { value: 148 })
  .node('STY_ABS', Constant, { value: 140 })
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
  .node('cmp_jsr', Comparator)
  .node('cmp_rts', Comparator)
  .node('cmp_cmp_imm', Comparator)
  .node('cmp_beq', Comparator)
  .node('cmp_bne', Comparator)
  .node('cmp_bcc', Comparator)
  .node('cmp_bcs', Comparator)
  .node('cmp_bmi', Comparator)
  .node('cmp_bpl', Comparator)
  .node('cmp_bvc', Comparator)
  .node('cmp_bvs', Comparator)
  .node('cmp_sec', Comparator)
  .node('cmp_clc', Comparator)
  .node('cmp_nop', Comparator)
  .node('cmp_and_imm', Comparator)
  .node('cmp_ora_imm', Comparator)
  .node('cmp_eor_imm', Comparator)
  .node('cmp_iny', Comparator)
  .node('cmp_dex', Comparator)
  .node('cmp_dey', Comparator)
  .node('cmp_txa', Comparator)
  .node('cmp_tya', Comparator)
  .node('cmp_ldy_imm', Comparator)
  .node('cmp_cpx_imm', Comparator)
  .node('cmp_cpy_imm', Comparator)
  .node('cmp_txs', Comparator)
  .node('cmp_tsx', Comparator)
  .node('cmp_clv', Comparator)
  .node('cmp_ldx_imm', Comparator)
  .node('cmp_sbc_imm', Comparator)
  .node('cmp_adc_imm', Comparator)
  .node('cmp_stx_zp', Comparator)
  .node('cmp_sty_zp', Comparator)
  .node('cmp_asl_a', Comparator)
  .node('cmp_lsr_a', Comparator)
  .node('cmp_rol_a', Comparator)
  .node('cmp_ror_a', Comparator)
  .node('cmp_sei', Comparator)
  .node('cmp_cli', Comparator)
  .node('cmp_sed', Comparator)
  .node('cmp_cld', Comparator)
  .node('cmp_inc_zp', Comparator)
  .node('cmp_dec_zp', Comparator)
  .node('cmp_asl_zp', Comparator)
  .node('cmp_lsr_zp', Comparator)
  .node('cmp_rol_zp', Comparator)
  .node('cmp_ror_zp', Comparator)
  .node('cmp_lda_zp_x', Comparator)
  .node('cmp_sta_zp_x', Comparator)
  .node('cmp_adc_zp_x', Comparator)
  .node('cmp_sbc_zp_x', Comparator)
  .node('cmp_and_zp_x', Comparator)
  .node('cmp_ora_zp_x', Comparator)
  .node('cmp_eor_zp_x', Comparator)
  .node('cmp_cmp_zp_x', Comparator)
  .node('is_zp_x_1', Or)
  .node('is_zp_x_2', Or)
  .node('is_zp_x_3', Or)
  .node('is_zp_x_4', Or)
  .node('is_zp_x_5', Or)
  .node('is_zp_x_6', Or)
  .node('is_zp_x_7', Or)
  .node('is_zp_x_8', Or)
  .node('is_zp_x_9', Or)
  .node('is_zp_x_10', Or)
  .node('is_zp_x_final', Or)
  .node('cmp_ldx_zp_y', Comparator)
  .node('cmp_stx_zp_y', Comparator)
  .node('is_zp_y_final', Or)
  .node('cmp_lda_abs_y', Comparator)
  .node('cmp_sta_abs_y', Comparator)
  .node('cmp_adc_abs_y', Comparator)
  .node('cmp_sbc_abs_y', Comparator)
  .node('cmp_and_abs_y', Comparator)
  .node('cmp_ora_abs_y', Comparator)
  .node('cmp_eor_abs_y', Comparator)
  .node('cmp_cmp_abs_y', Comparator)
  .node('cmp_ldx_abs_y', Comparator)
  .node('is_abs_y_1', Or)
  .node('is_abs_y_2', Or)
  .node('is_abs_y_3', Or)
  .node('is_abs_y_4', Or)
  .node('is_abs_y_5', Or)
  .node('is_abs_y_6', Or)
  .node('is_abs_y_7', Or)
  .node('is_abs_y_final', Or)
  .node('cmp_lda_ind_x', Comparator)
  .node('cmp_sta_ind_x', Comparator)
  .node('cmp_adc_ind_x', Comparator)
  .node('cmp_sbc_ind_x', Comparator)
  .node('cmp_and_ind_x', Comparator)
  .node('cmp_ora_ind_x', Comparator)
  .node('cmp_eor_ind_x', Comparator)
  .node('cmp_cmp_ind_x', Comparator)
  .node('is_ind_x_1', Or)
  .node('is_ind_x_2', Or)
  .node('is_ind_x_3', Or)
  .node('is_ind_x_4', Or)
  .node('is_ind_x_5', Or)
  .node('is_ind_x_6', Or)
  .node('is_ind_x_final', Or)
  .node('cmp_lda_ind_y', Comparator)
  .node('cmp_sta_ind_y', Comparator)
  .node('cmp_adc_ind_y', Comparator)
  .node('cmp_sbc_ind_y', Comparator)
  .node('cmp_and_ind_y', Comparator)
  .node('cmp_ora_ind_y', Comparator)
  .node('cmp_eor_ind_y', Comparator)
  .node('cmp_cmp_ind_y', Comparator)
  .node('is_ind_y_1', Or)
  .node('is_ind_y_2', Or)
  .node('is_ind_y_3', Or)
  .node('is_ind_y_4', Or)
  .node('is_ind_y_5', Or)
  .node('is_ind_y_6', Or)
  .node('is_ind_y_final', Or)
  .node('cmp_bit_zp', Comparator)
  .node('cmp_bit_abs', Comparator)
  .node('cmp_php', Comparator)
  .node('cmp_plp', Comparator)
  .node('cmp_jmp_ind', Comparator)
  .node('cmp_rti', Comparator)
  .node('cmp_asl_zp_x', Comparator)
  .node('cmp_lsr_zp_x', Comparator)
  .node('cmp_rol_zp_x', Comparator)
  .node('cmp_ror_zp_x', Comparator)
  .node('cmp_asl_abs', Comparator)
  .node('cmp_lsr_abs', Comparator)
  .node('cmp_rol_abs', Comparator)
  .node('cmp_ror_abs', Comparator)
  .node('cmp_asl_abs_x', Comparator)
  .node('cmp_lsr_abs_x', Comparator)
  .node('cmp_rol_abs_x', Comparator)
  .node('cmp_ror_abs_x', Comparator)
  .node('is_shift_zp_x_temp', Or)
  .node('is_shift_zp_x_temp2', Or)
  .node('is_shift_zp_x_signal', Or)
  .node('is_shift_abs_temp', Or)
  .node('is_shift_abs_temp2', Or)
  .node('is_shift_abs_signal', Or)
  .node('is_shift_abs_x_temp', Or)
  .node('is_shift_abs_x_temp2', Or)
  .node('is_shift_abs_x_signal', Or)
  .node('cmp_inc_zp_x', Comparator)
  .node('cmp_dec_zp_x', Comparator)
  .node('cmp_inc_abs', Comparator)
  .node('cmp_dec_abs', Comparator)
  .node('cmp_inc_abs_x', Comparator)
  .node('cmp_dec_abs_x', Comparator)
  .node('is_inc_dec_zp_x_signal', Or)
  .node('is_inc_dec_abs_signal', Or)
  .node('is_inc_dec_abs_x_signal', Or)
  .node('cmp_cpx_zp', Comparator)
  .node('cmp_cpy_zp', Comparator)
  .node('cmp_cpx_abs', Comparator)
  .node('cmp_cpy_abs', Comparator)
  .node('cmp_ldx_zp', Comparator)
  .node('cmp_ldx_abs', Comparator)
  .node('cmp_ldy_zp', Comparator)
  .node('cmp_ldy_zp_x', Comparator)
  .node('cmp_ldy_abs', Comparator)
  .node('cmp_ldy_abs_x', Comparator)
  .node('cmp_stx_abs', Comparator)
  .node('cmp_sty_zp_x', Comparator)
  .node('cmp_sty_abs', Comparator)
  .node('is_rmw_inc_dec_zp', Or)
  .node('is_rmw_inc_dec_temp', Or)
  .node('is_rmw_inc_dec_temp2', Or)
  .node('is_rmw_inc_dec', Or)
  .node('is_rmw_asl_lsr', Or)
  .node('is_rmw_rol_ror', Or)
  .node('is_rmw_shift_zp', Or)
  .node('is_rmw_shift_temp', Or)
  .node('is_rmw_shift_temp2', Or)
  .node('is_rmw_shift', Or)
  .node('is_rmw', Or)
  .node('is_imm_lda', Or)
  .node('is_imm_lda_2', Or)
  .node('is_imm_lda_3', Or)
  .node('is_imm_lda_4', Or)
  .node('is_imm_lda_5', Or)
  .node('is_imm_any_1', Or)
  .node('is_imm_any_2', Or)
  .node('is_imm_any_3', Or)
  .node('is_imm_any_4', Or)
  .node('is_imm_any', Or)
  .node('is_zp_1', Or)
  .node('is_zp_2', Or)
  .node('is_zp_3', Or)
  .node('is_zp_4', Or)
  .node('is_zp_5', Or)
  .node('is_zp_6', Or)
  .node('is_zp_7', Or)
  .node('is_zp_8', Or)
  .node('is_zp_9', Or)
  .node('is_zp_10', Or)
  .node('is_zp_11', Or)
  .node('is_zp_12', Or)
  .node('is_zp_13', Or)
  .node('is_zp_14', Or)
  .node('is_zp_15', Or)
  .node('is_zp', Or)
  .node('is_abs_temp', Or)
  .node('is_abs_temp2', Or)
  .node('is_abs_temp3', Or)
  .node('is_abs_temp4', Or)
  .node('is_abs_temp5', Or)
  .node('is_abs_temp6', Or)
  .node('is_abs_temp7', Or)
  .node('is_abs_temp8', Or)
  .node('is_abs_temp9', Or)
  .node('is_abs_temp10', Or)
  .node('is_abs_temp11', Or)
  .node('is_abs_temp12', Or)
  .node('is_abs_temp13', Or)
  .node('is_abs_temp14', Or)
  .node('is_abs_temp15', Or)
  .node('is_abs_final', Or)
  .node('is_1cycle_1', Or)
  .node('is_1cycle_2', Or)
  .node('is_1cycle_3', Or)
  .node('is_1cycle_4', Or)
  .node('is_1cycle_5', Or)
  .node('is_1cycle_6', Or)
  .node('is_1cycle_7', Or)
  .node('is_1cycle_8', Or)
  .node('is_1cycle_9', Or)
  .node('is_1cycle_10', Or)
  .node('is_1cycle_11', Or)
  .node('is_1cycle_12', Or)
  .node('is_1cycle_13', Or)
  .node('is_1cycle_14', Or)
  .node('is_1cycle_15', Or)
  .node('is_1cycle_16', Or)
  .node('is_1cycle_17', Or)
  .node('is_1cycle_18', Or)
  .node('is_1cycle_19', Or)
  .node('is_1cycle', Or)
  .node('is_branch_1', Or)
  .node('is_branch_2', Or)
  .node('is_branch_3', Or)
  .node('is_branch_4', Or)
  .node('is_branch_5', Or)
  .node('is_branch_6', Or)
  .node('is_branch', Or)
  .node('beq_cond', And)
  .node('not_z', Not)
  .node('bne_cond', And)
  .node('not_c', Not)
  .node('bcc_cond', And)
  .node('bcs_cond', And)
  .node('bmi_cond', And)
  .node('not_n', Not)
  .node('bpl_cond', And)
  .node('not_v', Not)
  .node('bvc_cond', And)
  .node('bvs_cond', And)
  .node('branch_cond_1', Or)
  .node('branch_cond_2', Or)
  .node('branch_cond_3', Or)
  .node('branch_cond_4', Or)
  .node('branch_cond_5', Or)
  .node('branch_cond_6', Or)
  .node('branch_taken', Or)
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('two', Constant, { value: 2 })
  .node('three', Constant, { value: 3 })
  .node('four', Constant, { value: 4 })
  .node('five', Constant, { value: 5 })
  .node('inc_subcycle', Incrementer)
  .node('subcycle_increment', Mux)
  .node('always_on', Constant, { value: 1 })
  .node('is_sub0', Comparator)
  .node('is_sub1', Comparator)
  .node('is_sub2', Comparator)
  .node('is_sub3', Comparator)
  .node('is_sub4', Comparator)
  .node('is_sub5', Comparator)
  .node('next_from_fetch', Mux)
  .node('next_from_decode', Mux)
  .node('exec_sub0', And)
  .node('exec_sub1', And)
  .node('exec_sub2', And)
  .node('exec_sub3', And)
  .node('exec_sub4', And)
  .node('exec_sub5', And)
  .node('done_imm', And)
  .node('not_rmw', Not)
  .node('is_zp_non_rmw', And)
  .node('done_zp', And)
  .node('done_rmw', And)
  .node('done_abs', And)
  .node('done_1cyc', And)
  .node('done_pha', And)
  .node('done_pla', And)
  .node('done_php', And)
  .node('done_plp', And)
  .node('done_jmp_ind', And)
  .node('done_rti', And)
  .node('done_jsr', And)
  .node('done_rts', And)
  .node('done_ind_x', And)
  .node('done_ind_y', And)
  .node('done_branch', And)
  .node('exec_done_temp1', Or)
  .node('exec_done_temp2', Or)
  .node('exec_done_temp3', Or)
  .node('exec_done_temp4', Or)
  .node('exec_done_temp5', Or)
  .node('exec_done_temp6', Or)
  .node('exec_done_temp7', Or)
  .node('exec_done_temp8', Or)
  .node('exec_done_temp9', Or)
  .node('exec_done_temp10', Or)
  .node('exec_done_temp11', Or)
  .node('exec_done_temp12', Or)
  .node('exec_done_temp13', Or)
  .node('exec_done_temp14', Or)
  .node('exec_done', Or)
  .node('next_from_execute', Mux)
  .node('next_state', Mux)
  .node('needs_operand_any', Or)
  .node('needs_operand_temp', Or)
  .node('needs_operand_temp2', Or)
  .node('needs_operand_temp3', Or)
  .node('needs_operand_temp4', Or)
  .node('needs_operand_temp5', Or)
  .node('needs_operand', Or)
  .node('pc_inc_exec_sub0', And)
  .node('needs_2nd_byte_temp', Or)
  .node('needs_2nd_byte', Or)
  .node('pc_inc_exec_sub1', And)
  .node('pc_inc_temp', Or)
  .node('pc_inc_signal', Or)
  .node('operand_load_signal', And)
  .node('addr_lo_load_signal', And)
  .node('addr_hi_load_signal', And)
  .node('is_load', Or)
  .node('is_load_final', Or)
  .node('mem_read_zp', And)
  .node('is_zp_x_load', And)
  .node('not_sta_zp_x', Not)
  .node('mem_read_zp_x', And)
  .node('mem_read_zp_y', And)
  .node('mem_read_abs_temp', And)
  .node('mem_read_abs_x', And)
  .node('not_sta_abs_y', Not)
  .node('is_abs_y_load', And)
  .node('mem_read_abs_y', And)
  .node('mem_read_abs_1', Or)
  .node('mem_read_abs', Or)
  .node('mem_read_rmw', And)
  .node('mem_read_signal_temp1', Or)
  .node('mem_read_signal_temp1b', Or)
  .node('mem_read_signal_temp2', Or)
  .node('mem_read_signal', Or)
  .node('is_store_zp_1', Or)
  .node('is_store_zp_2', Or)
  .node('is_store_zp_3', Or)
  .node('is_store_zp', Or)
  .node('mem_write_zp', And)
  .node('is_stx_any', Or)
  .node('use_x_for_mem_signal', And)
  .node('use_y_for_mem_signal', And)
  .node('mem_write_abs_temp', And)
  .node('mem_write_abs_x', And)
  .node('mem_write_abs_y', And)
  .node('mem_write_abs_1', Or)
  .node('mem_write_abs', Or)
  .node('mem_write_rmw', And)
  .node('mem_write_ind_x', And)
  .node('mem_write_ind_y', And)
  .node('mem_write_signal_temp', Or)
  .node('mem_write_signal_temp2', Or)
  .node('mem_write_signal_temp3', Or)
  .node('mem_write_signal', Or)
  .node('sp_dec_pha', And)
  .node('sp_dec_jsr_sub2', And)
  .node('sp_dec_jsr_sub3', And)
  .node('sp_dec_php', And)
  .node('sp_dec_temp', Or)
  .node('sp_dec_temp2', Or)
  .node('sp_dec_signal', Or)
  .node('sp_inc_pla', And)
  .node('sp_inc_plp', And)
  .node('sp_inc_rts_sub0', And)
  .node('sp_inc_rts_sub2', And)
  .node('sp_inc_temp', Or)
  .node('sp_inc_temp2', Or)
  .node('sp_inc_temp3', Or)
  .node('sp_inc_rti_sub0', And)
  .node('sp_inc_rti_sub2', And)
  .node('sp_inc_rti_sub4', And)
  .node('sp_inc_temp4', Or)
  .node('sp_inc_temp5', Or)
  .node('sp_inc_signal', Or)
  .node('stack_write_pha', And)
  .node('stack_write_php', And)
  .node('stack_write_jsr_hi', And)
  .node('stack_write_jsr_lo', And)
  .node('stack_write_temp', Or)
  .node('stack_write_temp2', Or)
  .node('stack_write_signal', Or)
  .node('use_stack_signal', And)
  .node('update_flags_plp_signal', And)
  .node('jsr_load_pc_signal', And)
  .node('rts_load_pc_signal', And)
  .node('jmp_ind_load_pc_signal', And)
  .node('rti_load_pc_signal', And)
  .node('rti_pull_p_signal', And)
  .node('update_flags_rti_signal', And)
  .node('push_pc_hi_signal', And)
  .node('push_pc_lo_signal', And)
  .node('pull_pc_lo_rts', And)
  .node('pull_pc_lo_rti', And)
  .node('pull_pc_lo_signal', Or)
  .node('pull_pc_hi_rts', And)
  .node('pull_pc_hi_rti', And)
  .node('pull_pc_hi_signal', Or)
  .node('branch_at_sub1', And)
  .node('update_flags_lda', And)
  .node('is_any_compare', Or)
  .node('is_any_compare_2', Or)
  .node('update_flags_cmp', And)
  .node('is_zp_x_flags_1', Or)
  .node('is_zp_x_flags_2', Or)
  .node('is_zp_x_flags_3', Or)
  .node('is_zp_x_flags_4', Or)
  .node('is_zp_x_flags_5', Or)
  .node('is_zp_x_flags_6', Or)
  .node('is_zp_xy_flags', Or)
  .node('update_flags_zp_xy', And)
  .node('is_abs_y_flags_1', Or)
  .node('is_abs_y_flags_2', Or)
  .node('is_abs_y_flags_3', Or)
  .node('is_abs_y_flags_4', Or)
  .node('is_abs_y_flags_5', Or)
  .node('is_abs_y_flags_6', Or)
  .node('is_abs_y_flags', Or)
  .node('update_flags_abs_y', And)
  .node('is_ind_x_flags_1', Or)
  .node('is_ind_x_flags_2', Or)
  .node('is_ind_x_flags_3', Or)
  .node('is_ind_x_flags_4', Or)
  .node('is_ind_x_flags_5', Or)
  .node('is_ind_x_flags', Or)
  .node('update_flags_ind_x', And)
  .node('is_ind_y_flags_1', Or)
  .node('is_ind_y_flags_2', Or)
  .node('is_ind_y_flags_3', Or)
  .node('is_ind_y_flags_4', Or)
  .node('is_ind_y_flags_5', Or)
  .node('is_ind_y_flags', Or)
  .node('update_flags_ind_y', And)
  .node('update_flags_ldy', And)
  .node('update_flags_ldx', And)
  .node('is_reg_inc_dec', Or)
  .node('is_reg_inc_dec_2', Or)
  .node('is_reg_inc_dec_3', Or)
  .node('is_reg_inc_dec_4', Or)
  .node('is_reg_inc_dec_5', Or)
  .node('is_reg_inc_dec_6', Or)
  .node('is_reg_inc_dec_7', Or)
  .node('is_reg_inc_dec_8', Or)
  .node('is_reg_inc_dec_9', Or)
  .node('is_reg_inc_dec_10', Or)
  .node('update_flags_inx', And)
  .node('update_flags_temp', Or)
  .node('update_flags_temp2', Or)
  .node('update_flags_temp3', Or)
  .node('update_flags_rmw', And)
  .node('update_flags_temp4', Or)
  .node('update_flags_temp5', Or)
  .node('update_flags_temp6', Or)
  .node('update_flags_temp7', Or)
  .node('update_flags_temp8', Or)
  .node('update_flags_temp9', Or)
  .node('update_flags_bit_zp', And)
  .node('update_flags_bit_abs', And)
  .node('update_flags_bit', Or)
  .node('update_flags_signal', Or)
  .node('is_sec_clc', Or)
  .node('update_c_only_signal', And)
  .node('set_c_signal', And)
  .node('clear_c_signal', And)
  .node('clear_v_signal', And)
  .node('set_d_signal', And)
  .node('clear_d_signal', And)
  .node('set_i_signal', And)
  .node('clear_i_signal', And)
  .node('update_d_signal', Or)
  .node('update_i_signal', Or)
  .node('sp_load_signal', And)
  .node('ptr_lo_load_ind_x', And)
  .node('ptr_lo_load_ind_y', And)
  .node('ptr_lo_load_temp', Or)
  .node('ptr_lo_load_jmp_ind', And)
  .node('ptr_lo_load_signal', Or)
  .node('ptr_hi_load_ind_x', And)
  .node('ptr_hi_load_ind_y', And)
  .node('ptr_hi_load_temp', Or)
  .node('ptr_hi_load_jmp_ind', And)
  .node('ptr_hi_load_signal', Or)
  .node('ind_x_sub3_signal', And)
  .node('ind_x_sub4_signal', And)
  .node('ind_x_sub5_signal', And)
  .node('ind_y_sub2_signal', And)
  .node('ind_y_sub3_signal', And)
  .node('ind_y_sub4_signal', And)
  .node('ind_y_sub5_signal', And)
  .node('jmp_ind_sub2_signal', And)
  .node('jmp_ind_sub3_signal', And)
  .node('write_a_imm', And)
  .node('write_a_zp', And)
  .node('is_zp_x_write_a_1', Or)
  .node('is_zp_x_write_a_2', Or)
  .node('is_zp_x_write_a_3', Or)
  .node('is_zp_x_write_a_4', Or)
  .node('is_zp_x_write_a', Or)
  .node('write_a_zp_x', And)
  .node('write_a_abs_temp', And)
  .node('write_a_abs_x', And)
  .node('is_abs_y_write_a_1', Or)
  .node('is_abs_y_write_a_2', Or)
  .node('is_abs_y_write_a_3', Or)
  .node('is_abs_y_write_a_4', Or)
  .node('is_abs_y_write_a', Or)
  .node('write_a_abs_y', And)
  .node('is_ind_x_write_a_1', Or)
  .node('is_ind_x_write_a_2', Or)
  .node('is_ind_x_write_a_3', Or)
  .node('is_ind_x_write_a_4', Or)
  .node('is_ind_x_write_a', Or)
  .node('write_a_ind_x', And)
  .node('is_ind_y_write_a_1', Or)
  .node('is_ind_y_write_a_2', Or)
  .node('is_ind_y_write_a_3', Or)
  .node('is_ind_y_write_a_4', Or)
  .node('is_ind_y_write_a', Or)
  .node('write_a_ind_y', And)
  .node('write_a_abs_temp2', Or)
  .node('write_a_abs', Or)
  .node('write_a_zp_all', Or)
  .node('write_a_temp', Or)
  .node('write_a_temp2', Or)
  .node('write_a_pla', And)
  .node('write_a_txa', And)
  .node('write_a_tya', And)
  .node('write_a_temp3', Or)
  .node('write_a_temp4', Or)
  .node('write_a_temp5', Or)
  .node('is_shift_rotate', Or)
  .node('is_shift_rotate_2', Or)
  .node('is_shift_rotate_all', Or)
  .node('write_a_shift', And)
  .node('write_a_temp6', Or)
  .node('write_a_temp7', Or)
  .node('write_a_signal', Or)
  .node('write_x_tax', And)
  .node('write_x_inx', And)
  .node('write_x_dex', And)
  .node('write_x_tsx', And)
  .node('write_x_ldx_imm', And)
  .node('write_x_ldx_zp_y', And)
  .node('write_x_ldx_abs_y', And)
  .node('write_x_temp', Or)
  .node('write_x_temp2', Or)
  .node('write_x_temp3', Or)
  .node('write_x_temp4', Or)
  .node('write_x_temp5', Or)
  .node('write_x_signal', Or)
  .node('write_y_iny', And)
  .node('write_y_dey', And)
  .node('write_y_ldy_imm', And)
  .node('write_y_temp', Or)
  .node('write_y_signal', Or)
  .connect(({ in: inp, out, state_reg, subcycle_reg, STATE_FETCH, STATE_DECODE, STATE_EXECUTE, is_fetch, is_decode, is_execute, LDA_IMM, LDA_ZP, LDA_ABS, LDA_ABS_X, STA_ZP, STA_ABS, STA_ABS_X, TAX, INX, PHA, PLA, JSR, RTS, CMP_IMM, BEQ, BNE, BCC, BCS, BMI, BPL, BVC, BVS, SEC, CLC, NOP, AND_IMM, ORA_IMM, EOR_IMM, INY, DEX, DEY, TXA, TYA, LDY_IMM, CPX_IMM, CPY_IMM, TXS, TSX, CLV, LDX_IMM, SBC_IMM, ADC_IMM, STX_ZP, STY_ZP, ASL_A, LSR_A, ROL_A, ROR_A, SEI, CLI, SED, CLD, INC_ZP, DEC_ZP, ASL_ZP, LSR_ZP, ROL_ZP, ROR_ZP, LDA_ZP_X, STA_ZP_X, ADC_ZP_X, SBC_ZP_X, AND_ZP_X, ORA_ZP_X, EOR_ZP_X, CMP_ZP_X, LDX_ZP_Y, STX_ZP_Y, LDA_ABS_Y, STA_ABS_Y, ADC_ABS_Y, SBC_ABS_Y, AND_ABS_Y, ORA_ABS_Y, EOR_ABS_Y, CMP_ABS_Y, LDX_ABS_Y, LDA_IND_X, STA_IND_X, ADC_IND_X, SBC_IND_X, AND_IND_X, ORA_IND_X, EOR_IND_X, CMP_IND_X, LDA_IND_Y, STA_IND_Y, ADC_IND_Y, SBC_IND_Y, AND_IND_Y, ORA_IND_Y, EOR_IND_Y, CMP_IND_Y, BIT_ZP, BIT_ABS, PHP, PLP, JMP_IND, RTI, ASL_ZP_X, LSR_ZP_X, ROL_ZP_X, ROR_ZP_X, ASL_ABS, LSR_ABS, ROL_ABS, ROR_ABS, ASL_ABS_X, LSR_ABS_X, ROL_ABS_X, ROR_ABS_X, INC_ZP_X, DEC_ZP_X, INC_ABS, DEC_ABS, INC_ABS_X, DEC_ABS_X, CPX_ZP, CPY_ZP, CPX_ABS, CPY_ABS, LDX_ZP, LDX_ABS, LDY_ZP, LDY_ZP_X, LDY_ABS, LDY_ABS_X, STX_ABS, STY_ZP_X, STY_ABS, cmp_lda_imm, cmp_lda_zp, cmp_lda_abs, cmp_lda_abs_x, cmp_sta_zp, cmp_sta_abs, cmp_sta_abs_x, cmp_tax, cmp_inx, cmp_pha, cmp_pla, cmp_jsr, cmp_rts, cmp_cmp_imm, cmp_beq, cmp_bne, cmp_bcc, cmp_bcs, cmp_bmi, cmp_bpl, cmp_bvc, cmp_bvs, cmp_sec, cmp_clc, cmp_nop, cmp_and_imm, cmp_ora_imm, cmp_eor_imm, cmp_iny, cmp_dex, cmp_dey, cmp_txa, cmp_tya, cmp_ldy_imm, cmp_cpx_imm, cmp_cpy_imm, cmp_txs, cmp_tsx, cmp_clv, cmp_ldx_imm, cmp_sbc_imm, cmp_adc_imm, cmp_stx_zp, cmp_sty_zp, cmp_asl_a, cmp_lsr_a, cmp_rol_a, cmp_ror_a, cmp_sei, cmp_cli, cmp_sed, cmp_cld, cmp_inc_zp, cmp_dec_zp, cmp_asl_zp, cmp_lsr_zp, cmp_rol_zp, cmp_ror_zp, cmp_lda_zp_x, cmp_sta_zp_x, cmp_adc_zp_x, cmp_sbc_zp_x, cmp_and_zp_x, cmp_ora_zp_x, cmp_eor_zp_x, cmp_cmp_zp_x, is_zp_x_1, is_zp_x_2, is_zp_x_3, is_zp_x_4, is_zp_x_5, is_zp_x_6, is_zp_x_7, is_zp_x_8, is_zp_x_9, is_zp_x_10, is_zp_x_final, cmp_ldx_zp_y, cmp_stx_zp_y, is_zp_y_final, cmp_lda_abs_y, cmp_sta_abs_y, cmp_adc_abs_y, cmp_sbc_abs_y, cmp_and_abs_y, cmp_ora_abs_y, cmp_eor_abs_y, cmp_cmp_abs_y, cmp_ldx_abs_y, is_abs_y_1, is_abs_y_2, is_abs_y_3, is_abs_y_4, is_abs_y_5, is_abs_y_6, is_abs_y_7, is_abs_y_final, cmp_lda_ind_x, cmp_sta_ind_x, cmp_adc_ind_x, cmp_sbc_ind_x, cmp_and_ind_x, cmp_ora_ind_x, cmp_eor_ind_x, cmp_cmp_ind_x, is_ind_x_1, is_ind_x_2, is_ind_x_3, is_ind_x_4, is_ind_x_5, is_ind_x_6, is_ind_x_final, cmp_lda_ind_y, cmp_sta_ind_y, cmp_adc_ind_y, cmp_sbc_ind_y, cmp_and_ind_y, cmp_ora_ind_y, cmp_eor_ind_y, cmp_cmp_ind_y, is_ind_y_1, is_ind_y_2, is_ind_y_3, is_ind_y_4, is_ind_y_5, is_ind_y_6, is_ind_y_final, cmp_bit_zp, cmp_bit_abs, cmp_php, cmp_plp, cmp_jmp_ind, cmp_rti, cmp_asl_zp_x, cmp_lsr_zp_x, cmp_rol_zp_x, cmp_ror_zp_x, cmp_asl_abs, cmp_lsr_abs, cmp_rol_abs, cmp_ror_abs, cmp_asl_abs_x, cmp_lsr_abs_x, cmp_rol_abs_x, cmp_ror_abs_x, is_shift_zp_x_temp, is_shift_zp_x_temp2, is_shift_zp_x_signal, is_shift_abs_temp, is_shift_abs_temp2, is_shift_abs_signal, is_shift_abs_x_temp, is_shift_abs_x_temp2, is_shift_abs_x_signal, cmp_inc_zp_x, cmp_dec_zp_x, cmp_inc_abs, cmp_dec_abs, cmp_inc_abs_x, cmp_dec_abs_x, is_inc_dec_zp_x_signal, is_inc_dec_abs_signal, is_inc_dec_abs_x_signal, cmp_cpx_zp, cmp_cpy_zp, cmp_cpx_abs, cmp_cpy_abs, cmp_ldx_zp, cmp_ldx_abs, cmp_ldy_zp, cmp_ldy_zp_x, cmp_ldy_abs, cmp_ldy_abs_x, cmp_stx_abs, cmp_sty_zp_x, cmp_sty_abs, is_rmw_inc_dec_zp, is_rmw_inc_dec_temp, is_rmw_inc_dec_temp2, is_rmw_inc_dec, is_rmw_asl_lsr, is_rmw_rol_ror, is_rmw_shift_zp, is_rmw_shift_temp, is_rmw_shift_temp2, is_rmw_shift, is_rmw, is_imm_lda, is_imm_lda_2, is_imm_lda_3, is_imm_lda_4, is_imm_lda_5, is_imm_any_1, is_imm_any_2, is_imm_any_3, is_imm_any_4, is_imm_any, is_zp_1, is_zp_2, is_zp_3, is_zp_4, is_zp_5, is_zp_6, is_zp_7, is_zp_8, is_zp_9, is_zp_10, is_zp_11, is_zp_12, is_zp_13, is_zp_14, is_zp_15, is_zp, is_abs_temp, is_abs_temp2, is_abs_temp3, is_abs_temp4, is_abs_temp5, is_abs_temp6, is_abs_temp7, is_abs_temp8, is_abs_temp9, is_abs_temp10, is_abs_temp11, is_abs_temp12, is_abs_temp13, is_abs_temp14, is_abs_temp15, is_abs_final, is_1cycle_1, is_1cycle_2, is_1cycle_3, is_1cycle_4, is_1cycle_5, is_1cycle_6, is_1cycle_7, is_1cycle_8, is_1cycle_9, is_1cycle_10, is_1cycle_11, is_1cycle_12, is_1cycle_13, is_1cycle_14, is_1cycle_15, is_1cycle_16, is_1cycle_17, is_1cycle_18, is_1cycle_19, is_1cycle, is_branch_1, is_branch_2, is_branch_3, is_branch_4, is_branch_5, is_branch_6, is_branch, beq_cond, not_z, bne_cond, not_c, bcc_cond, bcs_cond, bmi_cond, not_n, bpl_cond, not_v, bvc_cond, bvs_cond, branch_cond_1, branch_cond_2, branch_cond_3, branch_cond_4, branch_cond_5, branch_cond_6, branch_taken, zero, one, two, three, four, five, inc_subcycle, subcycle_increment, always_on, is_sub0, is_sub1, is_sub2, is_sub3, is_sub4, is_sub5, next_from_fetch, next_from_decode, exec_sub0, exec_sub1, exec_sub2, exec_sub3, exec_sub4, exec_sub5, done_imm, not_rmw, is_zp_non_rmw, done_zp, done_rmw, done_abs, done_1cyc, done_pha, done_pla, done_php, done_plp, done_jmp_ind, done_rti, done_jsr, done_rts, done_ind_x, done_ind_y, done_branch, exec_done_temp1, exec_done_temp2, exec_done_temp3, exec_done_temp4, exec_done_temp5, exec_done_temp6, exec_done_temp7, exec_done_temp8, exec_done_temp9, exec_done_temp10, exec_done_temp11, exec_done_temp12, exec_done_temp13, exec_done_temp14, exec_done, next_from_execute, next_state, needs_operand_any, needs_operand_temp, needs_operand_temp2, needs_operand_temp3, needs_operand_temp4, needs_operand_temp5, needs_operand, pc_inc_exec_sub0, needs_2nd_byte_temp, needs_2nd_byte, pc_inc_exec_sub1, pc_inc_temp, pc_inc_signal, operand_load_signal, addr_lo_load_signal, addr_hi_load_signal, is_load, is_load_final, mem_read_zp, is_zp_x_load, not_sta_zp_x, mem_read_zp_x, mem_read_zp_y, mem_read_abs_temp, mem_read_abs_x, not_sta_abs_y, is_abs_y_load, mem_read_abs_y, mem_read_abs_1, mem_read_abs, mem_read_rmw, mem_read_signal_temp1, mem_read_signal_temp1b, mem_read_signal_temp2, mem_read_signal, is_store_zp_1, is_store_zp_2, is_store_zp_3, is_store_zp, mem_write_zp, is_stx_any, use_x_for_mem_signal, use_y_for_mem_signal, mem_write_abs_temp, mem_write_abs_x, mem_write_abs_y, mem_write_abs_1, mem_write_abs, mem_write_rmw, mem_write_ind_x, mem_write_ind_y, mem_write_signal_temp, mem_write_signal_temp2, mem_write_signal_temp3, mem_write_signal, sp_dec_pha, sp_dec_jsr_sub2, sp_dec_jsr_sub3, sp_dec_php, sp_dec_temp, sp_dec_temp2, sp_dec_signal, sp_inc_pla, sp_inc_plp, sp_inc_rts_sub0, sp_inc_rts_sub2, sp_inc_temp, sp_inc_temp2, sp_inc_temp3, sp_inc_rti_sub0, sp_inc_rti_sub2, sp_inc_rti_sub4, sp_inc_temp4, sp_inc_temp5, sp_inc_signal, stack_write_pha, stack_write_php, stack_write_jsr_hi, stack_write_jsr_lo, stack_write_temp, stack_write_temp2, stack_write_signal, use_stack_signal, update_flags_plp_signal, jsr_load_pc_signal, rts_load_pc_signal, jmp_ind_load_pc_signal, rti_load_pc_signal, rti_pull_p_signal, update_flags_rti_signal, push_pc_hi_signal, push_pc_lo_signal, pull_pc_lo_rts, pull_pc_lo_rti, pull_pc_lo_signal, pull_pc_hi_rts, pull_pc_hi_rti, pull_pc_hi_signal, branch_at_sub1, update_flags_lda, is_any_compare, is_any_compare_2, update_flags_cmp, is_zp_x_flags_1, is_zp_x_flags_2, is_zp_x_flags_3, is_zp_x_flags_4, is_zp_x_flags_5, is_zp_x_flags_6, is_zp_xy_flags, update_flags_zp_xy, is_abs_y_flags_1, is_abs_y_flags_2, is_abs_y_flags_3, is_abs_y_flags_4, is_abs_y_flags_5, is_abs_y_flags_6, is_abs_y_flags, update_flags_abs_y, is_ind_x_flags_1, is_ind_x_flags_2, is_ind_x_flags_3, is_ind_x_flags_4, is_ind_x_flags_5, is_ind_x_flags, update_flags_ind_x, is_ind_y_flags_1, is_ind_y_flags_2, is_ind_y_flags_3, is_ind_y_flags_4, is_ind_y_flags_5, is_ind_y_flags, update_flags_ind_y, update_flags_ldy, update_flags_ldx, is_reg_inc_dec, is_reg_inc_dec_2, is_reg_inc_dec_3, is_reg_inc_dec_4, is_reg_inc_dec_5, is_reg_inc_dec_6, is_reg_inc_dec_7, is_reg_inc_dec_8, is_reg_inc_dec_9, is_reg_inc_dec_10, update_flags_inx, update_flags_temp, update_flags_temp2, update_flags_temp3, update_flags_rmw, update_flags_temp4, update_flags_temp5, update_flags_temp6, update_flags_temp7, update_flags_temp8, update_flags_temp9, update_flags_bit_zp, update_flags_bit_abs, update_flags_bit, update_flags_signal, is_sec_clc, update_c_only_signal, set_c_signal, clear_c_signal, clear_v_signal, set_d_signal, clear_d_signal, set_i_signal, clear_i_signal, update_d_signal, update_i_signal, sp_load_signal, ptr_lo_load_ind_x, ptr_lo_load_ind_y, ptr_lo_load_temp, ptr_lo_load_jmp_ind, ptr_lo_load_signal, ptr_hi_load_ind_x, ptr_hi_load_ind_y, ptr_hi_load_temp, ptr_hi_load_jmp_ind, ptr_hi_load_signal, ind_x_sub3_signal, ind_x_sub4_signal, ind_x_sub5_signal, ind_y_sub2_signal, ind_y_sub3_signal, ind_y_sub4_signal, ind_y_sub5_signal, jmp_ind_sub2_signal, jmp_ind_sub3_signal, write_a_imm, write_a_zp, is_zp_x_write_a_1, is_zp_x_write_a_2, is_zp_x_write_a_3, is_zp_x_write_a_4, is_zp_x_write_a, write_a_zp_x, write_a_abs_temp, write_a_abs_x, is_abs_y_write_a_1, is_abs_y_write_a_2, is_abs_y_write_a_3, is_abs_y_write_a_4, is_abs_y_write_a, write_a_abs_y, is_ind_x_write_a_1, is_ind_x_write_a_2, is_ind_x_write_a_3, is_ind_x_write_a_4, is_ind_x_write_a, write_a_ind_x, is_ind_y_write_a_1, is_ind_y_write_a_2, is_ind_y_write_a_3, is_ind_y_write_a_4, is_ind_y_write_a, write_a_ind_y, write_a_abs_temp2, write_a_abs, write_a_zp_all, write_a_temp, write_a_temp2, write_a_pla, write_a_txa, write_a_tya, write_a_temp3, write_a_temp4, write_a_temp5, is_shift_rotate, is_shift_rotate_2, is_shift_rotate_all, write_a_shift, write_a_temp6, write_a_temp7, write_a_signal, write_x_tax, write_x_inx, write_x_dex, write_x_tsx, write_x_ldx_imm, write_x_ldx_zp_y, write_x_ldx_abs_y, write_x_temp, write_x_temp2, write_x_temp3, write_x_temp4, write_x_temp5, write_x_signal, write_y_iny, write_y_dey, write_y_ldy_imm, write_y_temp, write_y_signal }) => [
    state_reg.q.to(is_fetch.a, is_decode.a, is_execute.a, next_from_fetch.in0, out.current_state),
    STATE_FETCH.out.to(is_fetch.b, next_from_execute.in1, next_state.in1),
    STATE_DECODE.out.to(is_decode.b, next_from_fetch.in1),
    STATE_EXECUTE.out.to(is_execute.b, next_from_decode.in1),
    inp.current_opcode.to(cmp_lda_imm.a, cmp_lda_zp.a, cmp_lda_abs.a, cmp_lda_abs_x.a, cmp_sta_zp.a, cmp_sta_abs.a, cmp_sta_abs_x.a, cmp_tax.a, cmp_inx.a, cmp_pha.a, cmp_pla.a, cmp_jsr.a, cmp_rts.a, cmp_cmp_imm.a, cmp_beq.a, cmp_bne.a, cmp_bcc.a, cmp_bcs.a, cmp_bmi.a, cmp_bpl.a, cmp_bvc.a, cmp_bvs.a, cmp_sec.a, cmp_clc.a, cmp_nop.a, cmp_and_imm.a, cmp_ora_imm.a, cmp_eor_imm.a, cmp_iny.a, cmp_dex.a, cmp_dey.a, cmp_txa.a, cmp_tya.a, cmp_ldy_imm.a, cmp_cpx_imm.a, cmp_cpy_imm.a, cmp_txs.a, cmp_tsx.a, cmp_clv.a, cmp_ldx_imm.a, cmp_sbc_imm.a, cmp_adc_imm.a, cmp_stx_zp.a, cmp_sty_zp.a, cmp_asl_a.a, cmp_lsr_a.a, cmp_rol_a.a, cmp_ror_a.a, cmp_sei.a, cmp_cli.a, cmp_sed.a, cmp_cld.a, cmp_inc_zp.a, cmp_dec_zp.a, cmp_asl_zp.a, cmp_lsr_zp.a, cmp_rol_zp.a, cmp_ror_zp.a, cmp_lda_zp_x.a, cmp_sta_zp_x.a, cmp_adc_zp_x.a, cmp_sbc_zp_x.a, cmp_and_zp_x.a, cmp_ora_zp_x.a, cmp_eor_zp_x.a, cmp_cmp_zp_x.a, cmp_ldx_zp_y.a, cmp_stx_zp_y.a, cmp_lda_abs_y.a, cmp_sta_abs_y.a, cmp_adc_abs_y.a, cmp_sbc_abs_y.a, cmp_and_abs_y.a, cmp_ora_abs_y.a, cmp_eor_abs_y.a, cmp_cmp_abs_y.a, cmp_ldx_abs_y.a, cmp_lda_ind_x.a, cmp_sta_ind_x.a, cmp_adc_ind_x.a, cmp_sbc_ind_x.a, cmp_and_ind_x.a, cmp_ora_ind_x.a, cmp_eor_ind_x.a, cmp_cmp_ind_x.a, cmp_lda_ind_y.a, cmp_sta_ind_y.a, cmp_adc_ind_y.a, cmp_sbc_ind_y.a, cmp_and_ind_y.a, cmp_ora_ind_y.a, cmp_eor_ind_y.a, cmp_cmp_ind_y.a, cmp_bit_zp.a, cmp_bit_abs.a, cmp_php.a, cmp_plp.a, cmp_jmp_ind.a, cmp_rti.a, cmp_asl_zp_x.a, cmp_lsr_zp_x.a, cmp_rol_zp_x.a, cmp_ror_zp_x.a, cmp_asl_abs.a, cmp_lsr_abs.a, cmp_rol_abs.a, cmp_ror_abs.a, cmp_asl_abs_x.a, cmp_lsr_abs_x.a, cmp_rol_abs_x.a, cmp_ror_abs_x.a, cmp_inc_zp_x.a, cmp_dec_zp_x.a, cmp_inc_abs.a, cmp_dec_abs.a, cmp_inc_abs_x.a, cmp_dec_abs_x.a, cmp_cpx_zp.a, cmp_cpy_zp.a, cmp_cpx_abs.a, cmp_cpy_abs.a, cmp_ldx_zp.a, cmp_ldx_abs.a, cmp_ldy_zp.a, cmp_ldy_zp_x.a, cmp_ldy_abs.a, cmp_ldy_abs_x.a, cmp_stx_abs.a, cmp_sty_zp_x.a, cmp_sty_abs.a),
    LDA_IMM.out.to(cmp_lda_imm.b),
    cmp_lda_imm.eq.to(out.is_lda_imm, is_imm_lda.a),
    LDA_ZP.out.to(cmp_lda_zp.b),
    cmp_lda_zp.eq.to(out.is_lda_zp, is_zp_1.a, is_load.a, mem_read_zp.b, write_a_zp.b),
    LDA_ABS.out.to(cmp_lda_abs.b),
    cmp_lda_abs.eq.to(out.is_lda_abs, is_abs_temp.a, is_load.b, mem_read_abs_temp.b, write_a_abs_temp.b),
    LDA_ABS_X.out.to(cmp_lda_abs_x.b),
    cmp_lda_abs_x.eq.to(out.is_lda_abs_x, is_abs_temp2.b, is_load_final.b, mem_read_abs_x.b, write_a_abs_x.b),
    STA_ZP.out.to(cmp_sta_zp.b),
    cmp_sta_zp.eq.to(out.is_sta_zp, is_zp_1.b, is_store_zp_1.a),
    STA_ABS.out.to(cmp_sta_abs.b),
    cmp_sta_abs.eq.to(out.is_sta_abs, is_abs_temp.b, mem_write_abs_temp.b),
    STA_ABS_X.out.to(cmp_sta_abs_x.b),
    cmp_sta_abs_x.eq.to(out.is_sta_abs_x, is_abs_temp3.b, mem_write_abs_x.b),
    TAX.out.to(cmp_tax.b),
    cmp_tax.eq.to(out.is_tax, is_1cycle_1.a, write_x_tax.b),
    INX.out.to(cmp_inx.b),
    cmp_inx.eq.to(out.is_inx, is_1cycle_1.b, is_reg_inc_dec.a, write_x_inx.b),
    PHA.out.to(cmp_pha.b),
    cmp_pha.eq.to(out.is_pha, done_pha.b, sp_dec_pha.b, stack_write_pha.b),
    PLA.out.to(cmp_pla.b),
    cmp_pla.eq.to(out.is_pla, done_pla.b, sp_inc_pla.b, use_stack_signal.b, write_a_pla.b),
    JSR.out.to(cmp_jsr.b),
    cmp_jsr.eq.to(out.is_jsr, done_jsr.b, needs_operand_temp2.b, needs_2nd_byte_temp.b, sp_dec_jsr_sub2.b, sp_dec_jsr_sub3.b, stack_write_jsr_hi.b, stack_write_jsr_lo.b, jsr_load_pc_signal.b, push_pc_hi_signal.b, push_pc_lo_signal.b),
    RTS.out.to(cmp_rts.b),
    cmp_rts.eq.to(out.is_rts, done_rts.b, sp_inc_rts_sub0.b, sp_inc_rts_sub2.b, rts_load_pc_signal.b, pull_pc_lo_rts.b, pull_pc_hi_rts.b),
    CMP_IMM.out.to(cmp_cmp_imm.b),
    cmp_cmp_imm.eq.to(out.is_cmp_imm, is_imm_any_1.b, is_any_compare.a),
    BEQ.out.to(cmp_beq.b),
    cmp_beq.eq.to(out.is_beq, is_branch_1.a, beq_cond.a),
    BNE.out.to(cmp_bne.b),
    cmp_bne.eq.to(out.is_bne, is_branch_1.b, bne_cond.a),
    BCC.out.to(cmp_bcc.b),
    cmp_bcc.eq.to(out.is_bcc, is_branch_2.b, bcc_cond.a),
    BCS.out.to(cmp_bcs.b),
    cmp_bcs.eq.to(out.is_bcs, is_branch_3.b, bcs_cond.a),
    BMI.out.to(cmp_bmi.b),
    cmp_bmi.eq.to(out.is_bmi, is_branch_4.b, bmi_cond.a),
    BPL.out.to(cmp_bpl.b),
    cmp_bpl.eq.to(out.is_bpl, is_branch_5.b, bpl_cond.a),
    BVC.out.to(cmp_bvc.b),
    cmp_bvc.eq.to(out.is_bvc, is_branch_6.b, bvc_cond.a),
    BVS.out.to(cmp_bvs.b),
    cmp_bvs.eq.to(out.is_bvs, is_branch.b, bvs_cond.a),
    SEC.out.to(cmp_sec.b),
    cmp_sec.eq.to(out.is_sec, is_1cycle_3.b, is_sec_clc.a, set_c_signal.b),
    CLC.out.to(cmp_clc.b),
    cmp_clc.eq.to(out.is_clc, is_1cycle_4.b, is_sec_clc.b, clear_c_signal.b),
    NOP.out.to(cmp_nop.b),
    cmp_nop.eq.to(out.is_nop, is_1cycle_2.b),
    AND_IMM.out.to(cmp_and_imm.b),
    cmp_and_imm.eq.to(out.is_and_imm, is_imm_lda.b),
    ORA_IMM.out.to(cmp_ora_imm.b),
    cmp_ora_imm.eq.to(out.is_ora_imm, is_imm_lda_2.b),
    EOR_IMM.out.to(cmp_eor_imm.b),
    cmp_eor_imm.eq.to(out.is_eor_imm, is_imm_lda_3.b),
    INY.out.to(cmp_iny.b),
    cmp_iny.eq.to(out.is_iny, is_1cycle_5.b, is_reg_inc_dec.b, write_y_iny.b),
    DEX.out.to(cmp_dex.b),
    cmp_dex.eq.to(out.is_dex, is_1cycle_6.b, is_reg_inc_dec_2.b, write_x_dex.b),
    DEY.out.to(cmp_dey.b),
    cmp_dey.eq.to(out.is_dey, is_1cycle_7.b, is_reg_inc_dec_3.b, write_y_dey.b),
    TXA.out.to(cmp_txa.b),
    cmp_txa.eq.to(out.is_txa, is_1cycle_8.b, is_reg_inc_dec_4.b, write_a_txa.b),
    TYA.out.to(cmp_tya.b),
    cmp_tya.eq.to(out.is_tya, is_1cycle_9.b, is_reg_inc_dec_5.b, write_a_tya.b),
    LDY_IMM.out.to(cmp_ldy_imm.b),
    cmp_ldy_imm.eq.to(out.is_ldy_imm, is_imm_any_2.b, update_flags_ldy.b, write_y_ldy_imm.b),
    CPX_IMM.out.to(cmp_cpx_imm.b),
    cmp_cpx_imm.eq.to(out.is_cpx_imm, is_imm_any_3.b, is_any_compare.b),
    CPY_IMM.out.to(cmp_cpy_imm.b),
    cmp_cpy_imm.eq.to(out.is_cpy_imm, is_imm_any_4.b, is_any_compare_2.b),
    TXS.out.to(cmp_txs.b),
    cmp_txs.eq.to(out.is_txs, is_1cycle_10.b, sp_load_signal.b),
    TSX.out.to(cmp_tsx.b),
    cmp_tsx.eq.to(out.is_tsx, is_1cycle_11.b, is_reg_inc_dec_6.b, write_x_tsx.b),
    CLV.out.to(cmp_clv.b),
    cmp_clv.eq.to(out.is_clv, is_1cycle_12.b, clear_v_signal.b),
    LDX_IMM.out.to(cmp_ldx_imm.b),
    cmp_ldx_imm.eq.to(out.is_ldx_imm, is_imm_any.b, update_flags_ldx.b, write_x_ldx_imm.b),
    SBC_IMM.out.to(cmp_sbc_imm.b),
    cmp_sbc_imm.eq.to(out.is_sbc_imm, is_imm_lda_4.b),
    ADC_IMM.out.to(cmp_adc_imm.b),
    cmp_adc_imm.eq.to(out.is_adc_imm, is_imm_lda_5.b),
    STX_ZP.out.to(cmp_stx_zp.b),
    cmp_stx_zp.eq.to(out.is_stx_zp, is_zp_2.b, is_store_zp_1.b, is_stx_any.a),
    STY_ZP.out.to(cmp_sty_zp.b),
    cmp_sty_zp.eq.to(out.is_sty_zp, is_zp_3.b, is_store_zp_2.b, use_y_for_mem_signal.b),
    ASL_A.out.to(cmp_asl_a.b),
    cmp_asl_a.eq.to(out.is_asl_a, is_1cycle_13.b, is_reg_inc_dec_7.b, is_shift_rotate.a),
    LSR_A.out.to(cmp_lsr_a.b),
    cmp_lsr_a.eq.to(out.is_lsr_a, is_1cycle_14.b, is_reg_inc_dec_8.b, is_shift_rotate.b),
    ROL_A.out.to(cmp_rol_a.b),
    cmp_rol_a.eq.to(out.is_rol_a, is_1cycle_15.b, is_reg_inc_dec_9.b, is_shift_rotate_2.b),
    ROR_A.out.to(cmp_ror_a.b),
    cmp_ror_a.eq.to(out.is_ror_a, is_1cycle_16.b, is_reg_inc_dec_10.b, is_shift_rotate_all.b),
    SEI.out.to(cmp_sei.b),
    cmp_sei.eq.to(out.is_sei, is_1cycle_17.b, set_i_signal.b),
    CLI.out.to(cmp_cli.b),
    cmp_cli.eq.to(out.is_cli, is_1cycle_18.b, clear_i_signal.b),
    SED.out.to(cmp_sed.b),
    cmp_sed.eq.to(out.is_sed, is_1cycle_19.b, set_d_signal.b),
    CLD.out.to(cmp_cld.b),
    cmp_cld.eq.to(out.is_cld, is_1cycle.b, clear_d_signal.b),
    INC_ZP.out.to(cmp_inc_zp.b),
    cmp_inc_zp.eq.to(out.is_inc_zp, is_rmw_inc_dec_zp.a, is_zp_4.b),
    DEC_ZP.out.to(cmp_dec_zp.b),
    cmp_dec_zp.eq.to(out.is_dec_zp, is_rmw_inc_dec_zp.b, is_zp_5.b),
    ASL_ZP.out.to(cmp_asl_zp.b),
    cmp_asl_zp.eq.to(out.is_asl_zp, is_rmw_asl_lsr.a, is_zp_6.b),
    LSR_ZP.out.to(cmp_lsr_zp.b),
    cmp_lsr_zp.eq.to(out.is_lsr_zp, is_rmw_asl_lsr.b, is_zp_7.b),
    ROL_ZP.out.to(cmp_rol_zp.b),
    cmp_rol_zp.eq.to(out.is_rol_zp, is_rmw_rol_ror.a, is_zp_8.b),
    ROR_ZP.out.to(cmp_ror_zp.b),
    cmp_ror_zp.eq.to(out.is_ror_zp, is_rmw_rol_ror.b, is_zp_9.b),
    LDA_ZP_X.out.to(cmp_lda_zp_x.b),
    cmp_lda_zp_x.eq.to(out.is_lda_zp_x, is_zp_x_1.a, is_zp_x_flags_1.a, is_zp_x_write_a_1.a),
    STA_ZP_X.out.to(cmp_sta_zp_x.b),
    cmp_sta_zp_x.eq.to(out.is_sta_zp_x, is_zp_x_1.b, not_sta_zp_x.in, is_store_zp_3.b),
    ADC_ZP_X.out.to(cmp_adc_zp_x.b),
    cmp_adc_zp_x.eq.to(out.is_adc_zp_x, is_zp_x_2.b, is_zp_x_flags_1.b, is_zp_x_write_a_1.b),
    SBC_ZP_X.out.to(cmp_sbc_zp_x.b),
    cmp_sbc_zp_x.eq.to(out.is_sbc_zp_x, is_zp_x_3.b, is_zp_x_flags_2.b, is_zp_x_write_a_2.b),
    AND_ZP_X.out.to(cmp_and_zp_x.b),
    cmp_and_zp_x.eq.to(out.is_and_zp_x, is_zp_x_4.b, is_zp_x_flags_3.b, is_zp_x_write_a_3.b),
    ORA_ZP_X.out.to(cmp_ora_zp_x.b),
    cmp_ora_zp_x.eq.to(out.is_ora_zp_x, is_zp_x_5.b, is_zp_x_flags_4.b, is_zp_x_write_a_4.b),
    EOR_ZP_X.out.to(cmp_eor_zp_x.b),
    cmp_eor_zp_x.eq.to(out.is_eor_zp_x, is_zp_x_6.b, is_zp_x_flags_5.b, is_zp_x_write_a.b),
    CMP_ZP_X.out.to(cmp_cmp_zp_x.b),
    cmp_cmp_zp_x.eq.to(out.is_cmp_zp_x, is_zp_x_7.b, is_zp_x_flags_6.b),
    is_zp_x_1.out.to(is_zp_x_2.a),
    is_zp_x_2.out.to(is_zp_x_3.a),
    is_zp_x_3.out.to(is_zp_x_4.a),
    is_zp_x_4.out.to(is_zp_x_5.a),
    is_zp_x_5.out.to(is_zp_x_6.a),
    is_zp_x_6.out.to(is_zp_x_7.a),
    is_zp_x_7.out.to(is_zp_x_8.a),
    is_shift_zp_x_signal.out.to(is_zp_x_8.b, out.is_shift_zp_x, is_rmw_shift_temp.b),
    is_zp_x_8.out.to(is_zp_x_9.a),
    is_inc_dec_zp_x_signal.out.to(is_zp_x_9.b, out.is_inc_dec_zp_x, is_rmw_inc_dec_temp.b),
    is_zp_x_9.out.to(is_zp_x_10.a),
    cmp_ldy_zp_x.eq.to(is_zp_x_10.b, out.is_ldy_zp_x),
    is_zp_x_10.out.to(is_zp_x_final.a),
    cmp_sty_zp_x.eq.to(is_zp_x_final.b, out.is_sty_zp_x),
    is_zp_x_final.out.to(out.is_zp_x, is_zp_10.b, is_zp_x_load.a),
    LDX_ZP_Y.out.to(cmp_ldx_zp_y.b),
    cmp_ldx_zp_y.eq.to(out.is_ldx_zp_y, is_zp_y_final.a, mem_read_zp_y.b, is_zp_xy_flags.b, write_x_ldx_zp_y.b),
    STX_ZP_Y.out.to(cmp_stx_zp_y.b),
    cmp_stx_zp_y.eq.to(out.is_stx_zp_y, is_zp_y_final.b, is_store_zp.b, is_stx_any.b),
    is_zp_y_final.out.to(out.is_zp_y, is_zp_11.b),
    LDA_ABS_Y.out.to(cmp_lda_abs_y.b),
    cmp_lda_abs_y.eq.to(out.is_lda_abs_y, is_abs_y_1.a, is_abs_y_flags_1.a, is_abs_y_write_a_1.a),
    STA_ABS_Y.out.to(cmp_sta_abs_y.b),
    cmp_sta_abs_y.eq.to(out.is_sta_abs_y, is_abs_y_1.b, not_sta_abs_y.in, mem_write_abs_y.b),
    ADC_ABS_Y.out.to(cmp_adc_abs_y.b),
    cmp_adc_abs_y.eq.to(out.is_adc_abs_y, is_abs_y_2.b, is_abs_y_flags_1.b, is_abs_y_write_a_1.b),
    SBC_ABS_Y.out.to(cmp_sbc_abs_y.b),
    cmp_sbc_abs_y.eq.to(out.is_sbc_abs_y, is_abs_y_3.b, is_abs_y_flags_2.b, is_abs_y_write_a_2.b),
    AND_ABS_Y.out.to(cmp_and_abs_y.b),
    cmp_and_abs_y.eq.to(out.is_and_abs_y, is_abs_y_4.b, is_abs_y_flags_3.b, is_abs_y_write_a_3.b),
    ORA_ABS_Y.out.to(cmp_ora_abs_y.b),
    cmp_ora_abs_y.eq.to(out.is_ora_abs_y, is_abs_y_5.b, is_abs_y_flags_4.b, is_abs_y_write_a_4.b),
    EOR_ABS_Y.out.to(cmp_eor_abs_y.b),
    cmp_eor_abs_y.eq.to(out.is_eor_abs_y, is_abs_y_6.b, is_abs_y_flags_5.b, is_abs_y_write_a.b),
    CMP_ABS_Y.out.to(cmp_cmp_abs_y.b),
    cmp_cmp_abs_y.eq.to(out.is_cmp_abs_y, is_abs_y_7.b, is_abs_y_flags_6.b),
    LDX_ABS_Y.out.to(cmp_ldx_abs_y.b),
    cmp_ldx_abs_y.eq.to(out.is_ldx_abs_y, is_abs_y_final.b, is_abs_y_flags.b, write_x_ldx_abs_y.b),
    is_abs_y_1.out.to(is_abs_y_2.a),
    is_abs_y_2.out.to(is_abs_y_3.a),
    is_abs_y_3.out.to(is_abs_y_4.a),
    is_abs_y_4.out.to(is_abs_y_5.a),
    is_abs_y_5.out.to(is_abs_y_6.a),
    is_abs_y_6.out.to(is_abs_y_7.a),
    is_abs_y_7.out.to(is_abs_y_final.a),
    is_abs_y_final.out.to(out.is_abs_y, is_abs_temp4.b, is_abs_y_load.a),
    LDA_IND_X.out.to(cmp_lda_ind_x.b),
    cmp_lda_ind_x.eq.to(out.is_lda_ind_x, is_ind_x_1.a, is_ind_x_flags_1.a, is_ind_x_write_a_1.a),
    STA_IND_X.out.to(cmp_sta_ind_x.b),
    cmp_sta_ind_x.eq.to(out.is_sta_ind_x, is_ind_x_1.b, mem_write_ind_x.b),
    ADC_IND_X.out.to(cmp_adc_ind_x.b),
    cmp_adc_ind_x.eq.to(out.is_adc_ind_x, is_ind_x_2.b, is_ind_x_flags_1.b, is_ind_x_write_a_1.b),
    SBC_IND_X.out.to(cmp_sbc_ind_x.b),
    cmp_sbc_ind_x.eq.to(out.is_sbc_ind_x, is_ind_x_3.b, is_ind_x_flags_2.b, is_ind_x_write_a_2.b),
    AND_IND_X.out.to(cmp_and_ind_x.b),
    cmp_and_ind_x.eq.to(out.is_and_ind_x, is_ind_x_4.b, is_ind_x_flags_3.b, is_ind_x_write_a_3.b),
    ORA_IND_X.out.to(cmp_ora_ind_x.b),
    cmp_ora_ind_x.eq.to(out.is_ora_ind_x, is_ind_x_5.b, is_ind_x_flags_4.b, is_ind_x_write_a_4.b),
    EOR_IND_X.out.to(cmp_eor_ind_x.b),
    cmp_eor_ind_x.eq.to(out.is_eor_ind_x, is_ind_x_6.b, is_ind_x_flags_5.b, is_ind_x_write_a.b),
    CMP_IND_X.out.to(cmp_cmp_ind_x.b),
    cmp_cmp_ind_x.eq.to(out.is_cmp_ind_x, is_ind_x_final.b, is_ind_x_flags.b),
    is_ind_x_1.out.to(is_ind_x_2.a),
    is_ind_x_2.out.to(is_ind_x_3.a),
    is_ind_x_3.out.to(is_ind_x_4.a),
    is_ind_x_4.out.to(is_ind_x_5.a),
    is_ind_x_5.out.to(is_ind_x_6.a),
    is_ind_x_6.out.to(is_ind_x_final.a),
    is_ind_x_final.out.to(out.is_ind_x, done_ind_x.b, needs_operand_temp4.b, ptr_lo_load_ind_x.b, ptr_hi_load_ind_x.b, ind_x_sub3_signal.b, ind_x_sub4_signal.b, ind_x_sub5_signal.b),
    LDA_IND_Y.out.to(cmp_lda_ind_y.b),
    cmp_lda_ind_y.eq.to(out.is_lda_ind_y, is_ind_y_1.a, is_ind_y_flags_1.a, is_ind_y_write_a_1.a),
    STA_IND_Y.out.to(cmp_sta_ind_y.b),
    cmp_sta_ind_y.eq.to(out.is_sta_ind_y, is_ind_y_1.b, mem_write_ind_y.b),
    ADC_IND_Y.out.to(cmp_adc_ind_y.b),
    cmp_adc_ind_y.eq.to(out.is_adc_ind_y, is_ind_y_2.b, is_ind_y_flags_1.b, is_ind_y_write_a_1.b),
    SBC_IND_Y.out.to(cmp_sbc_ind_y.b),
    cmp_sbc_ind_y.eq.to(out.is_sbc_ind_y, is_ind_y_3.b, is_ind_y_flags_2.b, is_ind_y_write_a_2.b),
    AND_IND_Y.out.to(cmp_and_ind_y.b),
    cmp_and_ind_y.eq.to(out.is_and_ind_y, is_ind_y_4.b, is_ind_y_flags_3.b, is_ind_y_write_a_3.b),
    ORA_IND_Y.out.to(cmp_ora_ind_y.b),
    cmp_ora_ind_y.eq.to(out.is_ora_ind_y, is_ind_y_5.b, is_ind_y_flags_4.b, is_ind_y_write_a_4.b),
    EOR_IND_Y.out.to(cmp_eor_ind_y.b),
    cmp_eor_ind_y.eq.to(out.is_eor_ind_y, is_ind_y_6.b, is_ind_y_flags_5.b, is_ind_y_write_a.b),
    CMP_IND_Y.out.to(cmp_cmp_ind_y.b),
    cmp_cmp_ind_y.eq.to(out.is_cmp_ind_y, is_ind_y_final.b, is_ind_y_flags.b),
    is_ind_y_1.out.to(is_ind_y_2.a),
    is_ind_y_2.out.to(is_ind_y_3.a),
    is_ind_y_3.out.to(is_ind_y_4.a),
    is_ind_y_4.out.to(is_ind_y_5.a),
    is_ind_y_5.out.to(is_ind_y_6.a),
    is_ind_y_6.out.to(is_ind_y_final.a),
    is_ind_y_final.out.to(out.is_ind_y, done_ind_y.b, needs_operand_temp5.b, ptr_lo_load_ind_y.b, ptr_hi_load_ind_y.b, ind_y_sub2_signal.b, ind_y_sub3_signal.b, ind_y_sub4_signal.b, ind_y_sub5_signal.b),
    BIT_ZP.out.to(cmp_bit_zp.b),
    cmp_bit_zp.eq.to(out.is_bit_zp, is_zp_12.b, update_flags_bit_zp.b),
    BIT_ABS.out.to(cmp_bit_abs.b),
    cmp_bit_abs.eq.to(out.is_bit_abs, is_abs_temp5.b, update_flags_bit_abs.b),
    PHP.out.to(cmp_php.b),
    cmp_php.eq.to(out.is_php, done_php.b, sp_dec_php.b, stack_write_php.b),
    PLP.out.to(cmp_plp.b),
    cmp_plp.eq.to(out.is_plp, done_plp.b, sp_inc_plp.b, update_flags_plp_signal.b),
    JMP_IND.out.to(cmp_jmp_ind.b),
    cmp_jmp_ind.eq.to(out.is_jmp_ind, done_jmp_ind.b, needs_operand.b, needs_2nd_byte.b, jmp_ind_load_pc_signal.b, ptr_lo_load_jmp_ind.b, ptr_hi_load_jmp_ind.b, jmp_ind_sub2_signal.b, jmp_ind_sub3_signal.b),
    RTI.out.to(cmp_rti.b),
    cmp_rti.eq.to(out.is_rti, done_rti.b, sp_inc_rti_sub0.b, sp_inc_rti_sub2.b, sp_inc_rti_sub4.b, rti_load_pc_signal.b, rti_pull_p_signal.b, update_flags_rti_signal.b, pull_pc_lo_rti.b, pull_pc_hi_rti.b),
    ASL_ZP_X.out.to(cmp_asl_zp_x.b),
    cmp_asl_zp_x.eq.to(out.is_asl_zp_x, is_shift_zp_x_temp.a),
    LSR_ZP_X.out.to(cmp_lsr_zp_x.b),
    cmp_lsr_zp_x.eq.to(out.is_lsr_zp_x, is_shift_zp_x_temp.b),
    ROL_ZP_X.out.to(cmp_rol_zp_x.b),
    cmp_rol_zp_x.eq.to(out.is_rol_zp_x, is_shift_zp_x_temp2.b),
    ROR_ZP_X.out.to(cmp_ror_zp_x.b),
    cmp_ror_zp_x.eq.to(out.is_ror_zp_x, is_shift_zp_x_signal.b),
    ASL_ABS.out.to(cmp_asl_abs.b),
    cmp_asl_abs.eq.to(out.is_asl_abs, is_shift_abs_temp.a),
    LSR_ABS.out.to(cmp_lsr_abs.b),
    cmp_lsr_abs.eq.to(out.is_lsr_abs, is_shift_abs_temp.b),
    ROL_ABS.out.to(cmp_rol_abs.b),
    cmp_rol_abs.eq.to(out.is_rol_abs, is_shift_abs_temp2.b),
    ROR_ABS.out.to(cmp_ror_abs.b),
    cmp_ror_abs.eq.to(out.is_ror_abs, is_shift_abs_signal.b),
    ASL_ABS_X.out.to(cmp_asl_abs_x.b),
    cmp_asl_abs_x.eq.to(out.is_asl_abs_x, is_shift_abs_x_temp.a),
    LSR_ABS_X.out.to(cmp_lsr_abs_x.b),
    cmp_lsr_abs_x.eq.to(out.is_lsr_abs_x, is_shift_abs_x_temp.b),
    ROL_ABS_X.out.to(cmp_rol_abs_x.b),
    cmp_rol_abs_x.eq.to(out.is_rol_abs_x, is_shift_abs_x_temp2.b),
    ROR_ABS_X.out.to(cmp_ror_abs_x.b),
    cmp_ror_abs_x.eq.to(out.is_ror_abs_x, is_shift_abs_x_signal.b),
    is_shift_zp_x_temp.out.to(is_shift_zp_x_temp2.a),
    is_shift_zp_x_temp2.out.to(is_shift_zp_x_signal.a),
    is_shift_abs_temp.out.to(is_shift_abs_temp2.a),
    is_shift_abs_temp2.out.to(is_shift_abs_signal.a),
    is_shift_abs_signal.out.to(out.is_shift_abs, is_rmw_shift_temp2.b, is_abs_temp6.b),
    is_shift_abs_x_temp.out.to(is_shift_abs_x_temp2.a),
    is_shift_abs_x_temp2.out.to(is_shift_abs_x_signal.a),
    is_shift_abs_x_signal.out.to(out.is_shift_abs_x, is_rmw_shift.b, is_abs_temp7.b),
    INC_ZP_X.out.to(cmp_inc_zp_x.b),
    cmp_inc_zp_x.eq.to(out.is_inc_zp_x, is_inc_dec_zp_x_signal.a),
    DEC_ZP_X.out.to(cmp_dec_zp_x.b),
    cmp_dec_zp_x.eq.to(out.is_dec_zp_x, is_inc_dec_zp_x_signal.b),
    INC_ABS.out.to(cmp_inc_abs.b),
    cmp_inc_abs.eq.to(out.is_inc_abs, is_inc_dec_abs_signal.a),
    DEC_ABS.out.to(cmp_dec_abs.b),
    cmp_dec_abs.eq.to(out.is_dec_abs, is_inc_dec_abs_signal.b),
    INC_ABS_X.out.to(cmp_inc_abs_x.b),
    cmp_inc_abs_x.eq.to(out.is_inc_abs_x, is_inc_dec_abs_x_signal.a),
    DEC_ABS_X.out.to(cmp_dec_abs_x.b),
    cmp_dec_abs_x.eq.to(out.is_dec_abs_x, is_inc_dec_abs_x_signal.b),
    is_inc_dec_abs_signal.out.to(out.is_inc_dec_abs, is_rmw_inc_dec_temp2.b, is_abs_temp8.b),
    is_inc_dec_abs_x_signal.out.to(out.is_inc_dec_abs_x, is_rmw_inc_dec.b, is_abs_temp9.b),
    CPX_ZP.out.to(cmp_cpx_zp.b),
    cmp_cpx_zp.eq.to(out.is_cpx_zp, is_zp_13.b),
    CPY_ZP.out.to(cmp_cpy_zp.b),
    cmp_cpy_zp.eq.to(out.is_cpy_zp, is_zp_14.b),
    CPX_ABS.out.to(cmp_cpx_abs.b),
    cmp_cpx_abs.eq.to(out.is_cpx_abs, is_abs_temp10.b),
    CPY_ABS.out.to(cmp_cpy_abs.b),
    cmp_cpy_abs.eq.to(out.is_cpy_abs, is_abs_temp11.b),
    LDX_ZP.out.to(cmp_ldx_zp.b),
    cmp_ldx_zp.eq.to(out.is_ldx_zp, is_zp_15.b),
    LDX_ABS.out.to(cmp_ldx_abs.b),
    cmp_ldx_abs.eq.to(out.is_ldx_abs, is_abs_temp12.b),
    LDY_ZP.out.to(cmp_ldy_zp.b),
    cmp_ldy_zp.eq.to(out.is_ldy_zp, is_zp.b),
    LDY_ZP_X.out.to(cmp_ldy_zp_x.b),
    LDY_ABS.out.to(cmp_ldy_abs.b),
    cmp_ldy_abs.eq.to(out.is_ldy_abs, is_abs_temp13.b),
    LDY_ABS_X.out.to(cmp_ldy_abs_x.b),
    cmp_ldy_abs_x.eq.to(out.is_ldy_abs_x, is_abs_temp14.b),
    STX_ABS.out.to(cmp_stx_abs.b),
    cmp_stx_abs.eq.to(out.is_stx_abs, is_abs_temp15.b),
    STY_ZP_X.out.to(cmp_sty_zp_x.b),
    STY_ABS.out.to(cmp_sty_abs.b),
    cmp_sty_abs.eq.to(out.is_sty_abs, is_abs_final.b),
    is_rmw_inc_dec_zp.out.to(is_rmw_inc_dec_temp.a),
    is_rmw_inc_dec_temp.out.to(is_rmw_inc_dec_temp2.a),
    is_rmw_inc_dec_temp2.out.to(is_rmw_inc_dec.a),
    is_rmw_asl_lsr.out.to(is_rmw_shift_zp.a),
    is_rmw_rol_ror.out.to(is_rmw_shift_zp.b),
    is_rmw_shift_zp.out.to(is_rmw_shift_temp.a),
    is_rmw_shift_temp.out.to(is_rmw_shift_temp2.a),
    is_rmw_shift_temp2.out.to(is_rmw_shift.a),
    is_rmw_inc_dec.out.to(is_rmw.a),
    is_rmw_shift.out.to(is_rmw.b),
    is_rmw.out.to(out.mem_rmw, not_rmw.in, done_rmw.b, mem_read_rmw.b, mem_write_rmw.b, update_flags_rmw.b),
    is_imm_lda.out.to(is_imm_lda_2.a),
    is_imm_lda_2.out.to(is_imm_lda_3.a),
    is_imm_lda_3.out.to(is_imm_lda_4.a),
    is_imm_lda_4.out.to(is_imm_lda_5.a, write_a_imm.b),
    is_imm_lda_5.out.to(is_imm_any_1.a, update_flags_lda.b),
    is_imm_any_1.out.to(is_imm_any_2.a),
    is_imm_any_2.out.to(is_imm_any_3.a),
    is_imm_any_3.out.to(is_imm_any_4.a),
    is_imm_any_4.out.to(is_imm_any.a),
    is_zp_1.out.to(is_zp_2.a),
    is_zp_2.out.to(is_zp_3.a),
    is_zp_3.out.to(is_zp_4.a),
    is_zp_4.out.to(is_zp_5.a),
    is_zp_5.out.to(is_zp_6.a),
    is_zp_6.out.to(is_zp_7.a),
    is_zp_7.out.to(is_zp_8.a),
    is_zp_8.out.to(is_zp_9.a),
    is_zp_9.out.to(is_zp_10.a),
    is_zp_10.out.to(is_zp_11.a),
    is_zp_11.out.to(is_zp_12.a),
    is_zp_12.out.to(is_zp_13.a),
    is_zp_13.out.to(is_zp_14.a),
    is_zp_14.out.to(is_zp_15.a),
    is_zp_15.out.to(is_zp.a),
    is_abs_temp.out.to(is_abs_temp2.a),
    is_abs_temp2.out.to(is_abs_temp3.a),
    is_abs_temp3.out.to(is_abs_temp4.a),
    is_abs_temp4.out.to(is_abs_temp5.a),
    is_abs_temp5.out.to(is_abs_temp6.a),
    is_abs_temp6.out.to(is_abs_temp7.a),
    is_abs_temp7.out.to(is_abs_temp8.a),
    is_abs_temp8.out.to(is_abs_temp9.a),
    is_abs_temp9.out.to(is_abs_temp10.a),
    is_abs_temp10.out.to(is_abs_temp11.a),
    is_abs_temp11.out.to(is_abs_temp12.a),
    is_abs_temp12.out.to(is_abs_temp13.a),
    is_abs_temp13.out.to(is_abs_temp14.a),
    is_abs_temp14.out.to(is_abs_temp15.a),
    is_abs_temp15.out.to(is_abs_final.a),
    is_1cycle_1.out.to(is_1cycle_2.a),
    is_1cycle_2.out.to(is_1cycle_3.a),
    is_1cycle_3.out.to(is_1cycle_4.a),
    is_1cycle_4.out.to(is_1cycle_5.a),
    is_1cycle_5.out.to(is_1cycle_6.a),
    is_1cycle_6.out.to(is_1cycle_7.a),
    is_1cycle_7.out.to(is_1cycle_8.a),
    is_1cycle_8.out.to(is_1cycle_9.a),
    is_1cycle_9.out.to(is_1cycle_10.a),
    is_1cycle_10.out.to(is_1cycle_11.a),
    is_1cycle_11.out.to(is_1cycle_12.a),
    is_1cycle_12.out.to(is_1cycle_13.a),
    is_1cycle_13.out.to(is_1cycle_14.a),
    is_1cycle_14.out.to(is_1cycle_15.a),
    is_1cycle_15.out.to(is_1cycle_16.a),
    is_1cycle_16.out.to(is_1cycle_17.a),
    is_1cycle_17.out.to(is_1cycle_18.a),
    is_1cycle_18.out.to(is_1cycle_19.a),
    is_1cycle_19.out.to(is_1cycle.a),
    is_branch_1.out.to(is_branch_2.a),
    is_branch_2.out.to(is_branch_3.a),
    is_branch_3.out.to(is_branch_4.a),
    is_branch_4.out.to(is_branch_5.a),
    is_branch_5.out.to(is_branch_6.a),
    is_branch_6.out.to(is_branch.a),
    inp.flag_z.to(beq_cond.b, not_z.in),
    not_z.out.to(bne_cond.b),
    inp.flag_c.to(not_c.in, bcs_cond.b),
    not_c.out.to(bcc_cond.b),
    inp.flag_n.to(bmi_cond.b, not_n.in),
    not_n.out.to(bpl_cond.b),
    inp.flag_v.to(not_v.in, bvs_cond.b),
    not_v.out.to(bvc_cond.b),
    beq_cond.out.to(branch_cond_1.a),
    bne_cond.out.to(branch_cond_1.b),
    branch_cond_1.out.to(branch_cond_2.a),
    bcc_cond.out.to(branch_cond_2.b),
    branch_cond_2.out.to(branch_cond_3.a),
    bcs_cond.out.to(branch_cond_3.b),
    branch_cond_3.out.to(branch_cond_4.a),
    bmi_cond.out.to(branch_cond_4.b),
    branch_cond_4.out.to(branch_cond_5.a),
    bpl_cond.out.to(branch_cond_5.b),
    branch_cond_5.out.to(branch_cond_6.a),
    bvc_cond.out.to(branch_cond_6.b),
    branch_cond_6.out.to(branch_taken.a),
    bvs_cond.out.to(branch_taken.b),
    subcycle_reg.q.to(inc_subcycle.in, out.exec_subcycle, is_sub0.a, is_sub1.a, is_sub2.a, is_sub3.a, is_sub4.a, is_sub5.a),
    is_execute.eq.to(subcycle_increment.sel, exec_sub0.a, exec_sub1.a, exec_sub2.a, exec_sub3.a, exec_sub4.a, exec_sub5.a),
    zero.out.to(subcycle_increment.in0, is_sub0.b),
    inc_subcycle.out.to(subcycle_increment.in1),
    subcycle_increment.out.to(subcycle_reg.data),
    always_on.out.to(subcycle_reg.we, state_reg.we),
    one.out.to(is_sub1.b),
    two.out.to(is_sub2.b),
    three.out.to(is_sub3.b),
    four.out.to(is_sub4.b),
    five.out.to(is_sub5.b),
    is_fetch.eq.to(next_from_fetch.sel, pc_inc_temp.a, out.ir_load),
    is_decode.eq.to(next_from_decode.sel),
    next_from_fetch.out.to(next_from_decode.in0),
    is_sub0.eq.to(exec_sub0.b),
    is_sub1.eq.to(exec_sub1.b),
    is_sub2.eq.to(exec_sub2.b),
    is_sub3.eq.to(exec_sub3.b),
    is_sub4.eq.to(exec_sub4.b),
    is_sub5.eq.to(exec_sub5.b),
    exec_sub1.out.to(done_imm.a, done_pha.a, done_php.a, done_branch.a, pc_inc_exec_sub1.a, addr_hi_load_signal.a, rti_pull_p_signal.a, update_flags_rti_signal.a, pull_pc_lo_rts.a, branch_at_sub1.a, update_flags_lda.a, update_flags_cmp.a, update_flags_ldy.a, update_flags_ldx.a, update_flags_bit_zp.a, write_a_imm.a, write_x_ldx_imm.a, write_y_ldy_imm.a),
    is_imm_any.out.to(done_imm.b, needs_operand_any.a),
    is_zp.out.to(is_zp_non_rmw.a, needs_operand_any.b),
    not_rmw.out.to(is_zp_non_rmw.b),
    exec_sub3.out.to(done_zp.a, mem_read_abs_temp.a, mem_read_abs_x.a, mem_read_abs_y.a, mem_write_abs_temp.a, mem_write_abs_x.a, mem_write_abs_y.a, mem_write_rmw.a, sp_dec_jsr_sub3.a, stack_write_jsr_lo.a, push_pc_lo_signal.a, pull_pc_lo_rti.a, pull_pc_hi_rts.a, update_flags_zp_xy.a, update_flags_rmw.a, ptr_lo_load_ind_x.a, ptr_hi_load_ind_y.a, ptr_hi_load_jmp_ind.a, ind_x_sub3_signal.a, ind_y_sub3_signal.a, jmp_ind_sub3_signal.a, write_a_zp.a, write_a_zp_x.a, write_x_ldx_zp_y.a),
    is_zp_non_rmw.out.to(done_zp.b),
    exec_sub4.out.to(done_rmw.a, done_abs.a, done_jmp_ind.a, sp_inc_rti_sub4.a, jsr_load_pc_signal.a, rts_load_pc_signal.a, jmp_ind_load_pc_signal.a, update_flags_abs_y.a, ptr_hi_load_ind_x.a, ind_x_sub4_signal.a, ind_y_sub4_signal.a, write_a_abs_temp.a, write_a_abs_x.a, write_a_abs_y.a, write_x_ldx_abs_y.a),
    is_abs_final.out.to(done_abs.b, needs_operand_temp.b, needs_2nd_byte_temp.a),
    exec_sub0.out.to(done_1cyc.a, pc_inc_exec_sub0.a, operand_load_signal.a, addr_lo_load_signal.a, sp_dec_pha.a, sp_dec_php.a, sp_inc_pla.a, sp_inc_plp.a, sp_inc_rts_sub0.a, sp_inc_rti_sub0.a, stack_write_pha.a, stack_write_php.a, update_flags_inx.a, update_c_only_signal.a, set_c_signal.a, clear_c_signal.a, clear_v_signal.a, set_d_signal.a, clear_d_signal.a, set_i_signal.a, clear_i_signal.a, sp_load_signal.a, write_a_txa.a, write_a_tya.a, write_a_shift.a, write_x_tax.a, write_x_inx.a, write_x_dex.a, write_x_tsx.a, write_y_iny.a, write_y_dey.a),
    is_1cycle.out.to(done_1cyc.b),
    exec_sub2.out.to(done_pla.a, done_plp.a, mem_read_zp.a, mem_read_zp_x.a, mem_read_zp_y.a, mem_read_rmw.a, mem_write_zp.a, use_x_for_mem_signal.a, use_y_for_mem_signal.a, sp_dec_jsr_sub2.a, sp_inc_rts_sub2.a, sp_inc_rti_sub2.a, stack_write_jsr_hi.a, use_stack_signal.a, update_flags_plp_signal.a, push_pc_hi_signal.a, update_flags_bit_abs.a, ptr_lo_load_ind_y.a, ptr_lo_load_jmp_ind.a, ind_y_sub2_signal.a, jmp_ind_sub2_signal.a, write_a_pla.a),
    exec_sub5.out.to(done_rti.a, done_jsr.a, done_rts.a, done_ind_x.a, done_ind_y.a, mem_write_ind_x.a, mem_write_ind_y.a, rti_load_pc_signal.a, pull_pc_hi_rti.a, update_flags_ind_x.a, update_flags_ind_y.a, ind_x_sub5_signal.a, ind_y_sub5_signal.a, write_a_ind_x.a, write_a_ind_y.a),
    is_branch.out.to(done_branch.b, needs_operand_temp3.b),
    done_imm.out.to(exec_done_temp1.a),
    done_zp.out.to(exec_done_temp1.b),
    exec_done_temp1.out.to(exec_done_temp2.a),
    done_abs.out.to(exec_done_temp2.b),
    exec_done_temp2.out.to(exec_done_temp3.a),
    done_1cyc.out.to(exec_done_temp3.b),
    exec_done_temp3.out.to(exec_done_temp4.a),
    done_pha.out.to(exec_done_temp4.b),
    exec_done_temp4.out.to(exec_done_temp5.a),
    done_pla.out.to(exec_done_temp5.b),
    exec_done_temp5.out.to(exec_done_temp6.a),
    done_jsr.out.to(exec_done_temp6.b),
    exec_done_temp6.out.to(exec_done_temp7.a),
    done_rts.out.to(exec_done_temp7.b),
    exec_done_temp7.out.to(exec_done_temp8.a),
    done_branch.out.to(exec_done_temp8.b),
    exec_done_temp8.out.to(exec_done_temp9.a),
    done_rmw.out.to(exec_done_temp9.b),
    exec_done_temp9.out.to(exec_done_temp10.a),
    done_ind_x.out.to(exec_done_temp10.b),
    exec_done_temp10.out.to(exec_done_temp11.a),
    done_ind_y.out.to(exec_done_temp11.b),
    exec_done_temp11.out.to(exec_done_temp12.a),
    done_php.out.to(exec_done_temp12.b),
    exec_done_temp12.out.to(exec_done_temp13.a),
    done_plp.out.to(exec_done_temp13.b),
    exec_done_temp13.out.to(exec_done_temp14.a),
    done_jmp_ind.out.to(exec_done_temp14.b),
    exec_done_temp14.out.to(exec_done.a),
    done_rti.out.to(exec_done.b),
    exec_done.out.to(next_from_execute.sel),
    next_from_decode.out.to(next_from_execute.in0),
    inp.reset.to(next_state.sel),
    next_from_execute.out.to(next_state.in0),
    next_state.out.to(state_reg.data),
    needs_operand_any.out.to(needs_operand_temp.a),
    needs_operand_temp.out.to(needs_operand_temp2.a),
    needs_operand_temp2.out.to(needs_operand_temp3.a),
    needs_operand_temp3.out.to(needs_operand_temp4.a),
    needs_operand_temp4.out.to(needs_operand_temp5.a),
    needs_operand_temp5.out.to(needs_operand.a),
    needs_operand.out.to(pc_inc_exec_sub0.b, operand_load_signal.b, addr_lo_load_signal.b),
    needs_2nd_byte_temp.out.to(needs_2nd_byte.a),
    needs_2nd_byte.out.to(pc_inc_exec_sub1.b, addr_hi_load_signal.b),
    pc_inc_exec_sub0.out.to(pc_inc_temp.b),
    pc_inc_temp.out.to(pc_inc_signal.a),
    pc_inc_exec_sub1.out.to(pc_inc_signal.b),
    pc_inc_signal.out.to(out.pc_increment),
    operand_load_signal.out.to(out.operand_load),
    addr_lo_load_signal.out.to(out.addr_lo_load),
    addr_hi_load_signal.out.to(out.addr_hi_load),
    is_load.out.to(is_load_final.a),
    not_sta_zp_x.out.to(is_zp_x_load.b),
    is_zp_x_load.out.to(mem_read_zp_x.b),
    not_sta_abs_y.out.to(is_abs_y_load.b),
    is_abs_y_load.out.to(mem_read_abs_y.b),
    mem_read_abs_temp.out.to(mem_read_abs_1.a),
    mem_read_abs_x.out.to(mem_read_abs_1.b),
    mem_read_abs_1.out.to(mem_read_abs.a),
    mem_read_abs_y.out.to(mem_read_abs.b),
    mem_read_zp.out.to(mem_read_signal_temp1.a),
    mem_read_zp_x.out.to(mem_read_signal_temp1.b),
    mem_read_signal_temp1.out.to(mem_read_signal_temp1b.a),
    mem_read_zp_y.out.to(mem_read_signal_temp1b.b),
    mem_read_signal_temp1b.out.to(mem_read_signal_temp2.a),
    mem_read_abs.out.to(mem_read_signal_temp2.b),
    mem_read_signal_temp2.out.to(mem_read_signal.a),
    mem_read_rmw.out.to(mem_read_signal.b),
    mem_read_signal.out.to(out.mem_read),
    is_store_zp_1.out.to(is_store_zp_2.a),
    is_store_zp_2.out.to(is_store_zp_3.a),
    is_store_zp_3.out.to(is_store_zp.a),
    is_store_zp.out.to(mem_write_zp.b),
    is_stx_any.out.to(use_x_for_mem_signal.b),
    use_x_for_mem_signal.out.to(out.use_x_for_mem),
    use_y_for_mem_signal.out.to(out.use_y_for_mem),
    mem_write_abs_temp.out.to(mem_write_abs_1.a),
    mem_write_abs_x.out.to(mem_write_abs_1.b),
    mem_write_abs_1.out.to(mem_write_abs.a),
    mem_write_abs_y.out.to(mem_write_abs.b),
    mem_write_zp.out.to(mem_write_signal_temp.a),
    mem_write_abs.out.to(mem_write_signal_temp.b),
    mem_write_signal_temp.out.to(mem_write_signal_temp2.a),
    mem_write_rmw.out.to(mem_write_signal_temp2.b, out.use_rmw_data),
    mem_write_signal_temp2.out.to(mem_write_signal_temp3.a),
    mem_write_ind_x.out.to(mem_write_signal_temp3.b),
    mem_write_signal_temp3.out.to(mem_write_signal.a),
    mem_write_ind_y.out.to(mem_write_signal.b),
    mem_write_signal.out.to(out.mem_write),
    sp_dec_pha.out.to(sp_dec_temp.a),
    sp_dec_jsr_sub2.out.to(sp_dec_temp.b),
    sp_dec_temp.out.to(sp_dec_temp2.a),
    sp_dec_jsr_sub3.out.to(sp_dec_temp2.b),
    sp_dec_temp2.out.to(sp_dec_signal.a),
    sp_dec_php.out.to(sp_dec_signal.b),
    sp_dec_signal.out.to(out.sp_decrement),
    sp_inc_pla.out.to(sp_inc_temp.a),
    sp_inc_rts_sub0.out.to(sp_inc_temp.b),
    sp_inc_temp.out.to(sp_inc_temp2.a),
    sp_inc_rts_sub2.out.to(sp_inc_temp2.b),
    sp_inc_temp2.out.to(sp_inc_temp3.a),
    sp_inc_plp.out.to(sp_inc_temp3.b),
    sp_inc_temp3.out.to(sp_inc_temp4.a),
    sp_inc_rti_sub0.out.to(sp_inc_temp4.b),
    sp_inc_temp4.out.to(sp_inc_temp5.a),
    sp_inc_rti_sub2.out.to(sp_inc_temp5.b),
    sp_inc_temp5.out.to(sp_inc_signal.a),
    sp_inc_rti_sub4.out.to(sp_inc_signal.b),
    sp_inc_signal.out.to(out.sp_increment),
    stack_write_pha.out.to(stack_write_temp.a),
    stack_write_jsr_hi.out.to(stack_write_temp.b),
    stack_write_temp.out.to(stack_write_temp2.a),
    stack_write_jsr_lo.out.to(stack_write_temp2.b),
    stack_write_temp2.out.to(stack_write_signal.a),
    stack_write_php.out.to(stack_write_signal.b),
    stack_write_signal.out.to(out.stack_write),
    use_stack_signal.out.to(out.use_stack_data),
    update_flags_plp_signal.out.to(out.update_flags_plp),
    jsr_load_pc_signal.out.to(out.jsr_load_pc),
    rts_load_pc_signal.out.to(out.rts_load_pc),
    jmp_ind_load_pc_signal.out.to(out.jmp_ind_load_pc),
    rti_load_pc_signal.out.to(out.rti_load_pc),
    rti_pull_p_signal.out.to(out.rti_pull_p),
    update_flags_rti_signal.out.to(out.update_flags_rti),
    push_pc_hi_signal.out.to(out.push_pc_hi),
    push_pc_lo_signal.out.to(out.push_pc_lo),
    pull_pc_lo_rts.out.to(pull_pc_lo_signal.a),
    pull_pc_lo_rti.out.to(pull_pc_lo_signal.b),
    pull_pc_lo_signal.out.to(out.pull_pc_lo),
    pull_pc_hi_rts.out.to(pull_pc_hi_signal.a),
    pull_pc_hi_rti.out.to(pull_pc_hi_signal.b),
    pull_pc_hi_signal.out.to(out.pull_pc_hi),
    branch_taken.out.to(branch_at_sub1.b),
    branch_at_sub1.out.to(out.branch_load_pc),
    is_any_compare.out.to(is_any_compare_2.a),
    is_any_compare_2.out.to(update_flags_cmp.b),
    is_zp_x_flags_1.out.to(is_zp_x_flags_2.a),
    is_zp_x_flags_2.out.to(is_zp_x_flags_3.a),
    is_zp_x_flags_3.out.to(is_zp_x_flags_4.a),
    is_zp_x_flags_4.out.to(is_zp_x_flags_5.a),
    is_zp_x_flags_5.out.to(is_zp_x_flags_6.a),
    is_zp_x_flags_6.out.to(is_zp_xy_flags.a),
    is_zp_xy_flags.out.to(update_flags_zp_xy.b),
    is_abs_y_flags_1.out.to(is_abs_y_flags_2.a),
    is_abs_y_flags_2.out.to(is_abs_y_flags_3.a),
    is_abs_y_flags_3.out.to(is_abs_y_flags_4.a),
    is_abs_y_flags_4.out.to(is_abs_y_flags_5.a),
    is_abs_y_flags_5.out.to(is_abs_y_flags_6.a),
    is_abs_y_flags_6.out.to(is_abs_y_flags.a),
    is_abs_y_flags.out.to(update_flags_abs_y.b),
    is_ind_x_flags_1.out.to(is_ind_x_flags_2.a),
    is_ind_x_flags_2.out.to(is_ind_x_flags_3.a),
    is_ind_x_flags_3.out.to(is_ind_x_flags_4.a),
    is_ind_x_flags_4.out.to(is_ind_x_flags_5.a),
    is_ind_x_flags_5.out.to(is_ind_x_flags.a),
    is_ind_x_flags.out.to(update_flags_ind_x.b),
    is_ind_y_flags_1.out.to(is_ind_y_flags_2.a),
    is_ind_y_flags_2.out.to(is_ind_y_flags_3.a),
    is_ind_y_flags_3.out.to(is_ind_y_flags_4.a),
    is_ind_y_flags_4.out.to(is_ind_y_flags_5.a),
    is_ind_y_flags_5.out.to(is_ind_y_flags.a),
    is_ind_y_flags.out.to(update_flags_ind_y.b),
    is_reg_inc_dec.out.to(is_reg_inc_dec_2.a),
    is_reg_inc_dec_2.out.to(is_reg_inc_dec_3.a),
    is_reg_inc_dec_3.out.to(is_reg_inc_dec_4.a),
    is_reg_inc_dec_4.out.to(is_reg_inc_dec_5.a),
    is_reg_inc_dec_5.out.to(is_reg_inc_dec_6.a),
    is_reg_inc_dec_6.out.to(is_reg_inc_dec_7.a),
    is_reg_inc_dec_7.out.to(is_reg_inc_dec_8.a),
    is_reg_inc_dec_8.out.to(is_reg_inc_dec_9.a),
    is_reg_inc_dec_9.out.to(is_reg_inc_dec_10.a),
    is_reg_inc_dec_10.out.to(update_flags_inx.b),
    update_flags_lda.out.to(update_flags_temp.a),
    update_flags_cmp.out.to(update_flags_temp.b),
    update_flags_temp.out.to(update_flags_temp2.a),
    update_flags_ldy.out.to(update_flags_temp2.b),
    update_flags_temp2.out.to(update_flags_temp3.a),
    update_flags_ldx.out.to(update_flags_temp3.b),
    update_flags_temp3.out.to(update_flags_temp4.a),
    update_flags_inx.out.to(update_flags_temp4.b),
    update_flags_temp4.out.to(update_flags_temp5.a),
    update_flags_rmw.out.to(update_flags_temp5.b),
    update_flags_temp5.out.to(update_flags_temp6.a),
    update_flags_zp_xy.out.to(update_flags_temp6.b),
    update_flags_temp6.out.to(update_flags_temp7.a),
    update_flags_abs_y.out.to(update_flags_temp7.b),
    update_flags_temp7.out.to(update_flags_temp8.a),
    update_flags_ind_x.out.to(update_flags_temp8.b),
    update_flags_temp8.out.to(update_flags_temp9.a),
    update_flags_ind_y.out.to(update_flags_temp9.b),
    update_flags_bit_zp.out.to(update_flags_bit.a),
    update_flags_bit_abs.out.to(update_flags_bit.b),
    update_flags_temp9.out.to(update_flags_signal.a),
    update_flags_bit.out.to(update_flags_signal.b, out.update_v_bit),
    update_flags_signal.out.to(out.update_flags),
    is_sec_clc.out.to(update_c_only_signal.b),
    update_c_only_signal.out.to(out.update_c_only),
    set_c_signal.out.to(out.set_c),
    clear_c_signal.out.to(out.clear_c),
    clear_v_signal.out.to(out.clear_v),
    set_d_signal.out.to(out.set_d, update_d_signal.a),
    clear_d_signal.out.to(out.clear_d, update_d_signal.b),
    set_i_signal.out.to(out.set_i, update_i_signal.a),
    clear_i_signal.out.to(out.clear_i, update_i_signal.b),
    update_d_signal.out.to(out.update_d),
    update_i_signal.out.to(out.update_i),
    sp_load_signal.out.to(out.sp_load),
    ptr_lo_load_ind_x.out.to(ptr_lo_load_temp.a),
    ptr_lo_load_ind_y.out.to(ptr_lo_load_temp.b),
    ptr_lo_load_temp.out.to(ptr_lo_load_signal.a),
    ptr_lo_load_jmp_ind.out.to(ptr_lo_load_signal.b),
    ptr_lo_load_signal.out.to(out.ptr_lo_load),
    ptr_hi_load_ind_x.out.to(ptr_hi_load_temp.a),
    ptr_hi_load_ind_y.out.to(ptr_hi_load_temp.b),
    ptr_hi_load_temp.out.to(ptr_hi_load_signal.a),
    ptr_hi_load_jmp_ind.out.to(ptr_hi_load_signal.b),
    ptr_hi_load_signal.out.to(out.ptr_hi_load),
    ind_x_sub3_signal.out.to(out.ind_x_sub3),
    ind_x_sub4_signal.out.to(out.ind_x_sub4),
    ind_x_sub5_signal.out.to(out.ind_x_sub5),
    ind_y_sub2_signal.out.to(out.ind_y_sub2),
    ind_y_sub3_signal.out.to(out.ind_y_sub3),
    ind_y_sub4_signal.out.to(out.ind_y_sub4),
    ind_y_sub5_signal.out.to(out.ind_y_sub5),
    jmp_ind_sub2_signal.out.to(out.jmp_ind_sub2),
    jmp_ind_sub3_signal.out.to(out.jmp_ind_sub3),
    is_zp_x_write_a_1.out.to(is_zp_x_write_a_2.a),
    is_zp_x_write_a_2.out.to(is_zp_x_write_a_3.a),
    is_zp_x_write_a_3.out.to(is_zp_x_write_a_4.a),
    is_zp_x_write_a_4.out.to(is_zp_x_write_a.a),
    is_zp_x_write_a.out.to(write_a_zp_x.b),
    is_abs_y_write_a_1.out.to(is_abs_y_write_a_2.a),
    is_abs_y_write_a_2.out.to(is_abs_y_write_a_3.a),
    is_abs_y_write_a_3.out.to(is_abs_y_write_a_4.a),
    is_abs_y_write_a_4.out.to(is_abs_y_write_a.a),
    is_abs_y_write_a.out.to(write_a_abs_y.b),
    is_ind_x_write_a_1.out.to(is_ind_x_write_a_2.a),
    is_ind_x_write_a_2.out.to(is_ind_x_write_a_3.a),
    is_ind_x_write_a_3.out.to(is_ind_x_write_a_4.a),
    is_ind_x_write_a_4.out.to(is_ind_x_write_a.a),
    is_ind_x_write_a.out.to(write_a_ind_x.b),
    is_ind_y_write_a_1.out.to(is_ind_y_write_a_2.a),
    is_ind_y_write_a_2.out.to(is_ind_y_write_a_3.a),
    is_ind_y_write_a_3.out.to(is_ind_y_write_a_4.a),
    is_ind_y_write_a_4.out.to(is_ind_y_write_a.a),
    is_ind_y_write_a.out.to(write_a_ind_y.b),
    write_a_abs_temp.out.to(write_a_abs_temp2.a),
    write_a_abs_x.out.to(write_a_abs_temp2.b),
    write_a_abs_temp2.out.to(write_a_abs.a),
    write_a_abs_y.out.to(write_a_abs.b),
    write_a_zp.out.to(write_a_zp_all.a),
    write_a_zp_x.out.to(write_a_zp_all.b),
    write_a_imm.out.to(write_a_temp.a),
    write_a_zp_all.out.to(write_a_temp.b),
    write_a_temp.out.to(write_a_temp2.a),
    write_a_abs.out.to(write_a_temp2.b),
    write_a_temp2.out.to(write_a_temp3.a),
    write_a_pla.out.to(write_a_temp3.b),
    write_a_temp3.out.to(write_a_temp4.a),
    write_a_txa.out.to(write_a_temp4.b),
    write_a_temp4.out.to(write_a_temp5.a),
    write_a_tya.out.to(write_a_temp5.b),
    is_shift_rotate.out.to(is_shift_rotate_2.a),
    is_shift_rotate_2.out.to(is_shift_rotate_all.a),
    is_shift_rotate_all.out.to(write_a_shift.b),
    write_a_temp5.out.to(write_a_temp6.a),
    write_a_shift.out.to(write_a_temp6.b),
    write_a_temp6.out.to(write_a_temp7.a),
    write_a_ind_x.out.to(write_a_temp7.b),
    write_a_temp7.out.to(write_a_signal.a),
    write_a_ind_y.out.to(write_a_signal.b),
    write_a_signal.out.to(out.write_a),
    write_x_tax.out.to(write_x_temp.a),
    write_x_inx.out.to(write_x_temp.b),
    write_x_temp.out.to(write_x_temp2.a),
    write_x_dex.out.to(write_x_temp2.b),
    write_x_temp2.out.to(write_x_temp3.a),
    write_x_tsx.out.to(write_x_temp3.b),
    write_x_temp3.out.to(write_x_temp4.a),
    write_x_ldx_imm.out.to(write_x_temp4.b),
    write_x_temp4.out.to(write_x_temp5.a),
    write_x_ldx_zp_y.out.to(write_x_temp5.b),
    write_x_temp5.out.to(write_x_signal.a),
    write_x_ldx_abs_y.out.to(write_x_signal.b),
    write_x_signal.out.to(out.write_x),
    write_y_iny.out.to(write_y_temp.a),
    write_y_dey.out.to(write_y_temp.b),
    write_y_temp.out.to(write_y_signal.a),
    write_y_ldy_imm.out.to(write_y_signal.b),
    write_y_signal.out.to(out.write_y),
  ])
  .build()

const Stage6CPU = component('Stage6CPU')
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
  .out('reg_y', bus(8))
  .out('reg_sp', bus(8))
  .out('flag_n', bit)
  .out('flag_z', bit)
  .out('flag_c', bit)
  .out('flag_v', bit)
  .out('flag_d', bit)
  .out('flag_i', bit)
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
  .node('byte_0', Constant, { value: 56 })
  .node('byte_1', Constant, { value: 120 })
  .node('byte_2', Constant, { value: 8 })
  .node('byte_3', Constant, { value: 24 })
  .node('byte_4', Constant, { value: 88 })
  .node('byte_5', Constant, { value: 40 })
  .node('byte_6', Constant, { value: 169 })
  .node('byte_7', Constant, { value: 15 })
  .node('byte_8', Constant, { value: 41 })
  .node('byte_9', Constant, { value: 240 })
  .node('byte_10', Constant, { value: 9 })
  .node('byte_11', Constant, { value: 240 })
  .node('byte_12', Constant, { value: 200 })
  .node('byte_13', Constant, { value: 200 })
  .node('byte_14', Constant, { value: 202 })
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
  .node('addr_lo_reg', Register)
  .node('addr_hi_reg', Register)
  .node('pc_lo_temp', Register)
  .node('pc_hi_temp', Register)
  .node('flags', FlagRegister)
  .node('addr_with_x', Adder)
  .node('addr_with_y', Adder)
  .node('ind_x_zp_addr', Adder)
  .node('ind_x_zp_addr_plus1', Incrementer)
  .node('ptr_lo_reg', Register)
  .node('ptr_hi_reg', Register)
  .node('control', Stage6Control)
  .node('registers', RegisterFile)
  .node('sp', StackPointer)
  .node('sp_load_or_reset', Or)
  .node('sp_init', Constant, { value: 255 })
  .node('sp_load_value_mux', Mux)
  .node('stack', StackMemory)
  .node('pc_minus_1', Subtractor)
  .node('one_const', Constant, { value: 1 })
  .node('const_one', Constant, { value: 1 })
  .node('status_byte', Combiner8to8)
  .node('stack_data_pha_or_lo', Mux)
  .node('stack_data_with_php', Mux)
  .node('stack_data_final', Mux)
  .node('stack_bits', Splitter8to8)
  .node('use_indexed_x_temp', Or)
  .node('use_indexed_x_temp2', Or)
  .node('use_indexed_x_temp3', Or)
  .node('use_indexed_x', Or)
  .node('effective_addr_x', Mux)
  .node('use_indexed_y', Or)
  .node('effective_addr_y', Mux)
  .node('is_sta_abs_xy', Or)
  .node('sta_abs_addr', Mux)
  .node('effective_addr_final', Mux)
  .node('ind_x_addr_sub4', Mux)
  .node('ind_x_addr_sub5', Mux)
  .node('use_ind_x_addr', Or)
  .node('use_ind_x_addr_all', Or)
  .node('operand_plus_1', Incrementer)
  .node('ptr_with_y', Adder)
  .node('ind_y_addr_sub3', Mux)
  .node('ind_y_addr_sub5', Mux)
  .node('use_ind_y_addr', Or)
  .node('use_ind_y_addr_all', Or)
  .node('use_indirect_addr', Or)
  .node('indirect_addr', Mux)
  .node('memory_addr_temp', Mux)
  .node('addr_lo_plus_1', Incrementer)
  .node('jmp_ind_addr', Mux)
  .node('use_jmp_ind_addr', Or)
  .node('memory_addr', Mux)
  .node('memory', SimpleMemory)
  .node('mem_data_x_mux', Mux)
  .node('mem_data_y_mux', Mux)
  .node('inc_mem', Incrementer)
  .node('dec_mem', Subtractor)
  .node('mem_bits', Splitter8to8)
  .node('mem_shift_one', Constant, { value: 1 })
  .node('asl_mem_result', LeftShifter)
  .node('lsr_mem_result', RightShifter)
  .node('rol_mem_adder', Adder)
  .node('mem_c_times_128', Constant, { value: 128 })
  .node('ror_mem_add_val', Mux)
  .node('ror_mem_adder', Adder)
  .node('rmw_inc_or_dec', Mux)
  .node('rmw_or_asl', Mux)
  .node('rmw_or_lsr', Mux)
  .node('rmw_or_rol', Mux)
  .node('rmw_result', Mux)
  .node('mem_data_rmw_mux', Mux)
  .node('inc_x', Incrementer)
  .node('dec_x', Subtractor)
  .node('inc_y', Incrementer)
  .node('dec_y', Subtractor)
  .node('rts_pc_plus1', Incrementer)
  .node('branch_adder', Adder)
  .node('is_zp_x_alu', Or)
  .node('is_zp_x_alu_2', Or)
  .node('is_zp_x_alu_3', Or)
  .node('is_zp_x_alu_4', Or)
  .node('is_zp_x_alu_5', Or)
  .node('is_abs_y_alu_1', Or)
  .node('is_abs_y_alu_2', Or)
  .node('is_abs_y_alu_3', Or)
  .node('is_abs_y_alu_4', Or)
  .node('is_abs_y_alu', Or)
  .node('is_ind_x_alu_1', Or)
  .node('is_ind_x_alu_2', Or)
  .node('is_ind_x_alu_3', Or)
  .node('is_ind_x_alu_4', Or)
  .node('is_ind_x_alu', Or)
  .node('is_ind_y_alu_1', Or)
  .node('is_ind_y_alu_2', Or)
  .node('is_ind_y_alu_3', Or)
  .node('is_ind_y_alu_4', Or)
  .node('is_ind_y_alu', Or)
  .node('is_mem_alu_temp', Or)
  .node('is_mem_alu_temp2', Or)
  .node('is_mem_alu', Or)
  .node('alu_b_operand', Mux)
  .node('and_result', BusAnd)
  .node('ora_result', BusOr)
  .node('eor_result', BusXor)
  .node('not_carry', Not)
  .node('sbc_result', Subtractor)
  .node('adc_result', Adder)
  .node('operand_bits', Splitter8to8)
  .node('adc_result_bits', Splitter8to8)
  .node('sbc_result_bits', Splitter8to8)
  .node('a_reg_bits', Splitter8to8)
  .node('adc_a_xor_m', Xor)
  .node('adc_same_sign', Not)
  .node('adc_a_xor_result', Xor)
  .node('v_adc', And)
  .node('sbc_a_xor_result', Xor)
  .node('v_sbc', And)
  .node('a_bits', Splitter8to8)
  .node('shift_one', Constant, { value: 1 })
  .node('asl_result', LeftShifter)
  .node('lsr_result', RightShifter)
  .node('rol_adder', Adder)
  .node('c_times_128', Constant, { value: 128 })
  .node('ror_add_val', Mux)
  .node('ror_adder', Adder)
  .node('is_and_any_temp', Or)
  .node('is_and_any_temp2', Or)
  .node('is_and_any_temp3', Or)
  .node('is_and_any', Or)
  .node('is_ora_any_temp', Or)
  .node('is_ora_any_temp2', Or)
  .node('is_ora_any_temp3', Or)
  .node('is_ora_any', Or)
  .node('is_eor_any_temp', Or)
  .node('is_eor_any_temp2', Or)
  .node('is_eor_any_temp3', Or)
  .node('is_eor_any', Or)
  .node('is_sbc_any_temp', Or)
  .node('is_sbc_any_temp2', Or)
  .node('is_sbc_any_temp3', Or)
  .node('is_sbc_any', Or)
  .node('is_adc_any_temp', Or)
  .node('is_adc_any_temp2', Or)
  .node('is_adc_any_temp3', Or)
  .node('is_adc_any', Or)
  .node('is_adc_or_sbc_any', Or)
  .node('is_lda_zp_any', Or)
  .node('result_a_lda_or_and', Mux)
  .node('result_a_or_ora', Mux)
  .node('result_a_or_eor', Mux)
  .node('result_a_or_sbc', Mux)
  .node('result_a_or_adc', Mux)
  .node('result_a_imm_zp', Mux)
  .node('result_a_abs', Mux)
  .node('result_a_abs_x', Mux)
  .node('result_a_abs_y', Mux)
  .node('result_a_ind_x', Mux)
  .node('result_a_ind_y', Mux)
  .node('result_a_stack', Mux)
  .node('result_a_txa', Mux)
  .node('result_a_tya', Mux)
  .node('result_a_asl', Mux)
  .node('result_a_lsr', Mux)
  .node('result_a_rol', Mux)
  .node('result_a', Mux)
  .node('result_x_tax_or_inx', Mux)
  .node('result_x_dex', Mux)
  .node('result_x_tsx', Mux)
  .node('result_x_ldx_imm', Mux)
  .node('result_x_ldx_zp_y', Mux)
  .node('result_x', Mux)
  .node('result_y_inc_dec', Mux)
  .node('result_y', Mux)
  .node('cmp_sub', Subtractor)
  .node('cpx_sub', Subtractor)
  .node('cpy_sub', Subtractor)
  .node('const_128', Constant, { value: 128 })
  .node('is_any_x_op_1', Or)
  .node('is_any_x_op_2', Or)
  .node('is_any_x_op_3', Or)
  .node('is_any_x_op', Or)
  .node('is_any_y_op', Or)
  .node('is_cmp_any_temp', Or)
  .node('is_cmp_any_temp2', Or)
  .node('is_cmp_any_temp3', Or)
  .node('is_cmp_any', Or)
  .node('flag_value_1', Mux)
  .node('flag_value_2', Mux)
  .node('flag_value_3', Mux)
  .node('flag_value_4', Mux)
  .node('flag_value_5', Mux)
  .node('flag_value_rmw', Mux)
  .node('is_bit_any', Or)
  .node('flag_value', Mux)
  .node('n_check', Comparator)
  .node('n_flag_normal', Or)
  .node('n_flag_val', Mux)
  .node('z_check', Comparator)
  .node('not_borrow_cmp', Not)
  .node('not_borrow_cpx', Not)
  .node('not_borrow_cpy', Not)
  .node('c_cmp_or_cpx', Mux)
  .node('c_compare', Mux)
  .node('not_borrow_sbc', Not)
  .node('c_with_sbc', Mux)
  .node('c_with_adc', Mux)
  .node('c_with_asl', Mux)
  .node('c_with_lsr', Mux)
  .node('c_with_rol', Mux)
  .node('c_with_ror', Mux)
  .node('c_with_asl_zp', Mux)
  .node('c_with_lsr_zp', Mux)
  .node('c_with_rol_zp', Mux)
  .node('c_with_ror_zp', Mux)
  .node('c_from_sec', Mux)
  .node('const_true', Constant, { value: 1 })
  .node('c_value', Mux)
  .node('update_flags_from_stack', Or)
  .node('update_n_signal', Or)
  .node('update_z_signal', Or)
  .node('update_c_temp', Or)
  .node('update_c_signal', Or)
  .node('update_v_temp', Or)
  .node('update_v_temp2', Or)
  .node('update_v_signal', Or)
  .node('new_v_temp', Mux)
  .node('new_v_after_adc', Mux)
  .node('new_v_after_sbc', Mux)
  .node('new_v_value', Mux)
  .node('new_n_value', Mux)
  .node('new_z_value', Mux)
  .node('new_c_value', Mux)
  .node('update_d_signal', Or)
  .node('update_i_signal', Or)
  .node('new_d_value', Mux)
  .node('new_i_value', Mux)
  .node('pc_after_inc', Mux)
  .node('pc_after_branch', Mux)
  .node('pc_after_rts', Mux)
  .node('pc_after_jsr', Mux)
  .node('pc_after_jmp_ind', Mux)
  .node('pc_after_rti', Mux)
  .connect(({ in: inp, out, pc_reg, always_on, pc_inc, zero, one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve, thirteen, fourteen, fifteen, byte_0, byte_1, byte_2, byte_3, byte_4, byte_5, byte_6, byte_7, byte_8, byte_9, byte_10, byte_11, byte_12, byte_13, byte_14, byte_15, at_0, at_1, at_2, at_3, at_4, at_5, at_6, at_7, at_8, at_9, at_10, at_11, at_12, at_13, at_14, at_15, mux1, mux2, mux3, mux4, mux5, mux6, mux7, mux8, mux9, mux10, mux11, mux12, mux13, mux14, mux15, ir, operand_reg, addr_lo_reg, addr_hi_reg, pc_lo_temp, pc_hi_temp, flags, addr_with_x, addr_with_y, ind_x_zp_addr, ind_x_zp_addr_plus1, ptr_lo_reg, ptr_hi_reg, control, registers, sp, sp_load_or_reset, sp_init, sp_load_value_mux, stack, pc_minus_1, one_const, const_one, status_byte, stack_data_pha_or_lo, stack_data_with_php, stack_data_final, stack_bits, use_indexed_x_temp, use_indexed_x_temp2, use_indexed_x_temp3, use_indexed_x, effective_addr_x, use_indexed_y, effective_addr_y, is_sta_abs_xy, sta_abs_addr, effective_addr_final, ind_x_addr_sub4, ind_x_addr_sub5, use_ind_x_addr, use_ind_x_addr_all, operand_plus_1, ptr_with_y, ind_y_addr_sub3, ind_y_addr_sub5, use_ind_y_addr, use_ind_y_addr_all, use_indirect_addr, indirect_addr, memory_addr_temp, addr_lo_plus_1, jmp_ind_addr, use_jmp_ind_addr, memory_addr, memory, mem_data_x_mux, mem_data_y_mux, inc_mem, dec_mem, mem_bits, mem_shift_one, asl_mem_result, lsr_mem_result, rol_mem_adder, mem_c_times_128, ror_mem_add_val, ror_mem_adder, rmw_inc_or_dec, rmw_or_asl, rmw_or_lsr, rmw_or_rol, rmw_result, mem_data_rmw_mux, inc_x, dec_x, inc_y, dec_y, rts_pc_plus1, branch_adder, is_zp_x_alu, is_zp_x_alu_2, is_zp_x_alu_3, is_zp_x_alu_4, is_zp_x_alu_5, is_abs_y_alu_1, is_abs_y_alu_2, is_abs_y_alu_3, is_abs_y_alu_4, is_abs_y_alu, is_ind_x_alu_1, is_ind_x_alu_2, is_ind_x_alu_3, is_ind_x_alu_4, is_ind_x_alu, is_ind_y_alu_1, is_ind_y_alu_2, is_ind_y_alu_3, is_ind_y_alu_4, is_ind_y_alu, is_mem_alu_temp, is_mem_alu_temp2, is_mem_alu, alu_b_operand, and_result, ora_result, eor_result, not_carry, sbc_result, adc_result, operand_bits, adc_result_bits, sbc_result_bits, a_reg_bits, adc_a_xor_m, adc_same_sign, adc_a_xor_result, v_adc, sbc_a_xor_result, v_sbc, a_bits, shift_one, asl_result, lsr_result, rol_adder, c_times_128, ror_add_val, ror_adder, is_and_any_temp, is_and_any_temp2, is_and_any_temp3, is_and_any, is_ora_any_temp, is_ora_any_temp2, is_ora_any_temp3, is_ora_any, is_eor_any_temp, is_eor_any_temp2, is_eor_any_temp3, is_eor_any, is_sbc_any_temp, is_sbc_any_temp2, is_sbc_any_temp3, is_sbc_any, is_adc_any_temp, is_adc_any_temp2, is_adc_any_temp3, is_adc_any, is_adc_or_sbc_any, is_lda_zp_any, result_a_lda_or_and, result_a_or_ora, result_a_or_eor, result_a_or_sbc, result_a_or_adc, result_a_imm_zp, result_a_abs, result_a_abs_x, result_a_abs_y, result_a_ind_x, result_a_ind_y, result_a_stack, result_a_txa, result_a_tya, result_a_asl, result_a_lsr, result_a_rol, result_a, result_x_tax_or_inx, result_x_dex, result_x_tsx, result_x_ldx_imm, result_x_ldx_zp_y, result_x, result_y_inc_dec, result_y, cmp_sub, cpx_sub, cpy_sub, const_128, is_any_x_op_1, is_any_x_op_2, is_any_x_op_3, is_any_x_op, is_any_y_op, is_cmp_any_temp, is_cmp_any_temp2, is_cmp_any_temp3, is_cmp_any, flag_value_1, flag_value_2, flag_value_3, flag_value_4, flag_value_5, flag_value_rmw, is_bit_any, flag_value, n_check, n_flag_normal, n_flag_val, z_check, not_borrow_cmp, not_borrow_cpx, not_borrow_cpy, c_cmp_or_cpx, c_compare, not_borrow_sbc, c_with_sbc, c_with_adc, c_with_asl, c_with_lsr, c_with_rol, c_with_ror, c_with_asl_zp, c_with_lsr_zp, c_with_rol_zp, c_with_ror_zp, c_from_sec, const_true, c_value, update_flags_from_stack, update_n_signal, update_z_signal, update_c_temp, update_c_signal, update_v_temp, update_v_temp2, update_v_signal, new_v_temp, new_v_after_adc, new_v_after_sbc, new_v_value, new_n_value, new_z_value, new_c_value, update_d_signal, update_i_signal, new_d_value, new_i_value, pc_after_inc, pc_after_branch, pc_after_rts, pc_after_jsr, pc_after_jmp_ind, pc_after_rti }) => [
    pc_reg.q.to(pc_inc.in, at_0.a, at_1.a, at_2.a, at_3.a, at_4.a, at_5.a, at_6.a, at_7.a, at_8.a, at_9.a, at_10.a, at_11.a, at_12.a, at_13.a, at_14.a, at_15.a, pc_minus_1.a, branch_adder.a, pc_after_inc.in0, out.pc),
    zero.out.to(at_0.b, addr_with_x.carry_in, addr_with_y.carry_in, ind_x_zp_addr.carry_in, pc_minus_1.borrow_in, stack_data_final.in1, ptr_with_y.carry_in, dec_mem.borrow_in, rol_mem_adder.b, ror_mem_add_val.in0, ror_mem_adder.carry_in, dec_x.borrow_in, dec_y.borrow_in, branch_adder.carry_in, rol_adder.b, ror_add_val.in0, ror_adder.carry_in, cmp_sub.borrow_in, cpx_sub.borrow_in, cpy_sub.borrow_in, z_check.b, c_value.in1, new_v_temp.in0),
    one.out.to(at_1.b),
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
    mux15.out.to(ir.data, operand_reg.data, addr_lo_reg.data, addr_hi_reg.data),
    addr_lo_reg.q.to(addr_with_x.a, addr_with_y.a, effective_addr_x.in0, addr_lo_plus_1.in, jmp_ind_addr.in0, pc_after_jsr.in1),
    registers.reg_y.to(addr_with_y.b, ptr_with_y.b, mem_data_y_mux.in1, inc_y.in, dec_y.a, result_a_tya.in1, cpy_sub.a, out.reg_y),
    operand_reg.q.to(ind_x_zp_addr.a, operand_plus_1.in, ind_y_addr_sub3.in0, branch_adder.b, alu_b_operand.in0, result_a_lda_or_and.in0, result_x_ldx_imm.in1, result_y.in1, cpx_sub.b, cpy_sub.b, out.operand),
    registers.reg_x.to(ind_x_zp_addr.b, sp_load_value_mux.in1, addr_with_x.b, mem_data_x_mux.in1, inc_x.in, dec_x.a, result_a_txa.in1, cpx_sub.a, out.reg_x),
    ind_x_zp_addr.sum.to(ind_x_zp_addr_plus1.in, ind_x_addr_sub4.in0),
    inp.reset.to(control.reset, sp_load_or_reset.a),
    ir.q.to(control.current_opcode, out.instruction),
    flags.flag_n.to(control.flag_n, status_byte.bit7, out.flag_n),
    flags.flag_z.to(control.flag_z, status_byte.bit1, out.flag_z),
    flags.flag_c.to(control.flag_c, status_byte.bit0, rol_mem_adder.carry_in, ror_mem_add_val.sel, not_carry.in, adc_result.carry_in, rol_adder.carry_in, ror_add_val.sel, out.flag_c),
    flags.flag_v.to(control.flag_v, status_byte.bit6, out.flag_v),
    control.write_a.to(registers.write_a),
    control.write_x.to(registers.write_x),
    control.write_y.to(registers.write_y),
    control.sp_decrement.to(sp.decrement),
    control.sp_increment.to(sp.increment),
    control.sp_load.to(sp_load_or_reset.b, sp_load_value_mux.sel),
    sp_load_or_reset.out.to(sp.load),
    sp_init.out.to(sp_load_value_mux.in0),
    sp_load_value_mux.out.to(sp.load_value),
    sp.sp.to(stack.addr, result_x_tsx.in1, out.reg_sp),
    one_const.out.to(pc_minus_1.b, dec_mem.b, dec_x.b, dec_y.b),
    flags.flag_i.to(status_byte.bit2, out.flag_i),
    flags.flag_d.to(status_byte.bit3, out.flag_d),
    const_one.out.to(status_byte.bit4, status_byte.bit5),
    control.push_pc_lo.to(stack_data_pha_or_lo.sel),
    registers.reg_a.to(stack_data_pha_or_lo.in0, mem_data_x_mux.in0, and_result.a, ora_result.a, eor_result.a, sbc_result.a, adc_result.a, a_reg_bits.in, a_bits.in, asl_result.value, lsr_result.value, result_x_tax_or_inx.in1, cmp_sub.a, out.reg_a),
    pc_minus_1.difference.to(stack_data_pha_or_lo.in1),
    control.is_php.to(stack_data_with_php.sel),
    stack_data_pha_or_lo.out.to(stack_data_with_php.in0),
    status_byte.out.to(stack_data_with_php.in1),
    control.push_pc_hi.to(stack_data_final.sel),
    stack_data_with_php.out.to(stack_data_final.in0),
    stack_data_final.out.to(stack.data_in),
    control.stack_write.to(stack.write_enable),
    stack.data_out.to(stack_bits.in, pc_lo_temp.data, pc_hi_temp.data, result_a_stack.in1, out.stack_data),
    control.pull_pc_lo.to(pc_lo_temp.we),
    control.pull_pc_hi.to(pc_hi_temp.we),
    control.is_lda_abs_x.to(use_indexed_x_temp.a, result_a_abs_x.sel),
    control.is_zp_x.to(use_indexed_x_temp.b),
    use_indexed_x_temp.out.to(use_indexed_x_temp2.a),
    control.is_shift_abs_x.to(use_indexed_x_temp2.b),
    use_indexed_x_temp2.out.to(use_indexed_x_temp3.a),
    control.is_inc_dec_abs_x.to(use_indexed_x_temp3.b),
    use_indexed_x_temp3.out.to(use_indexed_x.a),
    control.is_ldy_abs_x.to(use_indexed_x.b),
    use_indexed_x.out.to(effective_addr_x.sel),
    addr_with_x.sum.to(effective_addr_x.in1, sta_abs_addr.in0),
    control.is_zp_y.to(use_indexed_y.a),
    control.is_abs_y.to(use_indexed_y.b),
    use_indexed_y.out.to(effective_addr_y.sel),
    effective_addr_x.out.to(effective_addr_y.in0),
    addr_with_y.sum.to(effective_addr_y.in1, sta_abs_addr.in1),
    control.is_sta_abs_x.to(is_sta_abs_xy.a),
    control.is_sta_abs_y.to(is_sta_abs_xy.b, sta_abs_addr.sel),
    is_sta_abs_xy.out.to(effective_addr_final.sel),
    effective_addr_y.out.to(effective_addr_final.in0),
    sta_abs_addr.out.to(effective_addr_final.in1),
    control.ind_x_sub4.to(ind_x_addr_sub4.sel, use_ind_x_addr.b),
    ind_x_zp_addr_plus1.out.to(ind_x_addr_sub4.in1),
    control.ind_x_sub5.to(ind_x_addr_sub5.sel, use_ind_x_addr_all.b),
    ind_x_addr_sub4.out.to(ind_x_addr_sub5.in0),
    ptr_lo_reg.q.to(ind_x_addr_sub5.in1, ptr_with_y.a, pc_after_jmp_ind.in1),
    control.ind_x_sub3.to(use_ind_x_addr.a),
    use_ind_x_addr.out.to(use_ind_x_addr_all.a),
    control.ind_y_sub3.to(ind_y_addr_sub3.sel, use_ind_y_addr.b),
    operand_plus_1.out.to(ind_y_addr_sub3.in1),
    control.ind_y_sub5.to(ind_y_addr_sub5.sel, use_ind_y_addr_all.b),
    ind_y_addr_sub3.out.to(ind_y_addr_sub5.in0),
    ptr_with_y.sum.to(ind_y_addr_sub5.in1),
    control.ind_y_sub2.to(use_ind_y_addr.a),
    use_ind_y_addr.out.to(use_ind_y_addr_all.a),
    use_ind_x_addr_all.out.to(use_indirect_addr.a),
    use_ind_y_addr_all.out.to(use_indirect_addr.b, indirect_addr.sel),
    ind_x_addr_sub5.out.to(indirect_addr.in0),
    ind_y_addr_sub5.out.to(indirect_addr.in1),
    use_indirect_addr.out.to(memory_addr_temp.sel),
    effective_addr_final.out.to(memory_addr_temp.in0, out.address),
    indirect_addr.out.to(memory_addr_temp.in1),
    control.jmp_ind_sub3.to(jmp_ind_addr.sel, use_jmp_ind_addr.b),
    addr_lo_plus_1.out.to(jmp_ind_addr.in1),
    control.jmp_ind_sub2.to(use_jmp_ind_addr.a),
    use_jmp_ind_addr.out.to(memory_addr.sel),
    memory_addr_temp.out.to(memory_addr.in0),
    jmp_ind_addr.out.to(memory_addr.in1),
    memory.data_out.to(ptr_lo_reg.data, ptr_hi_reg.data, inc_mem.in, dec_mem.a, mem_bits.in, asl_mem_result.value, lsr_mem_result.value, alu_b_operand.in1, result_a_imm_zp.in1, result_a_abs.in1, result_a_abs_x.in1, result_a_abs_y.in1, result_a_ind_x.in1, result_a_ind_y.in1, result_x_ldx_zp_y.in1, result_x.in1, out.mem_data),
    control.ptr_lo_load.to(ptr_lo_reg.we),
    control.ptr_hi_load.to(ptr_hi_reg.we),
    memory_addr.out.to(memory.addr),
    control.mem_write.to(memory.write_enable),
    control.use_x_for_mem.to(mem_data_x_mux.sel),
    control.use_y_for_mem.to(mem_data_y_mux.sel),
    mem_data_x_mux.out.to(mem_data_y_mux.in0),
    mem_shift_one.out.to(asl_mem_result.shift, lsr_mem_result.shift),
    asl_mem_result.result.to(rol_mem_adder.a, rmw_or_asl.in1),
    mem_c_times_128.out.to(ror_mem_add_val.in1),
    lsr_mem_result.result.to(ror_mem_adder.a, rmw_or_lsr.in1),
    ror_mem_add_val.out.to(ror_mem_adder.b),
    control.is_inc_zp.to(rmw_inc_or_dec.sel),
    dec_mem.difference.to(rmw_inc_or_dec.in0),
    inc_mem.out.to(rmw_inc_or_dec.in1),
    control.is_asl_zp.to(rmw_or_asl.sel, c_with_asl_zp.sel),
    rmw_inc_or_dec.out.to(rmw_or_asl.in0),
    control.is_lsr_zp.to(rmw_or_lsr.sel, c_with_lsr_zp.sel),
    rmw_or_asl.out.to(rmw_or_lsr.in0),
    control.is_rol_zp.to(rmw_or_rol.sel, c_with_rol_zp.sel),
    rmw_or_lsr.out.to(rmw_or_rol.in0),
    rol_mem_adder.sum.to(rmw_or_rol.in1),
    control.is_ror_zp.to(rmw_result.sel, c_with_ror_zp.sel),
    rmw_or_rol.out.to(rmw_result.in0),
    ror_mem_adder.sum.to(rmw_result.in1),
    control.use_rmw_data.to(mem_data_rmw_mux.sel),
    mem_data_y_mux.out.to(mem_data_rmw_mux.in0),
    rmw_result.out.to(mem_data_rmw_mux.in1, flag_value_rmw.in1),
    mem_data_rmw_mux.out.to(memory.data_in),
    pc_lo_temp.q.to(rts_pc_plus1.in, pc_after_rti.in1),
    control.is_adc_zp_x.to(is_zp_x_alu.a, is_adc_any_temp.b),
    control.is_sbc_zp_x.to(is_zp_x_alu.b, is_sbc_any_temp.b),
    is_zp_x_alu.out.to(is_zp_x_alu_2.a),
    control.is_and_zp_x.to(is_zp_x_alu_2.b, is_and_any_temp.b),
    is_zp_x_alu_2.out.to(is_zp_x_alu_3.a),
    control.is_ora_zp_x.to(is_zp_x_alu_3.b, is_ora_any_temp.b),
    is_zp_x_alu_3.out.to(is_zp_x_alu_4.a),
    control.is_eor_zp_x.to(is_zp_x_alu_4.b, is_eor_any_temp.b),
    is_zp_x_alu_4.out.to(is_zp_x_alu_5.a),
    control.is_cmp_zp_x.to(is_zp_x_alu_5.b, is_cmp_any_temp.b),
    control.is_adc_abs_y.to(is_abs_y_alu_1.a, is_adc_any_temp2.b),
    control.is_sbc_abs_y.to(is_abs_y_alu_1.b, is_sbc_any_temp2.b),
    is_abs_y_alu_1.out.to(is_abs_y_alu_2.a),
    control.is_and_abs_y.to(is_abs_y_alu_2.b, is_and_any_temp2.b),
    is_abs_y_alu_2.out.to(is_abs_y_alu_3.a),
    control.is_ora_abs_y.to(is_abs_y_alu_3.b, is_ora_any_temp2.b),
    is_abs_y_alu_3.out.to(is_abs_y_alu_4.a),
    control.is_eor_abs_y.to(is_abs_y_alu_4.b, is_eor_any_temp2.b),
    is_abs_y_alu_4.out.to(is_abs_y_alu.a),
    control.is_cmp_abs_y.to(is_abs_y_alu.b, is_cmp_any_temp2.b),
    control.is_adc_ind_x.to(is_ind_x_alu_1.a, is_adc_any_temp3.b),
    control.is_sbc_ind_x.to(is_ind_x_alu_1.b, is_sbc_any_temp3.b),
    is_ind_x_alu_1.out.to(is_ind_x_alu_2.a),
    control.is_and_ind_x.to(is_ind_x_alu_2.b, is_and_any_temp3.b),
    is_ind_x_alu_2.out.to(is_ind_x_alu_3.a),
    control.is_ora_ind_x.to(is_ind_x_alu_3.b, is_ora_any_temp3.b),
    is_ind_x_alu_3.out.to(is_ind_x_alu_4.a),
    control.is_eor_ind_x.to(is_ind_x_alu_4.b, is_eor_any_temp3.b),
    is_ind_x_alu_4.out.to(is_ind_x_alu.a),
    control.is_cmp_ind_x.to(is_ind_x_alu.b, is_cmp_any_temp3.b),
    control.is_adc_ind_y.to(is_ind_y_alu_1.a, is_adc_any.b),
    control.is_sbc_ind_y.to(is_ind_y_alu_1.b, is_sbc_any.b),
    is_ind_y_alu_1.out.to(is_ind_y_alu_2.a),
    control.is_and_ind_y.to(is_ind_y_alu_2.b, is_and_any.b),
    is_ind_y_alu_2.out.to(is_ind_y_alu_3.a),
    control.is_ora_ind_y.to(is_ind_y_alu_3.b, is_ora_any.b),
    is_ind_y_alu_3.out.to(is_ind_y_alu_4.a),
    control.is_eor_ind_y.to(is_ind_y_alu_4.b, is_eor_any.b),
    is_ind_y_alu_4.out.to(is_ind_y_alu.a),
    control.is_cmp_ind_y.to(is_ind_y_alu.b, is_cmp_any.b),
    is_zp_x_alu_5.out.to(is_mem_alu_temp.a),
    is_abs_y_alu.out.to(is_mem_alu_temp.b),
    is_mem_alu_temp.out.to(is_mem_alu_temp2.a),
    is_ind_x_alu.out.to(is_mem_alu_temp2.b),
    is_mem_alu_temp2.out.to(is_mem_alu.a),
    is_ind_y_alu.out.to(is_mem_alu.b),
    is_mem_alu.out.to(alu_b_operand.sel),
    alu_b_operand.out.to(and_result.b, ora_result.b, eor_result.b, sbc_result.b, adc_result.b, operand_bits.in, cmp_sub.b),
    not_carry.out.to(sbc_result.borrow_in),
    adc_result.sum.to(adc_result_bits.in, result_a_or_adc.in1),
    sbc_result.difference.to(sbc_result_bits.in, result_a_or_sbc.in1),
    a_reg_bits.bit7.to(adc_a_xor_m.a, adc_a_xor_result.a, sbc_a_xor_result.a),
    operand_bits.bit7.to(adc_a_xor_m.b),
    adc_a_xor_m.out.to(adc_same_sign.in, v_sbc.a),
    adc_result_bits.bit7.to(adc_a_xor_result.b),
    adc_same_sign.out.to(v_adc.a),
    adc_a_xor_result.out.to(v_adc.b),
    sbc_result_bits.bit7.to(sbc_a_xor_result.b),
    sbc_a_xor_result.out.to(v_sbc.b),
    shift_one.out.to(asl_result.shift, lsr_result.shift),
    asl_result.result.to(rol_adder.a, result_a_asl.in1),
    c_times_128.out.to(ror_add_val.in1),
    lsr_result.result.to(ror_adder.a, result_a_lsr.in1),
    ror_add_val.out.to(ror_adder.b),
    control.is_and_imm.to(is_and_any_temp.a),
    is_and_any_temp.out.to(is_and_any_temp2.a),
    is_and_any_temp2.out.to(is_and_any_temp3.a),
    is_and_any_temp3.out.to(is_and_any.a),
    control.is_ora_imm.to(is_ora_any_temp.a),
    is_ora_any_temp.out.to(is_ora_any_temp2.a),
    is_ora_any_temp2.out.to(is_ora_any_temp3.a),
    is_ora_any_temp3.out.to(is_ora_any.a),
    control.is_eor_imm.to(is_eor_any_temp.a),
    is_eor_any_temp.out.to(is_eor_any_temp2.a),
    is_eor_any_temp2.out.to(is_eor_any_temp3.a),
    is_eor_any_temp3.out.to(is_eor_any.a),
    control.is_sbc_imm.to(is_sbc_any_temp.a),
    is_sbc_any_temp.out.to(is_sbc_any_temp2.a),
    is_sbc_any_temp2.out.to(is_sbc_any_temp3.a),
    is_sbc_any_temp3.out.to(is_sbc_any.a),
    control.is_adc_imm.to(is_adc_any_temp.a),
    is_adc_any_temp.out.to(is_adc_any_temp2.a),
    is_adc_any_temp2.out.to(is_adc_any_temp3.a),
    is_adc_any_temp3.out.to(is_adc_any.a),
    is_adc_any.out.to(is_adc_or_sbc_any.a, result_a_or_adc.sel, c_with_adc.sel, new_v_after_adc.sel),
    is_sbc_any.out.to(is_adc_or_sbc_any.b, result_a_or_sbc.sel, c_with_sbc.sel, new_v_after_sbc.sel),
    control.is_lda_zp.to(is_lda_zp_any.a),
    control.is_lda_zp_x.to(is_lda_zp_any.b),
    is_and_any.out.to(result_a_lda_or_and.sel),
    and_result.out.to(result_a_lda_or_and.in1, flag_value.in1),
    is_ora_any.out.to(result_a_or_ora.sel),
    result_a_lda_or_and.out.to(result_a_or_ora.in0),
    ora_result.out.to(result_a_or_ora.in1),
    is_eor_any.out.to(result_a_or_eor.sel),
    result_a_or_ora.out.to(result_a_or_eor.in0),
    eor_result.out.to(result_a_or_eor.in1),
    result_a_or_eor.out.to(result_a_or_sbc.in0),
    result_a_or_sbc.out.to(result_a_or_adc.in0),
    is_lda_zp_any.out.to(result_a_imm_zp.sel),
    result_a_or_adc.out.to(result_a_imm_zp.in0),
    control.is_lda_abs.to(result_a_abs.sel),
    result_a_imm_zp.out.to(result_a_abs.in0),
    result_a_abs.out.to(result_a_abs_x.in0),
    control.is_lda_abs_y.to(result_a_abs_y.sel),
    result_a_abs_x.out.to(result_a_abs_y.in0),
    control.is_lda_ind_x.to(result_a_ind_x.sel),
    result_a_abs_y.out.to(result_a_ind_x.in0),
    control.is_lda_ind_y.to(result_a_ind_y.sel),
    result_a_ind_x.out.to(result_a_ind_y.in0),
    control.use_stack_data.to(result_a_stack.sel),
    result_a_ind_y.out.to(result_a_stack.in0),
    control.is_txa.to(result_a_txa.sel),
    result_a_stack.out.to(result_a_txa.in0),
    control.is_tya.to(result_a_tya.sel),
    result_a_txa.out.to(result_a_tya.in0),
    control.is_asl_a.to(result_a_asl.sel, c_with_asl.sel),
    result_a_tya.out.to(result_a_asl.in0),
    control.is_lsr_a.to(result_a_lsr.sel, c_with_lsr.sel),
    result_a_asl.out.to(result_a_lsr.in0),
    control.is_rol_a.to(result_a_rol.sel, c_with_rol.sel),
    result_a_lsr.out.to(result_a_rol.in0),
    rol_adder.sum.to(result_a_rol.in1),
    control.is_ror_a.to(result_a.sel, c_with_ror.sel),
    result_a_rol.out.to(result_a.in0),
    ror_adder.sum.to(result_a.in1),
    result_a.out.to(registers.data_a, flag_value_1.in0),
    control.is_tax.to(result_x_tax_or_inx.sel),
    inc_x.out.to(result_x_tax_or_inx.in0),
    control.is_dex.to(result_x_dex.sel, is_any_x_op_1.b),
    result_x_tax_or_inx.out.to(result_x_dex.in0),
    dec_x.difference.to(result_x_dex.in1),
    control.is_tsx.to(result_x_tsx.sel, is_any_x_op_2.b),
    result_x_dex.out.to(result_x_tsx.in0),
    control.is_ldx_imm.to(result_x_ldx_imm.sel, is_any_x_op_3.b),
    result_x_tsx.out.to(result_x_ldx_imm.in0),
    control.is_ldx_zp_y.to(result_x_ldx_zp_y.sel, is_any_x_op.b),
    result_x_ldx_imm.out.to(result_x_ldx_zp_y.in0),
    control.is_ldx_abs_y.to(result_x.sel),
    result_x_ldx_zp_y.out.to(result_x.in0),
    result_x.out.to(registers.data_x, flag_value_4.in1),
    control.is_dey.to(result_y_inc_dec.sel, is_any_y_op.b),
    inc_y.out.to(result_y_inc_dec.in0),
    dec_y.difference.to(result_y_inc_dec.in1),
    control.is_ldy_imm.to(result_y.sel),
    result_y_inc_dec.out.to(result_y.in0),
    result_y.out.to(registers.data_y, flag_value_5.in1),
    control.is_inx.to(is_any_x_op_1.a),
    is_any_x_op_1.out.to(is_any_x_op_2.a),
    is_any_x_op_2.out.to(is_any_x_op_3.a),
    is_any_x_op_3.out.to(is_any_x_op.a),
    control.is_iny.to(is_any_y_op.a),
    control.is_cmp_imm.to(is_cmp_any_temp.a),
    is_cmp_any_temp.out.to(is_cmp_any_temp2.a),
    is_cmp_any_temp2.out.to(is_cmp_any_temp3.a),
    is_cmp_any_temp3.out.to(is_cmp_any.a),
    is_cmp_any.out.to(flag_value_1.sel),
    cmp_sub.difference.to(flag_value_1.in1),
    control.is_cpx_imm.to(flag_value_2.sel, c_cmp_or_cpx.sel),
    flag_value_1.out.to(flag_value_2.in0),
    cpx_sub.difference.to(flag_value_2.in1),
    control.is_cpy_imm.to(flag_value_3.sel, c_compare.sel),
    flag_value_2.out.to(flag_value_3.in0),
    cpy_sub.difference.to(flag_value_3.in1),
    is_any_x_op.out.to(flag_value_4.sel),
    flag_value_3.out.to(flag_value_4.in0),
    is_any_y_op.out.to(flag_value_5.sel),
    flag_value_4.out.to(flag_value_5.in0),
    control.mem_rmw.to(flag_value_rmw.sel),
    flag_value_5.out.to(flag_value_rmw.in0),
    control.is_bit_zp.to(is_bit_any.a),
    control.is_bit_abs.to(is_bit_any.b),
    is_bit_any.out.to(flag_value.sel, n_flag_val.sel),
    flag_value_rmw.out.to(flag_value.in0),
    flag_value.out.to(n_check.a, z_check.a),
    const_128.out.to(n_check.b),
    n_check.gt.to(n_flag_normal.a),
    n_check.eq.to(n_flag_normal.b),
    n_flag_normal.out.to(n_flag_val.in0),
    mem_bits.bit7.to(n_flag_val.in1, c_with_asl_zp.in1, c_with_rol_zp.in1),
    cmp_sub.borrow_out.to(not_borrow_cmp.in),
    cpx_sub.borrow_out.to(not_borrow_cpx.in),
    cpy_sub.borrow_out.to(not_borrow_cpy.in),
    not_borrow_cmp.out.to(c_cmp_or_cpx.in0),
    not_borrow_cpx.out.to(c_cmp_or_cpx.in1),
    c_cmp_or_cpx.out.to(c_compare.in0),
    not_borrow_cpy.out.to(c_compare.in1),
    sbc_result.borrow_out.to(not_borrow_sbc.in),
    c_compare.out.to(c_with_sbc.in0),
    not_borrow_sbc.out.to(c_with_sbc.in1),
    c_with_sbc.out.to(c_with_adc.in0),
    adc_result.carry_out.to(c_with_adc.in1),
    c_with_adc.out.to(c_with_asl.in0),
    a_bits.bit7.to(c_with_asl.in1, c_with_rol.in1),
    c_with_asl.out.to(c_with_lsr.in0),
    a_bits.bit0.to(c_with_lsr.in1, c_with_ror.in1),
    c_with_lsr.out.to(c_with_rol.in0),
    c_with_rol.out.to(c_with_ror.in0),
    c_with_ror.out.to(c_with_asl_zp.in0),
    c_with_asl_zp.out.to(c_with_lsr_zp.in0),
    mem_bits.bit0.to(c_with_lsr_zp.in1, c_with_ror_zp.in1),
    c_with_lsr_zp.out.to(c_with_rol_zp.in0),
    c_with_rol_zp.out.to(c_with_ror_zp.in0),
    control.set_c.to(c_from_sec.sel),
    c_with_ror_zp.out.to(c_from_sec.in0),
    const_true.out.to(c_from_sec.in1),
    control.clear_c.to(c_value.sel),
    c_from_sec.out.to(c_value.in0),
    control.update_flags_plp.to(update_flags_from_stack.a),
    control.update_flags_rti.to(update_flags_from_stack.b),
    control.update_flags.to(update_n_signal.a, update_z_signal.a, update_c_temp.a),
    update_flags_from_stack.out.to(update_n_signal.b, update_z_signal.b, update_c_signal.b, update_v_signal.b, new_v_value.sel, new_n_value.sel, new_z_value.sel, new_c_value.sel, update_d_signal.b, update_i_signal.b, new_d_value.sel, new_i_value.sel),
    update_n_signal.out.to(flags.update_n),
    update_z_signal.out.to(flags.update_z),
    control.update_c_only.to(update_c_temp.b),
    update_c_temp.out.to(update_c_signal.a),
    update_c_signal.out.to(flags.update_c),
    control.clear_v.to(update_v_temp.a),
    control.update_v_bit.to(update_v_temp.b, new_v_temp.sel),
    update_v_temp.out.to(update_v_temp2.a),
    is_adc_or_sbc_any.out.to(update_v_temp2.b),
    update_v_temp2.out.to(update_v_signal.a),
    update_v_signal.out.to(flags.update_v),
    mem_bits.bit6.to(new_v_temp.in1),
    new_v_temp.out.to(new_v_after_adc.in0),
    v_adc.out.to(new_v_after_adc.in1),
    new_v_after_adc.out.to(new_v_after_sbc.in0),
    v_sbc.out.to(new_v_after_sbc.in1),
    new_v_after_sbc.out.to(new_v_value.in0),
    stack_bits.bit6.to(new_v_value.in1),
    n_flag_val.out.to(new_n_value.in0),
    stack_bits.bit7.to(new_n_value.in1),
    z_check.eq.to(new_z_value.in0),
    stack_bits.bit1.to(new_z_value.in1),
    c_value.out.to(new_c_value.in0),
    stack_bits.bit0.to(new_c_value.in1),
    new_n_value.out.to(flags.new_n),
    new_z_value.out.to(flags.new_z),
    new_c_value.out.to(flags.new_c),
    new_v_value.out.to(flags.new_v),
    control.update_d.to(update_d_signal.a),
    update_d_signal.out.to(flags.update_d),
    control.update_i.to(update_i_signal.a),
    update_i_signal.out.to(flags.update_i),
    control.set_d.to(new_d_value.in0),
    stack_bits.bit3.to(new_d_value.in1),
    control.set_i.to(new_i_value.in0),
    stack_bits.bit2.to(new_i_value.in1),
    new_d_value.out.to(flags.new_d),
    new_i_value.out.to(flags.new_i),
    control.pc_increment.to(pc_after_inc.sel),
    pc_inc.out.to(pc_after_inc.in1),
    control.branch_load_pc.to(pc_after_branch.sel),
    pc_after_inc.out.to(pc_after_branch.in0),
    branch_adder.sum.to(pc_after_branch.in1),
    control.rts_load_pc.to(pc_after_rts.sel),
    pc_after_branch.out.to(pc_after_rts.in0),
    rts_pc_plus1.out.to(pc_after_rts.in1),
    control.jsr_load_pc.to(pc_after_jsr.sel),
    pc_after_rts.out.to(pc_after_jsr.in0),
    control.jmp_ind_load_pc.to(pc_after_jmp_ind.sel),
    pc_after_jsr.out.to(pc_after_jmp_ind.in0),
    control.rti_load_pc.to(pc_after_rti.sel),
    pc_after_jmp_ind.out.to(pc_after_rti.in0),
    pc_after_rti.out.to(pc_reg.data),
    always_on.out.to(pc_reg.we),
    control.ir_load.to(ir.we),
    control.operand_load.to(operand_reg.we),
    control.addr_lo_load.to(addr_lo_reg.we),
    control.addr_hi_load.to(addr_hi_reg.we),
    control.current_state.to(out.current_state),
    control.exec_subcycle.to(out.subcycle),
  ])
  .build()

const Stage6Test = component('Stage6Test')
  .node('cpu', Stage6CPU)
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
  .node('d_y', HexDisplay)
  .node('d_sp', HexDisplay)
  .node('d_n', HexDisplay)
  .node('d_z', HexDisplay)
  .node('d_c', HexDisplay)
  .connect(({ in: inp, out, cpu, reset_input, d_pc, d_instruction, d_operand, d_address, d_mem_data, d_stack_data, d_state, d_subcycle, d_a, d_x, d_y, d_sp, d_n, d_z, d_c }) => [
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
    cpu.reg_y.to(d_y.in),
    cpu.reg_sp.to(d_sp.in),
    cpu.flag_n.to(d_n.in),
    cpu.flag_z.to(d_z.in),
    cpu.flag_c.to(d_c.in),
  ])
  .build()
