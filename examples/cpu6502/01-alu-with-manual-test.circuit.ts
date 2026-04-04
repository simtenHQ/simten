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

const ALUManualTest = component('ALUManualTest')
  .out('result', bus(8))
  .out('carry', bit)
  .out('zero', bit)
  .out('negative', bit)
  .node('input_a', Input)
  .node('input_b', Input)
  .node('input_op', Input)
  .node('input_carry', Input)
  .node('alu', ALU)
  .connect(({ in: inp, out, input_a, input_b, input_op, input_carry, alu }) => [
    input_a.out.to(alu.a),
    input_b.out.to(alu.b),
    input_op.out.to(alu.op),
    input_carry.out.to(alu.carry_in),
    alu.result.to(out.result),
    alu.carry_out.to(out.carry),
    alu.zero.to(out.zero),
    alu.negative.to(out.negative),
  ])
  .build()
