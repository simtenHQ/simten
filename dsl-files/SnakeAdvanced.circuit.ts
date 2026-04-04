// Auto-generated from DSL

const SnakeAdvanced = component('SnakeAdvanced')
  .node('ram', DualPortRAM, { init: {"33":1,"34":1,"35":1,"36":1,"64":33,"65":34,"66":35,"67":36} })
  .node('screen', Screen)
  .node('keyboard', Input, { value: 77 })
  .node('foodX', Register, { initial: 6 })
  .node('foodY', Register, { initial: 3 })
  .node('foodNeedsDrawing', Register, { initial: 1 })
  .node('headPtr', Register, { initial: 3 })
  .node('tailPtr', Register, { initial: 0 })
  .node('snakeLen', Register, { initial: 4 })
  .node('headX', Register, { initial: 4 })
  .node('headY', Register, { initial: 4 })
  .node('tailPixelAddr', Register, { initial: 33 })
  .node('nextHeadPixelAddr', Register, { initial: 36 })
  .node('phase', Register, { initial: 0 })
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('two', Constant, { value: 2 })
  .node('three', Constant, { value: 3 })
  .node('bodyBase', Constant, { value: 64 })
  .node('minus1', Constant, { value: 255 })
  .node('eight', Constant, { value: 8 })
  .node('phaseInc', Adder)
  .node('phaseWrap', BitSlice, { low: 0, high: 1 })
  .node('phaseEnable', Switch, { value: 1 })
  .node('isPhase0', Comparator)
  .node('isPhase1', Comparator)
  .node('isPhase2', Comparator)
  .node('isPhase3', Comparator)
  .node('keyboardLatched', Register, { initial: 0 })
  .node('latchKeyboard', And)
  .node('upCode', Constant, { value: 72 })
  .node('downCode', Constant, { value: 80 })
  .node('leftCode', Constant, { value: 75 })
  .node('rightCode', Constant, { value: 77 })
  .node('isUp', Comparator)
  .node('isDown', Comparator)
  .node('isLeft', Comparator)
  .node('isRight', Comparator)
  .node('deltaXTemp', Mux)
  .node('deltaX', Mux)
  .node('deltaYTemp', Mux)
  .node('deltaY', Mux)
  .node('nextHeadXCalc', Adder)
  .node('nextHeadYCalc', Adder)
  .node('nextHeadX', BitSlice, { low: 0, high: 2 })
  .node('nextHeadY', BitSlice, { low: 0, high: 2 })
  .node('nextHeadY2', Adder)
  .node('nextHeadY4', Adder)
  .node('nextHeadY8', Adder)
  .node('nextPixelAddr', Adder)
  .node('foodY2', Adder)
  .node('foodY4', Adder)
  .node('foodY8', Adder)
  .node('foodPixelAddr', Adder)
  .node('nextHeadAtFoodX', Comparator)
  .node('nextHeadAtFoodY', Comparator)
  .node('willEatFood', And)
  .node('latchNextHead', And)
  .node('headPtrNext', Adder)
  .node('headPtrNextWrap', BitSlice, { low: 0, high: 5 })
  .node('headBodyAddr', Adder)
  .node('tailBodyAddr', Adder)
  .node('phase0Addr', Mux)
  .node('addrMux0', Mux)
  .node('addrMux1', Mux)
  .node('ramAddr', Mux)
  .node('dataMux0', Mux)
  .node('dataMux1', Mux)
  .node('ramData', Mux)
  .node('bufferEmpty', Comparator)
  .node('bufferNotEmpty', Not)
  .node('deltaXIsZero', Comparator)
  .node('deltaYIsZero', Comparator)
  .node('bothDeltasZero', And)
  .node('isMoving', Not)
  .node('shouldMoveTail', Switch, { value: 1 })
  .node('shouldMoveTailActual', And)
  .node('notEatingFood', Not)
  .node('shouldClearTail', And)
  .node('shouldClearTailMoving', And)
  .node('writePhase0', And)
  .node('writePhase1', And)
  .node('writePhase2', And)
  .node('writePhase3', And)
  .node('writePhase01', Or)
  .node('writePhase2or3', Or)
  .node('writeAny', Or)
  .node('writeEnable', Switch, { value: 1 })
  .node('finalWriteEnable', And)
  .node('latchTail', And)
  .node('latchTailFinal', And)
  .node('latchTailNotFood', And)
  .node('notDrawingFood', Not)
  .node('clearFoodFlag', And)
  .node('clearFoodFlagFinal', And)
  .node('ateFood', And)
  .node('ateFoodFinal', And)
  .node('foodFlagWriteEnable', Or)
  .node('foodFlagData', Mux)
  .node('foodXNext', Adder)
  .node('foodXWrap', BitSlice, { low: 0, high: 2 })
  .node('foodYNext', Adder)
  .node('five', Constant, { value: 5 })
  .node('foodYWrap', BitSlice, { low: 0, high: 2 })
  .node('updateHead', And)
  .node('updateHeadFinal', And)
  .node('headPtrInc', Adder)
  .node('headPtrWrap', BitSlice, { low: 0, high: 5 })
  .node('tailPtrInc', Adder)
  .node('tailPtrWrap', BitSlice, { low: 0, high: 5 })
  .node('updateTail', And)
  .node('updateTailFinal', And)
  .node('snakeLenDelta', Mux)
  .node('snakeLenNew', Adder)
  .connect(({ in: inp, out, ram, screen, keyboard, foodX, foodY, foodNeedsDrawing, headPtr, tailPtr, snakeLen, headX, headY, tailPixelAddr, nextHeadPixelAddr, phase, zero, one, two, three, bodyBase, minus1, eight, phaseInc, phaseWrap, phaseEnable, isPhase0, isPhase1, isPhase2, isPhase3, keyboardLatched, latchKeyboard, upCode, downCode, leftCode, rightCode, isUp, isDown, isLeft, isRight, deltaXTemp, deltaX, deltaYTemp, deltaY, nextHeadXCalc, nextHeadYCalc, nextHeadX, nextHeadY, nextHeadY2, nextHeadY4, nextHeadY8, nextPixelAddr, foodY2, foodY4, foodY8, foodPixelAddr, nextHeadAtFoodX, nextHeadAtFoodY, willEatFood, latchNextHead, headPtrNext, headPtrNextWrap, headBodyAddr, tailBodyAddr, phase0Addr, addrMux0, addrMux1, ramAddr, dataMux0, dataMux1, ramData, bufferEmpty, bufferNotEmpty, deltaXIsZero, deltaYIsZero, bothDeltasZero, isMoving, shouldMoveTail, shouldMoveTailActual, notEatingFood, shouldClearTail, shouldClearTailMoving, writePhase0, writePhase1, writePhase2, writePhase3, writePhase01, writePhase2or3, writeAny, writeEnable, finalWriteEnable, latchTail, latchTailFinal, latchTailNotFood, notDrawingFood, clearFoodFlag, clearFoodFlagFinal, ateFood, ateFoodFinal, foodFlagWriteEnable, foodFlagData, foodXNext, foodXWrap, foodYNext, five, foodYWrap, updateHead, updateHeadFinal, headPtrInc, headPtrWrap, tailPtrInc, tailPtrWrap, updateTail, updateTailFinal, snakeLenDelta, snakeLenNew }) => [
    screen.addrB.to(ram.addrB),
    ram.outB.to(screen.dataIn),
    phase.q.to(phaseInc.a, isPhase0.a, isPhase1.a, isPhase2.a, isPhase3.a),
    one.out.to(phaseInc.b, isPhase1.b, deltaX.in1, deltaY.in1, headPtrNext.b, dataMux1.in1, ramData.in1, foodFlagData.in1, headPtrInc.b, tailPtrInc.b, snakeLenDelta.in0),
    phaseInc.sum.to(phaseWrap.in),
    phaseWrap.out.to(phase.data),
    phaseEnable.out.to(phase.we, latchKeyboard.a, latchNextHead.a, latchTail.a, clearFoodFlag.a, ateFood.a, updateHead.a, updateTail.a),
    zero.out.to(isPhase0.b, deltaXTemp.in0, deltaYTemp.in0, dataMux0.in0, bufferEmpty.b, deltaXIsZero.b, deltaYIsZero.b, foodFlagData.in0, snakeLenDelta.in1),
    two.out.to(isPhase2.b),
    three.out.to(isPhase3.b, foodXNext.b),
    keyboard.out.to(keyboardLatched.data),
    isPhase0.eq.to(latchKeyboard.b, writePhase0.a, latchTail.b, clearFoodFlag.b),
    latchKeyboard.out.to(keyboardLatched.we),
    keyboardLatched.q.to(isUp.a, isDown.a, isLeft.a, isRight.a),
    upCode.out.to(isUp.b),
    downCode.out.to(isDown.b),
    leftCode.out.to(isLeft.b),
    rightCode.out.to(isRight.b),
    minus1.out.to(deltaXTemp.in1, deltaYTemp.in1),
    isLeft.eq.to(deltaXTemp.sel),
    deltaXTemp.out.to(deltaX.in0),
    isRight.eq.to(deltaX.sel),
    isUp.eq.to(deltaYTemp.sel),
    deltaYTemp.out.to(deltaY.in0),
    isDown.eq.to(deltaY.sel),
    headX.q.to(nextHeadXCalc.a),
    deltaX.out.to(nextHeadXCalc.b, deltaXIsZero.a),
    headY.q.to(nextHeadYCalc.a),
    deltaY.out.to(nextHeadYCalc.b, deltaYIsZero.a),
    nextHeadXCalc.sum.to(nextHeadX.in),
    nextHeadYCalc.sum.to(nextHeadY.in),
    nextHeadY.out.to(nextHeadY2.a, nextHeadY2.b, nextHeadAtFoodY.a, headY.data),
    nextHeadY2.sum.to(nextHeadY4.a, nextHeadY4.b),
    nextHeadY4.sum.to(nextHeadY8.a, nextHeadY8.b),
    nextHeadY8.sum.to(nextPixelAddr.a),
    nextHeadX.out.to(nextPixelAddr.b, nextHeadAtFoodX.a, headX.data),
    foodY.q.to(foodY2.a, foodY2.b, nextHeadAtFoodY.b, foodYNext.a),
    foodY2.sum.to(foodY4.a, foodY4.b),
    foodY4.sum.to(foodY8.a, foodY8.b),
    foodY8.sum.to(foodPixelAddr.a),
    foodX.q.to(foodPixelAddr.b, nextHeadAtFoodX.b, foodXNext.a),
    nextHeadAtFoodX.eq.to(willEatFood.a),
    nextHeadAtFoodY.eq.to(willEatFood.b),
    nextPixelAddr.sum.to(nextHeadPixelAddr.data),
    isPhase1.eq.to(latchNextHead.b, addrMux0.sel, writePhase1.a),
    latchNextHead.out.to(nextHeadPixelAddr.we),
    headPtr.q.to(headPtrNext.a, headPtrInc.a),
    headPtrNext.sum.to(headPtrNextWrap.in),
    headPtrNextWrap.out.to(headBodyAddr.a),
    bodyBase.out.to(headBodyAddr.b, tailBodyAddr.b),
    tailPtr.q.to(tailBodyAddr.a, tailPtrInc.a),
    tailBodyAddr.sum.to(phase0Addr.in0),
    foodPixelAddr.sum.to(phase0Addr.in1),
    foodNeedsDrawing.q.to(phase0Addr.sel, ramData.sel, writePhase0.b, notDrawingFood.in, clearFoodFlagFinal.b),
    phase0Addr.out.to(addrMux0.in0),
    tailPixelAddr.q.to(addrMux0.in1),
    addrMux0.out.to(addrMux1.in0),
    headBodyAddr.sum.to(addrMux1.in1),
    isPhase2.eq.to(addrMux1.sel, dataMux0.sel, writePhase2.a),
    addrMux1.out.to(ramAddr.in0),
    nextHeadPixelAddr.q.to(ramAddr.in1, dataMux0.in1),
    isPhase3.eq.to(ramAddr.sel, dataMux1.sel, writePhase3.a, ateFood.b, updateHead.b, updateTail.b),
    ramAddr.out.to(ram.addrA),
    dataMux0.out.to(dataMux1.in0),
    dataMux1.out.to(ramData.in0),
    ramData.out.to(ram.dataA),
    snakeLen.q.to(bufferEmpty.a, snakeLenNew.a),
    bufferEmpty.eq.to(bufferNotEmpty.in),
    deltaXIsZero.eq.to(bothDeltasZero.a),
    deltaYIsZero.eq.to(bothDeltasZero.b),
    bothDeltasZero.out.to(isMoving.in),
    shouldMoveTail.out.to(shouldMoveTailActual.a),
    willEatFood.out.to(notEatingFood.in, ateFoodFinal.b),
    notEatingFood.out.to(shouldMoveTailActual.b),
    shouldMoveTailActual.out.to(shouldClearTail.a),
    isMoving.out.to(shouldClearTail.b, writePhase2.b, writePhase3.b, updateHeadFinal.b),
    shouldClearTail.out.to(shouldClearTailMoving.a),
    bufferNotEmpty.out.to(shouldClearTailMoving.b, latchTailFinal.b),
    shouldClearTailMoving.out.to(writePhase1.b, updateTailFinal.b, snakeLenDelta.sel),
    writePhase0.out.to(writePhase01.a),
    writePhase1.out.to(writePhase01.b),
    writePhase2.out.to(writePhase2or3.a),
    writePhase3.out.to(writePhase2or3.b),
    writePhase01.out.to(writeAny.a),
    writePhase2or3.out.to(writeAny.b),
    writeEnable.out.to(finalWriteEnable.a),
    writeAny.out.to(finalWriteEnable.b),
    finalWriteEnable.out.to(ram.weA),
    ram.outA.to(tailPixelAddr.data),
    latchTail.out.to(latchTailFinal.a),
    latchTailFinal.out.to(latchTailNotFood.a),
    notDrawingFood.out.to(latchTailNotFood.b),
    latchTailNotFood.out.to(tailPixelAddr.we),
    clearFoodFlag.out.to(clearFoodFlagFinal.a),
    ateFood.out.to(ateFoodFinal.a),
    ateFoodFinal.out.to(foodFlagWriteEnable.a, foodFlagData.sel, foodX.we, foodY.we),
    clearFoodFlagFinal.out.to(foodFlagWriteEnable.b),
    foodFlagWriteEnable.out.to(foodNeedsDrawing.we),
    foodFlagData.out.to(foodNeedsDrawing.data),
    foodXNext.sum.to(foodXWrap.in),
    five.out.to(foodYNext.b),
    foodYNext.sum.to(foodYWrap.in),
    foodXWrap.out.to(foodX.data),
    foodYWrap.out.to(foodY.data),
    updateHead.out.to(updateHeadFinal.a),
    updateHeadFinal.out.to(headX.we, headY.we, headPtr.we, snakeLen.we),
    headPtrInc.sum.to(headPtrWrap.in),
    headPtrWrap.out.to(headPtr.data),
    tailPtrInc.sum.to(tailPtrWrap.in),
    tailPtrWrap.out.to(tailPtr.data),
    updateTail.out.to(updateTailFinal.a),
    updateTailFinal.out.to(tailPtr.we),
    snakeLenDelta.out.to(snakeLenNew.b),
    snakeLenNew.sum.to(snakeLen.data),
  ])
  .build()
