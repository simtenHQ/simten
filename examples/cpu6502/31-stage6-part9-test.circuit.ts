// Auto-generated from DSL

const SimpleMemory = component('SimpleMemory')
  .in('addr', bus(8))
  .in('data_in', bus(8))
  .in('write_enable', bit)
  .out('data_out', bus(8))
  .node('zero', Constant, { value: 0 })
  .node('addr_10', Constant, { value: 16 })
  .node('addr_11', Constant, { value: 17 })
  .node('at_10', Comparator)
  .node('at_11', Comparator)
  .node('mem_10', Register)
  .node('mem_11', Register)
  .node('we_10', And)
  .node('we_11', And)
  .node('out_10', Mux)
  .node('out_11', Mux)
  .connect(({ in: inp, out, zero, addr_10, addr_11, at_10, at_11, mem_10, mem_11, we_10, we_11, out_10, out_11 }) => [
    inp.addr.to(at_10.a, at_11.a),
    addr_10.out.to(at_10.b),
    addr_11.out.to(at_11.b),
    inp.data_in.to(mem_10.data, mem_11.data),
    inp.write_enable.to(we_10.a, we_11.a),
    at_10.eq.to(we_10.b, out_10.sel),
    at_11.eq.to(we_11.b, out_11.sel),
    we_10.out.to(mem_10.we),
    we_11.out.to(mem_11.we),
    zero.out.to(out_10.in0),
    mem_10.q.to(out_10.in1),
    out_10.out.to(out_11.in0),
    mem_11.q.to(out_11.in1),
    out_11.out.to(out.data_out),
  ])
  .build()

const FlagRegister = component('FlagRegister')
  .in('new_n', bit)
  .in('new_z', bit)
  .in('new_c', bit)
  .in('update_n', bit)
  .in('update_z', bit)
  .in('update_c', bit)
  .out('flag_n', bit)
  .out('flag_z', bit)
  .out('flag_c', bit)
  .node('reg_n', Register)
  .node('reg_z', Register)
  .node('reg_c', Register)
  .connect(({ in: inp, out, reg_n, reg_z, reg_c }) => [
    inp.new_n.to(reg_n.data),
    inp.new_z.to(reg_z.data),
    inp.new_c.to(reg_c.data),
    inp.update_n.to(reg_n.we),
    inp.update_z.to(reg_z.we),
    inp.update_c.to(reg_c.we),
    reg_n.q.to(out.flag_n),
    reg_z.q.to(out.flag_z),
    reg_c.q.to(out.flag_c),
  ])
  .build()

