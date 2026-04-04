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
  .node('out_mux1', Mux)
  .node('out_mux2', Mux)
  .node('out_mux3', Mux)
  .node('out_mux4', Mux)
  .node('out_mux5', Mux)
  .node('out_mux6', Mux)
  .node('out_mux7', Mux)
  .connect(({ in: inp, out, zero, addr_10, addr_11, addr_12, addr_13, addr_14, addr_15, addr_20, addr_21, at_10, at_11, at_12, at_13, at_14, at_15, at_20, at_21, mem_10, mem_11, mem_12, mem_13, mem_14, mem_15, mem_20, mem_21, we_10, we_11, we_12, we_13, we_14, we_15, we_20, we_21, out_mux1, out_mux2, out_mux3, out_mux4, out_mux5, out_mux6, out_mux7 }) => [
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
    at_10.eq.to(we_10.b),
    we_10.out.to(mem_10.we),
    at_11.eq.to(we_11.b, out_mux1.sel),
    we_11.out.to(mem_11.we),
    at_12.eq.to(we_12.b, out_mux2.sel),
    we_12.out.to(mem_12.we),
    at_13.eq.to(we_13.b, out_mux3.sel),
    we_13.out.to(mem_13.we),
    at_14.eq.to(we_14.b, out_mux4.sel),
    we_14.out.to(mem_14.we),
    at_15.eq.to(we_15.b, out_mux5.sel),
    we_15.out.to(mem_15.we),
    at_20.eq.to(we_20.b, out_mux6.sel),
    we_20.out.to(mem_20.we),
    at_21.eq.to(we_21.b, out_mux7.sel),
    we_21.out.to(mem_21.we),
    mem_10.q.to(out_mux1.in0),
    mem_11.q.to(out_mux1.in1),
    out_mux1.out.to(out_mux2.in0),
    mem_12.q.to(out_mux2.in1),
    out_mux2.out.to(out_mux3.in0),
    mem_13.q.to(out_mux3.in1),
    out_mux3.out.to(out_mux4.in0),
    mem_14.q.to(out_mux4.in1),
    out_mux4.out.to(out_mux5.in0),
    mem_15.q.to(out_mux5.in1),
    out_mux5.out.to(out_mux6.in0),
    mem_20.q.to(out_mux6.in1),
    out_mux6.out.to(out_mux7.in0),
    mem_21.q.to(out_mux7.in1),
    out_mux7.out.to(out.data_out),
  ])
  .build()

const FlagRegister = component('FlagRegister')
  .in('new_n', bit)
  .in('new_z', bit)
  .in('new_c', bit)
  .in('new_v', bit)
  .in('update_n', bit)
  .in('update_z', bit)
  .in('update_c', bit)
  .in('update_v', bit)
  .out('flag_n', bit)
  .out('flag_z', bit)
  .out('flag_c', bit)
  .out('flag_v', bit)
  .node('reg_n', Register)
  .node('reg_z', Register)
  .node('reg_c', Register)
  .node('reg_v', Register)
  .connect(({ in: inp, out, reg_n, reg_z, reg_c, reg_v }) => [
    inp.new_n.to(reg_n.data),
    inp.new_z.to(reg_z.data),
    inp.new_c.to(reg_c.data),
    inp.new_v.to(reg_v.data),
    inp.update_n.to(reg_n.we),
    inp.update_z.to(reg_z.we),
    inp.update_c.to(reg_c.we),
    inp.update_v.to(reg_v.we),
    reg_n.q.to(out.flag_n),
    reg_z.q.to(out.flag_z),
    reg_c.q.to(out.flag_c),
    reg_v.q.to(out.flag_v),
  ])
  .build()

const RegisterFile = component('RegisterFile')
  .in('data_a', bus(8))
  .in('data_x', bus(8))
  .in('data_y', bus(8))
  .in('write_a', bit)
  .in('write_x', bit)
  .in('write_y', bit)
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

