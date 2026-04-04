// Auto-generated from DSL

const PongSimple = component('PongSimple')
  .node('ram', DualPortRAM)
  .node('screen', Screen)
  .node('keyboard0', Input)
  .node('keyboard1', Input)
  .node('ballX', Register)
  .node('ballY', Register)
  .node('ballDX', Register)
  .node('ballDY', Register)
  .node('leftPaddleY', Register)
  .node('rightPaddleY', Register)
  .node('oldBallX', Register)
  .node('oldBallY', Register)
  .node('oldLeftPaddleY', Register)
  .node('oldRightPaddleY', Register)
  .node('phaseCounter', Register)
  .node('phaseIncrement', Adder)
  .node('one', Input)
  .node('phaseMod', Comparator)
  .node('six', Input)
  .node('nextPhase', Mux)
  .node('zero', Input)
  .node('phaseEnable', Switch)
  .node('phase0Const', Input)
  .node('phase1Const', Input)
  .node('phase2Const', Input)
  .node('phase3Const', Input)
  .node('phase4Const', Input)
  .node('phase5Const', Input)
  .node('isPhase0', Comparator)
  .node('isPhase1', Comparator)
  .node('isPhase2', Comparator)
  .node('isPhase3', Comparator)
  .node('isPhase4', Comparator)
  .node('isPhase5', Comparator)
  .node('seven', Input)
  .node('minus1', Input)
  .node('keyW', Input)
  .node('keyS', Input)
  .node('keyUp', Input)
  .node('keyDown', Input)
  .node('isW_kb0', Comparator)
  .node('isS_kb0', Comparator)
  .node('isUp_kb0', Comparator)
  .node('isDown_kb0', Comparator)
  .node('isW_kb1', Comparator)
  .node('isS_kb1', Comparator)
  .node('isUp_kb1', Comparator)
  .node('isDown_kb1', Comparator)
  .node('isW', Or)
  .node('isS', Or)
  .node('isUp', Or)
  .node('isDown', Or)
  .node('leftUpDelta', Mux)
  .node('leftDelta', Mux)
  .node('newLeftPaddleY', Adder)
  .node('rightUpDelta', Mux)
  .node('rightDelta', Mux)
  .node('newRightPaddleY', Adder)
  .node('newBallX', Adder)
  .node('newBallY', Adder)
  .node('updateEnable', Switch)
  .node('shouldUpdate', And)
  .node('yMux0', Mux)
  .node('yMux1', Mux)
  .node('yMux2', Mux)
  .node('yMux3', Mux)
  .node('selectY', Mux)
  .node('xMux0', Mux)
  .node('xMux1', Mux)
  .node('xMux2', Mux)
  .node('xMux3', Mux)
  .node('selectX', Mux)
  .node('yTimes2', Adder)
  .node('yTimes4', Adder)
  .node('yTimes8', Adder)
  .node('ramAddr', Adder)
  .node('isClearPhase', Or)
  .node('isClearPhase2', Or)
  .node('ramData', Mux)
  .node('writeEnable', Switch)
  .connect(({ in: inp, out, ram, screen, keyboard0, keyboard1, ballX, ballY, ballDX, ballDY, leftPaddleY, rightPaddleY, oldBallX, oldBallY, oldLeftPaddleY, oldRightPaddleY, phaseCounter, phaseIncrement, one, phaseMod, six, nextPhase, zero, phaseEnable, phase0Const, phase1Const, phase2Const, phase3Const, phase4Const, phase5Const, isPhase0, isPhase1, isPhase2, isPhase3, isPhase4, isPhase5, seven, minus1, keyW, keyS, keyUp, keyDown, isW_kb0, isS_kb0, isUp_kb0, isDown_kb0, isW_kb1, isS_kb1, isUp_kb1, isDown_kb1, isW, isS, isUp, isDown, leftUpDelta, leftDelta, newLeftPaddleY, rightUpDelta, rightDelta, newRightPaddleY, newBallX, newBallY, updateEnable, shouldUpdate, yMux0, yMux1, yMux2, yMux3, selectY, xMux0, xMux1, xMux2, xMux3, selectX, yTimes2, yTimes4, yTimes8, ramAddr, isClearPhase, isClearPhase2, ramData, writeEnable }) => [
    screen.addrB.to(ram.addrB),
    ram.outB.to(screen.dataIn),
    phaseCounter.q.to(phaseIncrement.a, isPhase0.a, isPhase1.a, isPhase2.a, isPhase3.a, isPhase4.a, isPhase5.a),
    one.out.to(phaseIncrement.b, leftDelta.in1, rightDelta.in1, ramData.in0),
    phaseIncrement.sum.to(phaseMod.a, nextPhase.in0),
    six.out.to(phaseMod.b),
    zero.out.to(nextPhase.in1, leftUpDelta.in0, rightUpDelta.in0, xMux0.in1, xMux3.in1, ramData.in1),
    phaseMod.eq.to(nextPhase.sel),
    nextPhase.out.to(phaseCounter.data),
    phaseEnable.out.to(phaseCounter.we),
    phase0Const.out.to(isPhase0.b),
    phase1Const.out.to(isPhase1.b),
    phase2Const.out.to(isPhase2.b),
    phase3Const.out.to(isPhase3.b),
    phase4Const.out.to(isPhase4.b),
    phase5Const.out.to(isPhase5.b),
    keyboard0.out.to(isW_kb0.a, isS_kb0.a, isUp_kb0.a, isDown_kb0.a),
    keyW.out.to(isW_kb0.b, isW_kb1.b),
    keyS.out.to(isS_kb0.b, isS_kb1.b),
    keyUp.out.to(isUp_kb0.b, isUp_kb1.b),
    keyDown.out.to(isDown_kb0.b, isDown_kb1.b),
    keyboard1.out.to(isW_kb1.a, isS_kb1.a, isUp_kb1.a, isDown_kb1.a),
    isW_kb0.eq.to(isW.a),
    isW_kb1.eq.to(isW.b),
    isS_kb0.eq.to(isS.a),
    isS_kb1.eq.to(isS.b),
    isUp_kb0.eq.to(isUp.a),
    isUp_kb1.eq.to(isUp.b),
    isDown_kb0.eq.to(isDown.a),
    isDown_kb1.eq.to(isDown.b),
    minus1.out.to(leftUpDelta.in1, rightUpDelta.in1),
    isW.out.to(leftUpDelta.sel),
    leftUpDelta.out.to(leftDelta.in0),
    isS.out.to(leftDelta.sel),
    leftPaddleY.q.to(newLeftPaddleY.a, oldLeftPaddleY.data, yMux3.in1),
    leftDelta.out.to(newLeftPaddleY.b),
    isUp.out.to(rightUpDelta.sel),
    rightUpDelta.out.to(rightDelta.in0),
    isDown.out.to(rightDelta.sel),
    rightPaddleY.q.to(newRightPaddleY.a, oldRightPaddleY.data, selectY.in1),
    rightDelta.out.to(newRightPaddleY.b),
    ballX.q.to(newBallX.a, oldBallX.data, xMux2.in1),
    ballDX.q.to(newBallX.b),
    ballY.q.to(newBallY.a, oldBallY.data, yMux2.in1),
    ballDY.q.to(newBallY.b),
    updateEnable.out.to(shouldUpdate.a),
    isPhase5.eq.to(shouldUpdate.b, selectY.sel, selectX.sel),
    shouldUpdate.out.to(oldBallX.we, oldBallY.we, oldLeftPaddleY.we, oldRightPaddleY.we, ballX.we, ballY.we, leftPaddleY.we, rightPaddleY.we),
    newBallX.sum.to(ballX.data),
    newBallY.sum.to(ballY.data),
    newLeftPaddleY.sum.to(leftPaddleY.data),
    newRightPaddleY.sum.to(rightPaddleY.data),
    oldBallY.q.to(yMux0.in0),
    oldLeftPaddleY.q.to(yMux0.in1),
    isPhase1.eq.to(yMux0.sel, xMux0.sel, isClearPhase.b),
    yMux0.out.to(yMux1.in0),
    oldRightPaddleY.q.to(yMux1.in1),
    isPhase2.eq.to(yMux1.sel, xMux1.sel, isClearPhase2.b),
    yMux1.out.to(yMux2.in0),
    isPhase3.eq.to(yMux2.sel, xMux2.sel),
    yMux2.out.to(yMux3.in0),
    isPhase4.eq.to(yMux3.sel, xMux3.sel),
    yMux3.out.to(selectY.in0),
    oldBallX.q.to(xMux0.in0),
    xMux0.out.to(xMux1.in0),
    seven.out.to(xMux1.in1, selectX.in1),
    xMux1.out.to(xMux2.in0),
    xMux2.out.to(xMux3.in0),
    xMux3.out.to(selectX.in0),
    selectY.out.to(yTimes2.a, yTimes2.b),
    yTimes2.sum.to(yTimes4.a, yTimes4.b),
    yTimes4.sum.to(yTimes8.a, yTimes8.b),
    yTimes8.sum.to(ramAddr.a),
    selectX.out.to(ramAddr.b),
    ramAddr.sum.to(ram.addrA),
    isPhase0.eq.to(isClearPhase.a),
    isClearPhase.out.to(isClearPhase2.a),
    isClearPhase2.out.to(ramData.sel),
    ramData.out.to(ram.dataA),
    writeEnable.out.to(ram.weA),
  ])
  .build()