const Part9TestCPU = component('Part9TestCPU')
  .in('reset', bit)
  .out('pc', bus(8))
  .out('reg_a', bus(8))
  .out('flag_n', bit)
  .out('flag_z', bit)
  .out('flag_c', bit)
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('pc_reg', Register)
  .node('pc_inc', Incrementer)
  .node('state_reg', Register)
  .node('always_on', Constant, { value: 1 })
  .node('STATE_FETCH', Constant, { value: 0 })
  .node('STATE_DECODE', Constant, { value: 1 })
  .node('STATE_EXECUTE', Constant, { value: 2 })
  .node('is_fetch', Comparator)
  .node('is_decode', Comparator)
  .node('is_execute', Comparator)
  .node('subcycle_reg', Register)
  .node('sub_inc', Incrementer)
  .node('subcycle_next', Mux)
  .node('two', Constant, { value: 2 })
  .node('three', Constant, { value: 3 })
  .node('four', Constant, { value: 4 })
  .node('is_sub0', Comparator)
  .node('is_sub1', Comparator)
  .node('is_sub2', Comparator)
  .node('is_sub3', Comparator)
  .node('is_sub4', Comparator)
  .node('ir_reg', Register)
  .node('operand_reg', Register)
  .node('a_reg', Register)
  .node('flags', FlagRegister)
  .node('byte_00', Constant, { value: 169 })
  .node('byte_01', Constant, { value: 65 })
  .node('byte_02', Constant, { value: 133 })
  .node('byte_03', Constant, { value: 16 })
  .node('byte_04', Constant, { value: 6 })
  .node('byte_05', Constant, { value: 16 })
  .node('byte_06', Constant, { value: 165 })
  .node('byte_07', Constant, { value: 16 })
  .node('byte_08', Constant, { value: 6 })
  .node('byte_09', Constant, { value: 16 })
  .node('byte_0A', Constant, { value: 169 })
  .node('byte_0B', Constant, { value: 130 })
  .node('byte_0C', Constant, { value: 133 })
  .node('byte_0D', Constant, { value: 16 })
  .node('byte_0E', Constant, { value: 70 })
  .node('byte_0F', Constant, { value: 16 })
  .node('byte_10', Constant, { value: 165 })
  .node('byte_11', Constant, { value: 16 })
  .node('byte_12', Constant, { value: 56 })
  .node('byte_13', Constant, { value: 169 })
  .node('byte_14', Constant, { value: 128 })
  .node('byte_15', Constant, { value: 133 })
  .node('byte_16', Constant, { value: 16 })
  .node('byte_17', Constant, { value: 38 })
  .node('byte_18', Constant, { value: 16 })
  .node('byte_19', Constant, { value: 165 })
  .node('byte_1A', Constant, { value: 16 })
  .node('byte_1B', Constant, { value: 56 })
  .node('byte_1C', Constant, { value: 169 })
  .node('byte_1D', Constant, { value: 1 })
  .node('byte_1E', Constant, { value: 133 })
  .node('byte_1F', Constant, { value: 16 })
  .node('byte_20', Constant, { value: 102 })
  .node('byte_21', Constant, { value: 16 })
  .node('byte_22', Constant, { value: 165 })
  .node('byte_23', Constant, { value: 16 })
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
  .node('eighteen', Constant, { value: 18 })
  .node('nineteen', Constant, { value: 19 })
  .node('twenty', Constant, { value: 20 })
  .node('twentyone', Constant, { value: 21 })
  .node('twentytwo', Constant, { value: 22 })
  .node('twentythree', Constant, { value: 23 })
  .node('twentyfour', Constant, { value: 24 })
  .node('twentyfive', Constant, { value: 25 })
  .node('twentysix', Constant, { value: 26 })
  .node('twentyseven', Constant, { value: 27 })
  .node('twentyeight', Constant, { value: 28 })
  .node('twentynine', Constant, { value: 29 })
  .node('thirty', Constant, { value: 30 })
  .node('thirtyone', Constant, { value: 31 })
  .node('thirtytwo', Constant, { value: 32 })
  .node('thirtythree', Constant, { value: 33 })
  .node('thirtyfour', Constant, { value: 34 })
  .node('thirtyfive', Constant, { value: 35 })
  .node('at_01', Comparator)
  .node('at_02', Comparator)
  .node('at_03', Comparator)
  .node('at_04', Comparator)
  .node('at_05', Comparator)
  .node('at_06', Comparator)
  .node('at_07', Comparator)
  .node('at_08', Comparator)
  .node('at_09', Comparator)
  .node('at_0A', Comparator)
  .node('at_0B', Comparator)
  .node('at_0C', Comparator)
  .node('at_0D', Comparator)
  .node('at_0E', Comparator)
  .node('at_0F', Comparator)
  .node('at_10', Comparator)
  .node('at_11', Comparator)
  .node('at_12', Comparator)
  .node('at_13', Comparator)
  .node('at_14', Comparator)
  .node('at_15', Comparator)
  .node('at_16', Comparator)
  .node('at_17', Comparator)
  .node('at_18', Comparator)
  .node('at_19', Comparator)
  .node('at_1A', Comparator)
  .node('at_1B', Comparator)
  .node('at_1C', Comparator)
  .node('at_1D', Comparator)
  .node('at_1E', Comparator)
  .node('at_1F', Comparator)
  .node('at_20', Comparator)
  .node('at_21', Comparator)
  .node('at_22', Comparator)
  .node('at_23', Comparator)
  .node('mux_01', Mux)
  .node('mux_02', Mux)
  .node('mux_03', Mux)
  .node('mux_04', Mux)
  .node('mux_05', Mux)
  .node('mux_06', Mux)
  .node('mux_07', Mux)
  .node('mux_08', Mux)
  .node('mux_09', Mux)
  .node('mux_0A', Mux)
  .node('mux_0B', Mux)
  .node('mux_0C', Mux)
  .node('mux_0D', Mux)
  .node('mux_0E', Mux)
  .node('mux_0F', Mux)
  .node('mux_10', Mux)
  .node('mux_11', Mux)
  .node('mux_12', Mux)
  .node('mux_13', Mux)
  .node('mux_14', Mux)
  .node('mux_15', Mux)
  .node('mux_16', Mux)
  .node('mux_17', Mux)
  .node('mux_18', Mux)
  .node('mux_19', Mux)
  .node('mux_1A', Mux)
  .node('mux_1B', Mux)
  .node('mux_1C', Mux)
  .node('mux_1D', Mux)
  .node('mux_1E', Mux)
  .node('mux_1F', Mux)
  .node('mux_20', Mux)
  .node('mux_21', Mux)
  .node('mux_22', Mux)
  .node('rom', Mux)
  .node('LDA_IMM', Constant, { value: 169 })
  .node('LDA_ZP', Constant, { value: 165 })
  .node('STA_ZP', Constant, { value: 133 })
  .node('SEC', Constant, { value: 56 })
  .node('ASL_ZP', Constant, { value: 6 })
  .node('LSR_ZP', Constant, { value: 70 })
  .node('ROL_ZP', Constant, { value: 38 })
  .node('ROR_ZP', Constant, { value: 102 })
  .node('cmp_lda_imm', Comparator)
  .node('cmp_lda_zp', Comparator)
  .node('cmp_sta_zp', Comparator)
  .node('cmp_sec', Comparator)
  .node('cmp_asl_zp', Comparator)
  .node('cmp_lsr_zp', Comparator)
  .node('cmp_rol_zp', Comparator)
  .node('cmp_ror_zp', Comparator)
  .node('is_rmw_1', Or)
  .node('is_rmw_2', Or)
  .node('is_rmw', Or)
  .node('is_zp_1', Or)
  .node('is_zp', Or)
  .node('exec_sub0', And)
  .node('exec_sub1', And)
  .node('exec_sub2', And)
  .node('exec_sub3', And)
  .node('exec_sub4', And)
  .node('done_lda_imm', And)
  .node('done_sec', And)
  .node('not_rmw', Not)
  .node('is_zp_non_rmw', And)
  .node('done_zp', And)
  .node('done_rmw', And)
  .node('done_temp1', Or)
  .node('done_temp2', Or)
  .node('exec_done', Or)
  .node('next_from_fetch', Mux)
  .node('next_from_decode', Mux)
  .node('next_from_execute', Mux)
  .node('next_state', Mux)
  .node('needs_operand_1', Or)
  .node('pc_inc_sub0', And)
  .node('pc_inc_signal', Or)
  .node('pc_next', Mux)
  .node('pc_reset', Mux)
  .node('operand_load', And)
  .node('memory', SimpleMemory)
  .node('is_load_or_rmw', Or)
  .node('mem_read', And)
  .node('mem_write_sta', And)
  .node('mem_write_rmw', And)
  .node('mem_write', Or)
  .node('mem_bits', Splitter8to8)
  .node('mem_shift_one', Constant, { value: 1 })
  .node('asl_mem', LeftShifter)
  .node('lsr_mem', RightShifter)
  .node('rol_mem', Adder)
  .node('c_times_128', Constant, { value: 128 })
  .node('ror_add_val', Mux)
  .node('ror_mem', Adder)
  .node('rmw_asl_or_lsr', Mux)
  .node('rmw_or_rol', Mux)
  .node('rmw_result', Mux)
  .node('mem_data_in', Mux)
  .node('load_a_imm', And)
  .node('load_a_zp', And)
  .node('load_a', Or)
  .node('a_data', Mux)
  .node('update_nz_rmw', And)
  .node('update_c_sec', And)
  .node('update_c', Or)
  .node('const_128', Constant, { value: 128 })
  .node('n_check', Comparator)
  .node('n_flag_val', Or)
  .node('z_check', Comparator)
  .node('c_from_asl_rol', Mux)
  .node('c_with_rol', Mux)
  .node('c_with_lsr', Mux)
  .node('c_with_ror', Mux)
  .node('const_true', Constant, { value: 1 })
  .node('c_from_sec', Mux)
  .connect(({ in: inp, out, zero, one, pc_reg, pc_inc, state_reg, always_on, STATE_FETCH, STATE_DECODE, STATE_EXECUTE, is_fetch, is_decode, is_execute, subcycle_reg, sub_inc, subcycle_next, two, three, four, is_sub0, is_sub1, is_sub2, is_sub3, is_sub4, ir_reg, operand_reg, a_reg, flags, byte_00, byte_01, byte_02, byte_03, byte_04, byte_05, byte_06, byte_07, byte_08, byte_09, byte_0A, byte_0B, byte_0C, byte_0D, byte_0E, byte_0F, byte_10, byte_11, byte_12, byte_13, byte_14, byte_15, byte_16, byte_17, byte_18, byte_19, byte_1A, byte_1B, byte_1C, byte_1D, byte_1E, byte_1F, byte_20, byte_21, byte_22, byte_23, five, six, seven, eight, nine, ten, eleven, twelve, thirteen, fourteen, fifteen, sixteen, seventeen, eighteen, nineteen, twenty, twentyone, twentytwo, twentythree, twentyfour, twentyfive, twentysix, twentyseven, twentyeight, twentynine, thirty, thirtyone, thirtytwo, thirtythree, thirtyfour, thirtyfive, at_01, at_02, at_03, at_04, at_05, at_06, at_07, at_08, at_09, at_0A, at_0B, at_0C, at_0D, at_0E, at_0F, at_10, at_11, at_12, at_13, at_14, at_15, at_16, at_17, at_18, at_19, at_1A, at_1B, at_1C, at_1D, at_1E, at_1F, at_20, at_21, at_22, at_23, mux_01, mux_02, mux_03, mux_04, mux_05, mux_06, mux_07, mux_08, mux_09, mux_0A, mux_0B, mux_0C, mux_0D, mux_0E, mux_0F, mux_10, mux_11, mux_12, mux_13, mux_14, mux_15, mux_16, mux_17, mux_18, mux_19, mux_1A, mux_1B, mux_1C, mux_1D, mux_1E, mux_1F, mux_20, mux_21, mux_22, rom, LDA_IMM, LDA_ZP, STA_ZP, SEC, ASL_ZP, LSR_ZP, ROL_ZP, ROR_ZP, cmp_lda_imm, cmp_lda_zp, cmp_sta_zp, cmp_sec, cmp_asl_zp, cmp_lsr_zp, cmp_rol_zp, cmp_ror_zp, is_rmw_1, is_rmw_2, is_rmw, is_zp_1, is_zp, exec_sub0, exec_sub1, exec_sub2, exec_sub3, exec_sub4, done_lda_imm, done_sec, not_rmw, is_zp_non_rmw, done_zp, done_rmw, done_temp1, done_temp2, exec_done, next_from_fetch, next_from_decode, next_from_execute, next_state, needs_operand_1, pc_inc_sub0, pc_inc_signal, pc_next, pc_reset, operand_load, memory, is_load_or_rmw, mem_read, mem_write_sta, mem_write_rmw, mem_write, mem_bits, mem_shift_one, asl_mem, lsr_mem, rol_mem, c_times_128, ror_add_val, ror_mem, rmw_asl_or_lsr, rmw_or_rol, rmw_result, mem_data_in, load_a_imm, load_a_zp, load_a, a_data, update_nz_rmw, update_c_sec, update_c, const_128, n_check, n_flag_val, z_check, c_from_asl_rol, c_with_rol, c_with_lsr, c_with_ror, const_true, c_from_sec }) => [
    pc_reg.q.to(pc_inc.in, at_01.a, at_02.a, at_03.a, at_04.a, at_05.a, at_06.a, at_07.a, at_08.a, at_09.a, at_0A.a, at_0B.a, at_0C.a, at_0D.a, at_0E.a, at_0F.a, at_10.a, at_11.a, at_12.a, at_13.a, at_14.a, at_15.a, at_16.a, at_17.a, at_18.a, at_19.a, at_1A.a, at_1B.a, at_1C.a, at_1D.a, at_1E.a, at_1F.a, at_20.a, at_21.a, at_22.a, at_23.a, pc_next.in0, out.pc),
    always_on.out.to(state_reg.we, subcycle_reg.we, pc_reg.we),
    state_reg.q.to(is_fetch.a, is_decode.a, is_execute.a, next_from_fetch.in0),
    STATE_FETCH.out.to(is_fetch.b, next_from_execute.in1, next_state.in1),
    STATE_DECODE.out.to(is_decode.b, next_from_fetch.in1),
    STATE_EXECUTE.out.to(is_execute.b, next_from_decode.in1),
    subcycle_reg.q.to(sub_inc.in, is_sub0.a, is_sub1.a, is_sub2.a, is_sub3.a, is_sub4.a),
    is_execute.eq.to(subcycle_next.sel, exec_sub0.a, exec_sub1.a, exec_sub2.a, exec_sub3.a, exec_sub4.a),
    zero.out.to(subcycle_next.in0, is_sub0.b, pc_reset.in1, rol_mem.b, ror_add_val.in0, ror_mem.carry_in, z_check.b, c_from_asl_rol.in0),
    sub_inc.out.to(subcycle_next.in1),
    subcycle_next.out.to(subcycle_reg.data),
    one.out.to(is_sub1.b, at_01.b),
    two.out.to(is_sub2.b, at_02.b),
    three.out.to(is_sub3.b, at_03.b),
    four.out.to(is_sub4.b, at_04.b),
    is_fetch.eq.to(ir_reg.we, next_from_fetch.sel, pc_inc_signal.a),
    five.out.to(at_05.b),
    six.out.to(at_06.b),
    seven.out.to(at_07.b),
    eight.out.to(at_08.b),
    nine.out.to(at_09.b),
    ten.out.to(at_0A.b),
    eleven.out.to(at_0B.b),
    twelve.out.to(at_0C.b),
    thirteen.out.to(at_0D.b),
    fourteen.out.to(at_0E.b),
    fifteen.out.to(at_0F.b),
    sixteen.out.to(at_10.b),
    seventeen.out.to(at_11.b),
    eighteen.out.to(at_12.b),
    nineteen.out.to(at_13.b),
    twenty.out.to(at_14.b),
    twentyone.out.to(at_15.b),
    twentytwo.out.to(at_16.b),
    twentythree.out.to(at_17.b),
    twentyfour.out.to(at_18.b),
    twentyfive.out.to(at_19.b),
    twentysix.out.to(at_1A.b),
    twentyseven.out.to(at_1B.b),
    twentyeight.out.to(at_1C.b),
    twentynine.out.to(at_1D.b),
    thirty.out.to(at_1E.b),
    thirtyone.out.to(at_1F.b),
    thirtytwo.out.to(at_20.b),
    thirtythree.out.to(at_21.b),
    thirtyfour.out.to(at_22.b),
    thirtyfive.out.to(at_23.b),
    at_01.eq.to(mux_01.sel),
    byte_00.out.to(mux_01.in0),
    byte_01.out.to(mux_01.in1),
    at_02.eq.to(mux_02.sel),
    mux_01.out.to(mux_02.in0),
    byte_02.out.to(mux_02.in1),
    at_03.eq.to(mux_03.sel),
    mux_02.out.to(mux_03.in0),
    byte_03.out.to(mux_03.in1),
    at_04.eq.to(mux_04.sel),
    mux_03.out.to(mux_04.in0),
    byte_04.out.to(mux_04.in1),
    at_05.eq.to(mux_05.sel),
    mux_04.out.to(mux_05.in0),
    byte_05.out.to(mux_05.in1),
    at_06.eq.to(mux_06.sel),
    mux_05.out.to(mux_06.in0),
    byte_06.out.to(mux_06.in1),
    at_07.eq.to(mux_07.sel),
    mux_06.out.to(mux_07.in0),
    byte_07.out.to(mux_07.in1),
    at_08.eq.to(mux_08.sel),
    mux_07.out.to(mux_08.in0),
    byte_08.out.to(mux_08.in1),
    at_09.eq.to(mux_09.sel),
    mux_08.out.to(mux_09.in0),
    byte_09.out.to(mux_09.in1),
    at_0A.eq.to(mux_0A.sel),
    mux_09.out.to(mux_0A.in0),
    byte_0A.out.to(mux_0A.in1),
    at_0B.eq.to(mux_0B.sel),
    mux_0A.out.to(mux_0B.in0),
    byte_0B.out.to(mux_0B.in1),
    at_0C.eq.to(mux_0C.sel),
    mux_0B.out.to(mux_0C.in0),
    byte_0C.out.to(mux_0C.in1),
    at_0D.eq.to(mux_0D.sel),
    mux_0C.out.to(mux_0D.in0),
    byte_0D.out.to(mux_0D.in1),
    at_0E.eq.to(mux_0E.sel),
    mux_0D.out.to(mux_0E.in0),
    byte_0E.out.to(mux_0E.in1),
    at_0F.eq.to(mux_0F.sel),
    mux_0E.out.to(mux_0F.in0),
    byte_0F.out.to(mux_0F.in1),
    at_10.eq.to(mux_10.sel),
    mux_0F.out.to(mux_10.in0),
    byte_10.out.to(mux_10.in1),
    at_11.eq.to(mux_11.sel),
    mux_10.out.to(mux_11.in0),
    byte_11.out.to(mux_11.in1),
    at_12.eq.to(mux_12.sel),
    mux_11.out.to(mux_12.in0),
    byte_12.out.to(mux_12.in1),
    at_13.eq.to(mux_13.sel),
    mux_12.out.to(mux_13.in0),
    byte_13.out.to(mux_13.in1),
    at_14.eq.to(mux_14.sel),
    mux_13.out.to(mux_14.in0),
    byte_14.out.to(mux_14.in1),
    at_15.eq.to(mux_15.sel),
    mux_14.out.to(mux_15.in0),
    byte_15.out.to(mux_15.in1),
    at_16.eq.to(mux_16.sel),
    mux_15.out.to(mux_16.in0),
    byte_16.out.to(mux_16.in1),
    at_17.eq.to(mux_17.sel),
    mux_16.out.to(mux_17.in0),
    byte_17.out.to(mux_17.in1),
    at_18.eq.to(mux_18.sel),
    mux_17.out.to(mux_18.in0),
    byte_18.out.to(mux_18.in1),
    at_19.eq.to(mux_19.sel),
    mux_18.out.to(mux_19.in0),
    byte_19.out.to(mux_19.in1),
    at_1A.eq.to(mux_1A.sel),
    mux_19.out.to(mux_1A.in0),
    byte_1A.out.to(mux_1A.in1),
    at_1B.eq.to(mux_1B.sel),
    mux_1A.out.to(mux_1B.in0),
    byte_1B.out.to(mux_1B.in1),
    at_1C.eq.to(mux_1C.sel),
    mux_1B.out.to(mux_1C.in0),
    byte_1C.out.to(mux_1C.in1),
    at_1D.eq.to(mux_1D.sel),
    mux_1C.out.to(mux_1D.in0),
    byte_1D.out.to(mux_1D.in1),
    at_1E.eq.to(mux_1E.sel),
    mux_1D.out.to(mux_1E.in0),
    byte_1E.out.to(mux_1E.in1),
    at_1F.eq.to(mux_1F.sel),
    mux_1E.out.to(mux_1F.in0),
    byte_1F.out.to(mux_1F.in1),
    at_20.eq.to(mux_20.sel),
    mux_1F.out.to(mux_20.in0),
    byte_20.out.to(mux_20.in1),
    at_21.eq.to(mux_21.sel),
    mux_20.out.to(mux_21.in0),
    byte_21.out.to(mux_21.in1),
    at_22.eq.to(mux_22.sel),
    mux_21.out.to(mux_22.in0),
    byte_22.out.to(mux_22.in1),
    at_23.eq.to(rom.sel),
    mux_22.out.to(rom.in0),
    byte_23.out.to(rom.in1),
    rom.out.to(ir_reg.data, operand_reg.data),
    ir_reg.q.to(cmp_lda_imm.a, cmp_lda_zp.a, cmp_sta_zp.a, cmp_sec.a, cmp_asl_zp.a, cmp_lsr_zp.a, cmp_rol_zp.a, cmp_ror_zp.a),
    LDA_IMM.out.to(cmp_lda_imm.b),
    LDA_ZP.out.to(cmp_lda_zp.b),
    STA_ZP.out.to(cmp_sta_zp.b),
    SEC.out.to(cmp_sec.b),
    ASL_ZP.out.to(cmp_asl_zp.b),
    LSR_ZP.out.to(cmp_lsr_zp.b),
    ROL_ZP.out.to(cmp_rol_zp.b),
    ROR_ZP.out.to(cmp_ror_zp.b),
    cmp_asl_zp.eq.to(is_rmw_1.a, rmw_asl_or_lsr.sel, c_from_asl_rol.sel),
    cmp_lsr_zp.eq.to(is_rmw_1.b, c_with_lsr.sel),
    cmp_rol_zp.eq.to(is_rmw_2.a, rmw_or_rol.sel, c_with_rol.sel),
    cmp_ror_zp.eq.to(is_rmw_2.b, rmw_result.sel, c_with_ror.sel),
    is_rmw_1.out.to(is_rmw.a),
    is_rmw_2.out.to(is_rmw.b),
    cmp_lda_zp.eq.to(is_zp_1.a, is_load_or_rmw.a, load_a_zp.b, a_data.sel),
    cmp_sta_zp.eq.to(is_zp_1.b, mem_write_sta.b),
    is_zp_1.out.to(is_zp.a),
    is_rmw.out.to(is_zp.b, not_rmw.in, done_rmw.b, is_load_or_rmw.b, mem_write_rmw.b, mem_data_in.sel, update_nz_rmw.b),
    is_sub0.eq.to(exec_sub0.b),
    is_sub1.eq.to(exec_sub1.b),
    is_sub2.eq.to(exec_sub2.b),
    is_sub3.eq.to(exec_sub3.b),
    is_sub4.eq.to(exec_sub4.b),
    exec_sub1.out.to(done_lda_imm.a, load_a_imm.a),
    cmp_lda_imm.eq.to(done_lda_imm.b, needs_operand_1.a, load_a_imm.b),
    exec_sub0.out.to(done_sec.a, pc_inc_sub0.a, operand_load.a, update_c_sec.a),
    cmp_sec.eq.to(done_sec.b, update_c_sec.b, c_from_sec.sel),
    is_zp.out.to(is_zp_non_rmw.a, needs_operand_1.b),
    not_rmw.out.to(is_zp_non_rmw.b),
    exec_sub3.out.to(done_zp.a, mem_write_rmw.a, load_a_zp.a, update_nz_rmw.a),
    is_zp_non_rmw.out.to(done_zp.b),
    exec_sub4.out.to(done_rmw.a),
    done_lda_imm.out.to(done_temp1.a),
    done_sec.out.to(done_temp1.b),
    done_temp1.out.to(done_temp2.a),
    done_zp.out.to(done_temp2.b),
    done_temp2.out.to(exec_done.a),
    done_rmw.out.to(exec_done.b),
    is_decode.eq.to(next_from_decode.sel),
    next_from_fetch.out.to(next_from_decode.in0),
    exec_done.out.to(next_from_execute.sel),
    next_from_decode.out.to(next_from_execute.in0),
    inp.reset.to(next_state.sel, pc_reset.sel),
    next_from_execute.out.to(next_state.in0),
    next_state.out.to(state_reg.data),
    needs_operand_1.out.to(pc_inc_sub0.b, operand_load.b),
    pc_inc_sub0.out.to(pc_inc_signal.b),
    pc_inc_signal.out.to(pc_next.sel),
    pc_inc.out.to(pc_next.in1),
    pc_next.out.to(pc_reset.in0),
    pc_reset.out.to(pc_reg.data),
    operand_load.out.to(operand_reg.we),
    operand_reg.q.to(memory.addr, a_data.in0),
    exec_sub2.out.to(mem_read.a, mem_write_sta.a),
    is_load_or_rmw.out.to(mem_read.b),
    mem_write_sta.out.to(mem_write.a),
    mem_write_rmw.out.to(mem_write.b),
    mem_write.out.to(memory.write_enable),
    memory.data_out.to(mem_bits.in, asl_mem.value, lsr_mem.value, a_data.in1),
    mem_shift_one.out.to(asl_mem.shift, lsr_mem.shift),
    asl_mem.result.to(rol_mem.a, rmw_asl_or_lsr.in1),
    flags.flag_c.to(rol_mem.carry_in, ror_add_val.sel, out.flag_c),
    c_times_128.out.to(ror_add_val.in1),
    lsr_mem.result.to(ror_mem.a, rmw_asl_or_lsr.in0),
    ror_add_val.out.to(ror_mem.b),
    rmw_asl_or_lsr.out.to(rmw_or_rol.in0),
    rol_mem.sum.to(rmw_or_rol.in1),
    rmw_or_rol.out.to(rmw_result.in0),
    ror_mem.sum.to(rmw_result.in1),
    a_reg.q.to(mem_data_in.in0, out.reg_a),
    rmw_result.out.to(mem_data_in.in1, n_check.a, z_check.a),
    mem_data_in.out.to(memory.data_in),
    load_a_imm.out.to(load_a.a),
    load_a_zp.out.to(load_a.b),
    load_a.out.to(a_reg.we),
    a_data.out.to(a_reg.data),
    update_nz_rmw.out.to(flags.update_n, flags.update_z, update_c.b),
    update_c_sec.out.to(update_c.a),
    update_c.out.to(flags.update_c),
    const_128.out.to(n_check.b),
    n_check.gt.to(n_flag_val.a),
    n_check.eq.to(n_flag_val.b),
    n_flag_val.out.to(flags.new_n),
    z_check.eq.to(flags.new_z),
    mem_bits.bit7.to(c_from_asl_rol.in1, c_with_rol.in1),
    c_from_asl_rol.out.to(c_with_rol.in0),
    c_with_rol.out.to(c_with_lsr.in0),
    mem_bits.bit0.to(c_with_lsr.in1, c_with_ror.in1),
    c_with_lsr.out.to(c_with_ror.in0),
    c_with_ror.out.to(c_from_sec.in0),
    const_true.out.to(c_from_sec.in1),
    c_from_sec.out.to(flags.new_c),
    flags.flag_n.to(out.flag_n),
    flags.flag_z.to(out.flag_z),
  ])
  .build()

const Part9Test = component('Part9Test')
  .out('pc', bus(8))
  .out('reg_a', bus(8))
  .out('flag_n', bit)
  .out('flag_z', bit)
  .out('flag_c', bit)
  .node('zero', Constant, { value: 0 })
  .node('cpu', Part9TestCPU)
  .connect(({ in: inp, out, zero, cpu }) => [
    zero.out.to(cpu.reset),
    cpu.pc.to(out.pc),
    cpu.reg_a.to(out.reg_a),
    cpu.flag_n.to(out.flag_n),
    cpu.flag_z.to(out.flag_z),
    cpu.flag_c.to(out.flag_c),
  ])
  .build()
