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

const CPUTest = component('CPUTest')
  .node('rom_addr', Input)
  .node('byte_0', Constant, { value: 169 })
  .node('byte_1', Constant, { value: 66 })
  .node('byte_2', Constant, { value: 105 })
  .node('byte_3', Constant, { value: 8 })
  .node('byte_4', Constant, { value: 141 })
  .node('byte_5', Constant, { value: 254 })
  .node('byte_6', Constant, { value: 0 })
  .node('byte_7', Constant, { value: 0 })
  .node('info_display', HexDisplay)
  .node('zero', Constant, { value: 0 })
  .node('cycle_counter', Register)
  .node('always_on', Constant, { value: 1 })
  .node('inc', Incrementer)
  .node('cycle_display', HexDisplay)
  .connect(({ in: inp, out, rom_addr, byte_0, byte_1, byte_2, byte_3, byte_4, byte_5, byte_6, byte_7, info_display, zero, cycle_counter, always_on, inc, cycle_display }) => [
    zero.out.to(info_display.in),
    always_on.out.to(cycle_counter.we),
    cycle_counter.q.to(inc.in, cycle_display.in),
    inc.out.to(cycle_counter.data),
  ])
  .build()

const StepByStepCPU = component('StepByStepCPU')
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
  .node('at_0', Comparator)
  .node('at_1', Comparator)
  .node('at_2', Comparator)
  .node('at_3', Comparator)
  .node('at_4', Comparator)
  .node('at_5', Comparator)
  .node('at_6', Comparator)
  .node('at_7', Comparator)
  .node('byte_0', Constant, { value: 169 })
  .node('byte_1', Constant, { value: 66 })
  .node('byte_2', Constant, { value: 105 })
  .node('byte_3', Constant, { value: 8 })
  .node('byte_4', Constant, { value: 141 })
  .node('byte_5', Constant, { value: 254 })
  .node('byte_6', Constant, { value: 0 })
  .node('byte_7', Constant, { value: 0 })
  .node('mux1', Mux)
  .node('mux2', Mux)
  .node('mux3', Mux)
  .node('mux4', Mux)
  .node('mux5', Mux)
  .node('mux6', Mux)
  .node('mux7', Mux)
  .node('reg_a', Register)
  .node('alu', ALU)
  .node('d_pc', HexDisplay)
  .node('d_instruction', HexDisplay)
  .node('d_a', HexDisplay)
  .node('d_alu_result', HexDisplay)
  .connect(({ in: inp, out, pc_reg, always_on, pc_inc, zero, one, two, three, four, five, six, seven, at_0, at_1, at_2, at_3, at_4, at_5, at_6, at_7, byte_0, byte_1, byte_2, byte_3, byte_4, byte_5, byte_6, byte_7, mux1, mux2, mux3, mux4, mux5, mux6, mux7, reg_a, alu, d_pc, d_instruction, d_a, d_alu_result }) => [
    always_on.out.to(pc_reg.we, reg_a.we),
    pc_reg.q.to(pc_inc.in, at_0.a, at_1.a, at_2.a, at_3.a, at_4.a, at_5.a, at_6.a, at_7.a, d_pc.in),
    pc_inc.out.to(pc_reg.data),
    zero.out.to(at_0.b, alu.op, alu.carry_in),
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
    reg_a.q.to(alu.a, d_a.in),
    mux7.out.to(alu.b, d_instruction.in),
    alu.result.to(reg_a.data, d_alu_result.in),
  ])
  .build()
