// Auto-generated from DSL

const ALU = component('ALU')
  .in('a', bus(8))
  .in('b', bus(8))
  .in('op', bus(3))
  .in('carry_in', bit)
  .out('result', bus(8))
  .out('carry_out', bit)
  .out('zero', bit)
  .out('negative', bit)
  .node('adder', Adder)
  .node('subtractor', Subtractor)
  .node('and_op', BusAnd)
  .node('or_op', BusOr)
  .node('xor_op', BusXor)
  .node('op_0', Constant, { value: 0 })
  .node('op_1', Constant, { value: 1 })
  .node('op_2', Constant, { value: 2 })
  .node('op_3', Constant, { value: 3 })
  .node('op_4', Constant, { value: 4 })
  .node('is_add', Comparator)
  .node('is_sub', Comparator)
  .node('is_and', Comparator)
  .node('is_or', Comparator)
  .node('is_xor', Comparator)
  .node('mux1', Mux)
  .node('mux2', Mux)
  .node('mux3', Mux)
  .node('mux4', Mux)
  .node('mux_carry', Mux)
  .node('zero_cmp', Comparator)
  .node('threshold', Constant, { value: 127 })
  .node('neg_cmp', Comparator)
  .connect(({ in: inp, out, adder, subtractor, and_op, or_op, xor_op, op_0, op_1, op_2, op_3, op_4, is_add, is_sub, is_and, is_or, is_xor, mux1, mux2, mux3, mux4, mux_carry, zero_cmp, threshold, neg_cmp }) => [
    inp.a.to(adder.a, subtractor.a, and_op.a, or_op.a, xor_op.a),
    inp.b.to(adder.b, subtractor.b, and_op.b, or_op.b, xor_op.b),
    inp.carry_in.to(adder.carry_in, subtractor.borrow_in),
    inp.op.to(is_add.a, is_sub.a, is_and.a, is_or.a, is_xor.a),
    op_0.out.to(is_add.b, zero_cmp.b),
    op_1.out.to(is_sub.b),
    op_2.out.to(is_and.b),
    op_3.out.to(is_or.b),
    op_4.out.to(is_xor.b),
    is_sub.eq.to(mux1.sel, mux_carry.sel),
    adder.sum.to(mux1.in0),
    subtractor.difference.to(mux1.in1),
    is_and.eq.to(mux2.sel),
    mux1.out.to(mux2.in0),
    and_op.out.to(mux2.in1),
    is_or.eq.to(mux3.sel),
    mux2.out.to(mux3.in0),
    or_op.out.to(mux3.in1),
    is_xor.eq.to(mux4.sel),
    mux3.out.to(mux4.in0),
    xor_op.out.to(mux4.in1),
    mux4.out.to(out.result),
    adder.carry_out.to(mux_carry.in0),
    subtractor.borrow_out.to(mux_carry.in1),
    mux_carry.out.to(out.carry_out),
    out.result.to(zero_cmp.a, neg_cmp.a),
    zero_cmp.eq.to(out.zero),
    threshold.out.to(neg_cmp.b),
    neg_cmp.gt.to(out.negative),
  ])
  .build()

const RegisterFile = component('RegisterFile')
  .in('write_sel', bus(2))
  .in('write_data', bus(8))
  .in('write_enable', bit)
  .in('read_sel', bus(2))
  .out('read_data', bus(8))
  .node('regA', Register)
  .node('regX', Register)
  .node('regY', Register)
  .node('sel_0', Constant, { value: 0 })
  .node('sel_1', Constant, { value: 1 })
  .node('sel_2', Constant, { value: 2 })
  .node('is_sel_A', Comparator)
  .node('is_sel_X', Comparator)
  .node('is_sel_Y', Comparator)
  .node('write_A', And)
  .node('write_X', And)
  .node('write_Y', And)
  .node('is_read_X', Comparator)
  .node('is_read_Y', Comparator)
  .node('read_mux1', Mux)
  .node('read_mux2', Mux)
  .connect(({ in: inp, out, regA, regX, regY, sel_0, sel_1, sel_2, is_sel_A, is_sel_X, is_sel_Y, write_A, write_X, write_Y, is_read_X, is_read_Y, read_mux1, read_mux2 }) => [
    inp.write_data.to(regA.data, regX.data, regY.data),
    inp.write_sel.to(is_sel_A.a, is_sel_X.a, is_sel_Y.a),
    sel_0.out.to(is_sel_A.b),
    sel_1.out.to(is_sel_X.b, is_read_X.b),
    sel_2.out.to(is_sel_Y.b, is_read_Y.b),
    is_sel_A.eq.to(write_A.a),
    inp.write_enable.to(write_A.b, write_X.b, write_Y.b),
    write_A.out.to(regA.we),
    is_sel_X.eq.to(write_X.a),
    write_X.out.to(regX.we),
    is_sel_Y.eq.to(write_Y.a),
    write_Y.out.to(regY.we),
    inp.read_sel.to(is_read_X.a, is_read_Y.a),
    is_read_X.eq.to(read_mux1.sel),
    regA.q.to(read_mux1.in0),
    regX.q.to(read_mux1.in1),
    is_read_Y.eq.to(read_mux2.sel),
    read_mux1.out.to(read_mux2.in0),
    regY.q.to(read_mux2.in1),
    read_mux2.out.to(out.read_data),
  ])
  .build()

