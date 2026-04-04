/**
 * Circuit definitions for the "Pong in Hardware" blog post.
 *
 * Each circuit builds toward the final Pong game, from ball position
 * and bounce detection to paddle movement, phased rendering, and
 * the complete PongSimple circuit.
 */

export interface BlogCircuit {
  name: string;
  description: string;
  displayDsl: string;
  dsl: string;
  nodePositions?: Record<string, { x: number; y: number }>;
}

export const PONG_CIRCUITS: Record<string, BlogCircuit> = {
  ballPosition: {
    name: "Ball Position",
    description:
      "Two registers store the ball's X and Y coordinates. An adder moves the ball by adding a velocity delta each tick.",
    nodePositions: {
      dx: { x: 0, y: 50 },
      dy: { x: 0, y: 200 },
      enable: { x: 0, y: 370 },
      nextX: { x: 200, y: 50 },
      nextY: { x: 200, y: 200 },
      wrapX: { x: 370, y: 50 },
      wrapY: { x: 370, y: 200 },
      ballX: { x: 540, y: 50 },
      ballY: { x: 540, y: 200 },
      displayX: { x: 710, y: 50 },
      displayY: { x: 710, y: 200 },
    },
    displayDsl: `
const BallPosition = component('BallPosition')
  .node('ballX', Register, { initial: 8 })
  .node('ballY', Register, { initial: 8 })
  .node('dx', Input, { value: 1 })
  .node('dy', Input, { value: 1 })
  .node('nextX', Adder)
  .node('nextY', Adder)
  .node('wrapX', BitSlice, { low: 0, high: 3 })
  .node('wrapY', BitSlice, { low: 0, high: 3 })
  .node('enable', Switch)
  .node('displayX', HexDisplay)
  .node('displayY', HexDisplay)
  .connect(({ in: inp, out, ballX, ballY, dx, dy, nextX, nextY, wrapX, wrapY, enable, displayX, displayY }) => [
    ballX.q.to(nextX.a, displayX.in),
    dx.out.to(nextX.b),
    ballY.q.to(nextY.a, displayY.in),
    dy.out.to(nextY.b),
    nextX.sum.to(wrapX.in),
    nextY.sum.to(wrapY.in),
    wrapX.out.to(ballX.data),
    wrapY.out.to(ballY.data),
    enable.out.to(ballX.we, ballY.we),
  ])
  .build()
`,
    dsl: `
const BallPosition = component('BallPosition')
  .node('ballX', Register, { initial: 8 })
  .node('ballY', Register, { initial: 8 })
  .node('dx', Input, { value: 1 })
  .node('dy', Input, { value: 1 })
  .node('nextX', Adder)
  .node('nextY', Adder)
  .node('wrapX', BitSlice, { low: 0, high: 3 })
  .node('wrapY', BitSlice, { low: 0, high: 3 })
  .node('enable', Switch)
  .node('displayX', HexDisplay)
  .node('displayY', HexDisplay)
  .connect(({ in: inp, out, ballX, ballY, dx, dy, nextX, nextY, wrapX, wrapY, enable, displayX, displayY }) => [
    ballX.q.to(nextX.a, displayX.in),
    dx.out.to(nextX.b),
    ballY.q.to(nextY.a, displayY.in),
    dy.out.to(nextY.b),
    nextX.sum.to(wrapX.in),
    nextY.sum.to(wrapY.in),
    wrapX.out.to(ballX.data),
    wrapY.out.to(ballY.data),
    enable.out.to(ballX.we, ballY.we),
  ])
  .build()
`,
  },

  bounceDetection: {
    name: "Bounce Detection",
    description:
      "Comparators check if the ball is at a screen edge (0 or 15), signaling when it needs to reverse direction.",
    nodePositions: {
      ballY: { x: 0, y: 120 },
      zero: { x: 0, y: 0 },
      fifteen: { x: 0, y: 240 },
      atTop: { x: 200, y: 30 },
      atBottom: { x: 200, y: 200 },
      shouldBounce: { x: 380, y: 120 },
      bounceLed: { x: 560, y: 120 },
      one: { x: 200, y: 350 },
      minus1: { x: 200, y: 450 },
      newDY: { x: 380, y: 400 },
      display: { x: 560, y: 400 },
    },
    displayDsl: `
const BounceDetection = component('BounceDetection')
  .node('ballY', Input, { value: 15 })
  .node('zero', Constant, { value: 0 })
  .node('fifteen', Constant, { value: 15 })
  .node('atTop', Comparator)
  .node('atBottom', Comparator)
  .node('shouldBounce', Or)
  .node('bounceLed', Led)
  .node('one', Constant, { value: 1 })
  .node('minus1', Constant, { value: 255 })
  .node('newDY', Mux, { width: 8 })
  .node('display', HexDisplay)
  .connect(({ in: inp, out, ballY, zero, fifteen, atTop, atBottom, shouldBounce, bounceLed, one, minus1, newDY, display }) => [
    ballY.out.to(atTop.a, atBottom.a),
    zero.out.to(atTop.b),
    fifteen.out.to(atBottom.b),
    atTop.eq.to(shouldBounce.a),
    atBottom.eq.to(shouldBounce.b, newDY.sel),
    shouldBounce.out.to(bounceLed.in),
    one.out.to(newDY.in0),
    minus1.out.to(newDY.in1),
    newDY.out.to(display.in),
  ])
  .build()
`,
    dsl: `
const BounceDetection = component('BounceDetection')
  .node('ballY', Input, { value: 15 })
  .node('zero', Constant, { value: 0 })
  .node('fifteen', Constant, { value: 15 })
  .node('atTop', Comparator)
  .node('atBottom', Comparator)
  .node('shouldBounce', Or)
  .node('bounceLed', Led)
  .node('one', Constant, { value: 1 })
  .node('minus1', Constant, { value: 255 })
  .node('newDY', Mux, { width: 8 })
  .node('display', HexDisplay)
  .connect(({ in: inp, out, ballY, zero, fifteen, atTop, atBottom, shouldBounce, bounceLed, one, minus1, newDY, display }) => [
    ballY.out.to(atTop.a, atBottom.a),
    zero.out.to(atTop.b),
    fifteen.out.to(atBottom.b),
    atTop.eq.to(shouldBounce.a),
    atBottom.eq.to(shouldBounce.b, newDY.sel),
    shouldBounce.out.to(bounceLed.in),
    one.out.to(newDY.in0),
    minus1.out.to(newDY.in1),
    newDY.out.to(display.in),
  ])
  .build()
`,
  },

  paddleMovement: {
    name: "Paddle Movement",
    description:
      "Keyboard scan codes are compared to detect W/S key presses. A mux tree converts the result into a delta that moves the paddle register.",
    nodePositions: {
      keyboard: { x: 0, y: 100 },
      keyW: { x: 0, y: 200 },
      keyS: { x: 0, y: 300 },
      zero: { x: 0, y: 400 },
      minus1: { x: 0, y: 0 },
      one: { x: 0, y: 500 },
      isW: { x: 200, y: 100 },
      isS: { x: 200, y: 300 },
      upDelta: { x: 370, y: 100 },
      delta: { x: 370, y: 300 },
      paddleY: { x: 540, y: 200 },
      newY: { x: 540, y: 370 },
      wrapY: { x: 540, y: 500 },
      enable: { x: 370, y: 500 },
      display: { x: 720, y: 150 },
      deltaDisplay: { x: 720, y: 330 },
    },
    displayDsl: `
const PaddleMovement = component('PaddleMovement')
  .node('keyboard', Input, { value: 17 })
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('minus1', Constant, { value: 255 })
  .node('keyW', Constant, { value: 17 })
  .node('keyS', Constant, { value: 31 })
  .node('isW', Comparator)
  .node('isS', Comparator)
  .node('upDelta', Mux, { width: 8 })
  .node('delta', Mux, { width: 8 })
  .node('paddleY', Register, { initial: 6 })
  .node('newY', Adder)
  .node('wrapY', BitSlice, { low: 0, high: 3 })
  .node('enable', Switch)
  .node('display', HexDisplay)
  .node('deltaDisplay', HexDisplay)
  .connect(({ in: inp, out, keyboard, zero, one, minus1, keyW, keyS, isW, isS, upDelta, delta, paddleY, newY, wrapY, enable, display, deltaDisplay }) => [
    keyboard.out.to(isW.a, isS.a),
    keyW.out.to(isW.b),
    keyS.out.to(isS.b),
    zero.out.to(upDelta.in0),
    minus1.out.to(upDelta.in1),
    isW.eq.to(upDelta.sel),
    upDelta.out.to(delta.in0),
    one.out.to(delta.in1),
    isS.eq.to(delta.sel),
    paddleY.q.to(newY.a, display.in),
    delta.out.to(newY.b, deltaDisplay.in),
    newY.sum.to(wrapY.in),
    wrapY.out.to(paddleY.data),
    enable.out.to(paddleY.we),
  ])
  .build()
`,
    dsl: `
const PaddleMovement = component('PaddleMovement')
  .node('keyboard', Input, { value: 17 })
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('minus1', Constant, { value: 255 })
  .node('keyW', Constant, { value: 17 })
  .node('keyS', Constant, { value: 31 })
  .node('isW', Comparator)
  .node('isS', Comparator)
  .node('upDelta', Mux, { width: 8 })
  .node('delta', Mux, { width: 8 })
  .node('paddleY', Register, { initial: 6 })
  .node('newY', Adder)
  .node('wrapY', BitSlice, { low: 0, high: 3 })
  .node('enable', Switch)
  .node('display', HexDisplay)
  .node('deltaDisplay', HexDisplay)
  .connect(({ in: inp, out, keyboard, zero, one, minus1, keyW, keyS, isW, isS, upDelta, delta, paddleY, newY, wrapY, enable, display, deltaDisplay }) => [
    keyboard.out.to(isW.a, isS.a),
    keyW.out.to(isW.b),
    keyS.out.to(isS.b),
    zero.out.to(upDelta.in0),
    minus1.out.to(upDelta.in1),
    isW.eq.to(upDelta.sel),
    upDelta.out.to(delta.in0),
    one.out.to(delta.in1),
    isS.eq.to(delta.sel),
    paddleY.q.to(newY.a, display.in),
    delta.out.to(newY.b, deltaDisplay.in),
    newY.sum.to(wrapY.in),
    wrapY.out.to(paddleY.data),
    enable.out.to(paddleY.we),
  ])
  .build()
`,
  },

  phaseCounter: {
    name: "14-Phase Rendering Pipeline",
    description:
      "A counter cycles 0-13, orchestrating: clear old ball, clear old left paddle, clear old right paddle, draw new ball, draw new left paddle, draw new right paddle.",
    nodePositions: {
      enable: { x: 0, y: 100 },
      one: { x: 0, y: 250 },
      zero: { x: 200, y: 350 },
      fourteen: { x: 200, y: 250 },
      phase: { x: 200, y: 100 },
      phaseInc: { x: 370, y: 100 },
      atFourteen: { x: 370, y: 250 },
      nextPhase: { x: 530, y: 180 },
      display: { x: 700, y: 100 },
      drawThreshold: { x: 370, y: 400 },
      isDrawPhase: { x: 530, y: 400 },
      drawLed: { x: 700, y: 400 },
    },
    displayDsl: `
const PhaseCounter14 = component('PhaseCounter14')
  .node('phase', Register, { initial: 0 })
  .node('one', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .node('fourteen', Constant, { value: 14 })
  .node('phaseInc', Adder)
  .node('atFourteen', Comparator)
  .node('nextPhase', Mux, { width: 8 })
  .node('enable', Switch)
  .node('display', HexDisplay)
  .node('drawThreshold', Constant, { value: 6 })
  .node('isDrawPhase', Comparator)
  .node('drawLed', Led)
  .connect(({ in: inp, out, phase, one, zero, fourteen, phaseInc, atFourteen, nextPhase, enable, display, drawThreshold, isDrawPhase, drawLed }) => [
    phase.q.to(phaseInc.a, display.in, isDrawPhase.a),
    one.out.to(phaseInc.b),
    phaseInc.sum.to(atFourteen.a, nextPhase.in0),
    fourteen.out.to(atFourteen.b),
    zero.out.to(nextPhase.in1),
    atFourteen.eq.to(nextPhase.sel),
    nextPhase.out.to(phase.data),
    enable.out.to(phase.we),
    drawThreshold.out.to(isDrawPhase.b),
    isDrawPhase.gt.to(drawLed.in),
  ])
  .build()
`,
    dsl: `
const PhaseCounter14 = component('PhaseCounter14')
  .node('phase', Register, { initial: 0 })
  .node('one', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .node('fourteen', Constant, { value: 14 })
  .node('phaseInc', Adder)
  .node('atFourteen', Comparator)
  .node('nextPhase', Mux, { width: 8 })
  .node('enable', Switch)
  .node('display', HexDisplay)
  .node('drawThreshold', Constant, { value: 6 })
  .node('isDrawPhase', Comparator)
  .node('drawLed', Led)
  .connect(({ in: inp, out, phase, one, zero, fourteen, phaseInc, atFourteen, nextPhase, enable, display, drawThreshold, isDrawPhase, drawLed }) => [
    phase.q.to(phaseInc.a, display.in, isDrawPhase.a),
    one.out.to(phaseInc.b),
    phaseInc.sum.to(atFourteen.a, nextPhase.in0),
    fourteen.out.to(atFourteen.b),
    zero.out.to(nextPhase.in1),
    atFourteen.eq.to(nextPhase.sel),
    nextPhase.out.to(phase.data),
    enable.out.to(phase.we),
    drawThreshold.out.to(isDrawPhase.b),
    isDrawPhase.gt.to(drawLed.in),
  ])
  .build()
`,
  },

  pixelAddress: {
    name: "Pixel Address Calculation",
    description:
      "Converts (X, Y) coordinates to a linear framebuffer address using (Y << 4) + X. In real hardware a left shift by 4 is just wiring — each bit of Y connects to a position 4 places higher — so the only real gate is the final adder.",
    nodePositions: {
      x: { x: 0, y: 120 },
      y: { x: 0, y: 0 },
      four: { x: 0, y: 240 },
      y16: { x: 220, y: 60 },
      addr: { x: 420, y: 90 },
      result: { x: 600, y: 90 },
    },
    displayDsl: `
const PixelAddress = component('PixelAddress')
  .node('x', Input, { value: 4 })
  .node('y', Input, { value: 4 })
  .node('four', Input, { value: 4 })
  .node('y16', LeftShifter)
  .node('addr', Adder)
  .node('result', HexDisplay)
  .connect(({ in: inp, out, x, y, four, y16, addr, result }) => [
    y.out.to(y16.value),
    four.out.to(y16.shift),
    y16.result.to(addr.a),
    x.out.to(addr.b),
    addr.sum.to(result.in),
  ])
  .build()
`,
    dsl: `
const PixelAddress = component('PixelAddress')
  .node('x', Input, { value: 4 })
  .node('y', Input, { value: 4 })
  .node('four', Input, { value: 4 })
  .node('y16', LeftShifter)
  .node('addr', Adder)
  .node('result', HexDisplay)
  .connect(({ in: inp, out, x, y, four, y16, addr, result }) => [
    y.out.to(y16.value),
    four.out.to(y16.shift),
    y16.result.to(addr.a),
    x.out.to(addr.b),
    addr.sum.to(result.in),
  ])
  .build()
`,
  },
};

