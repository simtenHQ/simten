// Auto-generated from DSL

const CORDICIteration = component('CORDICIteration')
  .node('x', Register, { initial: 80 })
  .node('y', Register, { initial: 0 })
  .node('z', Register, { initial: 32 })
  .node('iteration', Register, { initial: 0 })
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('eight', Constant, { value: 8 })
  .node('zPositive', SignedComparator)
  .node('xShifted', RightShifter)
  .node('yShifted', RightShifter)
  .node('yShiftedNeg', BusNot)
  .node('xSubtract', SignedAdder)
  .node('xAdd', SignedAdder)
  .node('xUpdate', Mux)
  .node('xShiftedNeg', BusNot)
  .node('yAdd', SignedAdder)
  .node('ySubtract', SignedAdder)
  .node('yUpdate', Mux)
  .node('angle0', Constant, { value: 32 })
  .node('angle1', Constant, { value: 19 })
  .node('angle2', Constant, { value: 10 })
  .node('angle3', Constant, { value: 5 })
  .node('angle4', Constant, { value: 3 })
  .node('angle5', Constant, { value: 1 })
  .node('angle6', Constant, { value: 1 })
  .node('angle7', Constant, { value: 0 })
  .node('bit0', BitSlice, { low: 0, high: 0 })
  .node('bit1', BitSlice, { low: 1, high: 1 })
  .node('bit2', BitSlice, { low: 2, high: 2 })
  .node('mux01', Mux)
  .node('mux23', Mux)
  .node('mux45', Mux)
  .node('mux67', Mux)
  .node('mux0123', Mux)
  .node('mux4567', Mux)
  .node('angleSel', Mux)
  .node('angleNeg', BusNot)
  .node('zSubtract', SignedAdder)
  .node('zAdd', SignedAdder)
  .node('zUpdate', Mux)
  .node('iterInc', Incrementer)
  .node('shouldContinue', Comparator)
  .node('xDisplay', HexDisplay)
  .node('yDisplay', HexDisplay)
  .node('zDisplay', HexDisplay)
  .node('iterDisplay', HexDisplay)
  .node('doneCheck', Comparator)
  .node('doneLed', Led)
  .connect(({ in: inp, out, x, y, z, iteration, zero, one, eight, zPositive, xShifted, yShifted, yShiftedNeg, xSubtract, xAdd, xUpdate, xShiftedNeg, yAdd, ySubtract, yUpdate, angle0, angle1, angle2, angle3, angle4, angle5, angle6, angle7, bit0, bit1, bit2, mux01, mux23, mux45, mux67, mux0123, mux4567, angleSel, angleNeg, zSubtract, zAdd, zUpdate, iterInc, shouldContinue, xDisplay, yDisplay, zDisplay, iterDisplay, doneCheck, doneLed }) => [
    z.q.to(zPositive.a, zSubtract.a, zAdd.a, zDisplay.in),
    zero.out.to(zPositive.b, xAdd.carry_in, yAdd.carry_in, zAdd.carry_in),
    x.q.to(xShifted.value, xSubtract.a, xAdd.a, xDisplay.in),
    y.q.to(yShifted.value, yAdd.a, ySubtract.a, yDisplay.in),
    iteration.q.to(xShifted.shift, yShifted.shift, bit0.in, bit1.in, bit2.in, iterInc.in, shouldContinue.a, iterDisplay.in, doneCheck.a),
    yShifted.result.to(yShiftedNeg.in, xAdd.b),
    yShiftedNeg.out.to(xSubtract.b),
    one.out.to(xSubtract.carry_in, ySubtract.carry_in, zSubtract.carry_in),
    zPositive.gte.to(xUpdate.sel, yUpdate.sel, zUpdate.sel),
    xAdd.sum.to(xUpdate.in0),
    xSubtract.sum.to(xUpdate.in1),
    xShifted.result.to(xShiftedNeg.in, yAdd.b),
    xShiftedNeg.out.to(ySubtract.b),
    ySubtract.sum.to(yUpdate.in0),
    yAdd.sum.to(yUpdate.in1),
    bit0.out.to(mux01.sel, mux23.sel, mux45.sel, mux67.sel),
    angle0.out.to(mux01.in0),
    angle1.out.to(mux01.in1),
    angle2.out.to(mux23.in0),
    angle3.out.to(mux23.in1),
    angle4.out.to(mux45.in0),
    angle5.out.to(mux45.in1),
    angle6.out.to(mux67.in0),
    angle7.out.to(mux67.in1),
    bit1.out.to(mux0123.sel, mux4567.sel),
    mux01.out.to(mux0123.in0),
    mux23.out.to(mux0123.in1),
    mux45.out.to(mux4567.in0),
    mux67.out.to(mux4567.in1),
    bit2.out.to(angleSel.sel),
    mux0123.out.to(angleSel.in0),
    mux4567.out.to(angleSel.in1),
    angleSel.out.to(angleNeg.in, zAdd.b),
    angleNeg.out.to(zSubtract.b),
    zAdd.sum.to(zUpdate.in0),
    zSubtract.sum.to(zUpdate.in1),
    eight.out.to(shouldContinue.b, doneCheck.b),
    shouldContinue.lt.to(x.we, y.we, z.we, iteration.we),
    xUpdate.out.to(x.data),
    yUpdate.out.to(y.data),
    zUpdate.out.to(z.data),
    iterInc.out.to(iteration.data),
    doneCheck.eq.to(doneLed.in),
  ])
  .build()
