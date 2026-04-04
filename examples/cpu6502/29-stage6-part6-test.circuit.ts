// Auto-generated from DSL

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
  .in('write_a', bit)
  .out('reg_a', bus(8))
  .node('regA', Register)
  .connect(({ in: inp, out, regA }) => [
    inp.data_a.to(regA.data),
    inp.write_a.to(regA.we),
    regA.q.to(out.reg_a),
  ])
  .build()

const Part6Control = component('Part6Control')
  .in('current_state', bus(8))
  .in('current_opcode', bus(8))
  .in('subcycle', bus(8))
  .in('flag_c', bit)
  .out('next_state', bus(8))
  .out('next_subcycle', bus(8))
  .out('pc_increment', bit)
  .out('ir_load', bit)
  .out('operand_load', bit)
  .out('write_a', bit)
  .out('update_flags', bit)
  .out('update_c_only', bit)
  .out('set_c', bit)
  .out('clear_c', bit)
  .out('is_asl_a', bit)
  .out('is_lsr_a', bit)
  .out('is_rol_a', bit)
  .out('is_ror_a', bit)
  .out('is_lda_imm', bit)
  .node('STATE_FETCH', Constant, { value: 0 })
  .node('STATE_DECODE', Constant, { value: 1 })
  .node('STATE_EXECUTE', Constant, { value: 2 })
  .node('SUB0', Constant, { value: 0 })
  .node('SUB1', Constant, { value: 1 })
  .node('LDA_IMM', Constant, { value: 169 })
  .node('SEC', Constant, { value: 56 })
  .node('CLC', Constant, { value: 24 })
  .node('ASL_A', Constant, { value: 10 })
  .node('LSR_A', Constant, { value: 74 })
  .node('ROL_A', Constant, { value: 42 })
  .node('ROR_A', Constant, { value: 106 })
  .node('is_fetch', Comparator)
  .node('is_decode', Comparator)
  .node('is_execute', Comparator)
  .node('at_sub0', Comparator)
  .node('at_sub1', Comparator)
  .node('exec_sub0', And)
  .node('exec_sub1', And)
  .node('cmp_lda_imm', Comparator)
  .node('cmp_sec', Comparator)
  .node('cmp_clc', Comparator)
  .node('cmp_asl_a', Comparator)
  .node('cmp_lsr_a', Comparator)
  .node('cmp_rol_a', Comparator)
  .node('cmp_ror_a', Comparator)
  .node('is_1cycle_1', Or)
  .node('is_1cycle_2', Or)
  .node('is_1cycle_3', Or)
  .node('is_1cycle_4', Or)
  .node('is_1cycle', Or)
  .node('is_imm', Or)
  .node('one', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .node('go_to_decode', Mux)
  .node('go_to_execute', Mux)
  .node('done_1cycle', And)
  .node('done_imm', And)
  .node('done', Or)
  .node('go_to_fetch', Mux)
  .node('inc_subcycle', Incrementer)
  .node('reset_subcycle', Mux)
  .node('keep_subcycle', Mux)
  .node('pc_inc_fetch', And)
  .node('pc_inc_exec', And)
  .node('pc_inc_signal', Or)
  .node('operand_load_signal', And)
  .node('write_a_lda', And)
  .node('is_shift_rotate', Or)
  .node('is_shift_rotate_2', Or)
  .node('is_shift_rotate_all', Or)
  .node('write_a_shift', And)
  .node('write_a_signal', Or)
  .node('update_flags_lda', And)
  .node('update_flags_shift', And)
  .node('update_flags_signal', Or)
  .node('is_sec_clc', Or)
  .node('update_c_only_signal', And)
  .node('set_c_signal', And)
  .node('clear_c_signal', And)
  .connect(({ in: inp, out, STATE_FETCH, STATE_DECODE, STATE_EXECUTE, SUB0, SUB1, LDA_IMM, SEC, CLC, ASL_A, LSR_A, ROL_A, ROR_A, is_fetch, is_decode, is_execute, at_sub0, at_sub1, exec_sub0, exec_sub1, cmp_lda_imm, cmp_sec, cmp_clc, cmp_asl_a, cmp_lsr_a, cmp_rol_a, cmp_ror_a, is_1cycle_1, is_1cycle_2, is_1cycle_3, is_1cycle_4, is_1cycle, is_imm, one, zero, go_to_decode, go_to_execute, done_1cycle, done_imm, done, go_to_fetch, inc_subcycle, reset_subcycle, keep_subcycle, pc_inc_fetch, pc_inc_exec, pc_inc_signal, operand_load_signal, write_a_lda, is_shift_rotate, is_shift_rotate_2, is_shift_rotate_all, write_a_shift, write_a_signal, update_flags_lda, update_flags_shift, update_flags_signal, is_sec_clc, update_c_only_signal, set_c_signal, clear_c_signal }) => [
    inp.current_state.to(is_fetch.a, is_decode.a, is_execute.a, go_to_decode.in0),
    STATE_FETCH.out.to(is_fetch.b, go_to_fetch.in1),
    STATE_DECODE.out.to(is_decode.b, go_to_decode.in1),
    STATE_EXECUTE.out.to(is_execute.b, go_to_execute.in1),
    inp.subcycle.to(at_sub0.a, at_sub1.a, inc_subcycle.in),
    SUB0.out.to(at_sub0.b),
    SUB1.out.to(at_sub1.b),
    is_execute.eq.to(exec_sub0.a, exec_sub1.a, keep_subcycle.sel),
    at_sub0.eq.to(exec_sub0.b),
    at_sub1.eq.to(exec_sub1.b),
    inp.current_opcode.to(cmp_lda_imm.a, cmp_sec.a, cmp_clc.a, cmp_asl_a.a, cmp_lsr_a.a, cmp_rol_a.a, cmp_ror_a.a),
    LDA_IMM.out.to(cmp_lda_imm.b),
    cmp_lda_imm.eq.to(out.is_lda_imm, is_imm.a, is_imm.b, write_a_lda.b, update_flags_lda.b),
    SEC.out.to(cmp_sec.b),
    CLC.out.to(cmp_clc.b),
    ASL_A.out.to(cmp_asl_a.b),
    cmp_asl_a.eq.to(out.is_asl_a, is_1cycle_2.b, is_shift_rotate.a),
    LSR_A.out.to(cmp_lsr_a.b),
    cmp_lsr_a.eq.to(out.is_lsr_a, is_1cycle_3.b, is_shift_rotate.b),
    ROL_A.out.to(cmp_rol_a.b),
    cmp_rol_a.eq.to(out.is_rol_a, is_1cycle_4.b, is_shift_rotate_2.b),
    ROR_A.out.to(cmp_ror_a.b),
    cmp_ror_a.eq.to(out.is_ror_a, is_1cycle.b, is_shift_rotate_all.b),
    cmp_sec.eq.to(is_1cycle_1.a, is_sec_clc.a, set_c_signal.b),
    cmp_clc.eq.to(is_1cycle_1.b, is_sec_clc.b, clear_c_signal.b),
    is_1cycle_1.out.to(is_1cycle_2.a),
    is_1cycle_2.out.to(is_1cycle_3.a),
    is_1cycle_3.out.to(is_1cycle_4.a),
    is_1cycle_4.out.to(is_1cycle.a),
    is_fetch.eq.to(go_to_decode.sel, pc_inc_fetch.a, out.ir_load),
    is_decode.eq.to(go_to_execute.sel),
    go_to_decode.out.to(go_to_execute.in0),
    exec_sub0.out.to(done_1cycle.a, pc_inc_exec.a, operand_load_signal.a, write_a_shift.a, update_flags_shift.a, update_c_only_signal.a, set_c_signal.a, clear_c_signal.a),
    is_1cycle.out.to(done_1cycle.b),
    exec_sub1.out.to(done_imm.a, write_a_lda.a, update_flags_lda.a),
    is_imm.out.to(done_imm.b, pc_inc_exec.b, operand_load_signal.b),
    done_1cycle.out.to(done.a),
    done_imm.out.to(done.b),
    done.out.to(go_to_fetch.sel, reset_subcycle.sel),
    go_to_execute.out.to(go_to_fetch.in0),
    go_to_fetch.out.to(out.next_state),
    inc_subcycle.out.to(reset_subcycle.in0),
    zero.out.to(reset_subcycle.in1, keep_subcycle.in0),
    reset_subcycle.out.to(keep_subcycle.in1),
    keep_subcycle.out.to(out.next_subcycle),
    one.out.to(pc_inc_fetch.b),
    pc_inc_fetch.out.to(pc_inc_signal.a),
    pc_inc_exec.out.to(pc_inc_signal.b),
    pc_inc_signal.out.to(out.pc_increment),
    operand_load_signal.out.to(out.operand_load),
    is_shift_rotate.out.to(is_shift_rotate_2.a),
    is_shift_rotate_2.out.to(is_shift_rotate_all.a),
    is_shift_rotate_all.out.to(write_a_shift.b, update_flags_shift.b),
    write_a_lda.out.to(write_a_signal.a),
    write_a_shift.out.to(write_a_signal.b),
    write_a_signal.out.to(out.write_a),
    update_flags_lda.out.to(update_flags_signal.a),
    update_flags_shift.out.to(update_flags_signal.b),
    update_flags_signal.out.to(out.update_flags),
    is_sec_clc.out.to(update_c_only_signal.b),
    update_c_only_signal.out.to(out.update_c_only),
    set_c_signal.out.to(out.set_c),
    clear_c_signal.out.to(out.clear_c),
  ])
  .build()

const Part6TestCPU = component('Part6TestCPU')
  .in('reset', bit)
  .out('pc', bus(8))
  .out('reg_a', bus(8))
  .out('flag_c', bit)
  .out('flag_z', bit)
  .out('flag_n', bit)
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
  .node('eighteen', Constant, { value: 18 })
  .node('nineteen', Constant, { value: 19 })
  .node('twenty', Constant, { value: 20 })
  .node('byte_0', Constant, { value: 169 })
  .node('byte_1', Constant, { value: 65 })
  .node('byte_2', Constant, { value: 10 })
  .node('byte_3', Constant, { value: 10 })
  .node('byte_4', Constant, { value: 169 })
  .node('byte_5', Constant, { value: 130 })
  .node('byte_6', Constant, { value: 74 })
  .node('byte_7', Constant, { value: 74 })
  .node('byte_8', Constant, { value: 24 })
  .node('byte_9', Constant, { value: 169 })
  .node('byte_10', Constant, { value: 128 })
  .node('byte_11', Constant, { value: 42 })
  .node('byte_12', Constant, { value: 56 })
  .node('byte_13', Constant, { value: 169 })
  .node('byte_14', Constant, { value: 0 })
  .node('byte_15', Constant, { value: 42 })
  .node('byte_16', Constant, { value: 56 })
  .node('byte_17', Constant, { value: 169 })
  .node('byte_18', Constant, { value: 1 })
  .node('byte_19', Constant, { value: 106 })
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
  .node('at_18', Comparator)
  .node('at_19', Comparator)
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
  .node('mux17', Mux)
  .node('mux18', Mux)
  .node('rom_out', Mux)
  .node('state_reg', Register)
  .node('subcycle_reg', Register)
  .node('ir_reg', Register)
  .node('operand_reg', Register)
  .node('control', Part6Control)
  .node('registers', RegisterFile)
  .node('flags', FlagRegister)
  .node('a_bits', Splitter8to8)
  .node('shift_one', Constant, { value: 1 })
  .node('asl_result', LeftShifter)
  .node('lsr_result', RightShifter)
  .node('rol_adder', Adder)
  .node('c_times_128', Constant, { value: 128 })
  .node('ror_add_val', Mux)
  .node('ror_adder', Adder)
  .node('result_a_lda', Mux)
  .node('result_a_lsr', Mux)
  .node('result_a_rol', Mux)
  .node('result_a', Mux)
  .node('always_on', Constant, { value: 1 })
  .node('pc_next', Mux)
  .node('split_result', Splitter8to8)
  .node('z_check', Comparator)
  .node('is_shift_left', Or)
  .node('c_from_shift', Mux)
  .node('c_from_sec', Mux)
  .node('c_value', Mux)
  .node('update_c_signal', Or)
  .connect(({ in: inp, out, pc_reg, pc_inc, zero, one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve, thirteen, fourteen, fifteen, sixteen, seventeen, eighteen, nineteen, twenty, byte_0, byte_1, byte_2, byte_3, byte_4, byte_5, byte_6, byte_7, byte_8, byte_9, byte_10, byte_11, byte_12, byte_13, byte_14, byte_15, byte_16, byte_17, byte_18, byte_19, at_0, at_1, at_2, at_3, at_4, at_5, at_6, at_7, at_8, at_9, at_10, at_11, at_12, at_13, at_14, at_15, at_16, at_17, at_18, at_19, mux1, mux2, mux3, mux4, mux5, mux6, mux7, mux8, mux9, mux10, mux11, mux12, mux13, mux14, mux15, mux16, mux17, mux18, rom_out, state_reg, subcycle_reg, ir_reg, operand_reg, control, registers, flags, a_bits, shift_one, asl_result, lsr_result, rol_adder, c_times_128, ror_add_val, ror_adder, result_a_lda, result_a_lsr, result_a_rol, result_a, always_on, pc_next, split_result, z_check, is_shift_left, c_from_shift, c_from_sec, c_value, update_c_signal }) => [
    pc_reg.q.to(pc_inc.in, at_0.a, at_1.a, at_2.a, at_3.a, at_4.a, at_5.a, at_6.a, at_7.a, at_8.a, at_9.a, at_10.a, at_11.a, at_12.a, at_13.a, at_14.a, at_15.a, at_16.a, at_17.a, at_18.a, at_19.a, pc_next.in0, out.pc),
    zero.out.to(at_0.b, rol_adder.b, ror_add_val.in0, ror_adder.carry_in, z_check.b, c_value.in1, flags.new_v, flags.update_v),
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
    eighteen.out.to(at_18.b),
    nineteen.out.to(at_19.b),
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
    at_17.eq.to(mux17.sel),
    mux16.out.to(mux17.in0),
    byte_17.out.to(mux17.in1),
    at_18.eq.to(mux18.sel),
    mux17.out.to(mux18.in0),
    byte_18.out.to(mux18.in1),
    at_19.eq.to(rom_out.sel),
    mux18.out.to(rom_out.in0),
    byte_19.out.to(rom_out.in1),
    state_reg.q.to(control.current_state),
    ir_reg.q.to(control.current_opcode),
    subcycle_reg.q.to(control.subcycle),
    flags.flag_c.to(control.flag_c, rol_adder.carry_in, ror_add_val.sel, out.flag_c),
    registers.reg_a.to(a_bits.in, asl_result.value, lsr_result.value, out.reg_a),
    shift_one.out.to(asl_result.shift, lsr_result.shift),
    asl_result.result.to(rol_adder.a, result_a_lda.in1),
    c_times_128.out.to(ror_add_val.in1),
    lsr_result.result.to(ror_adder.a, result_a_lsr.in1),
    ror_add_val.out.to(ror_adder.b),
    control.is_asl_a.to(result_a_lda.sel, is_shift_left.a),
    operand_reg.q.to(result_a_lda.in0),
    control.is_lsr_a.to(result_a_lsr.sel),
    result_a_lda.out.to(result_a_lsr.in0),
    control.is_rol_a.to(result_a_rol.sel, is_shift_left.b),
    result_a_lsr.out.to(result_a_rol.in0),
    rol_adder.sum.to(result_a_rol.in1),
    control.is_ror_a.to(result_a.sel),
    result_a_rol.out.to(result_a.in0),
    ror_adder.sum.to(result_a.in1),
    result_a.out.to(registers.data_a, split_result.in, z_check.a),
    control.write_a.to(registers.write_a),
    always_on.out.to(state_reg.we, subcycle_reg.we, pc_reg.we, c_from_sec.in1),
    control.next_state.to(state_reg.data),
    control.next_subcycle.to(subcycle_reg.data),
    control.ir_load.to(ir_reg.we),
    rom_out.out.to(ir_reg.data, operand_reg.data),
    control.operand_load.to(operand_reg.we),
    control.pc_increment.to(pc_next.sel),
    pc_inc.out.to(pc_next.in1),
    pc_next.out.to(pc_reg.data),
    split_result.bit7.to(flags.new_n),
    z_check.eq.to(flags.new_z),
    is_shift_left.out.to(c_from_shift.sel),
    a_bits.bit0.to(c_from_shift.in0),
    a_bits.bit7.to(c_from_shift.in1),
    control.set_c.to(c_from_sec.sel),
    c_from_shift.out.to(c_from_sec.in0),
    control.clear_c.to(c_value.sel),
    c_from_sec.out.to(c_value.in0),
    c_value.out.to(flags.new_c),
    control.update_flags.to(flags.update_n, flags.update_z, update_c_signal.a),
    control.update_c_only.to(update_c_signal.b),
    update_c_signal.out.to(flags.update_c),
    flags.flag_z.to(out.flag_z),
    flags.flag_n.to(out.flag_n),
  ])
  .build()

const Part6Test = component('Part6Test')
  .out('pc', bus(8))
  .out('reg_a', bus(8))
  .out('flag_c', bit)
  .out('flag_z', bit)
  .out('flag_n', bit)
  .node('zero', Constant, { value: 0 })
  .node('cpu', Part6TestCPU)
  .connect(({ in: inp, out, zero, cpu }) => [
    zero.out.to(cpu.reset),
    cpu.pc.to(out.pc),
    cpu.reg_a.to(out.reg_a),
    cpu.flag_c.to(out.flag_c),
    cpu.flag_z.to(out.flag_z),
    cpu.flag_n.to(out.flag_n),
  ])
  .build()
