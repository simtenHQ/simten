/**
 * Circuit definitions for the "Snake in Hardware" blog post.
 *
 * Each circuit builds toward the final Snake game, from framebuffers
 * and address computation to direction decoding, movement, phased
 * operations, collision detection, and the full SnakeAdvanced circuit.
 */

export interface BlogCircuit {
  name: string;
  description: string;
  displayDsl: string;
  dsl: string;
  nodePositions?: Record<string, { x: number; y: number }>;
}

export const SNAKE_CIRCUITS: Record<string, BlogCircuit> = {
  simpleFramebuffer: {
    name: "Simple Framebuffer",
    description:
      "DualPortRAM as a screen framebuffer. Port A reads/writes data, port B is used by the Screen to display pixels.",
    displayDsl: `
const SimpleFramebuffer = component('SimpleFramebuffer')
  .node('ram', DualPortRAM, { init: {"0":1,"1":1,"2":1,"3":1,"4":1,"5":1,"6":1,"7":1,"9":1,"14":1,"17":1,"22":1,"25":1,"30":1,"33":1,"38":1,"41":1,"46":1,"49":1,"54":1,"56":1,"57":1,"58":1,"59":1,"60":1,"61":1,"62":1,"63":1} })
  .node('screen', Screen)
  .node('addr', Input)
  .node('data_in', Input)
  .node('we', Switch)
  .node('readback', HexDisplay)
  .connect(({ in: inp, out, ram, screen, addr, data_in, we, readback }) => [
    screen.addrB.to(ram.addrB),
    ram.outB.to(screen.dataIn),
    addr.out.to(ram.addrA),
    data_in.out.to(ram.dataA),
    we.out.to(ram.weA),
    ram.outA.to(readback.in),
  ])
  .build()
`,
    dsl: `
const SimpleFramebuffer = component('SimpleFramebuffer')
  .node('ram', DualPortRAM, { init: {"0":1,"1":1,"2":1,"3":1,"4":1,"5":1,"6":1,"7":1,"9":1,"14":1,"17":1,"22":1,"25":1,"30":1,"33":1,"38":1,"41":1,"46":1,"49":1,"54":1,"56":1,"57":1,"58":1,"59":1,"60":1,"61":1,"62":1,"63":1} })
  .node('screen', Screen)
  .node('addr', Input)
  .node('data_in', Input)
  .node('we', Switch)
  .node('readback', HexDisplay)
  .connect(({ in: inp, out, ram, screen, addr, data_in, we, readback }) => [
    screen.addrB.to(ram.addrB),
    ram.outB.to(screen.dataIn),
    addr.out.to(ram.addrA),
    data_in.out.to(ram.dataA),
    we.out.to(ram.weA),
    ram.outA.to(readback.in),
  ])
  .build()
`,
    nodePositions: {
      // Inputs (left)
      addr:     { x: 0,   y: 0 },
      data_in:  { x: 0,   y: 120 },
      we:       { x: 0,   y: 240 },
      // RAM + Screen (center)
      ram:      { x: 250, y: 60 },
      screen:   { x: 500, y: 0 },
      // Output (right)
      readback: { x: 500, y: 180 },
    },
  },

  coordToPixel: {
    name: "Coordinate to Pixel Address",
    description:
      "Converts (X, Y) coordinates to a linear pixel address using (Y << 3) + X. A left shift by 3 is just wiring in real hardware — zero gates.",
    displayDsl: `
const CoordToPixel = component('CoordToPixel')
  .node('x', Input, { value: 3 })
  .node('y', Input, { value: 2 })
  .node('three', Input, { value: 3 })
  .node('y8', LeftShifter)
  .node('addr', Adder)
  .node('result', HexDisplay)
  .connect(({ in: inp, out, x, y, three, y8, addr, result }) => [
    y.out.to(y8.value),
    three.out.to(y8.shift),
    y8.result.to(addr.a),
    x.out.to(addr.b),
    addr.sum.to(result.in),
  ])
  .build()
`,
    dsl: `
const CoordToPixel = component('CoordToPixel')
  .node('x', Input, { value: 3 })
  .node('y', Input, { value: 2 })
  .node('three', Input, { value: 3 })
  .node('y8', LeftShifter)
  .node('addr', Adder)
  .node('result', HexDisplay)
  .connect(({ in: inp, out, x, y, three, y8, addr, result }) => [
    y.out.to(y8.value),
    three.out.to(y8.shift),
    y8.result.to(addr.a),
    x.out.to(addr.b),
    addr.sum.to(result.in),
  ])
  .build()
`,
    nodePositions: {
      x:      { x: 0,   y: 0 },
      y:      { x: 0,   y: 120 },
      three:  { x: 0,   y: 240 },
      y8:     { x: 200, y: 120 },
      addr:   { x: 400, y: 60 },
      result: { x: 600, y: 60 },
    },
  },

  directionDecoder: {
    name: "Direction Decoder",
    description:
      "Decodes keyboard scan codes into deltaX/deltaY movement values using Comparators and a Mux tree.",
    displayDsl: `
const DirectionDecoder = component('DirectionDecoder')
  .node('keyCode', Input, { value: 77 })
  .node('upCode', Constant, { value: 72 })
  .node('downCode', Constant, { value: 80 })
  .node('leftCode', Constant, { value: 75 })
  .node('rightCode', Constant, { value: 77 })
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('minus1', Constant, { value: 255 })
  .node('isUp', Comparator)
  .node('isDown', Comparator)
  .node('isLeft', Comparator)
  .node('isRight', Comparator)
  .node('deltaXTemp', Mux)
  .node('deltaX', Mux)
  .node('deltaYTemp', Mux)
  .node('deltaY', Mux)
  .node('displayDX', HexDisplay)
  .node('displayDY', HexDisplay)
  .connect(({ in: inp, out, keyCode, upCode, downCode, leftCode, rightCode, zero, one, minus1, isUp, isDown, isLeft, isRight, deltaXTemp, deltaX, deltaYTemp, deltaY, displayDX, displayDY }) => [
    keyCode.out.to(isUp.a, isDown.a, isLeft.a, isRight.a),
    upCode.out.to(isUp.b),
    downCode.out.to(isDown.b),
    leftCode.out.to(isLeft.b),
    rightCode.out.to(isRight.b),
    zero.out.to(deltaXTemp.in0, deltaYTemp.in0),
    minus1.out.to(deltaXTemp.in1, deltaYTemp.in1),
    isLeft.eq.to(deltaXTemp.sel),
    deltaXTemp.out.to(deltaX.in0),
    one.out.to(deltaX.in1, deltaY.in1),
    isRight.eq.to(deltaX.sel),
    isUp.eq.to(deltaYTemp.sel),
    deltaYTemp.out.to(deltaY.in0),
    isDown.eq.to(deltaY.sel),
    deltaX.out.to(displayDX.in),
    deltaY.out.to(displayDY.in),
  ])
  .build()
`,
    dsl: `
const DirectionDecoder = component('DirectionDecoder')
  .node('keyCode', Input, { value: 77 })
  .node('upCode', Constant, { value: 72 })
  .node('downCode', Constant, { value: 80 })
  .node('leftCode', Constant, { value: 75 })
  .node('rightCode', Constant, { value: 77 })
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('minus1', Constant, { value: 255 })
  .node('isUp', Comparator)
  .node('isDown', Comparator)
  .node('isLeft', Comparator)
  .node('isRight', Comparator)
  .node('deltaXTemp', Mux)
  .node('deltaX', Mux)
  .node('deltaYTemp', Mux)
  .node('deltaY', Mux)
  .node('displayDX', HexDisplay)
  .node('displayDY', HexDisplay)
  .connect(({ in: inp, out, keyCode, upCode, downCode, leftCode, rightCode, zero, one, minus1, isUp, isDown, isLeft, isRight, deltaXTemp, deltaX, deltaYTemp, deltaY, displayDX, displayDY }) => [
    keyCode.out.to(isUp.a, isDown.a, isLeft.a, isRight.a),
    upCode.out.to(isUp.b),
    downCode.out.to(isDown.b),
    leftCode.out.to(isLeft.b),
    rightCode.out.to(isRight.b),
    zero.out.to(deltaXTemp.in0, deltaYTemp.in0),
    minus1.out.to(deltaXTemp.in1, deltaYTemp.in1),
    isLeft.eq.to(deltaXTemp.sel),
    deltaXTemp.out.to(deltaX.in0),
    one.out.to(deltaX.in1, deltaY.in1),
    isRight.eq.to(deltaX.sel),
    isUp.eq.to(deltaYTemp.sel),
    deltaYTemp.out.to(deltaY.in0),
    isDown.eq.to(deltaY.sel),
    deltaX.out.to(displayDX.in),
    deltaY.out.to(displayDY.in),
  ])
  .build()
`,
    nodePositions: {
      // Input (left)
      keyCode:    { x: 0,   y: 140 },
      // Constants (left column)
      upCode:     { x: 0,   y: 0 },
      downCode:   { x: 0,   y: 60 },
      leftCode:   { x: 0,   y: 280 },
      rightCode:  { x: 0,   y: 340 },
      zero:       { x: 220, y: 280 },
      one:        { x: 220, y: 340 },
      minus1:     { x: 220, y: 400 },
      // Comparators
      isUp:       { x: 220, y: 0 },
      isDown:     { x: 220, y: 60 },
      isLeft:     { x: 220, y: 140 },
      isRight:    { x: 220, y: 200 },
      // Mux tree (X)
      deltaXTemp: { x: 440, y: 160 },
      deltaX:     { x: 620, y: 160 },
      // Mux tree (Y)
      deltaYTemp: { x: 440, y: 20 },
      deltaY:     { x: 620, y: 20 },
      // Displays (right)
      displayDX:  { x: 800, y: 160 },
      displayDY:  { x: 800, y: 20 },
    },
  },

  pixelMover: {
    name: "Pixel Mover",
    description:
      "Position registers with delta addition and BitSlice wraparound, drawing the result to a Screen via DualPortRAM.",
    displayDsl: `
const PixelMover = component('PixelMover')
  .node('ram', DualPortRAM)
  .node('screen', Screen)
  .node('keyboard', Input, { value: 77 })
  .node('headX', Register, { initial: 4 })
  .node('headY', Register, { initial: 4 })
  .node('upCode', Constant, { value: 72 })
  .node('downCode', Constant, { value: 80 })
  .node('leftCode', Constant, { value: 75 })
  .node('rightCode', Constant, { value: 77 })
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('minus1', Constant, { value: 255 })
  .node('isUp', Comparator)
  .node('isDown', Comparator)
  .node('isLeft', Comparator)
  .node('isRight', Comparator)
  .node('deltaXTemp', Mux)
  .node('deltaX', Mux)
  .node('deltaYTemp', Mux)
  .node('deltaY', Mux)
  .node('nextX', Adder)
  .node('nextY', Adder)
  .node('wrapX', BitSlice, { low: 0, high: 2 })
  .node('wrapY', BitSlice, { low: 0, high: 2 })
  .node('enable', Switch)
  .node('shiftAmt', Constant, { value: 3 })
  .node('y8', LeftShifter)
  .node('pixelAddr', Adder)
  .node('displayX', HexDisplay)
  .node('displayY', HexDisplay)
  .connect(({ in: inp, out, ram, screen, keyboard, headX, headY, upCode, downCode, leftCode, rightCode, zero, one, minus1, isUp, isDown, isLeft, isRight, deltaXTemp, deltaX, deltaYTemp, deltaY, nextX, nextY, wrapX, wrapY, enable, shiftAmt, y8, pixelAddr, displayX, displayY }) => [
    screen.addrB.to(ram.addrB),
    ram.outB.to(screen.dataIn),
    keyboard.out.to(isUp.a, isDown.a, isLeft.a, isRight.a),
    upCode.out.to(isUp.b),
    downCode.out.to(isDown.b),
    leftCode.out.to(isLeft.b),
    rightCode.out.to(isRight.b),
    zero.out.to(deltaXTemp.in0, deltaYTemp.in0),
    minus1.out.to(deltaXTemp.in1, deltaYTemp.in1),
    isLeft.eq.to(deltaXTemp.sel),
    deltaXTemp.out.to(deltaX.in0),
    one.out.to(deltaX.in1, deltaY.in1, ram.dataA),
    isRight.eq.to(deltaX.sel),
    isUp.eq.to(deltaYTemp.sel),
    deltaYTemp.out.to(deltaY.in0),
    isDown.eq.to(deltaY.sel),
    headX.q.to(nextX.a),
    deltaX.out.to(nextX.b),
    headY.q.to(nextY.a),
    deltaY.out.to(nextY.b),
    nextX.sum.to(wrapX.in),
    nextY.sum.to(wrapY.in),
    wrapX.out.to(headX.data, pixelAddr.b, displayX.in),
    wrapY.out.to(headY.data, y8.value, displayY.in),
    enable.out.to(headX.we, headY.we, ram.weA),
    shiftAmt.out.to(y8.shift),
    y8.result.to(pixelAddr.a),
    pixelAddr.sum.to(ram.addrA),
  ])
  .build()
`,
    dsl: `
const PixelMover = component('PixelMover')
  .node('ram', DualPortRAM)
  .node('screen', Screen)
  .node('keyboard', Input, { value: 77 })
  .node('headX', Register, { initial: 4 })
  .node('headY', Register, { initial: 4 })
  .node('upCode', Constant, { value: 72 })
  .node('downCode', Constant, { value: 80 })
  .node('leftCode', Constant, { value: 75 })
  .node('rightCode', Constant, { value: 77 })
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('minus1', Constant, { value: 255 })
  .node('isUp', Comparator)
  .node('isDown', Comparator)
  .node('isLeft', Comparator)
  .node('isRight', Comparator)
  .node('deltaXTemp', Mux)
  .node('deltaX', Mux)
  .node('deltaYTemp', Mux)
  .node('deltaY', Mux)
  .node('nextX', Adder)
  .node('nextY', Adder)
  .node('wrapX', BitSlice, { low: 0, high: 2 })
  .node('wrapY', BitSlice, { low: 0, high: 2 })
  .node('enable', Switch)
  .node('shiftAmt', Constant, { value: 3 })
  .node('y8', LeftShifter)
  .node('pixelAddr', Adder)
  .node('displayX', HexDisplay)
  .node('displayY', HexDisplay)
  .connect(({ in: inp, out, ram, screen, keyboard, headX, headY, upCode, downCode, leftCode, rightCode, zero, one, minus1, isUp, isDown, isLeft, isRight, deltaXTemp, deltaX, deltaYTemp, deltaY, nextX, nextY, wrapX, wrapY, enable, shiftAmt, y8, pixelAddr, displayX, displayY }) => [
    screen.addrB.to(ram.addrB),
    ram.outB.to(screen.dataIn),
    keyboard.out.to(isUp.a, isDown.a, isLeft.a, isRight.a),
    upCode.out.to(isUp.b),
    downCode.out.to(isDown.b),
    leftCode.out.to(isLeft.b),
    rightCode.out.to(isRight.b),
    zero.out.to(deltaXTemp.in0, deltaYTemp.in0),
    minus1.out.to(deltaXTemp.in1, deltaYTemp.in1),
    isLeft.eq.to(deltaXTemp.sel),
    deltaXTemp.out.to(deltaX.in0),
    one.out.to(deltaX.in1, deltaY.in1, ram.dataA),
    isRight.eq.to(deltaX.sel),
    isUp.eq.to(deltaYTemp.sel),
    deltaYTemp.out.to(deltaY.in0),
    isDown.eq.to(deltaY.sel),
    headX.q.to(nextX.a),
    deltaX.out.to(nextX.b),
    headY.q.to(nextY.a),
    deltaY.out.to(nextY.b),
    nextX.sum.to(wrapX.in),
    nextY.sum.to(wrapY.in),
    wrapX.out.to(headX.data, pixelAddr.b, displayX.in),
    wrapY.out.to(headY.data, y8.value, displayY.in),
    enable.out.to(headX.we, headY.we, ram.weA),
    shiftAmt.out.to(y8.shift),
    y8.result.to(pixelAddr.a),
    pixelAddr.sum.to(ram.addrA),
  ])
  .build()
`,
    nodePositions: {
      // Input
      keyboard:   { x: 0,   y: 200 },
      enable:     { x: 0,   y: 500 },
      // Direction constants
      upCode:     { x: 0,   y: 0 },
      downCode:   { x: 0,   y: 60 },
      leftCode:   { x: 0,   y: 340 },
      rightCode:  { x: 0,   y: 400 },
      zero:       { x: 180, y: 340 },
      one:        { x: 180, y: 400 },
      minus1:     { x: 180, y: 460 },
      // Comparators
      isUp:       { x: 180, y: 0 },
      isDown:     { x: 180, y: 60 },
      isLeft:     { x: 180, y: 140 },
      isRight:    { x: 180, y: 200 },
      // Delta muxes
      deltaXTemp: { x: 380, y: 160 },
      deltaX:     { x: 520, y: 160 },
      deltaYTemp: { x: 380, y: 20 },
      deltaY:     { x: 520, y: 20 },
      // Position registers
      headX:      { x: 520, y: 300 },
      headY:      { x: 520, y: 400 },
      // Next position
      nextX:      { x: 680, y: 160 },
      nextY:      { x: 680, y: 20 },
      wrapX:      { x: 820, y: 160 },
      wrapY:      { x: 820, y: 20 },
      // Pixel address
      shiftAmt:   { x: 820, y: 300 },
      y8:         { x: 960, y: 20 },
      pixelAddr:  { x: 960, y: 100 },
      // RAM + Screen
      ram:        { x: 1100, y: 60 },
      screen:     { x: 1100, y: 250 },
      // Displays
      displayX:   { x: 960, y: 200 },
      displayY:   { x: 960, y: 300 },
    },
  },

  phaseDemo: {
    name: "4-Phase Counter",
    description:
      "A 2-bit counter cycling through phases 0-3, with LED indicators showing the active phase.",
    displayDsl: `
const PhaseDemo = component('PhaseDemo')
  .node('phase', Register, { initial: 0 })
  .node('one', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .node('two', Constant, { value: 2 })
  .node('three', Constant, { value: 3 })
  .node('phaseInc', Adder)
  .node('phaseWrap', BitSlice, { low: 0, high: 1 })
  .node('enable', Switch)
  .node('isPhase0', Comparator)
  .node('isPhase1', Comparator)
  .node('isPhase2', Comparator)
  .node('isPhase3', Comparator)
  .node('led0', Led)
  .node('led1', Led)
  .node('led2', Led)
  .node('led3', Led)
  .node('display', HexDisplay)
  .connect(({ in: inp, out, phase, one, zero, two, three, phaseInc, phaseWrap, enable, isPhase0, isPhase1, isPhase2, isPhase3, led0, led1, led2, led3, display }) => [
    phase.q.to(phaseInc.a, isPhase0.a, isPhase1.a, isPhase2.a, isPhase3.a, display.in),
    one.out.to(phaseInc.b, isPhase1.b),
    phaseInc.sum.to(phaseWrap.in),
    phaseWrap.out.to(phase.data),
    enable.out.to(phase.we),
    zero.out.to(isPhase0.b),
    two.out.to(isPhase2.b),
    three.out.to(isPhase3.b),
    isPhase0.eq.to(led0.in),
    isPhase1.eq.to(led1.in),
    isPhase2.eq.to(led2.in),
    isPhase3.eq.to(led3.in),
  ])
  .build()
`,
    dsl: `
const PhaseDemo = component('PhaseDemo')
  .node('phase', Register, { initial: 0 })
  .node('one', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .node('two', Constant, { value: 2 })
  .node('three', Constant, { value: 3 })
  .node('phaseInc', Adder)
  .node('phaseWrap', BitSlice, { low: 0, high: 1 })
  .node('enable', Switch)
  .node('isPhase0', Comparator)
  .node('isPhase1', Comparator)
  .node('isPhase2', Comparator)
  .node('isPhase3', Comparator)
  .node('led0', Led)
  .node('led1', Led)
  .node('led2', Led)
  .node('led3', Led)
  .node('display', HexDisplay)
  .connect(({ in: inp, out, phase, one, zero, two, three, phaseInc, phaseWrap, enable, isPhase0, isPhase1, isPhase2, isPhase3, led0, led1, led2, led3, display }) => [
    phase.q.to(phaseInc.a, isPhase0.a, isPhase1.a, isPhase2.a, isPhase3.a, display.in),
    one.out.to(phaseInc.b, isPhase1.b),
    phaseInc.sum.to(phaseWrap.in),
    phaseWrap.out.to(phase.data),
    enable.out.to(phase.we),
    zero.out.to(isPhase0.b),
    two.out.to(isPhase2.b),
    three.out.to(isPhase3.b),
    isPhase0.eq.to(led0.in),
    isPhase1.eq.to(led1.in),
    isPhase2.eq.to(led2.in),
    isPhase3.eq.to(led3.in),
  ])
  .build()
`,
    nodePositions: {
      // Control (left)
      enable:   { x: 0,   y: 100 },
      one:      { x: 60,  y: 230 },
      // Phase register + increment
      phase:    { x: 200, y: 100 },
      phaseInc: { x: 200, y: 0 },
      phaseWrap:{ x: 200, y: 230 },
      // Constants
      zero:     { x: 420, y: 0 },
      two:      { x: 420, y: 160 },
      three:    { x: 420, y: 240 },
      // Comparators
      isPhase0: { x: 580, y: 0 },
      isPhase1: { x: 580, y: 80 },
      isPhase2: { x: 580, y: 160 },
      isPhase3: { x: 580, y: 240 },
      // LEDs (right)
      led0:     { x: 760, y: 0 },
      led1:     { x: 760, y: 80 },
      led2:     { x: 760, y: 160 },
      led3:     { x: 760, y: 240 },
      display:  { x: 760, y: 340 },
    },
  },

  collisionDetector: {
    name: "Collision Detector",
    description:
      "Compares head and food X/Y coordinates to detect collision, outputting a grow signal when they match.",
    displayDsl: `
const CollisionDetector = component('CollisionDetector')
  .node('headX', Input, { value: 3 })
  .node('headY', Input, { value: 5 })
  .node('foodX', Input, { value: 3 })
  .node('foodY', Input, { value: 5 })
  .node('matchX', Comparator)
  .node('matchY', Comparator)
  .node('collision', And)
  .node('collisionLed', Led)
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('growMux', Mux)
  .node('growDisplay', HexDisplay)
  .connect(({ in: inp, out, headX, headY, foodX, foodY, matchX, matchY, collision, collisionLed, zero, one, growMux, growDisplay }) => [
    headX.out.to(matchX.a),
    foodX.out.to(matchX.b),
    headY.out.to(matchY.a),
    foodY.out.to(matchY.b),
    matchX.eq.to(collision.a),
    matchY.eq.to(collision.b),
    collision.out.to(collisionLed.in, growMux.sel),
    zero.out.to(growMux.in0),
    one.out.to(growMux.in1),
    growMux.out.to(growDisplay.in),
  ])
  .build()
`,
    dsl: `
const CollisionDetector = component('CollisionDetector')
  .node('headX', Input, { value: 3 })
  .node('headY', Input, { value: 5 })
  .node('foodX', Input, { value: 3 })
  .node('foodY', Input, { value: 5 })
  .node('matchX', Comparator)
  .node('matchY', Comparator)
  .node('collision', And)
  .node('collisionLed', Led)
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('growMux', Mux)
  .node('growDisplay', HexDisplay)
  .connect(({ in: inp, out, headX, headY, foodX, foodY, matchX, matchY, collision, collisionLed, zero, one, growMux, growDisplay }) => [
    headX.out.to(matchX.a),
    foodX.out.to(matchX.b),
    headY.out.to(matchY.a),
    foodY.out.to(matchY.b),
    matchX.eq.to(collision.a),
    matchY.eq.to(collision.b),
    collision.out.to(collisionLed.in, growMux.sel),
    zero.out.to(growMux.in0),
    one.out.to(growMux.in1),
    growMux.out.to(growDisplay.in),
  ])
  .build()
`,
    nodePositions: {
      // Inputs (left, 2x2 grid)
      headX:        { x: 0,   y: 0 },
      headY:        { x: 0,   y: 120 },
      foodX:        { x: 0,   y: 260 },
      foodY:        { x: 0,   y: 380 },
      // Comparators
      matchX:       { x: 220, y: 60 },
      matchY:       { x: 220, y: 300 },
      // AND gate
      collision:    { x: 420, y: 160 },
      collisionLed: { x: 620, y: 100 },
      // Grow mux
      zero:         { x: 420, y: 300 },
      one:          { x: 420, y: 380 },
      growMux:       { x: 620, y: 300 },
      growDisplay:  { x: 780, y: 300 },
    },
  },
};

/**
 * Full SnakeAdvanced DSL — the complete Snake game circuit.
 * Uses DualPortRAM for both framebuffer and snake body storage,
 * a 4-phase pipeline for coordinated read/compute/write operations,
 * direction decoding, collision detection, and food spawning.
 */
export const SNAKE_ADVANCED_DSL = `
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
  .build()`
