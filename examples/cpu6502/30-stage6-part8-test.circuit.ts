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

const Part8TestCPU = component('Part8TestCPU')
  .in('reset', bit)
  .out('pc', bus(8))
  .out('reg_a', bus(8))
  .out('mem_10', bus(8))
  .out('mem_11', bus(8))
  .out('flag_n', bit)
  .out('flag_z', bit)
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
  .node('n_reg', Register)
  .node('z_reg', Register)
  .node('byte_00', Constant, { value: 169 })
  .node('byte_01', Constant, { value: 5 })
  .node('byte_02', Constant, { value: 133 })
  .node('byte_03', Constant, { value: 16 })
  .node('byte_04', Constant, { value: 230 })
  .node('byte_05', Constant, { value: 16 })
  .node('byte_06', Constant, { value: 165 })
  .node('byte_07', Constant, { value: 16 })
  .node('byte_08', Constant, { value: 198 })
  .node('byte_09', Constant, { value: 16 })
  .node('byte_0A', Constant, { value: 165 })
  .node('byte_0B', Constant, { value: 16 })
  .node('byte_0C', Constant, { value: 169 })
  .node('byte_0D', Constant, { value: 0 })
  .node('byte_0E', Constant, { value: 133 })
  .node('byte_0F', Constant, { value: 17 })
  .node('byte_10', Constant, { value: 198 })
  .node('byte_11', Constant, { value: 17 })
  .node('byte_12', Constant, { value: 165 })
  .node('byte_13', Constant, { value: 17 })
  .node('byte_14', Constant, { value: 230 })
  .node('byte_15', Constant, { value: 17 })
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
  .node('at_00', Comparator)
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
  .node('rom', Mux)
  .node('LDA_IMM', Constant, { value: 169 })
  .node('LDA_ZP', Constant, { value: 165 })
  .node('STA_ZP', Constant, { value: 133 })
  .node('INC_ZP', Constant, { value: 230 })
  .node('DEC_ZP', Constant, { value: 198 })
  .node('cmp_lda_imm', Comparator)
  .node('cmp_lda_zp', Comparator)
  .node('cmp_sta_zp', Comparator)
  .node('cmp_inc_zp', Comparator)
  .node('cmp_dec_zp', Comparator)
  .node('is_rmw', Or)
  .node('is_zp_1', Or)
  .node('is_zp', Or)
  .node('exec_sub0', And)
  .node('exec_sub1', And)
  .node('exec_sub2', And)
  .node('exec_sub3', And)
  .node('exec_sub4', And)
  .node('done_lda_imm', And)
  .node('not_rmw', Not)
  .node('is_zp_non_rmw', And)
  .node('done_zp', And)
  .node('done_rmw', And)
  .node('done_temp', Or)
  .node('exec_done', Or)
  .node('next_from_fetch', Mux)
  .node('next_from_decode', Mux)
  .node('next_from_execute', Mux)
  .node('next_state', Mux)
  .node('needs_operand', Or)
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
  .node('inc_mem', Incrementer)
  .node('dec_mem', Subtractor)
  .node('rmw_result', Mux)
  .node('mem_data_in', Mux)
  .node('load_a_imm', And)
  .node('load_a_zp', And)
  .node('load_a', Or)
  .node('a_data', Mux)
  .node('update_flags', And)
  .node('const_128', Constant, { value: 128 })
  .node('n_check', Comparator)
  .node('n_flag_val', Or)
  .node('z_check', Comparator)
  .connect(({ in: inp, out, zero, one, pc_reg, pc_inc, state_reg, always_on, STATE_FETCH, STATE_DECODE, STATE_EXECUTE, is_fetch, is_decode, is_execute, subcycle_reg, sub_inc, subcycle_next, two, three, four, is_sub0, is_sub1, is_sub2, is_sub3, is_sub4, ir_reg, operand_reg, a_reg, n_reg, z_reg, byte_00, byte_01, byte_02, byte_03, byte_04, byte_05, byte_06, byte_07, byte_08, byte_09, byte_0A, byte_0B, byte_0C, byte_0D, byte_0E, byte_0F, byte_10, byte_11, byte_12, byte_13, byte_14, byte_15, five, six, seven, eight, nine, ten, eleven, twelve, thirteen, fourteen, fifteen, sixteen, seventeen, eighteen, nineteen, twenty, twentyone, at_00, at_01, at_02, at_03, at_04, at_05, at_06, at_07, at_08, at_09, at_0A, at_0B, at_0C, at_0D, at_0E, at_0F, at_10, at_11, at_12, at_13, at_14, at_15, mux_01, mux_02, mux_03, mux_04, mux_05, mux_06, mux_07, mux_08, mux_09, mux_0A, mux_0B, mux_0C, mux_0D, mux_0E, mux_0F, mux_10, mux_11, mux_12, mux_13, mux_14, rom, LDA_IMM, LDA_ZP, STA_ZP, INC_ZP, DEC_ZP, cmp_lda_imm, cmp_lda_zp, cmp_sta_zp, cmp_inc_zp, cmp_dec_zp, is_rmw, is_zp_1, is_zp, exec_sub0, exec_sub1, exec_sub2, exec_sub3, exec_sub4, done_lda_imm, not_rmw, is_zp_non_rmw, done_zp, done_rmw, done_temp, exec_done, next_from_fetch, next_from_decode, next_from_execute, next_state, needs_operand, pc_inc_sub0, pc_inc_signal, pc_next, pc_reset, operand_load, memory, is_load_or_rmw, mem_read, mem_write_sta, mem_write_rmw, mem_write, inc_mem, dec_mem, rmw_result, mem_data_in, load_a_imm, load_a_zp, load_a, a_data, update_flags, const_128, n_check, n_flag_val, z_check }) => [
    pc_reg.q.to(pc_inc.in, at_00.a, at_01.a, at_02.a, at_03.a, at_04.a, at_05.a, at_06.a, at_07.a, at_08.a, at_09.a, at_0A.a, at_0B.a, at_0C.a, at_0D.a, at_0E.a, at_0F.a, at_10.a, at_11.a, at_12.a, at_13.a, at_14.a, at_15.a, pc_next.in0, out.pc),
    always_on.out.to(state_reg.we, subcycle_reg.we, pc_reg.we),
    state_reg.q.to(is_fetch.a, is_decode.a, is_execute.a, next_from_fetch.in0),
    STATE_FETCH.out.to(is_fetch.b, next_from_execute.in1, next_state.in1),
    STATE_DECODE.out.to(is_decode.b, next_from_fetch.in1),
    STATE_EXECUTE.out.to(is_execute.b, next_from_decode.in1),
    subcycle_reg.q.to(sub_inc.in, is_sub0.a, is_sub1.a, is_sub2.a, is_sub3.a, is_sub4.a),
    is_execute.eq.to(subcycle_next.sel, exec_sub0.a, exec_sub1.a, exec_sub2.a, exec_sub3.a, exec_sub4.a),
    zero.out.to(subcycle_next.in0, is_sub0.b, at_00.b, pc_reset.in1, dec_mem.borrow_in, z_check.b),
    sub_inc.out.to(subcycle_next.in1),
    subcycle_next.out.to(subcycle_reg.data),
    one.out.to(is_sub1.b, at_01.b, dec_mem.b),
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
    at_15.eq.to(rom.sel),
    mux_14.out.to(rom.in0),
    byte_15.out.to(rom.in1),
    rom.out.to(ir_reg.data, operand_reg.data),
    ir_reg.q.to(cmp_lda_imm.a, cmp_lda_zp.a, cmp_sta_zp.a, cmp_inc_zp.a, cmp_dec_zp.a),
    LDA_IMM.out.to(cmp_lda_imm.b),
    LDA_ZP.out.to(cmp_lda_zp.b),
    STA_ZP.out.to(cmp_sta_zp.b),
    INC_ZP.out.to(cmp_inc_zp.b),
    DEC_ZP.out.to(cmp_dec_zp.b),
    cmp_inc_zp.eq.to(is_rmw.a, rmw_result.sel),
    cmp_dec_zp.eq.to(is_rmw.b),
    cmp_lda_zp.eq.to(is_zp_1.a, is_load_or_rmw.a, load_a_zp.b, a_data.sel),
    cmp_sta_zp.eq.to(is_zp_1.b, mem_write_sta.b),
    is_zp_1.out.to(is_zp.a),
    is_rmw.out.to(is_zp.b, not_rmw.in, done_rmw.b, is_load_or_rmw.b, mem_write_rmw.b, mem_data_in.sel, update_flags.b),
    is_sub0.eq.to(exec_sub0.b),
    is_sub1.eq.to(exec_sub1.b),
    is_sub2.eq.to(exec_sub2.b),
    is_sub3.eq.to(exec_sub3.b),
    is_sub4.eq.to(exec_sub4.b),
    exec_sub1.out.to(done_lda_imm.a, load_a_imm.a),
    cmp_lda_imm.eq.to(done_lda_imm.b, needs_operand.a, load_a_imm.b),
    is_zp.out.to(is_zp_non_rmw.a, needs_operand.b),
    not_rmw.out.to(is_zp_non_rmw.b),
    exec_sub3.out.to(done_zp.a, mem_write_rmw.a, load_a_zp.a, update_flags.a),
    is_zp_non_rmw.out.to(done_zp.b),
    exec_sub4.out.to(done_rmw.a),
    done_lda_imm.out.to(done_temp.a),
    done_zp.out.to(done_temp.b),
    done_temp.out.to(exec_done.a),
    done_rmw.out.to(exec_done.b),
    is_decode.eq.to(next_from_decode.sel),
    next_from_fetch.out.to(next_from_decode.in0),
    exec_done.out.to(next_from_execute.sel),
    next_from_decode.out.to(next_from_execute.in0),
    inp.reset.to(next_state.sel, pc_reset.sel),
    next_from_execute.out.to(next_state.in0),
    next_state.out.to(state_reg.data),
    exec_sub0.out.to(pc_inc_sub0.a, operand_load.a),
    needs_operand.out.to(pc_inc_sub0.b, operand_load.b),
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
    memory.data_out.to(inc_mem.in, dec_mem.a, a_data.in1, out.mem_10, out.mem_11),
    dec_mem.difference.to(rmw_result.in0),
    inc_mem.out.to(rmw_result.in1),
    a_reg.q.to(mem_data_in.in0, out.reg_a),
    rmw_result.out.to(mem_data_in.in1, n_check.a, z_check.a),
    mem_data_in.out.to(memory.data_in),
    load_a_imm.out.to(load_a.a),
    load_a_zp.out.to(load_a.b),
    load_a.out.to(a_reg.we),
    a_data.out.to(a_reg.data),
    update_flags.out.to(n_reg.we, z_reg.we),
    const_128.out.to(n_check.b),
    n_check.gt.to(n_flag_val.a),
    n_check.eq.to(n_flag_val.b),
    n_flag_val.out.to(n_reg.data),
    z_check.eq.to(z_reg.data),
    n_reg.q.to(out.flag_n),
    z_reg.q.to(out.flag_z),
  ])
  .build()

const Part8Test = component('Part8Test')
  .out('pc', bus(8))
  .out('reg_a', bus(8))
  .out('flag_n', bit)
  .out('flag_z', bit)
  .node('zero', Constant, { value: 0 })
  .node('cpu', Part8TestCPU)
  .connect(({ in: inp, out, zero, cpu }) => [
    zero.out.to(cpu.reset),
    cpu.pc.to(out.pc),
    cpu.reg_a.to(out.reg_a),
    cpu.flag_n.to(out.flag_n),
    cpu.flag_z.to(out.flag_z),
  ])
  .build()
