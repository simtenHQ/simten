/**
 * Bundled example catalog — complete example circuits with titles,
 * descriptions, and source. Single source of truth shared by the web
 * editor's empty state and the MCP server. Data only: no imports, safe
 * to load without pulling in the stdlib.
 */

export interface Example {
  id: string;
  title: string;
  description: string;
  category: "game" | "math" | "cpu" | "basics";
  nodes: string;
  code: string;
}

export const EXAMPLES: Example[] = [
  {
    id: "snake",
    title: "Snake",
    description: "A playable Snake game in pure logic, no CPU. Press Play, then steer with the arrow keys. Drillable to the gates, and runs on a real FPGA.",
    category: "game",
    nodes: "5 nodes, drillable",
    code: `
// A complete 8x8 Snake game in pure logic - no CPU.
// Press Run, then steer with the arrow keys.
//
// Drillable like a textbook diagram: double-click SnakeCore to see the
// 4-phase pipeline, then any stage to see its gates. One game tick is
// 4 clock cycles:
//   p0: latch direction, draw a pending food (or latch the tail)
//   p1: clear the latched tail pixel
//   p2: push the new head into the circular body buffer
//   p3: draw the head, commit registers
//
// The RAM holds the framebuffer (addresses 0-63) and the snake's body
// as a circular buffer of pixel addresses (64+). This is the same
// SnakeCore that runs on a real ULX3S FPGA over HDMI.

// Free-running 2-bit phase counter, decoded to one-hot strobes.
const PhaseSequencer = circuit('Snake_PhaseSequencer', {
  outputs: { p0: bit, p1: bit, p2: bit, p3: bit },
  nodes: {
    phase: Register({ value: 0 }),
    phaseInc: Adder(), phaseWrap: BitSlice({ low: 0, high: 1 }),
    enable: Constant({ value: 1 }),
    zero: Constant({ value: 0 }), one: Constant({ value: 1 }),
    two: Constant({ value: 2 }), three: Constant({ value: 3 }),
    isPhase0: Comparator(), isPhase1: Comparator(),
    isPhase2: Comparator(), isPhase3: Comparator(),
  },
  connect: ({ outputs, nodes: { phase, phaseInc, phaseWrap, enable, zero, one, two, three, isPhase0, isPhase1, isPhase2, isPhase3 } }) => [
    phase.q.to(phaseInc.a, isPhase0.a, isPhase1.a, isPhase2.a, isPhase3.a),
    one.out.to(phaseInc.b, isPhase1.b),
    zero.out.to(isPhase0.b),
    two.out.to(isPhase2.b),
    three.out.to(isPhase3.b),
    phaseInc.sum.to(phaseWrap.in),
    phaseWrap.out.to(phase.data),
    enable.out.to(phase.we),
    isPhase0.eq.to(outputs.p0),
    isPhase1.eq.to(outputs.p1),
    isPhase2.eq.to(outputs.p2),
    isPhase3.eq.to(outputs.p3),
  ],
});

// Latches the direction at p0 and decodes it to X/Y deltas
// (255 = -1 in 8-bit two's complement).
const DirectionUnit = circuit('Snake_DirectionUnit', {
  inputs: { dir: bus(2), p0: bit },
  outputs: { dx: bus(8), dy: bus(8), moving: bit },
  nodes: {
    keyboardLatched: Register({ value: 1 }),
    en: Constant({ value: 1 }),
    latchKeyboard: And,
    zero: Constant({ value: 0 }), one: Constant({ value: 1 }),
    two: Constant({ value: 2 }), three: Constant({ value: 3 }),
    minus1: Constant({ value: 255 }),
    isUp: Comparator(), isDown: Comparator(), isLeft: Comparator(), isRight: Comparator(),
    // 8-bit muxes: without the width override, minus1 (255) would be
    // truncated to 1 bit on FPGA synthesis and left/up would mirror.
    deltaXTemp: Mux({ width: 8 }), deltaX: Mux({ width: 8 }),
    deltaYTemp: Mux({ width: 8 }), deltaY: Mux({ width: 8 }),
    deltaXIsZero: Comparator(), deltaYIsZero: Comparator(),
    bothDeltasZero: And, isMoving: Not,
  },
  connect: ({ inputs, outputs, nodes: { keyboardLatched, en, latchKeyboard, zero, one, two, three, minus1, isUp, isDown, isLeft, isRight, deltaXTemp, deltaX, deltaYTemp, deltaY, deltaXIsZero, deltaYIsZero, bothDeltasZero, isMoving } }) => [
    en.out.to(latchKeyboard.a),
    inputs.p0.to(latchKeyboard.b),
    latchKeyboard.out.to(keyboardLatched.we),
    inputs.dir.to(keyboardLatched.data),
    keyboardLatched.q.to(isUp.a, isDown.a, isLeft.a, isRight.a),
    zero.out.to(isUp.b, deltaXTemp.in0, deltaYTemp.in0, deltaXIsZero.b, deltaYIsZero.b),
    one.out.to(isRight.b, deltaX.in1, deltaY.in1),
    two.out.to(isDown.b),
    three.out.to(isLeft.b),
    minus1.out.to(deltaXTemp.in1, deltaYTemp.in1),
    isLeft.eq.to(deltaXTemp.sel),
    deltaXTemp.out.to(deltaX.in0),
    isRight.eq.to(deltaX.sel),
    isUp.eq.to(deltaYTemp.sel),
    deltaYTemp.out.to(deltaY.in0),
    isDown.eq.to(deltaY.sel),
    deltaX.out.to(outputs.dx, deltaXIsZero.a),
    deltaY.out.to(outputs.dy, deltaYIsZero.a),
    deltaXIsZero.eq.to(bothDeltasZero.a),
    deltaYIsZero.eq.to(bothDeltasZero.b),
    bothDeltasZero.out.to(isMoving.in),
    isMoving.out.to(outputs.moving),
  ],
});

// Next head position (wrapping at the walls) and its pixel address
// (y*8 + x via adder doublings). Commits at p3.
const HeadUnit = circuit('Snake_HeadUnit', {
  inputs: { dx: bus(8), dy: bus(8), p1: bit, p3: bit, moving: bit },
  outputs: { nh_addr: bus(8), nhx: bus(3), nhy: bus(3), commit: bit },
  nodes: {
    headX: Register({ value: 4 }), headY: Register({ value: 4 }),
    nextHeadPixelAddr: Register({ value: 36 }),
    en: Constant({ value: 1 }),
    nextHeadXCalc: Adder(), nextHeadYCalc: Adder(),
    nextHeadX: BitSlice({ low: 0, high: 2 }), nextHeadY: BitSlice({ low: 0, high: 2 }),
    nextHeadY2: Adder(), nextHeadY4: Adder(), nextHeadY8: Adder(),
    nextPixelAddr: Adder(),
    latchNextHead: And, updateHead: And, updateHeadFinal: And,
  },
  connect: ({ inputs, outputs, nodes: { headX, headY, nextHeadPixelAddr, en, nextHeadXCalc, nextHeadYCalc, nextHeadX, nextHeadY, nextHeadY2, nextHeadY4, nextHeadY8, nextPixelAddr, latchNextHead, updateHead, updateHeadFinal } }) => [
    headX.q.to(nextHeadXCalc.a),
    inputs.dx.to(nextHeadXCalc.b),
    headY.q.to(nextHeadYCalc.a),
    inputs.dy.to(nextHeadYCalc.b),
    nextHeadXCalc.sum.to(nextHeadX.in),
    nextHeadYCalc.sum.to(nextHeadY.in),
    nextHeadY.out.to(nextHeadY2.a, nextHeadY2.b, headY.data, outputs.nhy),
    nextHeadY2.sum.to(nextHeadY4.a, nextHeadY4.b),
    nextHeadY4.sum.to(nextHeadY8.a, nextHeadY8.b),
    nextHeadY8.sum.to(nextPixelAddr.a),
    nextHeadX.out.to(nextPixelAddr.b, headX.data, outputs.nhx),
    nextPixelAddr.sum.to(nextHeadPixelAddr.data),
    en.out.to(latchNextHead.a, updateHead.a),
    inputs.p1.to(latchNextHead.b),
    latchNextHead.out.to(nextHeadPixelAddr.we),
    inputs.p3.to(updateHead.b),
    updateHead.out.to(updateHeadFinal.a),
    inputs.moving.to(updateHeadFinal.b),
    updateHeadFinal.out.to(headX.we, headY.we, outputs.commit),
    nextHeadPixelAddr.q.to(outputs.nh_addr),
  ],
});

// Eat detection and the one-tick-delayed food draw. Eating respawns the
// food at (x+3, y+5) mod 8 and arms 'drawing' for the next tick's p0.
const FoodUnit = circuit('Snake_FoodUnit', {
  inputs: { nhx: bus(3), nhy: bus(3), p0: bit, p3: bit },
  outputs: { will_eat: bit, not_eating: bit, drawing: bit, not_drawing: bit, food_addr: bus(8) },
  nodes: {
    foodX: Register({ value: 6 }), foodY: Register({ value: 3 }),
    foodNeedsDrawing: Register({ value: 1 }),
    en: Constant({ value: 1 }),
    zero: Constant({ value: 0 }), one: Constant({ value: 1 }),
    three: Constant({ value: 3 }), five: Constant({ value: 5 }),
    foodY2: Adder(), foodY4: Adder(), foodY8: Adder(), foodPixelAddr: Adder(),
    nextHeadAtFoodX: Comparator(), nextHeadAtFoodY: Comparator(),
    willEatFood: And, notEatingFood: Not, notDrawingFood: Not,
    clearFoodFlag: And, clearFoodFlagFinal: And,
    ateFood: And, ateFoodFinal: And,
    foodFlagWriteEnable: Or, foodFlagData: Mux(),
    foodXNext: Adder(), foodXWrap: BitSlice({ low: 0, high: 2 }),
    foodYNext: Adder(), foodYWrap: BitSlice({ low: 0, high: 2 }),
  },
  connect: ({ inputs, outputs, nodes: { foodX, foodY, foodNeedsDrawing, en, zero, one, three, five, foodY2, foodY4, foodY8, foodPixelAddr, nextHeadAtFoodX, nextHeadAtFoodY, willEatFood, notEatingFood, notDrawingFood, clearFoodFlag, clearFoodFlagFinal, ateFood, ateFoodFinal, foodFlagWriteEnable, foodFlagData, foodXNext, foodXWrap, foodYNext, foodYWrap } }) => [
    foodY.q.to(foodY2.a, foodY2.b, nextHeadAtFoodY.b, foodYNext.a),
    foodY2.sum.to(foodY4.a, foodY4.b),
    foodY4.sum.to(foodY8.a, foodY8.b),
    foodY8.sum.to(foodPixelAddr.a),
    foodX.q.to(foodPixelAddr.b, nextHeadAtFoodX.b, foodXNext.a),
    foodPixelAddr.sum.to(outputs.food_addr),
    inputs.nhx.to(nextHeadAtFoodX.a),
    inputs.nhy.to(nextHeadAtFoodY.a),
    nextHeadAtFoodX.eq.to(willEatFood.a),
    nextHeadAtFoodY.eq.to(willEatFood.b),
    willEatFood.out.to(notEatingFood.in, ateFoodFinal.b, outputs.will_eat),
    notEatingFood.out.to(outputs.not_eating),
    en.out.to(clearFoodFlag.a, ateFood.a),
    inputs.p0.to(clearFoodFlag.b),
    inputs.p3.to(ateFood.b),
    foodNeedsDrawing.q.to(notDrawingFood.in, clearFoodFlagFinal.b, outputs.drawing),
    notDrawingFood.out.to(outputs.not_drawing),
    clearFoodFlag.out.to(clearFoodFlagFinal.a),
    ateFood.out.to(ateFoodFinal.a),
    ateFoodFinal.out.to(foodFlagWriteEnable.a, foodFlagData.sel, foodX.we, foodY.we),
    clearFoodFlagFinal.out.to(foodFlagWriteEnable.b),
    foodFlagWriteEnable.out.to(foodNeedsDrawing.we),
    zero.out.to(foodFlagData.in0),
    one.out.to(foodFlagData.in1),
    foodFlagData.out.to(foodNeedsDrawing.data),
    three.out.to(foodXNext.b),
    five.out.to(foodYNext.b),
    foodXNext.sum.to(foodXWrap.in),
    foodYNext.sum.to(foodYWrap.in),
    foodXWrap.out.to(foodX.data),
    foodYWrap.out.to(foodY.data),
  ],
});

// Circular body buffer pointers, snake length, and the tail-pixel latch.
// Eat ticks skip the tail clear (growth) and defer it one tick.
const TailUnit = circuit('Snake_TailUnit', {
  inputs: { p0: bit, p3: bit, moving: bit, not_eating: bit, not_drawing: bit, commit: bit, ram_out: bus(8) },
  outputs: { head_body_addr: bus(8), tail_body_addr: bus(8), tail_addr: bus(8), clear_tail: bit },
  nodes: {
    headPtr: Register({ value: 3 }), tailPtr: Register({ value: 0 }),
    snakeLen: Register({ value: 4 }), tailPixelAddr: Register({ value: 33 }),
    en: Constant({ value: 1 }),
    zero: Constant({ value: 0 }), one: Constant({ value: 1 }),
    bodyBase: Constant({ value: 64 }),
    headPtrNext: Adder(), headPtrNextWrap: BitSlice({ low: 0, high: 5 }),
    headBodyAddr: Adder(), tailBodyAddr: Adder(),
    headPtrInc: Adder(), headPtrWrap: BitSlice({ low: 0, high: 5 }),
    tailPtrInc: Adder(), tailPtrWrap: BitSlice({ low: 0, high: 5 }),
    snakeLenDelta: Mux(), snakeLenNew: Adder(),
    bufferEmpty: Comparator(), bufferNotEmpty: Not,
    shouldMoveTail: Constant({ value: 1 }), shouldMoveTailActual: And,
    shouldClearTail: And, shouldClearTailMoving: And,
    latchTail: And, latchTailFinal: And, latchTailNotFood: And,
    updateTail: And, updateTailFinal: And,
  },
  connect: ({ inputs, outputs, nodes: { headPtr, tailPtr, snakeLen, tailPixelAddr, en, zero, one, bodyBase, headPtrNext, headPtrNextWrap, headBodyAddr, tailBodyAddr, headPtrInc, headPtrWrap, tailPtrInc, tailPtrWrap, snakeLenDelta, snakeLenNew, bufferEmpty, bufferNotEmpty, shouldMoveTail, shouldMoveTailActual, shouldClearTail, shouldClearTailMoving, latchTail, latchTailFinal, latchTailNotFood, updateTail, updateTailFinal } }) => [
    headPtr.q.to(headPtrNext.a, headPtrInc.a),
    one.out.to(headPtrNext.b, headPtrInc.b, tailPtrInc.b, snakeLenDelta.in0),
    zero.out.to(bufferEmpty.b, snakeLenDelta.in1),
    headPtrNext.sum.to(headPtrNextWrap.in),
    headPtrNextWrap.out.to(headBodyAddr.a),
    bodyBase.out.to(headBodyAddr.b, tailBodyAddr.b),
    tailPtr.q.to(tailBodyAddr.a, tailPtrInc.a),
    headBodyAddr.sum.to(outputs.head_body_addr),
    tailBodyAddr.sum.to(outputs.tail_body_addr),
    snakeLen.q.to(bufferEmpty.a, snakeLenNew.a),
    bufferEmpty.eq.to(bufferNotEmpty.in),
    shouldMoveTail.out.to(shouldMoveTailActual.a),
    inputs.not_eating.to(shouldMoveTailActual.b),
    shouldMoveTailActual.out.to(shouldClearTail.a),
    inputs.moving.to(shouldClearTail.b),
    shouldClearTail.out.to(shouldClearTailMoving.a),
    bufferNotEmpty.out.to(shouldClearTailMoving.b, latchTailFinal.b),
    shouldClearTailMoving.out.to(updateTailFinal.b, snakeLenDelta.sel, outputs.clear_tail),
    en.out.to(latchTail.a, updateTail.a),
    inputs.p0.to(latchTail.b),
    latchTail.out.to(latchTailFinal.a),
    latchTailFinal.out.to(latchTailNotFood.a),
    inputs.not_drawing.to(latchTailNotFood.b),
    latchTailNotFood.out.to(tailPixelAddr.we),
    inputs.ram_out.to(tailPixelAddr.data),
    tailPixelAddr.q.to(outputs.tail_addr),
    inputs.p3.to(updateTail.b),
    updateTail.out.to(updateTailFinal.a),
    updateTailFinal.out.to(tailPtr.we),
    inputs.commit.to(headPtr.we, snakeLen.we),
    headPtrInc.sum.to(headPtrWrap.in),
    headPtrWrap.out.to(headPtr.data),
    tailPtrInc.sum.to(tailPtrWrap.in),
    tailPtrWrap.out.to(tailPtr.data),
    snakeLenDelta.out.to(snakeLenNew.b),
    snakeLenNew.sum.to(snakeLen.data),
  ],
});

// One RAM write port, four customers: mux chains pick the address and
// data for the current phase, the strobe ORs the write conditions.
const WriteArbiter = circuit('Snake_WriteArbiter', {
  inputs: {
    p0: bit, p1: bit, p2: bit, p3: bit,
    drawing: bit, clear_tail: bit, moving: bit,
    food_addr: bus(8), tail_body_addr: bus(8), tail_addr: bus(8),
    head_body_addr: bus(8), nh_addr: bus(8),
  },
  outputs: { ram_addr: bus(8), ram_data: bus(8), ram_we: bit },
  nodes: {
    zero: Constant({ value: 0 }), one: Constant({ value: 1 }),
    phase0Addr: Mux(), addrMux0: Mux(), addrMux1: Mux(), ramAddr: Mux(),
    dataMux0: Mux(), dataMux1: Mux(), ramData: Mux(),
    writePhase0: And, writePhase1: And, writePhase2: And, writePhase3: And,
    writePhase01: Or, writePhase2or3: Or, writeAny: Or,
    writeEnable: Constant({ value: 1 }), finalWriteEnable: And,
  },
  connect: ({ inputs, outputs, nodes: { zero, one, phase0Addr, addrMux0, addrMux1, ramAddr, dataMux0, dataMux1, ramData, writePhase0, writePhase1, writePhase2, writePhase3, writePhase01, writePhase2or3, writeAny, writeEnable, finalWriteEnable } }) => [
    inputs.tail_body_addr.to(phase0Addr.in0),
    inputs.food_addr.to(phase0Addr.in1),
    inputs.drawing.to(phase0Addr.sel, ramData.sel, writePhase0.b),
    phase0Addr.out.to(addrMux0.in0),
    inputs.tail_addr.to(addrMux0.in1),
    inputs.p1.to(addrMux0.sel, writePhase1.a),
    addrMux0.out.to(addrMux1.in0),
    inputs.head_body_addr.to(addrMux1.in1),
    inputs.p2.to(addrMux1.sel, dataMux0.sel, writePhase2.a),
    addrMux1.out.to(ramAddr.in0),
    inputs.nh_addr.to(ramAddr.in1, dataMux0.in1),
    inputs.p3.to(ramAddr.sel, dataMux1.sel, writePhase3.a),
    ramAddr.out.to(outputs.ram_addr),
    zero.out.to(dataMux0.in0),
    dataMux0.out.to(dataMux1.in0),
    one.out.to(dataMux1.in1, ramData.in1),
    dataMux1.out.to(ramData.in0),
    ramData.out.to(outputs.ram_data),
    inputs.p0.to(writePhase0.a),
    inputs.clear_tail.to(writePhase1.b),
    inputs.moving.to(writePhase2.b, writePhase3.b),
    writePhase0.out.to(writePhase01.a),
    writePhase1.out.to(writePhase01.b),
    writePhase2.out.to(writePhase2or3.a),
    writePhase3.out.to(writePhase2or3.b),
    writePhase01.out.to(writeAny.a),
    writePhase2or3.out.to(writeAny.b),
    writeEnable.out.to(finalWriteEnable.a),
    writeAny.out.to(finalWriteEnable.b),
    finalWriteEnable.out.to(outputs.ram_we),
  ],
});

// The complete game logic with the memory external - same shape as a CPU
// core. This exact circuit runs on a real FPGA.
const SnakeCore = circuit('SnakeCore', {
  inputs: { dir: bus(2), ram_out: bus(8) },
  outputs: { ram_addr: bus(8), ram_data: bus(8), ram_we: bit },
  nodes: {
    phaser: PhaseSequencer,
    dirs: DirectionUnit,
    head: HeadUnit,
    food: FoodUnit,
    tail: TailUnit,
    writer: WriteArbiter,
  },
  connect: ({ inputs, outputs, nodes: { phaser, dirs, head, food, tail, writer } }) => [
    inputs.dir.to(dirs.dir),
    inputs.ram_out.to(tail.ram_out),
    phaser.p0.to(dirs.p0, food.p0, tail.p0, writer.p0),
    phaser.p1.to(head.p1, writer.p1),
    phaser.p2.to(writer.p2),
    phaser.p3.to(head.p3, food.p3, tail.p3, writer.p3),
    dirs.dx.to(head.dx),
    dirs.dy.to(head.dy),
    dirs.moving.to(head.moving, tail.moving, writer.moving),
    head.nhx.to(food.nhx),
    head.nhy.to(food.nhy),
    head.nh_addr.to(writer.nh_addr),
    head.commit.to(tail.commit),
    food.not_eating.to(tail.not_eating),
    food.not_drawing.to(tail.not_drawing),
    food.drawing.to(writer.drawing),
    food.food_addr.to(writer.food_addr),
    tail.clear_tail.to(writer.clear_tail),
    tail.head_body_addr.to(writer.head_body_addr),
    tail.tail_body_addr.to(writer.tail_body_addr),
    tail.tail_addr.to(writer.tail_addr),
    writer.ram_addr.to(outputs.ram_addr),
    writer.ram_data.to(outputs.ram_data),
    writer.ram_we.to(outputs.ram_we),
  ],
});

// Editor-only: turns the keyboard's PC scan codes (arrow keys) into the
// core's 2-bit direction. Arrows apply immediately (no input lag); the
// register holds the last arrow across other keypresses.
const DirDecoder = circuit('Snake_DirDecoder', {
  inputs: { key: bus(8) },
  outputs: { dir: bus(2) },
  nodes: {
    upCode: Constant({ value: 72 }), rightCode: Constant({ value: 77 }),
    downCode: Constant({ value: 80 }), leftCode: Constant({ value: 75 }),
    isUp: Comparator(), isRight: Comparator(), isDown: Comparator(), isLeft: Comparator(),
    anyUpDown: Or, anyLeftRight: Or, anyArrow: Or,
    c0: Constant({ value: 0 }), c1: Constant({ value: 1 }),
    c2: Constant({ value: 2 }), c3: Constant({ value: 3 }),
    encLeft: Mux({ width: 2 }), encDown: Mux({ width: 2 }), encRight: Mux({ width: 2 }),
    dirNow: Mux({ width: 2 }),
    held: Register({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: { upCode, rightCode, downCode, leftCode, isUp, isRight, isDown, isLeft, anyUpDown, anyLeftRight, anyArrow, c0, c1, c2, c3, encLeft, encDown, encRight, dirNow, held } }) => [
    inputs.key.to(isUp.a, isRight.a, isDown.a, isLeft.a),
    upCode.out.to(isUp.b),
    rightCode.out.to(isRight.b),
    downCode.out.to(isDown.b),
    leftCode.out.to(isLeft.b),
    isUp.eq.to(anyUpDown.a),
    isDown.eq.to(anyUpDown.b),
    isLeft.eq.to(anyLeftRight.a),
    isRight.eq.to(anyLeftRight.b),
    anyUpDown.out.to(anyArrow.a),
    anyLeftRight.out.to(anyArrow.b),
    c0.out.to(encLeft.in0),
    c3.out.to(encLeft.in1),
    isLeft.eq.to(encLeft.sel),
    encLeft.out.to(encDown.in0),
    c2.out.to(encDown.in1),
    isDown.eq.to(encDown.sel),
    encDown.out.to(encRight.in0),
    c1.out.to(encRight.in1),
    isRight.eq.to(encRight.sel),
    encRight.out.to(held.data, dirNow.in1),
    anyArrow.out.to(held.we, dirNow.sel),
    held.q.to(dirNow.in0),
    dirNow.out.to(outputs.dir),
  ],
});

// Top level: keyboard -> decoder -> core <-> RAM -> screen.
// RAM init: pixels 33-36 are the starting snake (row y=4, x=1..4);
// body buffer entries 64-67 hold those pixel addresses.
const SnakePlayable = circuit('SnakePlayable', {
  nodes: {
    keyboard: Input(),
    decoder: DirDecoder,
    core: SnakeCore,
    ram: DualPortRAM({ memory: { '33': 1, '34': 1, '35': 1, '36': 1, '64': 33, '65': 34, '66': 35, '67': 36 } }),
    screen: Screen(),
  },
  connect: ({ nodes: { keyboard, decoder, core, ram, screen } }) => [
    keyboard.out.to(decoder.key),
    decoder.dir.to(core.dir),
    ram.outA.to(core.ram_out),
    core.ram_addr.to(ram.addrA),
    core.ram_data.to(ram.dataA),
    core.ram_we.to(ram.weA),
    screen.addrB.to(ram.addrB),
    ram.outB.to(screen.dataIn),
  ],
});
`,
  },
  {
    id: "rv32i-computer",
    title: "RV32I Computer",
    description: "A 5-stage pipelined RISC-V CPU running real C or Rust. Verified against Spike, runs on a ULX3S FPGA.",
    category: "cpu",
    nodes: "5 blocks, ~150 nodes inside",
    code: `
// The preloaded program — prints "HELLO FROM RISC-V" in a loop:
//   lui  a0, 0x80000          # a0 = UART (memory-mapped at 0x80000000)
//   loop:
//     addi a1, x0, '<char>'   # for each character of the message
//     sw   a1, 0(a0)          #   write it to the UART
//   addi a2, x0, 300          # then count down a delay...
//   delay:
//     addi a2, a2, -1
//     bne  a2, x0, delay
//   jal  x0, loop             # ...and print it again
const PROGRAM = [
  55, 5, 0, 128, 147, 5, 128, 4, 35, 32, 181, 0, 147, 5, 80, 4, 35, 32, 181, 0,
  147, 5, 192, 4, 35, 32, 181, 0, 147, 5, 192, 4, 35, 32, 181, 0, 147, 5, 240, 4,
  35, 32, 181, 0, 147, 5, 0, 2, 35, 32, 181, 0, 147, 5, 96, 4, 35, 32, 181, 0,
  147, 5, 32, 5, 35, 32, 181, 0, 147, 5, 240, 4, 35, 32, 181, 0, 147, 5, 208, 4,
  35, 32, 181, 0, 147, 5, 0, 2, 35, 32, 181, 0, 147, 5, 32, 5, 35, 32, 181, 0,
  147, 5, 144, 4, 35, 32, 181, 0, 147, 5, 48, 5, 35, 32, 181, 0, 147, 5, 48, 4,
  35, 32, 181, 0, 147, 5, 208, 2, 35, 32, 181, 0, 147, 5, 96, 5, 35, 32, 181, 0,
  147, 5, 208, 0, 35, 32, 181, 0, 147, 5, 160, 0, 35, 32, 181, 0, 19, 6, 192, 18,
  19, 6, 246, 255, 227, 30, 6, 254, 111, 240, 223, 245,
];

// The CPU: the canonical 5-stage pipelined RV32I core (the same one that runs
// on the FPGA), with its unused network ports tied off. Drill in to see the
// pipeline.
const CPU = circuit('CPU', {
  inputs: { instruction: bus(32), data_read: bus(32) },
  outputs: {
    instr_addr: bus(32), data_addr: bus(32), data_write: bus(32),
    data_mem_read: bit, data_mem_write: bit, data_funct3: bus(3), pc: bus(32),
  },
  nodes: {
    core: RV32I_Core(),
    zero32: Constant({ value: 0, width: 32 }),
    zero1: Constant({ value: 0, width: 1 }),
  },
  connect: ({ inputs, outputs, nodes: { core, zero32, zero1 } }) => [
    inputs.instruction.to(core.instruction),
    inputs.data_read.to(core.data_read),
    zero32.out.to(core.net_rx_data),
    zero1.out.to(core.net_rx_valid, core.net_rx_frame),
    core.instr_addr.to(outputs.instr_addr),
    core.data_addr.to(outputs.data_addr),
    core.data_write.to(outputs.data_write),
    core.data_mem_read.to(outputs.data_mem_read),
    core.data_mem_write.to(outputs.data_mem_write),
    core.data_funct3.to(outputs.data_funct3),
    core.pc_out.to(outputs.pc),
  ],
});

// The memory system: bus decode + RAM, plus the plumbing that lets the CPU
// read constants out of the program ROM and talk to the UART.
// Map: RAM at 0x00010000, UART at 0x80000000, program ROM (read-only) at 0x0.
const Memory = circuit('Memory', {
  inputs: {
    addr: bus(32), write_data: bus(32), mem_read: bit, mem_write: bit, funct3: bus(3),
    rom_data: bus(32), uart_read_data: bus(32),
  },
  outputs: {
    read_data: bus(32), rom_addr: bus(32),
    uart_addr: bus(32), uart_write_data: bus(32), uart_read: bit, uart_write: bit,
  },
  nodes: {
    bus_mux: MemBusMux,
    ram: RV32I_DataMem,
    zero32: Constant({ value: 0, width: 32 }),
  },
  connect: ({ inputs, outputs, nodes: { bus_mux, ram, zero32 } }) => [
    inputs.addr.to(bus_mux.addr),
    inputs.write_data.to(bus_mux.write_data),
    inputs.mem_read.to(bus_mux.mem_read),
    inputs.mem_write.to(bus_mux.mem_write),
    inputs.funct3.to(bus_mux.funct3),
    bus_mux.local_addr.to(ram.addr, outputs.rom_addr, outputs.uart_addr),
    bus_mux.write_data_out.to(ram.write_data, outputs.uart_write_data),
    bus_mux.p0_read.to(ram.mem_read),
    bus_mux.p0_write.to(ram.mem_write),
    bus_mux.funct3_out.to(ram.funct3),
    ram.read_data.to(bus_mux.read_data_0),
    bus_mux.p1_read.to(outputs.uart_read),
    bus_mux.p1_write.to(outputs.uart_write),
    inputs.uart_read_data.to(bus_mux.read_data_1),
    inputs.rom_data.to(bus_mux.read_data_4),
    zero32.out.to(bus_mux.read_data_2, bus_mux.read_data_3),
    bus_mux.read_data.to(outputs.read_data),
  ],
});

// The computer: program → CPU → memory → console.
const RV32I_Computer = circuit('RV32I_Computer', {
  nodes: {
    program: DualPortROM({ memory: PROGRAM }),
    cpu: CPU,
    memory: Memory,
    console: UART_TX,
    pc_display: HexDisplay,
  },
  connect: ({ nodes: { program, cpu, memory, console: con, pc_display } }) => [
    // instruction fetch
    cpu.instr_addr.to(program.addrA),
    program.dataA.to(cpu.instruction),
    // data bus
    cpu.data_addr.to(memory.addr),
    cpu.data_write.to(memory.write_data),
    cpu.data_mem_read.to(memory.mem_read),
    cpu.data_mem_write.to(memory.mem_write),
    cpu.data_funct3.to(memory.funct3),
    memory.read_data.to(cpu.data_read),
    // data-side reads of the program ROM (constants, strings)
    memory.rom_addr.to(program.addrB),
    program.dataB.to(memory.rom_data),
    // UART console
    memory.uart_addr.to(con.addr),
    memory.uart_write_data.to(con.write_data),
    memory.uart_read.to(con.mem_read),
    memory.uart_write.to(con.mem_write),
    con.read_data.to(memory.uart_read_data),
    // program counter readout
    cpu.pc.to(pc_display.in),
  ],
});
`,
  },
  {
    id: "figlet",
    title: "npm → ROM",
    description: "Runs the figlet npm package at build time to bake ASCII art into a ROM, then streams it to a console.",
    category: "basics",
    nodes: "npm → ROM → console",
    code: `import figlet from 'figlet';
import smallFont from 'figlet/fonts/Small.js';
figlet.parseFont('Small', smallFont);

// Render ASCII-art at compile time with a real npm package,
// then stream the bytes through hardware — letter by letter.
const banner = figlet.textSync('Simten', { font: 'Small' });
const ascii = [...banner].map(c => c.charCodeAt(0));
const bannerBytes = Array.from({ length: 256 }, (_, i) =>
  i === 0 ? 12 : i <= ascii.length ? ascii[i - 1] : 0
);

const FigletStream = circuit('FigletStream', {
  outputs: { byte: bus(8), strobe: bit },
  nodes: {
    reg: Register({ width: 8 }),
    adder: Adder({ width: 8 }),
    rom: ROM({ memory: romFromBytes(bannerBytes) }),
    one: Constant({ value: 1 }),
    we: Constant({ value: 1 }),
    zero: Constant({ value: 0 }),
  },
  connect: ({ outputs, nodes: { reg, adder, rom, one, we, zero } }) => [
    reg.q.to(adder.a),
    one.out.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(reg.data),
    we.out.to(reg.we),
    reg.q.to(rom.addr),
    rom.data_out.to(outputs.byte),
    we.out.to(outputs.strobe),
  ],
});

const FigletDemo = circuit('FigletDemo', {
  nodes: { src: FigletStream, term: Console },
  connect: ({ nodes: { src, term } }) => [
    src.byte.to(term.data),
    src.strobe.to(term.we),
  ],
});`,
  },
  {
    id: "tpu-3x3",
    title: "3x3 Systolic Array (TPU)",
    description: "Google's TPU architecture: 9 processing elements multiplying a matrix in a wavefront, one cycle at a time.",
    category: "cpu",
    nodes: "~120 nodes",
    code: `
const PE_Systolic = circuit('PE_Systolic', {
  inputs: { dataIn: bus(8), weightIn: bus(8), partialSumIn: bus(16), weightValid: bit },
  outputs: { dataOut: bus(8), partialSumOut: bus(16) },
  nodes: { weightReg: Register(), mult: Multiplier, adder: Adder({ width: 16 }), psumReg: Register(), dataPipe: Register(), one: Constant({ value: 1 }), zero: Constant({ value: 0 }) },
  connect: ({ inputs, outputs, nodes: { weightReg, mult, adder, psumReg, dataPipe, one, zero } }) => [
    inputs.weightIn.to(weightReg.data),
    inputs.weightValid.to(weightReg.we),
    inputs.dataIn.to(mult.a, dataPipe.data),
    weightReg.q.to(mult.b),
    inputs.partialSumIn.to(adder.a),
    mult.product.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(psumReg.data),
    one.out.to(psumReg.we, dataPipe.we),
    psumReg.q.to(outputs.partialSumOut),
    dataPipe.q.to(outputs.dataOut),
  ],
})

const Systolic3x3 = circuit('Systolic3x3', {
  inputs: { a00: bus(8), a01: bus(8), a02: bus(8), a10: bus(8), a11: bus(8), a12: bus(8), a20: bus(8), a21: bus(8), a22: bus(8), b00: bus(8), b01: bus(8), b02: bus(8), b10: bus(8), b11: bus(8), b12: bus(8), b20: bus(8), b21: bus(8), b22: bus(8), start: bit },
  outputs: { c00: bus(16), c01: bus(16), c02: bus(16), c10: bus(16), c11: bus(16), c12: bus(16), c20: bus(16), c21: bus(16), c22: bus(16), done: bit },
  nodes: { pe00: PE_Systolic, pe01: PE_Systolic, pe02: PE_Systolic, pe10: PE_Systolic, pe11: PE_Systolic, pe12: PE_Systolic, pe20: PE_Systolic, pe21: PE_Systolic, pe22: PE_Systolic, zero: Constant({ value: 0 }), one: Constant({ value: 1 }), two: Constant({ value: 2 }), three: Constant({ value: 3 }), four: Constant({ value: 4 }), five: Constant({ value: 5 }), six: Constant({ value: 6 }), seven: Constant({ value: 7 }), eight: Constant({ value: 8 }), nine: Constant({ value: 9 }), counter: Register({ value: 0 }), counterInc: Incrementer, counterMux: Mux(), notDone: Comparator(), shouldAdvance: And, isCycle0: Comparator(), isCycle1: Comparator(), isCycle2: Comparator(), isCycle3: Comparator(), isCycle4: Comparator(), isCycle5: Comparator(), isCycle6: Comparator(), isCycle7: Comparator(), isCycle8: Comparator(), loadWeights: And, muxR0a: Mux(), muxR0b: Mux(), muxR0c: Mux(), muxR1a: Mux(), muxR1b: Mux(), muxR1c: Mux(), muxR2a: Mux(), muxR2b: Mux(), muxR2c: Mux(), result_c00: Register(), result_c10: Register(), result_c20: Register(), result_c01: Register(), result_c11: Register(), result_c21: Register(), result_c02: Register(), result_c12: Register(), result_c22: Register(), isDone: Comparator() },
  connect: ({ inputs, outputs, nodes: { pe00, pe01, pe02, pe10, pe11, pe12, pe20, pe21, pe22, zero, one, two, three, four, five, six, seven, eight, nine, counter, counterInc, counterMux, notDone, shouldAdvance, isCycle0, isCycle1, isCycle2, isCycle3, isCycle4, isCycle5, isCycle6, isCycle7, isCycle8, loadWeights, muxR0a, muxR0b, muxR0c, muxR1a, muxR1b, muxR1c, muxR2a, muxR2b, muxR2c, result_c00, result_c10, result_c20, result_c01, result_c11, result_c21, result_c02, result_c12, result_c22, isDone } }) => [
    counter.q.to(counterInc.in, notDone.a, counterMux.in0, isCycle0.a, isCycle1.a, isCycle2.a, isCycle3.a, isCycle4.a, isCycle5.a, isCycle6.a, isCycle7.a, isCycle8.a, isDone.a),
    nine.out.to(notDone.b, isDone.b),
    inputs.start.to(shouldAdvance.a, loadWeights.b),
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
    inputs.b00.to(pe00.weightIn),
    inputs.b01.to(pe01.weightIn),
    inputs.b02.to(pe02.weightIn),
    inputs.b10.to(pe10.weightIn),
    inputs.b11.to(pe11.weightIn),
    inputs.b12.to(pe12.weightIn),
    inputs.b20.to(pe20.weightIn),
    inputs.b21.to(pe21.weightIn),
    inputs.b22.to(pe22.weightIn),
    loadWeights.out.to(pe00.weightValid, pe01.weightValid, pe02.weightValid, pe10.weightValid, pe11.weightValid, pe12.weightValid, pe20.weightValid, pe21.weightValid, pe22.weightValid),
    isCycle1.eq.to(muxR0a.sel),
    inputs.a00.to(muxR0a.in1),
    isCycle2.eq.to(muxR0b.sel, muxR1a.sel),
    muxR0a.out.to(muxR0b.in0),
    inputs.a10.to(muxR0b.in1),
    isCycle3.eq.to(muxR0c.sel, muxR1b.sel, muxR2a.sel),
    muxR0b.out.to(muxR0c.in0),
    inputs.a20.to(muxR0c.in1),
    inputs.a01.to(muxR1a.in1),
    muxR1a.out.to(muxR1b.in0),
    inputs.a11.to(muxR1b.in1),
    isCycle4.eq.to(muxR1c.sel, muxR2b.sel, result_c00.we),
    muxR1b.out.to(muxR1c.in0),
    inputs.a21.to(muxR1c.in1),
    inputs.a02.to(muxR2a.in1),
    muxR2a.out.to(muxR2b.in0),
    inputs.a12.to(muxR2b.in1),
    isCycle5.eq.to(muxR2c.sel, result_c10.we, result_c01.we),
    muxR2b.out.to(muxR2c.in0),
    inputs.a22.to(muxR2c.in1),
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
    result_c00.q.to(outputs.c00),
    result_c01.q.to(outputs.c01),
    result_c02.q.to(outputs.c02),
    result_c10.q.to(outputs.c10),
    result_c11.q.to(outputs.c11),
    result_c12.q.to(outputs.c12),
    result_c20.q.to(outputs.c20),
    result_c21.q.to(outputs.c21),
    result_c22.q.to(outputs.c22),
    isDone.eq.to(outputs.done),
  ],
})

const TestSystolic3x3 = circuit('TestSystolic3x3', {
  nodes: { sys: Systolic3x3, a00: Input({ value: 1 }), a01: Input({ value: 2 }), a02: Input({ value: 3 }), a10: Input({ value: 4 }), a11: Input({ value: 5 }), a12: Input({ value: 6 }), a20: Input({ value: 7 }), a21: Input({ value: 8 }), a22: Input({ value: 9 }), b00: Input({ value: 2 }), b01: Input({ value: 0 }), b02: Input({ value: 1 }), b10: Input({ value: 0 }), b11: Input({ value: 2 }), b12: Input({ value: 0 }), b20: Input({ value: 1 }), b21: Input({ value: 0 }), b22: Input({ value: 2 }), start: Switch(), display_c00: HexDisplay, display_c01: HexDisplay, display_c02: HexDisplay, display_c10: HexDisplay, display_c11: HexDisplay, display_c12: HexDisplay, display_c20: HexDisplay, display_c21: HexDisplay, display_c22: HexDisplay, done_led: Led },
  connect: ({ inputs, outputs, nodes: { sys, a00, a01, a02, a10, a11, a12, a20, a21, a22, b00, b01, b02, b10, b11, b12, b20, b21, b22, start, display_c00, display_c01, display_c02, display_c10, display_c11, display_c12, display_c20, display_c21, display_c22, done_led } }) => [
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
  ],
})
`,
  },
  {
    id: "fibonacci",
    title: "Fibonacci Generator",
    description: "Two registers and an adder produce the Fibonacci sequence every clock tick. No software, no instructions.",
    category: "math",
    nodes: "~12 nodes",
    code: `
const Fibonacci = circuit('Fibonacci', {
  outputs: { fib: bus(8) },
  nodes: { reg_a: Register(), reg_b: Register(), adder: Adder(), one_bit: Constant({ value: 1 }), init: DFlipFlop() },
  connect: ({ inputs, outputs, nodes: { reg_a, reg_b, adder, one_bit, init } }) => [
    one_bit.out.to(init.d, reg_a.we, reg_b.we),
    init.q_bar.to(adder.carry_in),
    reg_a.q.to(adder.a),
    reg_b.q.to(adder.b, reg_a.data, outputs.fib),
    adder.sum.to(reg_b.data),
  ],
})

const FibonacciDemo = circuit('FibonacciDemo', {
  nodes: { fib: Fibonacci, display: HexDisplay, leds: Splitter8to8, led0: Led, led1: Led, led2: Led, led3: Led, led4: Led, led5: Led, led6: Led, led7: Led },
  connect: ({ inputs, outputs, nodes: { fib, display, leds, led0, led1, led2, led3, led4, led5, led6, led7 } }) => [
    fib.fib.to(display.in, leds.in),
    leds.bit0.to(led0.in),
    leds.bit1.to(led1.in),
    leds.bit2.to(led2.in),
    leds.bit3.to(led3.in),
    leds.bit4.to(led4.in),
    leds.bit5.to(led5.in),
    leds.bit6.to(led6.in),
    leds.bit7.to(led7.in),
  ],
})
`,
  },
  {
    id: "rule30",
    title: "Rule 30 Cellular Automaton",
    description: "Wolfram's Rule 30 cellular automaton: 8 cells, two gates each, chaos from a single seed.",
    category: "math",
    nodes: "~40 nodes",
    code: `
const Rule30Cell = circuit('Rule30Cell', {
  inputs: { left: bit, center: bit, right: bit },
  outputs: { next: bit },
  nodes: { or1: Or, xor1: Xor },
  connect: ({ inputs, outputs, nodes: { or1, xor1 } }) => [
    inputs.center.to(or1.a),
    inputs.right.to(or1.b),
    inputs.left.to(xor1.a),
    or1.out.to(xor1.b),
    xor1.out.to(outputs.next),
  ],
})

const Rule30 = circuit('Rule30', {
  nodes: { c0: DFlipFlop(), c1: DFlipFlop(), c2: DFlipFlop(), c3: DFlipFlop(), c4: DFlipFlop(), c5: DFlipFlop(), c6: DFlipFlop(), c7: DFlipFlop(), r0: Rule30Cell, r1: Rule30Cell, r2: Rule30Cell, r3: Rule30Cell, r4: Rule30Cell, r5: Rule30Cell, r6: Rule30Cell, r7: Rule30Cell, one: Constant({ value: 1 }), init: DFlipFlop(), mux4: Mux(), led0: Led, led1: Led, led2: Led, led3: Led, led4: Led, led5: Led, led6: Led, led7: Led, combine: Combiner8to8, display: HexDisplay },
  connect: ({ inputs, outputs, nodes: { c0, c1, c2, c3, c4, c5, c6, c7, r0, r1, r2, r3, r4, r5, r6, r7, one, init, mux4, led0, led1, led2, led3, led4, led5, led6, led7, combine, display } }) => [
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
  ],
})
`,
  },
  {
    id: "alu",
    title: "8-Bit ALU",
    description: "Eight operations on a 3-bit opcode (ADD, SUB, AND, OR, XOR, NOT, SHL, SHR), with zero, carry, and negative flags.",
    category: "cpu",
    nodes: "~30 nodes",
    code: `
const ALU = circuit('ALU', {
  inputs: { a: bus(8), b: bus(8), op0: bit, op1: bit, op2: bit },
  outputs: { result: bus(8), zero: bit, carry: bit, negative: bit },
  nodes: { gnd: Constant({ value: 0 }), add: Adder(), sub: Subtractor(), band: BusAnd(), bor: BusOr(), bxor: BusXor(), bnot: BusNot, shl: LeftShifter(), shr: RightShifter(), m01: Mux({ width: 8 }), m23: Mux({ width: 8 }), m45: Mux({ width: 8 }), m67: Mux({ width: 8 }), m03: Mux({ width: 8 }), m47: Mux({ width: 8 }), mfinal: Mux({ width: 8 }), split_r: Splitter8to8, or01: Or, or23: Or, or45: Or, or67: Or, or_lo: Or, or_hi: Or, or_all: Or, inv_z: Not },
  connect: ({ inputs, outputs, nodes: { gnd, add, sub, band, bor, bxor, bnot, shl, shr, m01, m23, m45, m67, m03, m47, mfinal, split_r, or01, or23, or45, or67, or_lo, or_hi, or_all, inv_z } }) => [
    inputs.a.to(add.a, sub.a, band.a, bor.a, bxor.a, bnot.in, shl.value, shr.value),
    inputs.b.to(add.b, sub.b, band.b, bor.b, bxor.b, shl.shift, shr.shift),
    gnd.out.to(add.carry_in, sub.borrow_in),
    add.sum.to(m01.in0),
    sub.difference.to(m01.in1),
    inputs.op0.to(m01.sel, m23.sel, m45.sel, m67.sel),
    band.out.to(m23.in0),
    bor.out.to(m23.in1),
    bxor.out.to(m45.in0),
    bnot.out.to(m45.in1),
    shl.result.to(m67.in0),
    shr.result.to(m67.in1),
    m01.out.to(m03.in0),
    m23.out.to(m03.in1),
    inputs.op1.to(m03.sel, m47.sel),
    m45.out.to(m47.in0),
    m67.out.to(m47.in1),
    m03.out.to(mfinal.in0),
    m47.out.to(mfinal.in1),
    inputs.op2.to(mfinal.sel),
    mfinal.out.to(outputs.result, split_r.in),
    add.carry_out.to(outputs.carry),
    split_r.bit7.to(outputs.negative, or67.b),
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
    inv_z.out.to(outputs.zero),
  ],
})

const ALUDemo = circuit('ALUDemo', {
  nodes: { a: Input({ value: 42 }), b: Input({ value: 13 }), op0: Switch(), op1: Switch(), op2: Switch(), alu: ALU, disp_a: HexDisplay, disp_b: HexDisplay, disp_result: HexDisplay, led_zero: Led, led_carry: Led, led_neg: Led },
  connect: ({ inputs, outputs, nodes: { a, b, op0, op1, op2, alu, disp_a, disp_b, disp_result, led_zero, led_carry, led_neg } }) => [
    a.out.to(alu.a, disp_a.in),
    b.out.to(alu.b, disp_b.in),
    op0.out.to(alu.op0),
    op1.out.to(alu.op1),
    op2.out.to(alu.op2),
    alu.result.to(disp_result.in),
    alu.zero.to(led_zero.in),
    alu.carry.to(led_carry.in),
    alu.negative.to(led_neg.in),
  ],
})
`,
  },
  {
    id: "half-adder",
    title: "Half Adder",
    description: "The simplest arithmetic circuit: XOR for sum, AND for carry. The building block of every adder.",
    category: "basics",
    nodes: "4 nodes",
    code: `
const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
    inputs.a.to(xor1.a, and1.a),
    inputs.b.to(xor1.b, and1.b),
    xor1.out.to(outputs.sum),
    and1.out.to(outputs.carry),
  ],
})

const HalfAdderDemo = circuit('HalfAdderDemo', {
  nodes: { sw_a: Switch(), sw_b: Switch(), dut: HalfAdder, led_sum: Led, led_carry: Led },
  connect: ({ inputs, outputs, nodes: { sw_a, sw_b, dut, led_sum, led_carry } }) => [
    sw_a.out.to(dut.a),
    sw_b.out.to(dut.b),
    dut.sum.to(led_sum.in),
    dut.carry.to(led_carry.in),
  ],
})
`,
  },
];