/**
 * Full PongSimple DSL — a complete Pong game on an 8x8 screen.
 * Two paddles (W/S and Up/Down), a bouncing ball, 14-phase rendering pipeline.
 *
 * Key additions over the raw PongSimple.dsl:
 * - Register initial values (ball starts at center, velocity = diagonal)
 * - Y-axis bounce detection (flip DY at top/bottom walls)
 * - X-axis bounce detection (flip DX at left/right walls)
 * - BitSlice wrapping for paddle positions
 * - All Input "constants" have value= so the circuit is self-contained
 */
export const PONG_DSL = `
const PongSimple = component('PongSimple')
  .node('ram', DualPortRAM)
  .node('screen', Screen, { width: 16, height: 16 })
  .node('keyboard0', Input)
  .node('keyboard1', Input)
  .node('ballX', Register, { initial: 8 })
  .node('ballY', Register, { initial: 8 })
  .node('ballDX', Register, { initial: 1 })
  .node('ballDY', Register, { initial: 1 })
  .node('leftPaddleY', Register, { initial: 6 })
  .node('rightPaddleY', Register, { initial: 6 })
  .node('oldBallX', Register, { initial: 8 })
  .node('oldBallY', Register, { initial: 8 })
  .node('oldLeftPaddleY', Register, { initial: 6 })
  .node('oldRightPaddleY', Register, { initial: 6 })
  .node('phaseCounter', Register)
  .node('phaseIncrement', Adder)
  .node('one', Input, { value: 1 })
  .node('phaseMod', Comparator)
  .node('fourteen', Input, { value: 14 })
  .node('nextPhase', Mux, { width: 8 })
  .node('zero', Input, { value: 0 })
  .node('phaseEnable', Switch)
  .node('p0c', Input, { value: 0 })
  .node('p1c', Input, { value: 1 })
  .node('p2c', Input, { value: 2 })
  .node('p3c', Input, { value: 3 })
  .node('p4c', Input, { value: 4 })
  .node('p5c', Input, { value: 5 })
  .node('p6c', Input, { value: 6 })
  .node('p7c', Input, { value: 7 })
  .node('p8c', Input, { value: 8 })
  .node('p9c', Input, { value: 9 })
  .node('p10c', Input, { value: 10 })
  .node('p11c', Input, { value: 11 })
  .node('p12c', Input, { value: 12 })
  .node('p13c', Input, { value: 13 })
  .node('isP0', Comparator)
  .node('isP1', Comparator)
  .node('isP2', Comparator)
  .node('isP3', Comparator)
  .node('isP4', Comparator)
  .node('isP5', Comparator)
  .node('isP6', Comparator)
  .node('isP7', Comparator)
  .node('isP8', Comparator)
  .node('isP9', Comparator)
  .node('isP10', Comparator)
  .node('isP11', Comparator)
  .node('isP12', Comparator)
  .node('isP13', Comparator)
  .node('fifteen', Input, { value: 15 })
  .node('thirteen', Input, { value: 13 })
  .node('six', Input, { value: 6 })
  .node('two', Input, { value: 2 })
  .node('four', Input, { value: 4 })
  .node('minus1', Input, { value: 255 })
  .node('halfRange', Input, { value: 128 })
  .node('keyW', Input, { value: 17 })
  .node('keyS', Input, { value: 31 })
  .node('keyUp', Input, { value: 72 })
  .node('keyDown', Input, { value: 80 })
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
  .node('leftUpDelta', Mux, { width: 8 })
  .node('leftDelta', Mux, { width: 8 })
  .node('newLeftPaddleY', Adder)
  .node('rightUpDelta', Mux, { width: 8 })
  .node('rightDelta', Mux, { width: 8 })
  .node('newRightPaddleY', Adder)
  .node('atTopWall', Comparator)
  .node('atBottomWall', Comparator)
  .node('headingUp', Comparator)
  .node('headingDown', Comparator)
  .node('topBounce', And)
  .node('bottomBounce', And)
  .node('yBounce', Or)
  .node('dyIs1', Comparator)
  .node('negDY', Mux, { width: 8 })
  .node('newDY', Mux, { width: 8 })
  .node('nearLeftWall', Comparator)
  .node('headingLeft', Comparator)
  .node('leftPaddleTop', Comparator)
  .node('leftPaddleBottom', Adder)
  .node('leftPaddleBot', Comparator)
  .node('leftAboveOrEq', Not)
  .node('leftBelowOrEq', Or)
  .node('leftPaddleMatch', And)
  .node('leftWallAndHeading', And)
  .node('leftBounce', And)
  .node('nearRightWall', Comparator)
  .node('wallBounceRight', Input, { value: 14 })
  .node('headingRight', Comparator)
  .node('rightPaddleTop', Comparator)
  .node('rightPaddleBottom', Adder)
  .node('rightPaddleBot', Comparator)
  .node('rightAboveOrEq', Not)
  .node('rightBelowOrEq', Or)
  .node('rightPaddleMatch', And)
  .node('rightWallAndHeading', And)
  .node('rightBounce', And)
  .node('xBounce', Or)
  .node('dxIs1', Comparator)
  .node('negDX', Mux, { width: 8 })
  .node('newDX', Mux, { width: 8 })
  .node('newBallX', Adder)
  .node('newBallY', Adder)
  .node('updateEnable', Switch)
  .node('shouldUpdate', And)
  .node('ballSpeedCounter', Register, { width: 2 })
  .node('ballSpeedInc', Adder, { width: 2 })
  .node('ballSpeedOne', Input, { value: 1, width: 2 })
  .node('ballSpeedLimit', Comparator, { width: 2 })
  .node('ballSpeedMax', Input, { value: 2, width: 2 })
  .node('ballSpeedNext', Mux, { width: 2 })
  .node('ballSpeedZero', Input, { value: 0, width: 2 })
  .node('isBallTick', Comparator, { width: 2 })
  .node('shouldUpdateBall', And)
  .node('wrappedBallX', BitSlice, { low: 0, high: 3 })
  .node('wrappedBallY', BitSlice, { low: 0, high: 3 })
  .node('leftYOver', Comparator)
  .node('leftYNeg', Comparator)
  .node('leftYClamped1', Mux, { width: 8 })
  .node('leftYClamped', Mux, { width: 8 })
  .node('rightYOver', Comparator)
  .node('rightYNeg', Comparator)
  .node('rightYClamped1', Mux, { width: 8 })
  .node('rightYClamped', Mux, { width: 8 })
  .node('isOff1a', Or)
  .node('isOff1b', Or)
  .node('isOffset1', Or)
  .node('isOff2a', Or)
  .node('isOff2b', Or)
  .node('isOffset2', Or)
  .node('paddleOffset', Mux, { width: 8 })
  .node('paddleOffset2', Mux, { width: 8 })
  .node('isClearLeft', Or)
  .node('isClearLeft2', Or)
  .node('isClearRight', Or)
  .node('isClearRight2', Or)
  .node('isDrawLeft', Or)
  .node('isDrawLeft2', Or)
  .node('isDrawRight', Or)
  .node('isDrawRight2', Or)
  .node('basePaddleY0', Mux, { width: 8 })
  .node('basePaddleY1', Mux, { width: 8 })
  .node('basePaddleY', Mux, { width: 8 })
  .node('paddlePixelY', Adder)
  .node('isPaddlePhase1', Or)
  .node('isPaddlePhase2', Or)
  .node('isPaddlePhase', Or)
  .node('selectBallY', Mux, { width: 8 })
  .node('selectY', Mux, { width: 8 })
  .node('isLeftPaddle', Or)
  .node('isRightPaddle', Or)
  .node('selectBallX', Mux, { width: 8 })
  .node('selectX0', Mux, { width: 8 })
  .node('selectX', Mux, { width: 8 })
  .node('yTimes16', LeftShifter)
  .node('ramAddr', Adder)
  .node('isClearPhase', Comparator)
  .node('ramData', Mux, { width: 8 })
  .node('writeEnable', Switch)
  .connect(({ in: inp, out, ram, screen, keyboard0, keyboard1, ballX, ballY, ballDX, ballDY, leftPaddleY, rightPaddleY, oldBallX, oldBallY, oldLeftPaddleY, oldRightPaddleY, phaseCounter, phaseIncrement, one, phaseMod, fourteen, nextPhase, zero, phaseEnable, p0c, p1c, p2c, p3c, p4c, p5c, p6c, p7c, p8c, p9c, p10c, p11c, p12c, p13c, isP0, isP1, isP2, isP3, isP4, isP5, isP6, isP7, isP8, isP9, isP10, isP11, isP12, isP13, fifteen, thirteen, six, two, four, minus1, halfRange, keyW, keyS, keyUp, keyDown, isW_kb0, isS_kb0, isUp_kb0, isDown_kb0, isW_kb1, isS_kb1, isUp_kb1, isDown_kb1, isW, isS, isUp, isDown, leftUpDelta, leftDelta, newLeftPaddleY, rightUpDelta, rightDelta, newRightPaddleY, atTopWall, atBottomWall, headingUp, headingDown, topBounce, bottomBounce, yBounce, dyIs1, negDY, newDY, nearLeftWall, headingLeft, leftPaddleTop, leftPaddleBottom, leftPaddleBot, leftAboveOrEq, leftBelowOrEq, leftPaddleMatch, leftWallAndHeading, leftBounce, nearRightWall, wallBounceRight, headingRight, rightPaddleTop, rightPaddleBottom, rightPaddleBot, rightAboveOrEq, rightBelowOrEq, rightPaddleMatch, rightWallAndHeading, rightBounce, xBounce, dxIs1, negDX, newDX, newBallX, newBallY, updateEnable, shouldUpdate, ballSpeedCounter, ballSpeedInc, ballSpeedOne, ballSpeedLimit, ballSpeedMax, ballSpeedNext, ballSpeedZero, isBallTick, shouldUpdateBall, wrappedBallX, wrappedBallY, leftYOver, leftYNeg, leftYClamped1, leftYClamped, rightYOver, rightYNeg, rightYClamped1, rightYClamped, isOff1a, isOff1b, isOffset1, isOff2a, isOff2b, isOffset2, paddleOffset, paddleOffset2, isClearLeft, isClearLeft2, isClearRight, isClearRight2, isDrawLeft, isDrawLeft2, isDrawRight, isDrawRight2, basePaddleY0, basePaddleY1, basePaddleY, paddlePixelY, isPaddlePhase1, isPaddlePhase2, isPaddlePhase, selectBallY, selectY, isLeftPaddle, isRightPaddle, selectBallX, selectX0, selectX, yTimes16, ramAddr, isClearPhase, ramData, writeEnable }) => [
    screen.addrB.to(ram.addrB),
    ram.outB.to(screen.dataIn),
    phaseCounter.q.to(phaseIncrement.a, isP0.a, isP1.a, isP2.a, isP3.a, isP4.a, isP5.a, isP6.a, isP7.a, isP8.a, isP9.a, isP10.a, isP11.a, isP12.a, isP13.a, isClearPhase.a),
    one.out.to(phaseIncrement.b, leftDelta.in1, rightDelta.in1, headingDown.b, dyIs1.b, negDY.in0, nearLeftWall.b, headingRight.b, dxIs1.b, negDX.in0, paddleOffset.in1, ramData.in0),
    phaseIncrement.sum.to(phaseMod.a, nextPhase.in0),
    fourteen.out.to(phaseMod.b),
    zero.out.to(nextPhase.in1, leftUpDelta.in0, rightUpDelta.in0, atTopWall.b, leftYClamped.in1, rightYClamped.in1, paddleOffset.in0, selectX0.in1, ramData.in1),
    phaseMod.eq.to(nextPhase.sel),
    nextPhase.out.to(phaseCounter.data),
    phaseEnable.out.to(phaseCounter.we),
    p0c.out.to(isP0.b),
    p1c.out.to(isP1.b),
    p2c.out.to(isP2.b),
    p3c.out.to(isP3.b),
    p4c.out.to(isP4.b),
    p5c.out.to(isP5.b),
    p6c.out.to(isP6.b),
    p7c.out.to(isP7.b, isClearPhase.b),
    p8c.out.to(isP8.b),
    p9c.out.to(isP9.b),
    p10c.out.to(isP10.b),
    p11c.out.to(isP11.b),
    p12c.out.to(isP12.b),
    p13c.out.to(isP13.b),
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
    minus1.out.to(leftUpDelta.in1, rightUpDelta.in1, headingUp.b, negDY.in1, headingLeft.b, negDX.in1),
    isW.out.to(leftUpDelta.sel),
    leftUpDelta.out.to(leftDelta.in0),
    isS.out.to(leftDelta.sel),
    leftPaddleY.q.to(newLeftPaddleY.a, leftPaddleTop.b, leftPaddleBottom.a, oldLeftPaddleY.data, basePaddleY1.in1),
    leftDelta.out.to(newLeftPaddleY.b),
    isUp.out.to(rightUpDelta.sel),
    rightUpDelta.out.to(rightDelta.in0),
    isDown.out.to(rightDelta.sel),
    rightPaddleY.q.to(newRightPaddleY.a, rightPaddleTop.b, rightPaddleBottom.a, oldRightPaddleY.data, basePaddleY.in1),
    rightDelta.out.to(newRightPaddleY.b),
    ballY.q.to(atTopWall.a, atBottomWall.a, leftPaddleTop.a, leftPaddleBot.a, rightPaddleTop.a, rightPaddleBot.a, newBallY.a, oldBallY.data, selectBallY.in0),
    fifteen.out.to(atBottomWall.b, selectX.in1),
    ballDY.q.to(headingUp.a, headingDown.a, dyIs1.a, newDY.in0),
    atTopWall.eq.to(topBounce.a),
    headingUp.eq.to(topBounce.b),
    atBottomWall.eq.to(bottomBounce.a),
    headingDown.eq.to(bottomBounce.b),
    topBounce.out.to(yBounce.a),
    bottomBounce.out.to(yBounce.b),
    dyIs1.eq.to(negDY.sel),
    negDY.out.to(newDY.in1),
    yBounce.out.to(newDY.sel),
    ballX.q.to(nearLeftWall.a, nearRightWall.a, newBallX.a, oldBallX.data, selectBallX.in0),
    ballDX.q.to(headingLeft.a, headingRight.a, dxIs1.a, newDX.in0),
    two.out.to(leftPaddleBottom.b, rightPaddleBottom.b, paddleOffset2.in1),
    leftPaddleBottom.sum.to(leftPaddleBot.b),
    leftPaddleTop.lt.to(leftAboveOrEq.in),
    leftPaddleBot.eq.to(leftBelowOrEq.a),
    leftPaddleBot.lt.to(leftBelowOrEq.b),
    leftAboveOrEq.out.to(leftPaddleMatch.a),
    leftBelowOrEq.out.to(leftPaddleMatch.b),
    nearLeftWall.eq.to(leftWallAndHeading.a),
    headingLeft.eq.to(leftWallAndHeading.b),
    leftWallAndHeading.out.to(leftBounce.a),
    leftPaddleMatch.out.to(leftBounce.b),
    wallBounceRight.out.to(nearRightWall.b),
    rightPaddleBottom.sum.to(rightPaddleBot.b),
    rightPaddleTop.lt.to(rightAboveOrEq.in),
    rightPaddleBot.eq.to(rightBelowOrEq.a),
    rightPaddleBot.lt.to(rightBelowOrEq.b),
    rightAboveOrEq.out.to(rightPaddleMatch.a),
    rightBelowOrEq.out.to(rightPaddleMatch.b),
    nearRightWall.eq.to(rightWallAndHeading.a),
    headingRight.eq.to(rightWallAndHeading.b),
    rightWallAndHeading.out.to(rightBounce.a),
    rightPaddleMatch.out.to(rightBounce.b),
    leftBounce.out.to(xBounce.a),
    rightBounce.out.to(xBounce.b),
    dxIs1.eq.to(negDX.sel),
    negDX.out.to(newDX.in1),
    xBounce.out.to(newDX.sel),
    newDX.out.to(newBallX.b, ballDX.data),
    newDY.out.to(newBallY.b, ballDY.data),
    updateEnable.out.to(shouldUpdate.a),
    isP13.eq.to(shouldUpdate.b, isOff2b.b, isDrawRight2.b),
    ballSpeedCounter.q.to(ballSpeedInc.a, ballSpeedLimit.a, isBallTick.a),
    ballSpeedOne.out.to(ballSpeedInc.b),
    ballSpeedMax.out.to(ballSpeedLimit.b),
    ballSpeedInc.sum.to(ballSpeedNext.in0),
    ballSpeedZero.out.to(ballSpeedNext.in1, isBallTick.b),
    ballSpeedLimit.eq.to(ballSpeedNext.sel),
    ballSpeedNext.out.to(ballSpeedCounter.data),
    shouldUpdate.out.to(ballSpeedCounter.we, shouldUpdateBall.a, oldLeftPaddleY.we, oldRightPaddleY.we, leftPaddleY.we, rightPaddleY.we),
    isBallTick.eq.to(shouldUpdateBall.b),
    shouldUpdateBall.out.to(oldBallX.we, oldBallY.we, ballX.we, ballY.we, ballDX.we, ballDY.we),
    newBallX.sum.to(wrappedBallX.in),
    wrappedBallX.out.to(ballX.data),
    newBallY.sum.to(wrappedBallY.in),
    wrappedBallY.out.to(ballY.data),
    newLeftPaddleY.sum.to(leftYOver.a, leftYNeg.a, leftYClamped1.in0),
    thirteen.out.to(leftYOver.b, leftYClamped1.in1, rightYOver.b, rightYClamped1.in1),
    halfRange.out.to(leftYNeg.b, rightYNeg.b),
    leftYOver.gt.to(leftYClamped1.sel),
    leftYClamped1.out.to(leftYClamped.in0),
    leftYNeg.gt.to(leftYClamped.sel),
    leftYClamped.out.to(leftPaddleY.data),
    newRightPaddleY.sum.to(rightYOver.a, rightYNeg.a, rightYClamped1.in0),
    rightYOver.gt.to(rightYClamped1.sel),
    rightYClamped1.out.to(rightYClamped.in0),
    rightYNeg.gt.to(rightYClamped.sel),
    rightYClamped.out.to(rightPaddleY.data),
    isP2.eq.to(isOff1a.a, isClearLeft.b),
    isP5.eq.to(isOff1a.b, isClearRight.b),
    isP9.eq.to(isOff1b.a, isDrawLeft.b),
    isP12.eq.to(isOff1b.b, isDrawRight.b),
    isOff1a.out.to(isOffset1.a),
    isOff1b.out.to(isOffset1.b),
    isP3.eq.to(isOff2a.a, isClearLeft2.b),
    isP6.eq.to(isOff2a.b, isClearRight2.b),
    isP10.eq.to(isOff2b.a, isDrawLeft2.b),
    isOff2a.out.to(isOffset2.a),
    isOff2b.out.to(isOffset2.b),
    isOffset1.out.to(paddleOffset.sel),
    paddleOffset.out.to(paddleOffset2.in0),
    isOffset2.out.to(paddleOffset2.sel),
    isP1.eq.to(isClearLeft.a),
    isClearLeft.out.to(isClearLeft2.a),
    isP4.eq.to(isClearRight.a),
    isClearRight.out.to(isClearRight2.a),
    isP8.eq.to(isDrawLeft.a),
    isDrawLeft.out.to(isDrawLeft2.a),
    isP11.eq.to(isDrawRight.a),
    isDrawRight.out.to(isDrawRight2.a),
    oldLeftPaddleY.q.to(basePaddleY0.in0),
    oldRightPaddleY.q.to(basePaddleY0.in1),
    isClearRight2.out.to(basePaddleY0.sel, isPaddlePhase1.b, isRightPaddle.a),
    basePaddleY0.out.to(basePaddleY1.in0),
    isDrawLeft2.out.to(basePaddleY1.sel, isPaddlePhase2.a, isLeftPaddle.b),
    basePaddleY1.out.to(basePaddleY.in0),
    isDrawRight2.out.to(basePaddleY.sel, isPaddlePhase2.b, isRightPaddle.b),
    basePaddleY.out.to(paddlePixelY.a),
    paddleOffset2.out.to(paddlePixelY.b),
    isClearLeft2.out.to(isPaddlePhase1.a, isLeftPaddle.a),
    isPaddlePhase1.out.to(isPaddlePhase.a),
    isPaddlePhase2.out.to(isPaddlePhase.b),
    oldBallY.q.to(selectBallY.in1),
    isP0.eq.to(selectBallY.sel, selectBallX.sel),
    selectBallY.out.to(selectY.in0),
    paddlePixelY.sum.to(selectY.in1),
    isPaddlePhase.out.to(selectY.sel),
    oldBallX.q.to(selectBallX.in1),
    selectBallX.out.to(selectX0.in0),
    isLeftPaddle.out.to(selectX0.sel),
    selectX0.out.to(selectX.in0),
    isRightPaddle.out.to(selectX.sel),
    selectY.out.to(yTimes16.value),
    four.out.to(yTimes16.shift),
    yTimes16.result.to(ramAddr.a),
    selectX.out.to(ramAddr.b),
    ramAddr.sum.to(ram.addrA),
    isClearPhase.lt.to(ramData.sel),
    ramData.out.to(ram.dataA),
    writeEnable.out.to(ram.weA),
  ])
  .build()
`;
