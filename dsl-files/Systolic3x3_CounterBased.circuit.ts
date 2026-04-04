// Auto-generated from DSL

const ProcessingElement = component('ProcessingElement')
  .in('dataIn', bus(8))
  .in('weightIn', bus(8))
  .in('partialSumIn', bus(16))
  .in('loadWeight', bit)
  .in('resetAccum', bit)
  .out('dataOut', bus(8))
  .out('result', bus(16))
  .node('weightReg', Register)
  .node('mult', Multiplier)
  .node('adder', Adder, { width: 16 })
  .node('accum', Register)
  .node('dataPipe', Register)
  .node('accum_mux', Mux)
  .node('one', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .node('zero16', Constant, { value: 0 })
  .connect(({ in: inp, out, weightReg, mult, adder, accum, dataPipe, accum_mux, one, zero, zero16 }) => [
    inp.weightIn.to(weightReg.data),
    inp.loadWeight.to(weightReg.we),
    inp.dataIn.to(mult.a, dataPipe.data),
    weightReg.q.to(mult.b),
    mult.product.to(adder.a),
    accum.q.to(adder.b, out.result),
    zero.out.to(adder.carry_in),
    inp.resetAccum.to(accum_mux.sel),
    adder.sum.to(accum_mux.in0),
    zero16.out.to(accum_mux.in1),
    accum_mux.out.to(accum.data),
    one.out.to(accum.we, dataPipe.we),
    dataPipe.q.to(out.dataOut),
  ])
  .build()

const Systolic3x3_CounterBased = component('Systolic3x3_CounterBased')
  .in('a00', bus(8))
  .in('a01', bus(8))
  .in('a02', bus(8))
  .in('a10', bus(8))
  .in('a11', bus(8))
  .in('a12', bus(8))
  .in('a20', bus(8))
  .in('a21', bus(8))
  .in('a22', bus(8))
  .in('b00', bus(8))
  .in('b01', bus(8))
  .in('b02', bus(8))
  .in('b10', bus(8))
  .in('b11', bus(8))
  .in('b12', bus(8))
  .in('b20', bus(8))
  .in('b21', bus(8))
  .in('b22', bus(8))
  .in('start', bit)
  .out('c00', bus(16))
  .out('c01', bus(16))
  .out('c02', bus(16))
  .out('c10', bus(16))
  .out('c11', bus(16))
  .out('c12', bus(16))
  .out('c20', bus(16))
  .out('c21', bus(16))
  .out('c22', bus(16))
  .out('done', bit)
  .node('pe00', ProcessingElement)
  .node('pe01', ProcessingElement)
  .node('pe02', ProcessingElement)
  .node('pe10', ProcessingElement)
  .node('pe11', ProcessingElement)
  .node('pe12', ProcessingElement)
  .node('pe20', ProcessingElement)
  .node('pe21', ProcessingElement)
  .node('pe22', ProcessingElement)
  .node('reg_a00', Register)
  .node('reg_a01', Register)
  .node('reg_a02', Register)
  .node('reg_a10', Register)
  .node('reg_a11', Register)
  .node('reg_a12', Register)
  .node('reg_a20', Register)
  .node('reg_a21', Register)
  .node('reg_a22', Register)
  .node('reg_b00', Register)
  .node('reg_b01', Register)
  .node('reg_b02', Register)
  .node('reg_b10', Register)
  .node('reg_b11', Register)
  .node('reg_b12', Register)
  .node('reg_b20', Register)
  .node('reg_b21', Register)
  .node('reg_b22', Register)
  .node('global_cycle', Register)
  .node('global_inc', Incrementer)
  .node('global_mux', Mux)
  .node('k_phase', Register)
  .node('k_inc', Incrementer)
  .node('k_mux_01', Mux)
  .node('k_mux_reset', Mux)
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
  .node('is_cycle_12', Comparator)
  .node('is_cycle_13', Comparator)
  .node('is_cycle_14', Comparator)
  .node('is_cycle_15', Comparator)
  .node('is_cycle_16', Comparator)
  .node('k_is_0', Comparator)
  .node('k_is_1', Comparator)
  .node('k_is_2', Comparator)
  .node('loadWeights_or1', Or)
  .node('loadWeights_or2', Or)
  .node('done_latch', DFlipFlop)
  .node('done_hold', Or)
  .node('a_row0_mux_01', Mux)
  .node('a_row0_mux_final', Mux)
  .node('a_row0_inject_01', Or)
  .node('a_row0_inject_final', Or)
  .node('a_row0_gate', Mux)
  .node('a_row1_mux_01', Mux)
  .node('a_row1_mux_final', Mux)
  .node('a_row1_inject_01', Or)
  .node('a_row1_inject_final', Or)
  .node('a_row1_gate', Mux)
  .node('a_row2_mux_01', Mux)
  .node('a_row2_mux_final', Mux)
  .node('a_row2_inject_01', Or)
  .node('a_row2_inject_final', Or)
  .node('a_row2_gate', Mux)
  .node('b_col0_mux_01', Mux)
  .node('b_col0_mux_final', Mux)
  .node('b_col1_mux_01', Mux)
  .node('b_col1_mux_final', Mux)
  .node('b_col2_mux_01', Mux)
  .node('b_col2_mux_final', Mux)
  .node('k_inc_trigger', Or)
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
  .node('const_12', Constant, { value: 12 })
  .node('const_13', Constant, { value: 13 })
  .node('const_14', Constant, { value: 14 })
  .node('const_15', Constant, { value: 15 })
  .node('const_16', Constant, { value: 16 })
  .connect(({ in: inp, out, pe00, pe01, pe02, pe10, pe11, pe12, pe20, pe21, pe22, reg_a00, reg_a01, reg_a02, reg_a10, reg_a11, reg_a12, reg_a20, reg_a21, reg_a22, reg_b00, reg_b01, reg_b02, reg_b10, reg_b11, reg_b12, reg_b20, reg_b21, reg_b22, global_cycle, global_inc, global_mux, k_phase, k_inc, k_mux_01, k_mux_reset, running, start_or_running, is_cycle_0, is_cycle_1, is_cycle_2, is_cycle_3, is_cycle_4, is_cycle_5, is_cycle_6, is_cycle_7, is_cycle_8, is_cycle_9, is_cycle_10, is_cycle_11, is_cycle_12, is_cycle_13, is_cycle_14, is_cycle_15, is_cycle_16, k_is_0, k_is_1, k_is_2, loadWeights_or1, loadWeights_or2, done_latch, done_hold, a_row0_mux_01, a_row0_mux_final, a_row0_inject_01, a_row0_inject_final, a_row0_gate, a_row1_mux_01, a_row1_mux_final, a_row1_inject_01, a_row1_inject_final, a_row1_gate, a_row2_mux_01, a_row2_mux_final, a_row2_inject_01, a_row2_inject_final, a_row2_gate, b_col0_mux_01, b_col0_mux_final, b_col1_mux_01, b_col1_mux_final, b_col2_mux_01, b_col2_mux_final, k_inc_trigger, zero8, zero16, one, zero, const_0, const_1, const_2, const_3, const_4, const_5, const_6, const_7, const_8, const_9, const_10, const_11, const_12, const_13, const_14, const_15, const_16 }) => [
    inp.a00.to(reg_a00.data),
    inp.a01.to(reg_a01.data),
    inp.a02.to(reg_a02.data),
    inp.a10.to(reg_a10.data),
    inp.a11.to(reg_a11.data),
    inp.a12.to(reg_a12.data),
    inp.a20.to(reg_a20.data),
    inp.a21.to(reg_a21.data),
    inp.a22.to(reg_a22.data),
    inp.b00.to(reg_b00.data),
    inp.b01.to(reg_b01.data),
    inp.b02.to(reg_b02.data),
    inp.b10.to(reg_b10.data),
    inp.b11.to(reg_b11.data),
    inp.b12.to(reg_b12.data),
    inp.b20.to(reg_b20.data),
    inp.b21.to(reg_b21.data),
    inp.b22.to(reg_b22.data),
    inp.start.to(reg_a00.we, reg_a01.we, reg_a02.we, reg_a10.we, reg_a11.we, reg_a12.we, reg_a20.we, reg_a21.we, reg_a22.we, reg_b00.we, reg_b01.we, reg_b02.we, reg_b10.we, reg_b11.we, reg_b12.we, reg_b20.we, reg_b21.we, reg_b22.we, start_or_running.a, global_mux.sel, k_mux_reset.sel),
    running.q.to(start_or_running.b),
    start_or_running.out.to(running.d, global_cycle.we, k_phase.we),
    global_cycle.q.to(global_inc.in, is_cycle_0.a, is_cycle_1.a, is_cycle_2.a, is_cycle_3.a, is_cycle_4.a, is_cycle_5.a, is_cycle_6.a, is_cycle_7.a, is_cycle_8.a, is_cycle_9.a, is_cycle_10.a, is_cycle_11.a, is_cycle_12.a, is_cycle_13.a, is_cycle_14.a, is_cycle_15.a, is_cycle_16.a),
    global_inc.out.to(global_mux.in0),
    zero.out.to(global_mux.in1, k_mux_reset.in1),
    global_mux.out.to(global_cycle.data),
    k_phase.q.to(k_inc.in, k_mux_01.in0, k_is_0.a, k_is_1.a, k_is_2.a),
    is_cycle_5.eq.to(k_inc_trigger.a),
    is_cycle_10.eq.to(k_inc_trigger.b),
    k_inc_trigger.out.to(k_mux_01.sel),
    k_inc.out.to(k_mux_01.in1),
    k_mux_01.out.to(k_mux_reset.in0),
    k_mux_reset.out.to(k_phase.data),
    const_0.out.to(k_is_0.b, is_cycle_0.b),
    const_1.out.to(k_is_1.b, is_cycle_1.b),
    const_2.out.to(k_is_2.b, is_cycle_2.b),
    const_3.out.to(is_cycle_3.b),
    const_4.out.to(is_cycle_4.b),
    const_5.out.to(is_cycle_5.b),
    const_6.out.to(is_cycle_6.b),
    const_7.out.to(is_cycle_7.b),
    const_8.out.to(is_cycle_8.b),
    const_9.out.to(is_cycle_9.b),
    const_10.out.to(is_cycle_10.b),
    const_11.out.to(is_cycle_11.b),
    const_12.out.to(is_cycle_12.b),
    const_13.out.to(is_cycle_13.b),
    const_14.out.to(is_cycle_14.b),
    const_15.out.to(is_cycle_15.b),
    const_16.out.to(is_cycle_16.b),
    is_cycle_1.eq.to(loadWeights_or1.a),
    is_cycle_6.eq.to(loadWeights_or1.b),
    loadWeights_or1.out.to(loadWeights_or2.a),
    is_cycle_11.eq.to(loadWeights_or2.b),
    is_cycle_2.eq.to(a_row0_inject_01.a),
    is_cycle_7.eq.to(a_row0_inject_01.b),
    a_row0_inject_01.out.to(a_row0_inject_final.a),
    is_cycle_12.eq.to(a_row0_inject_final.b),
    is_cycle_3.eq.to(a_row1_inject_01.a),
    is_cycle_8.eq.to(a_row1_inject_01.b),
    a_row1_inject_01.out.to(a_row1_inject_final.a),
    is_cycle_13.eq.to(a_row1_inject_final.b),
    is_cycle_4.eq.to(a_row2_inject_01.a),
    is_cycle_9.eq.to(a_row2_inject_01.b),
    a_row2_inject_01.out.to(a_row2_inject_final.a),
    is_cycle_14.eq.to(a_row2_inject_final.b),
    k_is_1.eq.to(a_row0_mux_01.sel, a_row1_mux_01.sel, a_row2_mux_01.sel, b_col0_mux_01.sel, b_col1_mux_01.sel, b_col2_mux_01.sel),
    reg_a00.q.to(a_row0_mux_01.in0),
    reg_a01.q.to(a_row0_mux_01.in1),
    k_is_2.eq.to(a_row0_mux_final.sel, a_row1_mux_final.sel, a_row2_mux_final.sel, b_col0_mux_final.sel, b_col1_mux_final.sel, b_col2_mux_final.sel),
    a_row0_mux_01.out.to(a_row0_mux_final.in0),
    reg_a02.q.to(a_row0_mux_final.in1),
    a_row0_inject_final.out.to(a_row0_gate.sel),
    zero8.out.to(a_row0_gate.in0, a_row1_gate.in0, a_row2_gate.in0),
    a_row0_mux_final.out.to(a_row0_gate.in1),
    reg_a10.q.to(a_row1_mux_01.in0),
    reg_a11.q.to(a_row1_mux_01.in1),
    a_row1_mux_01.out.to(a_row1_mux_final.in0),
    reg_a12.q.to(a_row1_mux_final.in1),
    a_row1_inject_final.out.to(a_row1_gate.sel),
    a_row1_mux_final.out.to(a_row1_gate.in1),
    reg_a20.q.to(a_row2_mux_01.in0),
    reg_a21.q.to(a_row2_mux_01.in1),
    a_row2_mux_01.out.to(a_row2_mux_final.in0),
    reg_a22.q.to(a_row2_mux_final.in1),
    a_row2_inject_final.out.to(a_row2_gate.sel),
    a_row2_mux_final.out.to(a_row2_gate.in1),
    reg_b00.q.to(b_col0_mux_01.in0),
    reg_b10.q.to(b_col0_mux_01.in1),
    b_col0_mux_01.out.to(b_col0_mux_final.in0),
    reg_b20.q.to(b_col0_mux_final.in1),
    reg_b01.q.to(b_col1_mux_01.in0),
    reg_b11.q.to(b_col1_mux_01.in1),
    b_col1_mux_01.out.to(b_col1_mux_final.in0),
    reg_b21.q.to(b_col1_mux_final.in1),
    reg_b02.q.to(b_col2_mux_01.in0),
    reg_b12.q.to(b_col2_mux_01.in1),
    b_col2_mux_01.out.to(b_col2_mux_final.in0),
    reg_b22.q.to(b_col2_mux_final.in1),
    b_col0_mux_final.out.to(pe00.weightIn, pe10.weightIn, pe20.weightIn),
    b_col1_mux_final.out.to(pe01.weightIn, pe11.weightIn, pe21.weightIn),
    b_col2_mux_final.out.to(pe02.weightIn, pe12.weightIn, pe22.weightIn),
    loadWeights_or2.out.to(pe00.loadWeight, pe01.loadWeight, pe02.loadWeight, pe10.loadWeight, pe11.loadWeight, pe12.loadWeight, pe20.loadWeight, pe21.loadWeight, pe22.loadWeight),
    is_cycle_0.eq.to(pe00.resetAccum, pe01.resetAccum, pe02.resetAccum, pe10.resetAccum, pe11.resetAccum, pe12.resetAccum, pe20.resetAccum, pe21.resetAccum, pe22.resetAccum),
    a_row0_gate.out.to(pe00.dataIn),
    pe00.dataOut.to(pe01.dataIn),
    pe01.dataOut.to(pe02.dataIn),
    a_row1_gate.out.to(pe10.dataIn),
    pe10.dataOut.to(pe11.dataIn),
    pe11.dataOut.to(pe12.dataIn),
    a_row2_gate.out.to(pe20.dataIn),
    pe20.dataOut.to(pe21.dataIn),
    pe21.dataOut.to(pe22.dataIn),
    zero16.out.to(pe00.partialSumIn, pe01.partialSumIn, pe02.partialSumIn, pe10.partialSumIn, pe11.partialSumIn, pe12.partialSumIn, pe20.partialSumIn, pe21.partialSumIn, pe22.partialSumIn),
    is_cycle_16.eq.to(done_hold.a),
    done_latch.q.to(done_hold.b, out.done),
    done_hold.out.to(done_latch.d),
    pe00.result.to(out.c00),
    pe01.result.to(out.c01),
    pe02.result.to(out.c02),
    pe10.result.to(out.c10),
    pe11.result.to(out.c11),
    pe12.result.to(out.c12),
    pe20.result.to(out.c20),
    pe21.result.to(out.c21),
    pe22.result.to(out.c22),
  ])
  .build()

const TestSystolic3x3 = component('TestSystolic3x3')
  .node('sys', Systolic3x3_CounterBased)
  .node('a00', Input, { value: 1 })
  .node('a01', Input, { value: 2 })
  .node('a02', Input, { value: 3 })
  .node('a10', Input, { value: 4 })
  .node('a11', Input, { value: 5 })
  .node('a12', Input, { value: 6 })
  .node('a20', Input, { value: 7 })
  .node('a21', Input, { value: 8 })
  .node('a22', Input, { value: 9 })
  .node('b00', Input, { value: 9 })
  .node('b01', Input, { value: 8 })
  .node('b02', Input, { value: 7 })
  .node('b10', Input, { value: 6 })
  .node('b11', Input, { value: 5 })
  .node('b12', Input, { value: 4 })
  .node('b20', Input, { value: 3 })
  .node('b21', Input, { value: 2 })
  .node('b22', Input, { value: 1 })
  .node('start', Switch)
  .node('display_c00', HexDisplay)
  .node('display_c01', HexDisplay)
  .node('display_c02', HexDisplay)
  .node('display_c10', HexDisplay)
  .node('display_c11', HexDisplay)
  .node('display_c12', HexDisplay)
  .node('display_c20', HexDisplay)
  .node('display_c21', HexDisplay)
  .node('display_c22', HexDisplay)
  .node('done_led', Led)
  .connect(({ in: inp, out, sys, a00, a01, a02, a10, a11, a12, a20, a21, a22, b00, b01, b02, b10, b11, b12, b20, b21, b22, start, display_c00, display_c01, display_c02, display_c10, display_c11, display_c12, display_c20, display_c21, display_c22, done_led }) => [
    a00.out.to(sys.a00),
    a01.out.to(sys.a01),
    a02.out.to(sys.a02),
    a10.out.to(sys.a10),
    a11.out.to(sys.a11),
    a12.out.to(sys.a12),
    a20.out.to(sys.a20),
    a21.out.to(sys.a21),
    a22.out.to(sys.a22),
    b00.out.to(sys.b00),
    b01.out.to(sys.b01),
    b02.out.to(sys.b02),
    b10.out.to(sys.b10),
    b11.out.to(sys.b11),
    b12.out.to(sys.b12),
    b20.out.to(sys.b20),
    b21.out.to(sys.b21),
    b22.out.to(sys.b22),
    start.out.to(sys.start),
    sys.c00.to(display_c00.in),
    sys.c01.to(display_c01.in),
    sys.c02.to(display_c02.in),
    sys.c10.to(display_c10.in),
    sys.c11.to(display_c11.in),
    sys.c12.to(display_c12.in),
    sys.c20.to(display_c20.in),
    sys.c21.to(display_c21.in),
    sys.c22.to(display_c22.in),
    sys.done.to(done_led.in),
  ])
  .build()
