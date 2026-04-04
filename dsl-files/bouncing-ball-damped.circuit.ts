// Auto-generated from DSL

const BouncingBallDamped = component('BouncingBallDamped')
  .node('ballX', Register, { initial: 3 })
  .node('ballY', Register, { initial: 7 })
  .node('prevX', Register, { initial: 3 })
  .node('prevY', Register, { initial: 7 })
  .node('dirY', DFlipFlop, { initial: 0 })
  .node('maxReach', Register, { initial: 0 })
  .node('framePhase', DFlipFlop)
  .node('yInc', Incrementer)
  .node('yDec', Adder)
  .node('yNegOne', Constant, { value: 255 })
  .node('yNext', Mux)
  .node('ground', Constant, { value: 7 })
  .node('cmpGround', Comparator)
  .node('cmpMaxReach', Comparator)
  .node('dirYInv', Not)
  .node('hitGround', And)
  .node('hitTop', And)
  .node('shouldFlip', Or)
  .node('flipY', Xor)
  .node('maxReachInc', Incrementer)
  .node('maxReachNext', Mux)
  .node('eight', Constant, { value: 8 })
  .node('yTimes8', Multiplier)
  .node('addr', Adder)
  .node('prevYTimes8', Multiplier)
  .node('prevAddr', Adder)
  .node('addrMux', Mux)
  .node('pixelMux', Mux)
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('phaseInv', Not)
  .node('enable', Constant, { value: 1 })
  .node('fb', DualPortRAM)
  .node('display', Screen)
  .node('debugMaxReach', HexDisplay)
  .node('y3bit', BitSlice, { low: 0, high: 2 })
  .node('x3bit', BitSlice, { low: 0, high: 2 })
  .node('prevY3bit', BitSlice, { low: 0, high: 2 })
  .node('prevX3bit', BitSlice, { low: 0, high: 2 })
  .node('maxReach3bit', BitSlice, { low: 0, high: 2 })
  .connect(({ in: inp, out, ballX, ballY, prevX, prevY, dirY, maxReach, framePhase, yInc, yDec, yNegOne, yNext, ground, cmpGround, cmpMaxReach, dirYInv, hitGround, hitTop, shouldFlip, flipY, maxReachInc, maxReachNext, eight, yTimes8, addr, prevYTimes8, prevAddr, addrMux, pixelMux, zero, one, phaseInv, enable, fb, display, debugMaxReach, y3bit, x3bit, prevY3bit, prevX3bit, maxReach3bit }) => [
    ballY.q.to(yInc.in, yDec.a, prevY.data, y3bit.in),
    yNegOne.out.to(yDec.b),
    flipY.out.to(yNext.sel, dirY.d),
    yInc.out.to(yNext.in1),
    yDec.sum.to(yNext.in0),
    yNext.out.to(ballY.data),
    framePhase.q.to(ballY.we, prevX.we, prevY.we, phaseInv.in, addrMux.sel, pixelMux.sel),
    ballX.q.to(prevX.data, x3bit.in),
    prevY.q.to(prevY3bit.in),
    prevX.q.to(prevX3bit.in),
    maxReach.q.to(maxReach3bit.in, maxReachInc.in, maxReachNext.in0, debugMaxReach.in),
    y3bit.out.to(cmpGround.a, cmpMaxReach.a, yTimes8.a),
    ground.out.to(cmpGround.b),
    maxReach3bit.out.to(cmpMaxReach.b),
    dirY.q.to(dirYInv.in, hitGround.b, flipY.a),
    cmpGround.eq.to(hitGround.a),
    cmpMaxReach.eq.to(hitTop.a),
    dirYInv.out.to(hitTop.b),
    hitGround.out.to(shouldFlip.a, maxReachNext.sel),
    hitTop.out.to(shouldFlip.b),
    shouldFlip.out.to(flipY.b),
    maxReachInc.out.to(maxReachNext.in1),
    maxReachNext.out.to(maxReach.data),
    enable.out.to(maxReach.we, fb.weA),
    eight.out.to(yTimes8.b, prevYTimes8.b),
    yTimes8.product.to(addr.a),
    x3bit.out.to(addr.b),
    prevY3bit.out.to(prevYTimes8.a),
    prevYTimes8.product.to(prevAddr.a),
    prevX3bit.out.to(prevAddr.b),
    phaseInv.out.to(framePhase.d),
    prevAddr.sum.to(addrMux.in0),
    addr.sum.to(addrMux.in1),
    zero.out.to(pixelMux.in0),
    one.out.to(pixelMux.in1),
    addrMux.out.to(fb.addrA),
    pixelMux.out.to(fb.dataA),
    display.addrB.to(fb.addrB),
    fb.outB.to(display.dataIn),
  ])
  .build()