const Part5Control = component('Part5Control')
  .in('current_state', bus(8))
  .in('current_opcode', bus(8))
  .in('subcycle', bus(8))
  .in('flag_c', bit)
  .out('next_state', bus(8))
  .out('next_subcycle', bus(8))
  .out('pc_increment', bit)
  .out('ir_load', bit)
  .out('operand_load', bit)
  .out('addr_lo_load', bit)
  .out('write_a', bit)
  .out('write_x', bit)
  .out('write_y', bit)
  .out('mem_write', bit)
  .out('update_flags', bit)
  .out('update_c_only', bit)
  .out('set_c', bit)
  .out('clear_c', bit)
  .out('is_adc_imm', bit)
  .out('is_stx_zp', bit)
  .out('is_sty_zp', bit)
  .out('use_x_for_mem', bit)
  .out('use_y_for_mem', bit)
  .node('STATE_FETCH', Constant, { value: 0 })
  .node('STATE_DECODE', Constant, { value: 1 })
  .node('STATE_EXECUTE', Constant, { value: 2 })
  .node('SUB0', Constant, { value: 0 })
  .node('SUB1', Constant, { value: 1 })
  .node('SUB2', Constant, { value: 2 })
  .node('LDA_IMM', Constant, { value: 169 })
  .node('LDX_IMM', Constant, { value: 162 })
  .node('LDY_IMM', Constant, { value: 160 })
  .node('ADC_IMM', Constant, { value: 105 })
  .node('STX_ZP', Constant, { value: 134 })
  .node('STY_ZP', Constant, { value: 132 })
  .node('SEC', Constant, { value: 56 })
  .node('CLC', Constant, { value: 24 })
  .node('is_fetch', Comparator)
  .node('is_decode', Comparator)
  .node('is_execute', Comparator)
  .node('at_sub0', Comparator)
  .node('at_sub1', Comparator)
  .node('at_sub2', Comparator)
  .node('exec_sub0', And)
  .node('exec_sub1', And)
  .node('exec_sub2', And)
  .node('cmp_lda_imm', Comparator)
  .node('cmp_ldx_imm', Comparator)
  .node('cmp_ldy_imm', Comparator)
  .node('cmp_adc_imm', Comparator)
  .node('cmp_stx_zp', Comparator)
  .node('cmp_sty_zp', Comparator)
  .node('cmp_sec', Comparator)
  .node('cmp_clc', Comparator)
  .node('is_imm_1', Or)
  .node('is_imm_2', Or)
  .node('is_imm', Or)
  .node('is_zp', Or)
  .node('is_1cycle', Or)
  .node('needs_operand', Or)
  .node('one', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .node('go_to_decode', Mux)
  .node('go_to_execute', Mux)
  .node('done_1cycle', And)
  .node('done_imm', And)
  .node('done_zp', And)
  .node('done_temp', Or)
  .node('done', Or)
  .node('go_to_fetch', Mux)
  .node('inc_subcycle', Incrementer)
  .node('reset_subcycle', Mux)
  .node('keep_subcycle', Mux)
  .node('pc_inc_fetch', And)
  .node('pc_inc_exec', And)
  .node('pc_inc_signal', Or)
  .node('operand_load_signal', And)
  .node('is_write_a', Or)
  .node('write_a_signal', And)
  .node('write_x_signal', And)
  .node('write_y_signal', And)
  .node('mem_write_signal', And)
  .node('use_x_signal', And)
  .node('use_y_signal', And)
  .node('is_update_flags_1', Or)
  .node('is_update_flags_2', Or)
  .node('is_update_flags', Or)
  .node('update_flags_signal', And)
  .node('is_sec_clc', Or)
  .node('update_c_only_signal', And)
  .node('set_c_signal', And)
  .node('clear_c_signal', And)
  .connect(({ in: inp, out, STATE_FETCH, STATE_DECODE, STATE_EXECUTE, SUB0, SUB1, SUB2, LDA_IMM, LDX_IMM, LDY_IMM, ADC_IMM, STX_ZP, STY_ZP, SEC, CLC, is_fetch, is_decode, is_execute, at_sub0, at_sub1, at_sub2, exec_sub0, exec_sub1, exec_sub2, cmp_lda_imm, cmp_ldx_imm, cmp_ldy_imm, cmp_adc_imm, cmp_stx_zp, cmp_sty_zp, cmp_sec, cmp_clc, is_imm_1, is_imm_2, is_imm, is_zp, is_1cycle, needs_operand, one, zero, go_to_decode, go_to_execute, done_1cycle, done_imm, done_zp, done_temp, done, go_to_fetch, inc_subcycle, reset_subcycle, keep_subcycle, pc_inc_fetch, pc_inc_exec, pc_inc_signal, operand_load_signal, is_write_a, write_a_signal, write_x_signal, write_y_signal, mem_write_signal, use_x_signal, use_y_signal, is_update_flags_1, is_update_flags_2, is_update_flags, update_flags_signal, is_sec_clc, update_c_only_signal, set_c_signal, clear_c_signal }) => [
    inp.current_state.to(is_fetch.a, is_decode.a, is_execute.a, go_to_decode.in0),
    STATE_FETCH.out.to(is_fetch.b, go_to_fetch.in1),
    STATE_DECODE.out.to(is_decode.b, go_to_decode.in1),
    STATE_EXECUTE.out.to(is_execute.b, go_to_execute.in1),
    inp.subcycle.to(at_sub0.a, at_sub1.a, at_sub2.a, inc_subcycle.in),
    SUB0.out.to(at_sub0.b),
    SUB1.out.to(at_sub1.b),
    SUB2.out.to(at_sub2.b),
    is_execute.eq.to(exec_sub0.a, exec_sub1.a, exec_sub2.a, keep_subcycle.sel),
    at_sub0.eq.to(exec_sub0.b),
    at_sub1.eq.to(exec_sub1.b),
    at_sub2.eq.to(exec_sub2.b),
    inp.current_opcode.to(cmp_lda_imm.a, cmp_ldx_imm.a, cmp_ldy_imm.a, cmp_adc_imm.a, cmp_stx_zp.a, cmp_sty_zp.a, cmp_sec.a, cmp_clc.a),
    LDA_IMM.out.to(cmp_lda_imm.b),
    LDX_IMM.out.to(cmp_ldx_imm.b),
    LDY_IMM.out.to(cmp_ldy_imm.b),
    ADC_IMM.out.to(cmp_adc_imm.b),
    cmp_adc_imm.eq.to(out.is_adc_imm, is_imm.b, is_write_a.b, is_update_flags.b),
    STX_ZP.out.to(cmp_stx_zp.b),
    cmp_stx_zp.eq.to(out.is_stx_zp, is_zp.a, use_x_signal.b),
    STY_ZP.out.to(cmp_sty_zp.b),
    cmp_sty_zp.eq.to(out.is_sty_zp, is_zp.b, use_y_signal.b),
    SEC.out.to(cmp_sec.b),
    CLC.out.to(cmp_clc.b),
    cmp_lda_imm.eq.to(is_imm_1.a, is_write_a.a, is_update_flags_1.a),
    cmp_ldx_imm.eq.to(is_imm_1.b, write_x_signal.b, is_update_flags_1.b),
    is_imm_1.out.to(is_imm_2.a),
    cmp_ldy_imm.eq.to(is_imm_2.b, write_y_signal.b, is_update_flags_2.b),
    is_imm_2.out.to(is_imm.a),
    cmp_sec.eq.to(is_1cycle.a, is_sec_clc.a, set_c_signal.b),
    cmp_clc.eq.to(is_1cycle.b, is_sec_clc.b, clear_c_signal.b),
    is_imm.out.to(needs_operand.a, done_imm.b),
    is_zp.out.to(needs_operand.b, done_zp.b, mem_write_signal.b),
    is_fetch.eq.to(go_to_decode.sel, pc_inc_fetch.a, out.ir_load),
    is_decode.eq.to(go_to_execute.sel),
    go_to_decode.out.to(go_to_execute.in0),
    exec_sub0.out.to(done_1cycle.a, pc_inc_exec.a, operand_load_signal.a, update_c_only_signal.a, set_c_signal.a, clear_c_signal.a),
    is_1cycle.out.to(done_1cycle.b),
    exec_sub1.out.to(done_imm.a, write_a_signal.a, write_x_signal.a, write_y_signal.a, update_flags_signal.a),
    exec_sub2.out.to(done_zp.a, mem_write_signal.a, use_x_signal.a, use_y_signal.a),
    done_1cycle.out.to(done_temp.a),
    done_imm.out.to(done_temp.b),
    done_temp.out.to(done.a),
    done_zp.out.to(done.b),
    done.out.to(go_to_fetch.sel, reset_subcycle.sel),
    go_to_execute.out.to(go_to_fetch.in0),
    go_to_fetch.out.to(out.next_state),
    inc_subcycle.out.to(reset_subcycle.in0),
    zero.out.to(reset_subcycle.in1, keep_subcycle.in0),
    reset_subcycle.out.to(keep_subcycle.in1),
    keep_subcycle.out.to(out.next_subcycle),
    one.out.to(pc_inc_fetch.b),
    needs_operand.out.to(pc_inc_exec.b, operand_load_signal.b),
    pc_inc_fetch.out.to(pc_inc_signal.a),
    pc_inc_exec.out.to(pc_inc_signal.b),
    pc_inc_signal.out.to(out.pc_increment),
    operand_load_signal.out.to(out.operand_load, out.addr_lo_load),
    is_write_a.out.to(write_a_signal.b),
    write_a_signal.out.to(out.write_a),
    write_x_signal.out.to(out.write_x),
    write_y_signal.out.to(out.write_y),
    mem_write_signal.out.to(out.mem_write),
    use_x_signal.out.to(out.use_x_for_mem),
    use_y_signal.out.to(out.use_y_for_mem),
    is_update_flags_1.out.to(is_update_flags_2.a),
    is_update_flags_2.out.to(is_update_flags.a),
    is_update_flags.out.to(update_flags_signal.b),
    update_flags_signal.out.to(out.update_flags),
    is_sec_clc.out.to(update_c_only_signal.b),
    update_c_only_signal.out.to(out.update_c_only),
    set_c_signal.out.to(out.set_c),
    clear_c_signal.out.to(out.clear_c),
  ])
  .build()

const Part5TestCPU = component('Part5TestCPU')
  .in('reset', bit)
  .out('pc', bus(8))
  .out('reg_a', bus(8))
  .out('reg_x', bus(8))
  .out('reg_y', bus(8))
  .out('flag_c', bit)
  .out('flag_z', bit)
  .out('flag_n', bit)
  .out('mem_10', bus(8))
  .out('mem_11', bus(8))
  .node('pc_reg', Register)
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
  .node('sixteen', Constant, { value: 16 })
  .node('seventeen', Constant, { value: 17 })
  .node('byte_0', Constant, { value: 24 })
  .node('byte_1', Constant, { value: 169 })
  .node('byte_2', Constant, { value: 16 })
  .node('byte_3', Constant, { value: 105 })
  .node('byte_4', Constant, { value: 5 })
  .node('byte_5', Constant, { value: 105 })
  .node('byte_6', Constant, { value: 5 })
  .node('byte_7', Constant, { value: 56 })
  .node('byte_8', Constant, { value: 105 })
  .node('byte_9', Constant, { value: 5 })
  .node('byte_10', Constant, { value: 162 })
  .node('byte_11', Constant, { value: 66 })
  .node('byte_12', Constant, { value: 134 })
  .node('byte_13', Constant, { value: 16 })
  .node('byte_14', Constant, { value: 160 })
  .node('byte_15', Constant, { value: 85 })
  .node('byte_16', Constant, { value: 132 })
  .node('byte_17', Constant, { value: 17 })
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
  .node('at_16', Comparator)
  .node('at_17', Comparator)
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
  .node('rom_out', Mux)
  .node('state_reg', Register)
  .node('subcycle_reg', Register)
  .node('ir_reg', Register)
  .node('operand_reg', Register)
  .node('addr_reg', Register)
  .node('control', Part5Control)
  .node('registers', RegisterFile)
  .node('flags', FlagRegister)
  .node('memory', SimpleMemory)
  .node('mem_data_x_mux', Mux)
  .node('mem_data_y_mux', Mux)
  .node('adc_result', Adder)
  .node('result_a_adc', Mux)
  .node('always_on', Constant, { value: 1 })
  .node('pc_next', Mux)
  .node('split_a', Splitter8to8)
  .node('split_operand', Splitter8to8)
  .node('n_value_x', Mux)
  .node('n_value', Mux)
  .node('z_check_a', Comparator)
  .node('z_check_operand', Comparator)
  .node('z_value_x', Mux)
  .node('z_value', Mux)
  .node('c_from_adc', Mux)
  .node('c_from_sec', Mux)
  .node('c_value', Mux)
  .node('update_c_signal', Or)
  .node('addr_10', Constant, { value: 16 })
  .node('addr_11', Constant, { value: 17 })
  .node('at_addr_10', Comparator)
  .node('at_addr_11', Comparator)
  .connect(({ in: inp, out, pc_reg, pc_inc, zero, one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve, thirteen, fourteen, fifteen, sixteen, seventeen, byte_0, byte_1, byte_2, byte_3, byte_4, byte_5, byte_6, byte_7, byte_8, byte_9, byte_10, byte_11, byte_12, byte_13, byte_14, byte_15, byte_16, byte_17, at_0, at_1, at_2, at_3, at_4, at_5, at_6, at_7, at_8, at_9, at_10, at_11, at_12, at_13, at_14, at_15, at_16, at_17, mux1, mux2, mux3, mux4, mux5, mux6, mux7, mux8, mux9, mux10, mux11, mux12, mux13, mux14, mux15, mux16, rom_out, state_reg, subcycle_reg, ir_reg, operand_reg, addr_reg, control, registers, flags, memory, mem_data_x_mux, mem_data_y_mux, adc_result, result_a_adc, always_on, pc_next, split_a, split_operand, n_value_x, n_value, z_check_a, z_check_operand, z_value_x, z_value, c_from_adc, c_from_sec, c_value, update_c_signal, addr_10, addr_11, at_addr_10, at_addr_11 }) => [
    pc_reg.q.to(pc_inc.in, at_0.a, at_1.a, at_2.a, at_3.a, at_4.a, at_5.a, at_6.a, at_7.a, at_8.a, at_9.a, at_10.a, at_11.a, at_12.a, at_13.a, at_14.a, at_15.a, at_16.a, at_17.a, pc_next.in0, out.pc),
    zero.out.to(at_0.b, z_check_a.b, z_check_operand.b, c_value.in1, flags.new_v, flags.update_v),
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
    sixteen.out.to(at_16.b),
    seventeen.out.to(at_17.b),
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
    at_16.eq.to(mux16.sel),
    mux15.out.to(mux16.in0),
    byte_16.out.to(mux16.in1),
    at_17.eq.to(rom_out.sel),
    mux16.out.to(rom_out.in0),
    byte_17.out.to(rom_out.in1),
    state_reg.q.to(control.current_state),
    ir_reg.q.to(control.current_opcode),
    subcycle_reg.q.to(control.subcycle),
    flags.flag_c.to(control.flag_c, adc_result.carry_in, c_from_adc.in0, out.flag_c),
    addr_reg.q.to(memory.addr, at_addr_10.a, at_addr_11.a),
    control.mem_write.to(memory.write_enable),
    control.use_x_for_mem.to(mem_data_x_mux.sel),
    registers.reg_a.to(mem_data_x_mux.in0, adc_result.a, out.reg_a),
    registers.reg_x.to(mem_data_x_mux.in1, out.reg_x),
    control.use_y_for_mem.to(mem_data_y_mux.sel),
    mem_data_x_mux.out.to(mem_data_y_mux.in0),
    registers.reg_y.to(mem_data_y_mux.in1, out.reg_y),
    mem_data_y_mux.out.to(memory.data_in),
    operand_reg.q.to(adc_result.b, result_a_adc.in0, registers.data_x, registers.data_y, split_operand.in, z_check_operand.a),
    control.is_adc_imm.to(result_a_adc.sel, c_from_adc.sel),
    adc_result.sum.to(result_a_adc.in1),
    result_a_adc.out.to(registers.data_a, split_a.in, z_check_a.a),
    control.write_a.to(registers.write_a),
    control.write_x.to(registers.write_x, n_value_x.sel, z_value_x.sel),
    control.write_y.to(registers.write_y, n_value.sel, z_value.sel),
    always_on.out.to(state_reg.we, subcycle_reg.we, pc_reg.we, c_from_sec.in1),
    control.next_state.to(state_reg.data),
    control.next_subcycle.to(subcycle_reg.data),
    control.ir_load.to(ir_reg.we),
    rom_out.out.to(ir_reg.data, operand_reg.data, addr_reg.data),
    control.operand_load.to(operand_reg.we),
    control.addr_lo_load.to(addr_reg.we),
    control.pc_increment.to(pc_next.sel),
    pc_inc.out.to(pc_next.in1),
    pc_next.out.to(pc_reg.data),
    split_a.bit7.to(n_value_x.in0),
    split_operand.bit7.to(n_value_x.in1, n_value.in1),
    n_value_x.out.to(n_value.in0),
    n_value.out.to(flags.new_n),
    z_check_a.eq.to(z_value_x.in0),
    z_check_operand.eq.to(z_value_x.in1, z_value.in1),
    z_value_x.out.to(z_value.in0),
    z_value.out.to(flags.new_z),
    adc_result.carry_out.to(c_from_adc.in1),
    control.set_c.to(c_from_sec.sel),
    c_from_adc.out.to(c_from_sec.in0),
    control.clear_c.to(c_value.sel),
    c_from_sec.out.to(c_value.in0),
    c_value.out.to(flags.new_c),
    control.update_flags.to(flags.update_n, flags.update_z, update_c_signal.a),
    control.update_c_only.to(update_c_signal.b),
    update_c_signal.out.to(flags.update_c),
    flags.flag_z.to(out.flag_z),
    flags.flag_n.to(out.flag_n),
    addr_10.out.to(at_addr_10.b),
    addr_11.out.to(at_addr_11.b),
    memory.data_out.to(out.mem_10, out.mem_11),
  ])
  .build()

const Part5Test = component('Part5Test')
  .out('pc', bus(8))
  .out('reg_a', bus(8))
  .out('reg_x', bus(8))
  .out('reg_y', bus(8))
  .out('flag_c', bit)
  .out('flag_z', bit)
  .out('flag_n', bit)
  .node('zero', Constant, { value: 0 })
  .node('cpu', Part5TestCPU)
  .connect(({ in: inp, out, zero, cpu }) => [
    zero.out.to(cpu.reset),
    cpu.pc.to(out.pc),
    cpu.reg_a.to(out.reg_a),
    cpu.reg_x.to(out.reg_x),
    cpu.reg_y.to(out.reg_y),
    cpu.flag_c.to(out.flag_c),
    cpu.flag_z.to(out.flag_z),
    cpu.flag_n.to(out.flag_n),
  ])
  .build()
