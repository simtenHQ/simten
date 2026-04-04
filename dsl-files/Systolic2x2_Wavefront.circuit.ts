// Auto-generated from DSL

const PE_Systolic = component('PE_Systolic')
  .in('dataIn', bus(8))
  .in('weightIn', bus(8))
  .in('partialSumIn', bus(16))
  .in('weightValid', bit)
  .in('validIn', bit)
  .out('dataOut', bus(8))
  .out('partialSumOut', bus(16))
  .out('validOut', bit)
  .node('weightReg', Register)
  .node('mult', Multiplier)
  .node('adder', Adder, { width: 16 })
  .node('psumReg', Register)
  .node('dataPipe', Register)
  .node('validPipe', DFlipFlop)
  .node('one', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .connect(({ in: inp, out, weightReg, mult, adder, psumReg, dataPipe, validPipe, one, zero }) => [
    inp.weightIn.to(weightReg.data),
    inp.weightValid.to(weightReg.we),
    inp.dataIn.to(mult.a, dataPipe.data),
    weightReg.q.to(mult.b),
    inp.partialSumIn.to(adder.a),
    mult.product.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(psumReg.data),
    one.out.to(psumReg.we, dataPipe.we),
    psumReg.q.to(out.partialSumOut),
    dataPipe.q.to(out.dataOut),
    inp.validIn.to(validPipe.d),
    validPipe.q.to(out.validOut),
  ])
  .build()

const Systolic2x2 = component('Systolic2x2')
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
  .node('pe00', PE_Systolic)
  .node('pe01', PE_Systolic)
  .node('pe10', PE_Systolic)
  .node('pe11', PE_Systolic)
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('two', Constant, { value: 2 })
  .node('three', Constant, { value: 3 })
  .node('four', Constant, { value: 4 })
  .node('counter', Register, { initial: 0 })
  .node('counterInc', Incrementer)
  .node('counterMux', Mux)
  .node('notDone', Comparator)
  .node('shouldAdvance', And)
  .node('isCycle0', Comparator)
  .node('isCycle1', Comparator)
  .node('isCycle2', Comparator)
  .node('loadWeights', And)
  .node('muxR0a', Mux)
  .node('muxR0b', Mux)
  .node('r0valid', Or)
  .node('muxR1a', Mux)
  .node('muxR1b', Mux)
  .node('r1valid', Or)
  .node('col0count', Register, { initial: 0 })
  .node('col0countInc', Incrementer)
  .node('col0isFirst', Comparator)
  .node('col0isSecond', Comparator)
  .node('c00we', And)
  .node('result_c00', Register)
  .node('c10we', And)
  .node('result_c10', Register)
  .node('col1count', Register, { initial: 0 })
  .node('col1countInc', Incrementer)
  .node('col1isFirst', Comparator)
  .node('col1isSecond', Comparator)
  .node('c01we', And)
  .node('result_c01', Register)
  .node('c11we', And)
  .node('result_c11', Register)
  .node('isDone', Comparator)
  .connect(({ in: inp, out, pe00, pe01, pe10, pe11, zero, one, two, three, four, counter, counterInc, counterMux, notDone, shouldAdvance, isCycle0, isCycle1, isCycle2, loadWeights, muxR0a, muxR0b, r0valid, muxR1a, muxR1b, r1valid, col0count, col0countInc, col0isFirst, col0isSecond, c00we, result_c00, c10we, result_c10, col1count, col1countInc, col1isFirst, col1isSecond, c01we, result_c01, c11we, result_c11, isDone }) => [
    counter.q.to(counterInc.in, notDone.a, counterMux.in0, isCycle0.a, isCycle1.a, isCycle2.a, isDone.a),
    four.out.to(notDone.b, isDone.b),
    inp.start.to(shouldAdvance.a, loadWeights.b),
    notDone.lt.to(shouldAdvance.b),
    shouldAdvance.out.to(counterMux.sel),
    counterInc.out.to(counterMux.in1),
    counterMux.out.to(counter.data),
    one.out.to(counter.we, isCycle1.b, col0isSecond.b, col1isSecond.b),
    zero.out.to(isCycle0.b, muxR0a.in0, muxR1a.in0, pe00.partialSumIn, pe01.partialSumIn, col0isFirst.b, col1isFirst.b),
    two.out.to(isCycle2.b),
    isCycle0.eq.to(loadWeights.a),
    inp.b00.to(pe00.weightIn),
    inp.b01.to(pe01.weightIn),
    inp.b10.to(pe10.weightIn),
    inp.b11.to(pe11.weightIn),
    loadWeights.out.to(pe00.weightValid, pe01.weightValid, pe10.weightValid, pe11.weightValid),
    isCycle1.eq.to(muxR0a.sel, r0valid.a, muxR1a.sel, r1valid.a),
    inp.a00.to(muxR0a.in1),
    isCycle2.eq.to(muxR0b.sel, r0valid.b, muxR1b.sel, r1valid.b),
    muxR0a.out.to(muxR0b.in0),
    inp.a10.to(muxR0b.in1),
    inp.a01.to(muxR1a.in1),
    muxR1a.out.to(muxR1b.in0),
    inp.a11.to(muxR1b.in1),
    muxR0b.out.to(pe00.dataIn),
    pe00.dataOut.to(pe01.dataIn),
    muxR1b.out.to(pe10.dataIn),
    pe10.dataOut.to(pe11.dataIn),
    r0valid.out.to(pe00.validIn),
    pe00.validOut.to(pe01.validIn),
    r1valid.out.to(pe10.validIn),
    pe10.validOut.to(pe11.validIn, col0count.we, c00we.a, c10we.a),
    pe00.partialSumOut.to(pe10.partialSumIn),
    pe01.partialSumOut.to(pe11.partialSumIn),
    col0count.q.to(col0countInc.in, col0isFirst.a, col0isSecond.a),
    col0countInc.out.to(col0count.data),
    col0isFirst.eq.to(c00we.b),
    pe10.partialSumOut.to(result_c00.data, result_c10.data),
    c00we.out.to(result_c00.we),
    col0isSecond.eq.to(c10we.b),
    c10we.out.to(result_c10.we),
    col1count.q.to(col1countInc.in, col1isFirst.a, col1isSecond.a),
    col1countInc.out.to(col1count.data),
    pe11.validOut.to(col1count.we, c01we.a, c11we.a),
    col1isFirst.eq.to(c01we.b),
    pe11.partialSumOut.to(result_c01.data, result_c11.data),
    c01we.out.to(result_c01.we),
    col1isSecond.eq.to(c11we.b),
    c11we.out.to(result_c11.we),
    result_c00.q.to(out.c00),
    result_c01.q.to(out.c01),
    result_c10.q.to(out.c10),
    result_c11.q.to(out.c11),
    isDone.eq.to(out.done),
  ])
  .build()

const TestWavefront = component('TestWavefront')
  .node('sys', Systolic2x2)
  .node('a00', Input, { value: 1 })
  .node('a01', Input, { value: 2 })
  .node('a10', Input, { value: 3 })
  .node('a11', Input, { value: 4 })
  .node('b00', Input, { value: 5 })
  .node('b01', Input, { value: 6 })
  .node('b10', Input, { value: 7 })
  .node('b11', Input, { value: 8 })
  .node('start', Switch, { value: 1 })
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
