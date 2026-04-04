// Auto-generated from DSL

const Snake4PixelsExplicit = component('Snake4PixelsExplicit')
  .node('ram', DualPortRAM)
  .node('screen', Screen)
  .node('keyboard', Input)
  .node('pos0X', Register)
  .node('pos0Y', Register)
  .node('pos1X', Register)
  .node('pos1Y', Register)
  .node('pos2X', Register)
  .node('pos2Y', Register)
  .node('pos3X', Register)
  .node('pos3Y', Register)
  .node('phase', DFlipFlop)
  .node('notPhase', Not)
  .node('upCode', Input)
  .node('downCode', Input)
  .node('leftCode', Input)
  .node('rightCode', Input)
  .node('isUp', Comparator)
  .node('isDown', Comparator)
  .node('isLeft', Comparator)
  .node('isRight', Comparator)
  .node('zero', Input)
  .node('one', Input)
  .node('minus1', Input)
  .node('deltaXTemp', Mux)
  .node('deltaX', Mux)
  .node('deltaYTemp', Mux)
  .node('deltaY', Mux)
  .node('newHeadX', Adder)
  .node('newHeadY', Adder)
  .node('wrapX', BitSlice)
  .node('wrapY', BitSlice)
  .node('useX', Mux)
  .node('useY', Mux)
  .node('y2', Adder)
  .node('y4', Adder)
  .node('y8', Adder)
  .node('addr', Adder)
  .node('ramData', Mux)
  .node('regEnable', Switch)
  .node('shiftEnable', And)
  .node('writeEnable', Switch)
  .connect(({ in: inp, out, ram, screen, keyboard, pos0X, pos0Y, pos1X, pos1Y, pos2X, pos2Y, pos3X, pos3Y, phase, notPhase, upCode, downCode, leftCode, rightCode, isUp, isDown, isLeft, isRight, zero, one, minus1, deltaXTemp, deltaX, deltaYTemp, deltaY, newHeadX, newHeadY, wrapX, wrapY, useX, useY, y2, y4, y8, addr, ramData, regEnable, shiftEnable, writeEnable }) => [
    screen.addrB.to(ram.addrB),
    ram.outB.to(screen.dataIn),
    phase.q.to(notPhase.in, useX.sel, useY.sel, ramData.sel, shiftEnable.b),
    notPhase.out.to(phase.d),
    keyboard.out.to(isUp.a, isDown.a, isLeft.a, isRight.a),
    upCode.out.to(isUp.b),
    downCode.out.to(isDown.b),
    leftCode.out.to(isLeft.b),
    rightCode.out.to(isRight.b),
    zero.out.to(deltaXTemp.in0, deltaYTemp.in0, ramData.in0),
    minus1.out.to(deltaXTemp.in1, deltaYTemp.in1),
    isLeft.eq.to(deltaXTemp.sel),
    deltaXTemp.out.to(deltaX.in0),
    one.out.to(deltaX.in1, deltaY.in1, ramData.in1),
    isRight.eq.to(deltaX.sel),
    isUp.eq.to(deltaYTemp.sel),
    deltaYTemp.out.to(deltaY.in0),
    isDown.eq.to(deltaY.sel),
    pos0X.q.to(newHeadX.a, pos1X.data),
    deltaX.out.to(newHeadX.b),
    pos0Y.q.to(newHeadY.a, pos1Y.data),
    deltaY.out.to(newHeadY.b),
    newHeadX.sum.to(wrapX.in),
    newHeadY.sum.to(wrapY.in),
    pos3X.q.to(useX.in0),
    wrapX.out.to(useX.in1, pos0X.data),
    pos3Y.q.to(useY.in0),
    wrapY.out.to(useY.in1, pos0Y.data),
    useY.out.to(y2.a, y2.b),
    y2.sum.to(y4.a, y4.b),
    y4.sum.to(y8.a, y8.b),
    y8.sum.to(addr.a),
    useX.out.to(addr.b),
    addr.sum.to(ram.addrA),
    ramData.out.to(ram.dataA),
    regEnable.out.to(shiftEnable.a),
    pos1X.q.to(pos2X.data),
    pos1Y.q.to(pos2Y.data),
    pos2X.q.to(pos3X.data),
    pos2Y.q.to(pos3Y.data),
    shiftEnable.out.to(pos0X.we, pos0Y.we, pos1X.we, pos1Y.we, pos2X.we, pos2Y.we, pos3X.we, pos3Y.we),
    writeEnable.out.to(ram.weA),
  ])
  .build()
