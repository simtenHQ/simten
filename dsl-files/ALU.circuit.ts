// Auto-generated from DSL

const ALU = component('ALU')
  .in('a', bus(8))
  .in('b', bus(8))
  .in('op0', bit)
  .in('op1', bit)
  .in('op2', bit)
  .out('result', bus(8))
  .out('zero', bit)
  .out('carry', bit)
  .out('negative', bit)
  .node('gnd', Constant, { value: 0 })
  .node('add', Adder)
  .node('sub', Subtractor)
  .node('band', BusAnd)
  .node('bor', BusOr)
  .node('bxor', BusXor)
  .node('bnot', BusNot)
  .node('shl', LeftShifter)
  .node('shr', RightShifter)
  .node('m01', Mux, { width: 8 })
  .node('m23', Mux, { width: 8 })
  .node('m45', Mux, { width: 8 })
  .node('m67', Mux, { width: 8 })
  .node('m03', Mux, { width: 8 })
  .node('m47', Mux, { width: 8 })
  .node('mfinal', Mux, { width: 8 })
  .node('split_r', Splitter8to8)
  .node('or01', Or)
  .node('or23', Or)
  .node('or45', Or)
  .node('or67', Or)
  .node('or_lo', Or)
  .node('or_hi', Or)
  .node('or_all', Or)
  .node('inv_z', Not)
  .connect(({ in: inp, out, gnd, add, sub, band, bor, bxor, bnot, shl, shr, m01, m23, m45, m67, m03, m47, mfinal, split_r, or01, or23, or45, or67, or_lo, or_hi, or_all, inv_z }) => [
    inp.a.to(add.a, sub.a, band.a, bor.a, bxor.a, bnot.in, shl.value, shr.value),
    inp.b.to(add.b, sub.b, band.b, bor.b, bxor.b, shl.shift, shr.shift),
    gnd.out.to(add.carry_in, sub.borrow_in),
    add.sum.to(m01.in0),
    sub.difference.to(m01.in1),
    inp.op0.to(m01.sel, m23.sel, m45.sel, m67.sel),
    band.out.to(m23.in0),
    bor.out.to(m23.in1),
    bxor.out.to(m45.in0),
    bnot.out.to(m45.in1),
    shl.result.to(m67.in0),
    shr.result.to(m67.in1),
    m01.out.to(m03.in0),
    m23.out.to(m03.in1),
    inp.op1.to(m03.sel, m47.sel),
    m45.out.to(m47.in0),
    m67.out.to(m47.in1),
    m03.out.to(mfinal.in0),
    m47.out.to(mfinal.in1),
    inp.op2.to(mfinal.sel),
    mfinal.out.to(out.result, split_r.in),
    add.carry_out.to(out.carry),
    split_r.bit7.to(out.negative, or67.b),
    split_r.bit0.to(or01.a),
    split_r.bit1.to(or01.b),
    split_r.bit2.to(or23.a),
    split_r.bit3.to(or23.b),
    split_r.bit4.to(or45.a),
    split_r.bit5.to(or45.b),
    split_r.bit6.to(or67.a),
    or01.out.to(or_lo.a),
    or23.out.to(or_lo.b),
    or45.out.to(or_hi.a),
    or67.out.to(or_hi.b),
    or_lo.out.to(or_all.a),
    or_hi.out.to(or_all.b),
    or_all.out.to(inv_z.in),
    inv_z.out.to(out.zero),
  ])
  .build()

const ALUDemo = component('ALUDemo')
  .node('a', Input, { value: 42 })
  .node('b', Input, { value: 13 })
  .node('op0', Switch)
  .node('op1', Switch)
  .node('op2', Switch)
  .node('alu', ALU)
  .node('disp_a', HexDisplay)
  .node('disp_b', HexDisplay)
  .node('disp_result', HexDisplay)
  .node('led_zero', Led)
  .node('led_carry', Led)
  .node('led_neg', Led)
  .connect(({ in: inp, out, a, b, op0, op1, op2, alu, disp_a, disp_b, disp_result, led_zero, led_carry, led_neg }) => [
    a.out.to(alu.a, disp_a.in),
    b.out.to(alu.b, disp_b.in),
    op0.out.to(alu.op0),
    op1.out.to(alu.op1),
    op2.out.to(alu.op2),
    alu.result.to(disp_result.in),
    alu.zero.to(led_zero.in),
    alu.carry.to(led_carry.in),
    alu.negative.to(led_neg.in),
  ])
  .build()
