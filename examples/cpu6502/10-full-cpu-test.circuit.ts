// Auto-generated from DSL

const ALU = circuit('ALU', {
  in: { a: bus(8), b: bus(8), op: bus(3), carry_in: bit },
  out: { result: bus(8), carry_out: bit, zero: bit, negative: bit },
  nodes: { adder: Adder, subtractor: Subtractor, and_op: BusAnd, or_op: BusOr, xor_op: BusXor, op_0: Constant, op_1: Constant, op_2: Constant, op_3: Constant, op_4: Constant, is_add: Comparator, is_sub: Comparator, is_and: Comparator, is_or: Comparator, is_xor: Comparator, mux1: Mux, mux2: Mux, mux3: Mux, mux4: Mux, mux_carry: Mux, zero_cmp: Comparator, threshold: Constant, neg_cmp: Comparator },
  nodeArgs: { op_0: { value: 0 }, op_1: { value: 1 }, op_2: { value: 2 }, op_3: { value: 3 }, op_4: { value: 4 }, threshold: { value: 127 } },
  connect: ({ in: inp, out, adder, subtractor, and_op, or_op, xor_op, op_0, op_1, op_2, op_3, op_4, is_add, is_sub, is_and, is_or, is_xor, mux1, mux2, mux3, mux4, mux_carry, zero_cmp, threshold, neg_cmp }) => [
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
  ],
})

const SimplePCTest = circuit('SimplePCTest', {
  nodes: { pc: Register, always_on: Constant, pc_inc: Incrementer, zero: Constant, one: Constant, two: Constant, three: Constant, at_0: Comparator, at_1: Comparator, at_2: Comparator, at_3: Comparator, byte_0: Constant, byte_1: Constant, byte_2: Constant, byte_3: Constant, mux1: Mux, mux2: Mux, mux3: Mux, d_pc: HexDisplay, d_instruction: HexDisplay },
  nodeArgs: { always_on: { value: 1 }, zero: { value: 0 }, one: { value: 1 }, two: { value: 2 }, three: { value: 3 }, byte_0: { value: 169 }, byte_1: { value: 66 }, byte_2: { value: 105 }, byte_3: { value: 8 } },
  connect: ({ in: inp, out, pc, always_on, pc_inc, zero, one, two, three, at_0, at_1, at_2, at_3, byte_0, byte_1, byte_2, byte_3, mux1, mux2, mux3, d_pc, d_instruction }) => [
    always_on.out.to(pc.we),
    pc.q.to(pc_inc.in, at_0.a, at_1.a, at_2.a, at_3.a, d_pc.in),
    pc_inc.out.to(pc.data),
    zero.out.to(at_0.b),
    one.out.to(at_1.b),
    two.out.to(at_2.b),
    three.out.to(at_3.b),
    at_1.eq.to(mux1.sel),
    byte_0.out.to(mux1.in0),
    byte_1.out.to(mux1.in1),
    at_2.eq.to(mux2.sel),
    mux1.out.to(mux2.in0),
    byte_2.out.to(mux2.in1),
    at_3.eq.to(mux3.sel),
    mux2.out.to(mux3.in0),
    byte_3.out.to(mux3.in1),
    mux3.out.to(d_instruction.in),
  ],
})

const ManualRegisterTest = circuit('ManualRegisterTest', {
  nodes: { reg_a: Register, write_enable: Input, data_input: Input, d_a: HexDisplay },
  connect: ({ in: inp, out, reg_a, write_enable, data_input, d_a }) => [
    write_enable.out.to(reg_a.we),
    data_input.out.to(reg_a.data),
    reg_a.q.to(d_a.in),
  ],
})

const ALUOnlyTest = circuit('ALUOnlyTest', {
  nodes: { alu: ALU, input_a: Input, input_b: Input, op_input: Input, zero: Constant, d_result: HexDisplay },
  nodeArgs: { zero: { value: 0 } },
  connect: ({ in: inp, out, alu, input_a, input_b, op_input, zero, d_result }) => [
    input_a.out.to(alu.a),
    input_b.out.to(alu.b),
    op_input.out.to(alu.op),
    zero.out.to(alu.carry_in),
    alu.result.to(d_result.in),
  ],
})
