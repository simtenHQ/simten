// Auto-generated from DSL

const ALU16 = component('ALU16')
  .in('a', bus(16))
  .in('b', bus(16))
  .in('op0', bit)
  .in('op1', bit)
  .in('op2', bit)
  .out('result', bus(16))
  .out('carry', bit)
  .node('adder', Adder, { width: 16 })
  .node('sub', Subtractor, { width: 16 })
  .node('band', BusAnd, { width: 16 })
  .node('bor', BusOr, { width: 16 })
  .node('bxor', BusXor, { width: 16 })
  .node('bnot', BusNot, { width: 16 })
  .node('shl', LeftShifter, { width: 16 })
  .node('shr', RightShifter, { width: 16 })
  .node('mux_01', Mux, { width: 16 })
  .node('mux_23', Mux, { width: 16 })
  .node('mux_45', Mux, { width: 16 })
  .node('mux_67', Mux, { width: 16 })
  .node('mux_0123', Mux, { width: 16 })
  .node('mux_4567', Mux, { width: 16 })
  .node('mux_final', Mux, { width: 16 })
  .connect(({ in: inp, out, adder, sub, band, bor, bxor, bnot, shl, shr, mux_01, mux_23, mux_45, mux_67, mux_0123, mux_4567, mux_final }) => [
    inp.a.to(adder.a, sub.a, band.a, bor.a, bxor.a, bnot.in, shl.value, shr.value),
    inp.b.to(adder.b, sub.b, band.b, bor.b, bxor.b, shl.shift, shr.shift),
    adder.sum.to(mux_01.in0),
    sub.difference.to(mux_01.in1),
    inp.op0.to(mux_01.sel, mux_23.sel, mux_45.sel, mux_67.sel),
    band.out.to(mux_23.in0),
    bor.out.to(mux_23.in1),
    bxor.out.to(mux_45.in0),
    bnot.out.to(mux_45.in1),
    shl.result.to(mux_67.in0),
    shr.result.to(mux_67.in1),
    mux_01.out.to(mux_0123.in0),
    mux_23.out.to(mux_0123.in1),
    inp.op1.to(mux_0123.sel, mux_4567.sel),
    mux_45.out.to(mux_4567.in0),
    mux_67.out.to(mux_4567.in1),
    mux_0123.out.to(mux_final.in0),
    mux_4567.out.to(mux_final.in1),
    inp.op2.to(mux_final.sel),
    mux_final.out.to(out.result),
    adder.carry_out.to(out.carry),
  ])
  .build()

const CPU16 = component('CPU16')
  .in('data_in', bus(16))
  .in('op0', bit)
  .in('op1', bit)
  .in('op2', bit)
  .in('load', bit)
  .in('we', bit)
  .out('acc_out', bus(16))
  .out('carry', bit)
  .node('acc', Register, { width: 16 })
  .node('alu', ALU16)
  .node('load_mux', Mux, { width: 16 })
  .connect(({ in: inp, out, acc, alu, load_mux }) => [
    acc.q.to(alu.a, out.acc_out),
    inp.data_in.to(alu.b, load_mux.in1),
    inp.op0.to(alu.op0),
    inp.op1.to(alu.op1),
    inp.op2.to(alu.op2),
    alu.result.to(load_mux.in0),
    inp.load.to(load_mux.sel),
    load_mux.out.to(acc.data),
    inp.we.to(acc.we),
    alu.carry.to(out.carry),
  ])
  .build()

const CPU16_Interactive = component('CPU16_Interactive')
  .node('data', Input, { value: 1000 })
  .node('op0_sw', Switch)
  .node('op1_sw', Switch)
  .node('op2_sw', Switch)
  .node('load_sw', Switch)
  .node('we_sw', Switch)
  .node('cpu', CPU16)
  .node('display', HexDisplay)
  .node('carry_led', Led)
  .connect(({ in: inp, out, data, op0_sw, op1_sw, op2_sw, load_sw, we_sw, cpu, display, carry_led }) => [
    data.out.to(cpu.data_in),
    op0_sw.out.to(cpu.op0),
    op1_sw.out.to(cpu.op1),
    op2_sw.out.to(cpu.op2),
    load_sw.out.to(cpu.load),
    we_sw.out.to(cpu.we),
    cpu.acc_out.to(display.in),
    cpu.carry.to(carry_led.in),
  ])
  .build()
