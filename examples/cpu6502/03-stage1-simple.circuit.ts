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

const Stage1Simple = component('Stage1Simple')
  .out('cycle', bus(8))
  .out('alu_out', bus(8))
  .out('reg_out', bus(8))
  .out('write_to', bus(2))
  .node('counter', Register)
  .node('always_on', Constant, { value: 1 })
  .node('inc', Incrementer)
  .node('c0', Constant, { value: 0 })
  .node('c1', Constant, { value: 1 })
  .node('c2', Constant, { value: 2 })
  .node('c3', Constant, { value: 3 })
  .node('is_c0', Comparator)
  .node('is_c1', Comparator)
  .node('is_c2', Comparator)
  .node('is_c3', Comparator)
  .node('rf', RegisterFile)
  .node('alu', ALU)
  .node('v66', Constant, { value: 66 })
  .node('v8', Constant, { value: 8 })
  .node('v10', Constant, { value: 10 })
  .node('zero', Constant, { value: 0 })
  .node('sel_a', Constant, { value: 0 })
  .node('sel_x', Constant, { value: 1 })
  .node('read_sel', Mux)
  .node('read_sel2', Mux)
  .node('b1', Mux)
  .node('b2', Mux)
  .node('b3', Mux)
  .node('ws1', Mux)
  .node('ws2', Mux)
  .connect(({ in: inp, out, counter, always_on, inc, c0, c1, c2, c3, is_c0, is_c1, is_c2, is_c3, rf, alu, v66, v8, v10, zero, sel_a, sel_x, read_sel, read_sel2, b1, b2, b3, ws1, ws2 }) => [
    always_on.out.to(counter.we, rf.write_enable),
    counter.q.to(inc.in, out.cycle, is_c0.a, is_c1.a, is_c2.a, is_c3.a),
    inc.out.to(counter.data),
    c0.out.to(is_c0.b),
    c1.out.to(is_c1.b),
    c2.out.to(is_c2.b),
    c3.out.to(is_c3.b),
    is_c2.eq.to(read_sel.sel, b2.sel, ws1.sel),
    sel_a.out.to(read_sel.in0, ws1.in0),
    sel_x.out.to(read_sel.in1, read_sel2.in1, ws1.in1, ws2.in1),
    is_c3.eq.to(read_sel2.sel, b3.sel, ws2.sel),
    read_sel.out.to(read_sel2.in0),
    read_sel2.out.to(rf.read_sel),
    rf.read_data.to(alu.a, out.reg_out),
    is_c0.eq.to(b1.sel),
    v8.out.to(b1.in0),
    v66.out.to(b1.in1),
    b1.out.to(b2.in0),
    zero.out.to(b2.in1, alu.op, alu.carry_in),
    b2.out.to(b3.in0),
    v10.out.to(b3.in1),
    b3.out.to(alu.b),
    alu.result.to(out.alu_out, rf.write_data),
    ws1.out.to(ws2.in0),
    ws2.out.to(rf.write_sel, out.write_to),
  ])
  .build()

const Stage1Demo = component('Stage1Demo')
  .node('cpu', Stage1Simple)
  .node('d_cycle', HexDisplay)
  .node('d_alu', HexDisplay)
  .node('d_reg', HexDisplay)
  .node('d_write', HexDisplay)
  .connect(({ in: inp, out, cpu, d_cycle, d_alu, d_reg, d_write }) => [
    cpu.cycle.to(d_cycle.in),
    cpu.alu_out.to(d_alu.in),
    cpu.reg_out.to(d_reg.in),
    cpu.write_to.to(d_write.in),
  ])
  .build()