const Stage1Integration = component('Stage1Integration')
  .out('cycle_count', bus(8))
  .out('reg_a_value', bus(8))
  .out('reg_x_value', bus(8))
  .out('alu_result', bus(8))
  .node('counter', Register)
  .node('always_enable', Constant, { value: 1 })
  .node('inc', Incrementer)
  .node('cycle_0', Constant, { value: 0 })
  .node('cycle_1', Constant, { value: 1 })
  .node('cycle_2', Constant, { value: 2 })
  .node('cycle_3', Constant, { value: 3 })
  .node('is_cycle_0', Comparator)
  .node('is_cycle_1', Comparator)
  .node('is_cycle_2', Comparator)
  .node('is_cycle_3', Comparator)
  .node('regfile', RegisterFile)
  .node('alu', ALU)
  .node('val_66', Constant, { value: 66 })
  .node('val_8', Constant, { value: 8 })
  .node('val_10', Constant, { value: 10 })
  .node('zero', Constant, { value: 0 })
  .node('sel_A', Constant, { value: 0 })
  .node('sel_X', Constant, { value: 1 })
  .node('op_add', Constant, { value: 0 })
  .node('alu_read_sel', Mux)
  .node('alu_read_sel2', Mux)
  .node('alu_b_mux1', Mux)
  .node('alu_b_mux2', Mux)
  .node('alu_b_mux3', Mux)
  .node('write_sel_mux1', Mux)
  .node('write_sel_mux2', Mux)
  .node('reader_A', RegisterFile)
  .node('reader_X', RegisterFile)
  .connect(({ in: inp, out, counter, always_enable, inc, cycle_0, cycle_1, cycle_2, cycle_3, is_cycle_0, is_cycle_1, is_cycle_2, is_cycle_3, regfile, alu, val_66, val_8, val_10, zero, sel_A, sel_X, op_add, alu_read_sel, alu_read_sel2, alu_b_mux1, alu_b_mux2, alu_b_mux3, write_sel_mux1, write_sel_mux2, reader_A, reader_X }) => [
    always_enable.out.to(counter.we, regfile.write_enable, reader_A.write_enable, reader_X.write_enable),
    counter.q.to(inc.in, out.cycle_count, is_cycle_0.a, is_cycle_1.a, is_cycle_2.a, is_cycle_3.a),
    inc.out.to(counter.data),
    cycle_0.out.to(is_cycle_0.b),
    cycle_1.out.to(is_cycle_1.b),
    cycle_2.out.to(is_cycle_2.b),
    cycle_3.out.to(is_cycle_3.b),
    is_cycle_2.eq.to(alu_read_sel.sel, alu_b_mux2.sel, write_sel_mux1.sel),
    sel_A.out.to(alu_read_sel.in0, write_sel_mux1.in0, reader_A.read_sel),
    sel_X.out.to(alu_read_sel.in1, alu_read_sel2.in1, write_sel_mux1.in1, write_sel_mux2.in1, reader_X.read_sel),
    is_cycle_3.eq.to(alu_read_sel2.sel, alu_b_mux3.sel, write_sel_mux2.sel),
    alu_read_sel.out.to(alu_read_sel2.in0),
    alu_read_sel2.out.to(regfile.read_sel),
    regfile.read_data.to(alu.a),
    is_cycle_0.eq.to(alu_b_mux1.sel),
    val_8.out.to(alu_b_mux1.in0),
    val_66.out.to(alu_b_mux1.in1),
    alu_b_mux1.out.to(alu_b_mux2.in0),
    zero.out.to(alu_b_mux2.in1, alu.carry_in),
    alu_b_mux2.out.to(alu_b_mux3.in0),
    val_10.out.to(alu_b_mux3.in1),
    alu_b_mux3.out.to(alu.b),
    op_add.out.to(alu.op),
    alu.result.to(out.alu_result, regfile.write_data, reader_A.write_data, reader_X.write_data),
    write_sel_mux1.out.to(write_sel_mux2.in0),
    write_sel_mux2.out.to(regfile.write_sel, reader_A.write_sel, reader_X.write_sel),
    reader_A.read_data.to(out.reg_a_value),
    reader_X.read_data.to(out.reg_x_value),
  ])
  .build()

const Stage1Demo = component('Stage1Demo')
  .node('cpu', Stage1Integration)
  .node('display_cycle', HexDisplay)
  .node('display_a', HexDisplay)
  .node('display_x', HexDisplay)
  .node('display_alu', HexDisplay)
  .connect(({ in: inp, out, cpu, display_cycle, display_a, display_x, display_alu }) => [
    cpu.cycle_count.to(display_cycle.in),
    cpu.reg_a_value.to(display_a.in),
    cpu.reg_x_value.to(display_x.in),
    cpu.alu_result.to(display_alu.in),
  ])
  .build()
