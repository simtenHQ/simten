/**
 * Example circuits for the editor empty state.
 * Each example has a title, description, category, and DSL source.
 */

export interface Example {
  id: string;
  title: string;
  description: string;
  category: "game" | "math" | "cpu" | "basics";
  nodes: string;
  dsl: string;
}

export const EXAMPLES: Example[] = [
  {
    id: "snake",
    title: "Snake",
    description: "A complete Snake game with food, growth, and collision — 4-phase pipeline, circular buffer body storage, all from logic gates. No CPU.",
    category: "game",
    nodes: "~100 nodes",
    dsl: `
const SnakeAdvanced = component('SnakeAdvanced')
  .node('ram', DualPortRAM, { init: {"33":1,"34":1,"35":1,"36":1,"64":33,"65":34,"66":35,"67":36} })
  .node('screen', Screen)
  .node('keyboard', Input)
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
`,
  },
  {
    id: "tpu-3x3",
    title: "3x3 Systolic Array (TPU)",
    description: "Google's TPU architecture — 9 processing elements doing matrix multiplication in a wavefront pattern. Watch A*B compute one cycle at a time.",
    category: "cpu",
    nodes: "~120 nodes",
    dsl: `
const PE_Systolic = component('PE_Systolic')
  .in('dataIn', bus(8))
  .in('weightIn', bus(8))
  .in('partialSumIn', bus(16))
  .in('weightValid', bit)
  .out('dataOut', bus(8))
  .out('partialSumOut', bus(16))
  .node('weightReg', Register)
  .node('mult', Multiplier)
  .node('adder', Adder, { width: 16 })
  .node('psumReg', Register)
  .node('dataPipe', Register)
  .node('one', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .connect(({ in: inp, out, weightReg, mult, adder, psumReg, dataPipe, one, zero }) => [
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
  ])
  .build()

const Systolic3x3 = component('Systolic3x3')
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
  .node('pe00', PE_Systolic)
  .node('pe01', PE_Systolic)
  .node('pe02', PE_Systolic)
  .node('pe10', PE_Systolic)
  .node('pe11', PE_Systolic)
  .node('pe12', PE_Systolic)
  .node('pe20', PE_Systolic)
  .node('pe21', PE_Systolic)
  .node('pe22', PE_Systolic)
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('two', Constant, { value: 2 })
  .node('three', Constant, { value: 3 })
  .node('four', Constant, { value: 4 })
  .node('five', Constant, { value: 5 })
  .node('six', Constant, { value: 6 })
  .node('seven', Constant, { value: 7 })
  .node('eight', Constant, { value: 8 })
  .node('nine', Constant, { value: 9 })
  .node('counter', Register, { initial: 0 })
  .node('counterInc', Incrementer)
  .node('counterMux', Mux)
  .node('notDone', Comparator)
  .node('shouldAdvance', And)
  .node('isCycle0', Comparator)
  .node('isCycle1', Comparator)
  .node('isCycle2', Comparator)
  .node('isCycle3', Comparator)
  .node('isCycle4', Comparator)
  .node('isCycle5', Comparator)
  .node('isCycle6', Comparator)
  .node('isCycle7', Comparator)
  .node('isCycle8', Comparator)
  .node('loadWeights', And)
  .node('muxR0a', Mux)
  .node('muxR0b', Mux)
  .node('muxR0c', Mux)
  .node('muxR1a', Mux)
  .node('muxR1b', Mux)
  .node('muxR1c', Mux)
  .node('muxR2a', Mux)
  .node('muxR2b', Mux)
  .node('muxR2c', Mux)
  .node('result_c00', Register)
  .node('result_c10', Register)
  .node('result_c20', Register)
  .node('result_c01', Register)
  .node('result_c11', Register)
  .node('result_c21', Register)
  .node('result_c02', Register)
  .node('result_c12', Register)
  .node('result_c22', Register)
  .node('isDone', Comparator)
  .connect(({ in: inp, out, pe00, pe01, pe02, pe10, pe11, pe12, pe20, pe21, pe22, zero, one, two, three, four, five, six, seven, eight, nine, counter, counterInc, counterMux, notDone, shouldAdvance, isCycle0, isCycle1, isCycle2, isCycle3, isCycle4, isCycle5, isCycle6, isCycle7, isCycle8, loadWeights, muxR0a, muxR0b, muxR0c, muxR1a, muxR1b, muxR1c, muxR2a, muxR2b, muxR2c, result_c00, result_c10, result_c20, result_c01, result_c11, result_c21, result_c02, result_c12, result_c22, isDone }) => [
    counter.q.to(counterInc.in, notDone.a, counterMux.in0, isCycle0.a, isCycle1.a, isCycle2.a, isCycle3.a, isCycle4.a, isCycle5.a, isCycle6.a, isCycle7.a, isCycle8.a, isDone.a),
    nine.out.to(notDone.b, isDone.b),
    inp.start.to(shouldAdvance.a, loadWeights.b),
    notDone.lt.to(shouldAdvance.b),
    shouldAdvance.out.to(counterMux.sel),
    counterInc.out.to(counterMux.in1),
    counterMux.out.to(counter.data),
    one.out.to(counter.we, isCycle1.b),
    zero.out.to(isCycle0.b, muxR0a.in0, muxR1a.in0, muxR2a.in0, pe00.partialSumIn, pe01.partialSumIn, pe02.partialSumIn),
    two.out.to(isCycle2.b),
    three.out.to(isCycle3.b),
    four.out.to(isCycle4.b),
    five.out.to(isCycle5.b),
    six.out.to(isCycle6.b),
    seven.out.to(isCycle7.b),
    eight.out.to(isCycle8.b),
    isCycle0.eq.to(loadWeights.a),
    inp.b00.to(pe00.weightIn),
    inp.b01.to(pe01.weightIn),
    inp.b02.to(pe02.weightIn),
    inp.b10.to(pe10.weightIn),
    inp.b11.to(pe11.weightIn),
    inp.b12.to(pe12.weightIn),
    inp.b20.to(pe20.weightIn),
    inp.b21.to(pe21.weightIn),
    inp.b22.to(pe22.weightIn),
    loadWeights.out.to(pe00.weightValid, pe01.weightValid, pe02.weightValid, pe10.weightValid, pe11.weightValid, pe12.weightValid, pe20.weightValid, pe21.weightValid, pe22.weightValid),
    isCycle1.eq.to(muxR0a.sel),
    inp.a00.to(muxR0a.in1),
    isCycle2.eq.to(muxR0b.sel, muxR1a.sel),
    muxR0a.out.to(muxR0b.in0),
    inp.a10.to(muxR0b.in1),
    isCycle3.eq.to(muxR0c.sel, muxR1b.sel, muxR2a.sel),
    muxR0b.out.to(muxR0c.in0),
    inp.a20.to(muxR0c.in1),
    inp.a01.to(muxR1a.in1),
    muxR1a.out.to(muxR1b.in0),
    inp.a11.to(muxR1b.in1),
    isCycle4.eq.to(muxR1c.sel, muxR2b.sel, result_c00.we),
    muxR1b.out.to(muxR1c.in0),
    inp.a21.to(muxR1c.in1),
    inp.a02.to(muxR2a.in1),
    muxR2a.out.to(muxR2b.in0),
    inp.a12.to(muxR2b.in1),
    isCycle5.eq.to(muxR2c.sel, result_c10.we, result_c01.we),
    muxR2b.out.to(muxR2c.in0),
    inp.a22.to(muxR2c.in1),
    muxR0c.out.to(pe00.dataIn),
    pe00.dataOut.to(pe01.dataIn),
    pe01.dataOut.to(pe02.dataIn),
    muxR1c.out.to(pe10.dataIn),
    pe10.dataOut.to(pe11.dataIn),
    pe11.dataOut.to(pe12.dataIn),
    muxR2c.out.to(pe20.dataIn),
    pe20.dataOut.to(pe21.dataIn),
    pe21.dataOut.to(pe22.dataIn),
    pe00.partialSumOut.to(pe10.partialSumIn),
    pe01.partialSumOut.to(pe11.partialSumIn),
    pe02.partialSumOut.to(pe12.partialSumIn),
    pe10.partialSumOut.to(pe20.partialSumIn),
    pe11.partialSumOut.to(pe21.partialSumIn),
    pe12.partialSumOut.to(pe22.partialSumIn),
    pe20.partialSumOut.to(result_c00.data, result_c10.data, result_c20.data),
    isCycle6.eq.to(result_c20.we, result_c11.we, result_c02.we),
    pe21.partialSumOut.to(result_c01.data, result_c11.data, result_c21.data),
    isCycle7.eq.to(result_c21.we, result_c12.we),
    pe22.partialSumOut.to(result_c02.data, result_c12.data, result_c22.data),
    isCycle8.eq.to(result_c22.we),
    result_c00.q.to(out.c00),
    result_c01.q.to(out.c01),
    result_c02.q.to(out.c02),
    result_c10.q.to(out.c10),
    result_c11.q.to(out.c11),
    result_c12.q.to(out.c12),
    result_c20.q.to(out.c20),
    result_c21.q.to(out.c21),
    result_c22.q.to(out.c22),
    isDone.eq.to(out.done),
  ])
  .build()

const TestSystolic3x3 = component('TestSystolic3x3')
  .node('sys', Systolic3x3)
  .node('a00', Input, { value: 1 })
  .node('a01', Input, { value: 2 })
  .node('a02', Input, { value: 3 })
  .node('a10', Input, { value: 4 })
  .node('a11', Input, { value: 5 })
  .node('a12', Input, { value: 6 })
  .node('a20', Input, { value: 7 })
  .node('a21', Input, { value: 8 })
  .node('a22', Input, { value: 9 })
  .node('b00', Input, { value: 2 })
  .node('b01', Input, { value: 0 })
  .node('b02', Input, { value: 1 })
  .node('b10', Input, { value: 0 })
  .node('b11', Input, { value: 2 })
  .node('b12', Input, { value: 0 })
  .node('b20', Input, { value: 1 })
  .node('b21', Input, { value: 0 })
  .node('b22', Input, { value: 2 })
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
`,
  },
  {
    id: "fibonacci",
    title: "Fibonacci Generator",
    description: "Pure datapath — two registers and one adder produce the Fibonacci sequence every clock tick. No software, no ROM, no instructions.",
    category: "math",
    nodes: "~12 nodes",
    dsl: `
const Fibonacci = component('Fibonacci')
  .out('fib', bus(8))
  .node('reg_a', Register)
  .node('reg_b', Register)
  .node('adder', Adder)
  .node('one_bit', Constant, { value: 1 })
  .node('init', DFlipFlop)
  .connect(({ in: inp, out, reg_a, reg_b, adder, one_bit, init }) => [
    one_bit.out.to(init.d, reg_a.we, reg_b.we),
    init.q_bar.to(adder.carry_in),
    reg_a.q.to(adder.a),
    reg_b.q.to(adder.b, reg_a.data, out.fib),
    adder.sum.to(reg_b.data),
  ])
  .build()

const FibonacciDemo = component('FibonacciDemo')
  .node('fib', Fibonacci)
  .node('display', HexDisplay)
  .node('leds', Splitter8to8)
  .node('led0', Led)
  .node('led1', Led)
  .node('led2', Led)
  .node('led3', Led)
  .node('led4', Led)
  .node('led5', Led)
  .node('led6', Led)
  .node('led7', Led)
  .connect(({ in: inp, out, fib, display, leds, led0, led1, led2, led3, led4, led5, led6, led7 }) => [
    fib.fib.to(display.in, leds.in),
    leds.bit0.to(led0.in),
    leds.bit1.to(led1.in),
    leds.bit2.to(led2.in),
    leds.bit3.to(led3.in),
    leds.bit4.to(led4.in),
    leds.bit5.to(led5.in),
    leds.bit6.to(led6.in),
    leds.bit7.to(led7.in),
  ])
  .build()
`,
  },
  {
    id: "rule30",
    title: "Rule 30 Cellular Automaton",
    description: "Wolfram's famous Rule 30 — the simplest known source of cryptographic randomness. 8 cells in a ring, two gates per cell, chaos from one seed.",
    category: "math",
    nodes: "~40 nodes",
    dsl: `
const Rule30Cell = component('Rule30Cell')
  .in('left', bit)
  .in('center', bit)
  .in('right', bit)
  .out('next', bit)
  .node('or1', Or)
  .node('xor1', Xor)
  .connect(({ in: inp, out, or1, xor1 }) => [
    inp.center.to(or1.a),
    inp.right.to(or1.b),
    inp.left.to(xor1.a),
    or1.out.to(xor1.b),
    xor1.out.to(out.next),
  ])
  .build()

const Rule30 = component('Rule30')
  .node('c0', DFlipFlop)
  .node('c1', DFlipFlop)
  .node('c2', DFlipFlop)
  .node('c3', DFlipFlop)
  .node('c4', DFlipFlop)
  .node('c5', DFlipFlop)
  .node('c6', DFlipFlop)
  .node('c7', DFlipFlop)
  .node('r0', Rule30Cell)
  .node('r1', Rule30Cell)
  .node('r2', Rule30Cell)
  .node('r3', Rule30Cell)
  .node('r4', Rule30Cell)
  .node('r5', Rule30Cell)
  .node('r6', Rule30Cell)
  .node('r7', Rule30Cell)
  .node('one', Constant, { value: 1 })
  .node('init', DFlipFlop)
  .node('mux4', Mux)
  .node('led0', Led)
  .node('led1', Led)
  .node('led2', Led)
  .node('led3', Led)
  .node('led4', Led)
  .node('led5', Led)
  .node('led6', Led)
  .node('led7', Led)
  .node('combine', Combiner8to8)
  .node('display', HexDisplay)
  .connect(({ in: inp, out, c0, c1, c2, c3, c4, c5, c6, c7, r0, r1, r2, r3, r4, r5, r6, r7, one, init, mux4, led0, led1, led2, led3, led4, led5, led6, led7, combine, display }) => [
    one.out.to(init.d, mux4.in0),
    r4.next.to(mux4.in1),
    init.q.to(mux4.sel),
    mux4.out.to(c4.d),
    c7.q.to(r0.left, r6.right, r7.center, led7.in, combine.bit7),
    c0.q.to(r0.center, r1.left, r7.right, led0.in, combine.bit0),
    c1.q.to(r0.right, r1.center, r2.left, led1.in, combine.bit1),
    r0.next.to(c0.d),
    c2.q.to(r1.right, r2.center, r3.left, led2.in, combine.bit2),
    r1.next.to(c1.d),
    c3.q.to(r2.right, r3.center, r4.left, led3.in, combine.bit3),
    r2.next.to(c2.d),
    c4.q.to(r3.right, r4.center, r5.left, led4.in, combine.bit4),
    r3.next.to(c3.d),
    c5.q.to(r4.right, r5.center, r6.left, led5.in, combine.bit5),
    c6.q.to(r5.right, r6.center, r7.left, led6.in, combine.bit6),
    r5.next.to(c5.d),
    r6.next.to(c6.d),
    r7.next.to(c7.d),
    combine.out.to(display.in),
  ])
  .build()
`,
  },
  {
    id: "alu",
    title: "8-Bit ALU",
    description: "The heart of every CPU — 8 operations (ADD, SUB, AND, OR, XOR, NOT, SHL, SHR) selected by a 3-bit opcode, with zero/carry/negative flags.",
    category: "cpu",
    nodes: "~30 nodes",
    dsl: `
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
`,
  },
  {
    id: "half-adder",
    title: "Half Adder",
    description: "The simplest arithmetic circuit — XOR for sum, AND for carry. The building block of every adder in every CPU ever made.",
    category: "basics",
    nodes: "4 nodes",
    dsl: `
const HalfAdder = component('HalfAdder')
  .in('a', bit)
  .in('b', bit)
  .out('sum', bit)
  .out('carry', bit)
  .node('xor1', Xor)
  .node('and1', And)
  .connect(({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
  ])
  .build()

const HalfAdderDemo = component('HalfAdderDemo')
  .node('sw_a', Switch)
  .node('sw_b', Switch)
  .node('dut', HalfAdder)
  .node('led_sum', Led)
  .node('led_carry', Led)
  .connect(({ in: inp, out, sw_a, sw_b, dut, led_sum, led_carry }) => [
    sw_a.out.to(dut.a),
    sw_b.out.to(dut.b),
    dut.sum.to(led_sum.in),
    dut.carry.to(led_carry.in),
  ])
  .build()
`,
  },
];

export const CATEGORY_COLORS: Record<Example["category"], string> = {
  game: "text-green-400 border-green-800/50 bg-green-900/30",
  math: "text-amber-400 border-amber-800/50 bg-amber-900/30",
  cpu: "text-blue-400 border-blue-800/50 bg-blue-900/30",
  basics: "text-gray-400 border-gray-700/50 bg-gray-800/30",
};

export const CATEGORY_LABELS: Record<Example["category"], string> = {
  game: "Game",
  math: "Math",
  cpu: "CPU",
  basics: "Basics",
};
