// Auto-generated from DSL

const ProcessingElement_VerticalWeight = component('ProcessingElement_VerticalWeight')
  .in('dataIn', bus(8))
  .in('weightIn', bus(8))
  .in('partialSumIn', bus(16))
  .in('weightValid', bit)
  .in('resetAccum', bit)
  .out('dataOut', bus(8))
  .out('weightOut', bus(8))
  .out('weightValidOut', bit)
  .out('result', bus(16))
  .node('weightReg', Register)
  .node('weightPipe', Register)
  .node('validPipe', DFlipFlop)
  .node('mult', Multiplier)
  .node('adder', Adder, { width: 16 })
  .node('accum', Register)
  .node('dataPipe', Register)
  .node('accum_mux', Mux)
  .node('one', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .node('zero16', Constant, { value: 0 })
  .connect(({ in: inp, out, weightReg, weightPipe, validPipe, mult, adder, accum, dataPipe, accum_mux, one, zero, zero16 }) => [
    inp.weightIn.to(weightReg.data, weightPipe.data),
    inp.weightValid.to(weightReg.we, validPipe.d),
    one.out.to(weightPipe.we, accum.we, dataPipe.we),
    weightPipe.q.to(out.weightOut),
    validPipe.q.to(out.weightValidOut),
    inp.dataIn.to(mult.a, dataPipe.data),
    weightReg.q.to(mult.b),
    mult.product.to(adder.a),
    accum.q.to(adder.b, out.result),
    zero.out.to(adder.carry_in),
    inp.resetAccum.to(accum_mux.sel),
    adder.sum.to(accum_mux.in0),
    zero16.out.to(accum_mux.in1),
    accum_mux.out.to(accum.data),
    dataPipe.q.to(out.dataOut),
  ])
  .build()

const Systolic2x2_VerticalWeights = component('Systolic2x2_VerticalWeights')
  .in('a00', bus(8))
  .in('a01', bus(8))
  .in('a10', bus(8))
  .in('a11', bus(8))
  .in('b00', bus(8))
  .in('b01', bus(8))
  .in('b10', bus(8))
  .in('b11', bus(8))
  .in('start', bit)
  .out('c00', bus(16))
  .out('c01', bus(16))
  .out('c10', bus(16))
  .out('c11', bus(16))
  .out('done', bit)
  .node('pe00', ProcessingElement_VerticalWeight)
  .node('pe01', ProcessingElement_VerticalWeight)
  .node('pe10', ProcessingElement_VerticalWeight)
  .node('pe11', ProcessingElement_VerticalWeight)
  .node('reg_a00', Register)
  .node('reg_a01', Register)
  .node('reg_a10', Register)
  .node('reg_a11', Register)
  .node('reg_b00', Register)
  .node('reg_b01', Register)
  .node('reg_b10', Register)
  .node('reg_b11', Register)
  .node('global_cycle', Register)
  .node('global_inc', Incrementer)
  .node('global_mux', Mux)
  .node('running', DFlipFlop)
  .node('start_or_running', Or)
  .node('is_cycle_0', Comparator)
  .node('is_cycle_1', Comparator)
  .node('is_cycle_2', Comparator)
  .node('is_cycle_3', Comparator)
  .node('is_cycle_4', Comparator)
  .node('is_cycle_5', Comparator)
  .node('is_cycle_6', Comparator)
  .node('is_cycle_7', Comparator)
  .node('is_cycle_8', Comparator)
  .node('is_cycle_9', Comparator)
  .node('is_cycle_10', Comparator)
  .node('is_cycle_11', Comparator)
  .node('cycle_5', Constant, { value: 5 })
  .node('k_implicit', Comparator)
  .node('weightValid_or', Or)
  .node('done_latch', DFlipFlop)
  .node('done_hold', Or)
  .node('a_row0_mux', Mux)
  .node('a_row1_mux', Mux)
  .node('b_col0_mux', Mux)
  .node('b_col1_mux', Mux)
  .node('a_row0_inject', Or)
  .node('a_row1_inject', Or)
  .node('a_row0_gate', Mux)
  .node('a_row1_gate', Mux)
  .node('zero8', Constant, { value: 0 })
  .node('zero16', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .node('const_0', Constant, { value: 0 })
  .node('const_1', Constant, { value: 1 })
  .node('const_2', Constant, { value: 2 })
  .node('const_3', Constant, { value: 3 })
  .node('const_4', Constant, { value: 4 })
  .node('const_5', Constant, { value: 5 })
  .node('const_6', Constant, { value: 6 })
  .node('const_7', Constant, { value: 7 })
  .node('const_8', Constant, { value: 8 })
  .node('const_9', Constant, { value: 9 })
  .node('const_10', Constant, { value: 10 })
  .node('const_11', Constant, { value: 11 })
  .connect(({ in: inp, out, pe00, pe01, pe10, pe11, reg_a00, reg_a01, reg_a10, reg_a11, reg_b00, reg_b01, reg_b10, reg_b11, global_cycle, global_inc, global_mux, running, start_or_running, is_cycle_0, is_cycle_1, is_cycle_2, is_cycle_3, is_cycle_4, is_cycle_5, is_cycle_6, is_cycle_7, is_cycle_8, is_cycle_9, is_cycle_10, is_cycle_11, cycle_5, k_implicit, weightValid_or, done_latch, done_hold, a_row0_mux, a_row1_mux, b_col0_mux, b_col1_mux, a_row0_inject, a_row1_inject, a_row0_gate, a_row1_gate, zero8, zero16, one, zero, const_0, const_1, const_2, const_3, const_4, const_5, const_6, const_7, const_8, const_9, const_10, const_11 }) => [
    inp.a00.to(reg_a00.data),
    inp.a01.to(reg_a01.data),
    inp.a10.to(reg_a10.data),
    inp.a11.to(reg_a11.data),
    inp.b00.to(reg_b00.data),
    inp.b01.to(reg_b01.data),
    inp.b10.to(reg_b10.data),
    inp.b11.to(reg_b11.data),
    inp.start.to(reg_a00.we, reg_a01.we, reg_a10.we, reg_a11.we, reg_b00.we, reg_b01.we, reg_b10.we, reg_b11.we, start_or_running.a, global_mux.sel),
    running.q.to(start_or_running.b),
    start_or_running.out.to(running.d, global_cycle.we),
    global_cycle.q.to(global_inc.in, k_implicit.a, is_cycle_0.a, is_cycle_1.a, is_cycle_2.a, is_cycle_3.a, is_cycle_4.a, is_cycle_5.a, is_cycle_6.a, is_cycle_7.a, is_cycle_8.a, is_cycle_9.a, is_cycle_10.a, is_cycle_11.a),
    global_inc.out.to(global_mux.in0),
    zero.out.to(global_mux.in1),
    global_mux.out.to(global_cycle.data),
    cycle_5.out.to(k_implicit.b),
    const_0.out.to(is_cycle_0.b),
    const_1.out.to(is_cycle_1.b),
    const_2.out.to(is_cycle_2.b),
    const_3.out.to(is_cycle_3.b),
    const_4.out.to(is_cycle_4.b),
    const_5.out.to(is_cycle_5.b),
    const_6.out.to(is_cycle_6.b),
    const_7.out.to(is_cycle_7.b),
    const_8.out.to(is_cycle_8.b),
    const_9.out.to(is_cycle_9.b),
    const_10.out.to(is_cycle_10.b),
    const_11.out.to(is_cycle_11.b),
    is_cycle_1.eq.to(weightValid_or.a),
    is_cycle_6.eq.to(weightValid_or.b),
    is_cycle_2.eq.to(a_row0_inject.a),
    is_cycle_7.eq.to(a_row0_inject.b),
    is_cycle_3.eq.to(a_row1_inject.a),
    is_cycle_8.eq.to(a_row1_inject.b),
    k_implicit.gt.to(a_row0_mux.sel, a_row1_mux.sel, b_col0_mux.sel, b_col1_mux.sel),
    reg_a00.q.to(a_row0_mux.in0),
    reg_a01.q.to(a_row0_mux.in1),
    reg_a10.q.to(a_row1_mux.in0),
    reg_a11.q.to(a_row1_mux.in1),
    a_row0_inject.out.to(a_row0_gate.sel),
    zero8.out.to(a_row0_gate.in0, a_row1_gate.in0),
    a_row0_mux.out.to(a_row0_gate.in1),
    a_row1_inject.out.to(a_row1_gate.sel),
    a_row1_mux.out.to(a_row1_gate.in1),
    reg_b00.q.to(b_col0_mux.in0),
    reg_b10.q.to(b_col0_mux.in1),
    reg_b01.q.to(b_col1_mux.in0),
    reg_b11.q.to(b_col1_mux.in1),
    b_col0_mux.out.to(pe00.weightIn),
    pe00.weightOut.to(pe10.weightIn),
    b_col1_mux.out.to(pe01.weightIn),
    pe01.weightOut.to(pe11.weightIn),
    weightValid_or.out.to(pe00.weightValid, pe01.weightValid),
    pe00.weightValidOut.to(pe10.weightValid),
    pe01.weightValidOut.to(pe11.weightValid),
    is_cycle_0.eq.to(pe00.resetAccum, pe01.resetAccum, pe10.resetAccum, pe11.resetAccum),
    a_row0_gate.out.to(pe00.dataIn),
    pe00.dataOut.to(pe01.dataIn),
    a_row1_gate.out.to(pe10.dataIn),
    pe10.dataOut.to(pe11.dataIn),
    zero16.out.to(pe00.partialSumIn, pe01.partialSumIn, pe10.partialSumIn, pe11.partialSumIn),
    is_cycle_11.eq.to(done_hold.a),
    done_latch.q.to(done_hold.b, out.done),
    done_hold.out.to(done_latch.d),
    pe00.result.to(out.c00),
    pe01.result.to(out.c01),
    pe10.result.to(out.c10),
    pe11.result.to(out.c11),
  ])
  .build()

const TestVerticalWeights = component('TestVerticalWeights')
  .node('sys', Systolic2x2_VerticalWeights)
  .node('a00', Input, { value: 1 })
  .node('a01', Input, { value: 2 })
  .node('a10', Input, { value: 3 })
  .node('a11', Input, { value: 4 })
  .node('b00', Input, { value: 5 })
  .node('b01', Input, { value: 6 })
  .node('b10', Input, { value: 7 })
  .node('b11', Input, { value: 8 })
  .node('start', Switch)
  .node('display_c00', HexDisplay)
  .node('display_c01', HexDisplay)
  .node('display_c10', HexDisplay)
  .node('display_c11', HexDisplay)
  .node('done_led', Led)
  .connect(({ in: inp, out, sys, a00, a01, a10, a11, b00, b01, b10, b11, start, display_c00, display_c01, display_c10, display_c11, done_led }) => [
    a00.out.to(sys.a00),
    a01.out.to(sys.a01),
    a10.out.to(sys.a10),
    a11.out.to(sys.a11),
    b00.out.to(sys.b00),
    b01.out.to(sys.b01),
    b10.out.to(sys.b10),
    b11.out.to(sys.b11),
    start.out.to(sys.start),
    sys.c00.to(display_c00.in),
    sys.c01.to(display_c01.in),
    sys.c10.to(display_c10.in),
    sys.c11.to(display_c11.in),
    sys.done.to(done_led.in),
  ])
  .build()
