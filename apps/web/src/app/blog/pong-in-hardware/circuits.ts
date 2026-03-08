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
    displayDsl: `circuit BallPosition {
  clock clk
  impl {
    node ballX: Register(initial=4)
    node ballY: Register(initial=4)
    connect clk -> ballX.clk
    connect clk -> ballY.clk

    node dx: Input(value=1)
    node dy: Input(value=1)

    node nextX: Adder
    node nextY: Adder
    connect ballX.q -> nextX.a
    connect dx.out -> nextX.b
    connect ballY.q -> nextY.a
    connect dy.out -> nextY.b

    node wrapX: BitSlice(low=0, high=2)
    node wrapY: BitSlice(low=0, high=2)
    connect nextX.sum -> wrapX.in
    connect nextY.sum -> wrapY.in

    connect wrapX.out -> ballX.data
    connect wrapY.out -> ballY.data

    node enable: Switch
    connect enable.out -> ballX.we
    connect enable.out -> ballY.we

    node displayX: HexDisplay
    node displayY: HexDisplay
    connect ballX.q -> displayX.in
    connect ballY.q -> displayY.in
  }
}`,
    dsl: `
circuit BallPosition {
  clock clk
  impl {
    node ballX: Register(initial=4)
    node ballY: Register(initial=4)
    connect clk -> ballX.clk
    connect clk -> ballY.clk

    node dx: Input(value=1)
    node dy: Input(value=1)

    node nextX: Adder
    node nextY: Adder
    connect ballX.q -> nextX.a
    connect dx.out -> nextX.b
    connect ballY.q -> nextY.a
    connect dy.out -> nextY.b

    node wrapX: BitSlice(low=0, high=2)
    node wrapY: BitSlice(low=0, high=2)
    connect nextX.sum -> wrapX.in
    connect nextY.sum -> wrapY.in

    connect wrapX.out -> ballX.data
    connect wrapY.out -> ballY.data

    node enable: Switch
    connect enable.out -> ballX.we
    connect enable.out -> ballY.we

    node displayX: HexDisplay
    node displayY: HexDisplay
    connect ballX.q -> displayX.in
    connect ballY.q -> displayY.in
  }
}`,
  },

  bounceDetection: {
    name: "Bounce Detection",
    description:
      "Comparators check if the ball is at a screen edge (0 or 7), signaling when it needs to reverse direction.",
    nodePositions: {
      ballY: { x: 0, y: 120 },
      zero: { x: 0, y: 0 },
      seven: { x: 0, y: 240 },
      atTop: { x: 200, y: 30 },
      atBottom: { x: 200, y: 200 },
      shouldBounce: { x: 380, y: 120 },
      bounceLed: { x: 560, y: 120 },
      one: { x: 200, y: 350 },
      minus1: { x: 200, y: 450 },
      newDY: { x: 380, y: 400 },
      display: { x: 560, y: 400 },
    },
    displayDsl: `circuit BounceDetection {
  impl {
    node ballY: Input(value=7)
    node zero: Constant(value=0)
    node seven: Constant(value=7)

    node atTop: Comparator
    connect ballY.out -> atTop.a
    connect zero.out -> atTop.b

    node atBottom: Comparator
    connect ballY.out -> atBottom.a
    connect seven.out -> atBottom.b

    node shouldBounce: Or
    connect atTop.eq -> shouldBounce.a
    connect atBottom.eq -> shouldBounce.b

    node bounceLed: Led
    connect shouldBounce.out -> bounceLed.in

    node one: Constant(value=1)
    node minus1: Constant(value=255)
    node newDY: Mux
    connect one.out -> newDY.in0
    connect minus1.out -> newDY.in1
    connect atBottom.eq -> newDY.sel

    node display: HexDisplay
    connect newDY.out -> display.in
  }
}`,
    dsl: `
circuit BounceDetection {
  impl {
    node ballY: Input(value=7)
    node zero: Constant(value=0)
    node seven: Constant(value=7)

    node atTop: Comparator
    connect ballY.out -> atTop.a
    connect zero.out -> atTop.b

    node atBottom: Comparator
    connect ballY.out -> atBottom.a
    connect seven.out -> atBottom.b

    node shouldBounce: Or
    connect atTop.eq -> shouldBounce.a
    connect atBottom.eq -> shouldBounce.b

    node bounceLed: Led
    connect shouldBounce.out -> bounceLed.in

    node one: Constant(value=1)
    node minus1: Constant(value=255)
    node newDY: Mux
    connect one.out -> newDY.in0
    connect minus1.out -> newDY.in1
    connect atBottom.eq -> newDY.sel

    node display: HexDisplay
    connect newDY.out -> display.in
  }
}`,
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
    displayDsl: `circuit PaddleMovement {
  clock clk
  impl {
    node keyboard: Input(value=17)
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node minus1: Constant(value=255)
    node keyW: Constant(value=17)
    node keyS: Constant(value=31)

    node isW: Comparator
    node isS: Comparator
    connect keyboard.out -> isW.a
    connect keyW.out -> isW.b
    connect keyboard.out -> isS.a
    connect keyS.out -> isS.b

    node upDelta: Mux
    connect zero.out -> upDelta.in0
    connect minus1.out -> upDelta.in1
    connect isW.eq -> upDelta.sel

    node delta: Mux
    connect upDelta.out -> delta.in0
    connect one.out -> delta.in1
    connect isS.eq -> delta.sel

    node paddleY: Register(initial=3)
    connect clk -> paddleY.clk

    node newY: Adder
    connect paddleY.q -> newY.a
    connect delta.out -> newY.b

    node wrapY: BitSlice(low=0, high=2)
    connect newY.sum -> wrapY.in
    connect wrapY.out -> paddleY.data

    node enable: Switch
    connect enable.out -> paddleY.we

    node display: HexDisplay
    connect paddleY.q -> display.in

    node deltaDisplay: HexDisplay
    connect delta.out -> deltaDisplay.in
  }
}`,
    dsl: `
circuit PaddleMovement {
  clock clk
  impl {
    node keyboard: Input(value=17)
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node minus1: Constant(value=255)
    node keyW: Constant(value=17)
    node keyS: Constant(value=31)

    node isW: Comparator
    node isS: Comparator
    connect keyboard.out -> isW.a
    connect keyW.out -> isW.b
    connect keyboard.out -> isS.a
    connect keyS.out -> isS.b

    node upDelta: Mux
    connect zero.out -> upDelta.in0
    connect minus1.out -> upDelta.in1
    connect isW.eq -> upDelta.sel

    node delta: Mux
    connect upDelta.out -> delta.in0
    connect one.out -> delta.in1
    connect isS.eq -> delta.sel

    node paddleY: Register(initial=3)
    connect clk -> paddleY.clk

    node newY: Adder
    connect paddleY.q -> newY.a
    connect delta.out -> newY.b

    node wrapY: BitSlice(low=0, high=2)
    connect newY.sum -> wrapY.in
    connect wrapY.out -> paddleY.data

    node enable: Switch
    connect enable.out -> paddleY.we

    node display: HexDisplay
    connect paddleY.q -> display.in

    node deltaDisplay: HexDisplay
    connect delta.out -> deltaDisplay.in
  }
}`,
  },

  phaseCounter: {
    name: "6-Phase Rendering Pipeline",
    description:
      "A counter cycles 0-5, orchestrating: clear old ball, clear old left paddle, clear old right paddle, draw new ball, draw new left paddle, draw new right paddle.",
    nodePositions: {
      enable: { x: 0, y: 100 },
      one: { x: 0, y: 250 },
      zero: { x: 200, y: 350 },
      six: { x: 200, y: 250 },
      phase: { x: 200, y: 100 },
      phaseInc: { x: 370, y: 100 },
      atSix: { x: 370, y: 250 },
      nextPhase: { x: 530, y: 180 },
      display: { x: 700, y: 100 },
      two: { x: 370, y: 400 },
      isDrawPhase: { x: 530, y: 400 },
      drawLed: { x: 700, y: 400 },
    },
    displayDsl: `circuit PhaseCounter6 {
  clock clk
  impl {
    node phase: Register(initial=0)
    connect clk -> phase.clk

    node one: Constant(value=1)
    node zero: Constant(value=0)
    node six: Constant(value=6)

    node phaseInc: Adder
    connect phase.q -> phaseInc.a
    connect one.out -> phaseInc.b

    node atSix: Comparator
    connect phaseInc.sum -> atSix.a
    connect six.out -> atSix.b

    node nextPhase: Mux
    connect phaseInc.sum -> nextPhase.in0
    connect zero.out -> nextPhase.in1
    connect atSix.eq -> nextPhase.sel

    connect nextPhase.out -> phase.data

    node enable: Switch
    connect enable.out -> phase.we

    node display: HexDisplay
    connect phase.q -> display.in

    node two: Constant(value=2)
    node isDrawPhase: Comparator
    connect phase.q -> isDrawPhase.a
    connect two.out -> isDrawPhase.b

    node drawLed: Led
    connect isDrawPhase.gt -> drawLed.in
  }
}`,
    dsl: `
circuit PhaseCounter6 {
  clock clk
  impl {
    node phase: Register(initial=0)
    connect clk -> phase.clk

    node one: Constant(value=1)
    node zero: Constant(value=0)
    node six: Constant(value=6)

    node phaseInc: Adder
    connect phase.q -> phaseInc.a
    connect one.out -> phaseInc.b

    node atSix: Comparator
    connect phaseInc.sum -> atSix.a
    connect six.out -> atSix.b

    node nextPhase: Mux
    connect phaseInc.sum -> nextPhase.in0
    connect zero.out -> nextPhase.in1
    connect atSix.eq -> nextPhase.sel

    connect nextPhase.out -> phase.data

    node enable: Switch
    connect enable.out -> phase.we

    node display: HexDisplay
    connect phase.q -> display.in

    node two: Constant(value=2)
    node isDrawPhase: Comparator
    connect phase.q -> isDrawPhase.a
    connect two.out -> isDrawPhase.b

    node drawLed: Led
    connect isDrawPhase.gt -> drawLed.in
  }
}`,
  },

  pixelAddress: {
    name: "Pixel Address Calculation",
    description:
      "Converts (X, Y) coordinates to a linear framebuffer address using (Y << 3) + X. In real hardware a left shift by 3 is just wiring — each bit of Y connects to a position 3 places higher — so the only real gate is the final adder.",
    nodePositions: {
      x: { x: 0, y: 120 },
      y: { x: 0, y: 0 },
      three: { x: 0, y: 240 },
      y8: { x: 220, y: 60 },
      addr: { x: 420, y: 90 },
      result: { x: 600, y: 90 },
    },
    displayDsl: `circuit PixelAddress {
  impl {
    node x: Input(value=3)
    node y: Input(value=4)
    node three: Input(value=3)

    node y8: LeftShifter
    connect y.out -> y8.value
    connect three.out -> y8.shift

    node addr: Adder
    connect y8.result -> addr.a
    connect x.out -> addr.b

    node result: HexDisplay
    connect addr.sum -> result.in
  }
}`,
    dsl: `
circuit PixelAddress {
  impl {
    node x: Input(value=3)
    node y: Input(value=4)
    node three: Input(value=3)

    node y8: LeftShifter
    connect y.out -> y8.value
    connect three.out -> y8.shift

    node addr: Adder
    connect y8.result -> addr.a
    connect x.out -> addr.b

    node result: HexDisplay
    connect addr.sum -> result.in
  }
}`,
  },
};

/**
 * Full PongSimple DSL — a complete Pong game on an 8x8 screen.
 * Two paddles (W/S and Up/Down), a bouncing ball, 6-phase rendering pipeline.
 *
 * Key additions over the raw PongSimple.dsl:
 * - Register initial values (ball starts at center, velocity = diagonal)
 * - Y-axis bounce detection (flip DY at top/bottom walls)
 * - X-axis bounce detection (flip DX at left/right walls)
 * - BitSlice wrapping for paddle positions
 * - All Input "constants" have value= so the circuit is self-contained
 */
export const PONG_DSL = `
circuit PongSimple {
  impl {
    // ===== SCREEN =====
    node ram: DualPortRAM
    node screen: Screen
    connect screen.addrB -> ram.addrB
    connect ram.outB -> screen.dataIn

    // ===== KEYBOARD (two registers for multi-key polling) =====
    node keyboard0: Input
    node keyboard1: Input

    // ===== GAME STATE REGISTERS =====
    node ballX: Register(initial=4)
    node ballY: Register(initial=4)
    node ballDX: Register(initial=1)
    node ballDY: Register(initial=1)
    node leftPaddleY: Register(initial=3)
    node rightPaddleY: Register(initial=3)

    // Old positions (for clearing previous frame)
    node oldBallX: Register(initial=4)
    node oldBallY: Register(initial=4)
    node oldLeftPaddleY: Register(initial=3)
    node oldRightPaddleY: Register(initial=3)

    // ===== PHASE COUNTER (0-5) =====
    node phaseCounter: Register
    node phaseIncrement: Adder
    connect phaseCounter.q -> phaseIncrement.a
    node one: Input(value=1)
    connect one.out -> phaseIncrement.b

    node phaseMod: Comparator
    node six: Input(value=6)
    connect phaseIncrement.sum -> phaseMod.a
    connect six.out -> phaseMod.b

    node nextPhase: Mux
    connect phaseIncrement.sum -> nextPhase.in0
    node zero: Input(value=0)
    connect zero.out -> nextPhase.in1
    connect phaseMod.eq -> nextPhase.sel

    connect nextPhase.out -> phaseCounter.data
    node phaseEnable: Switch
    connect phaseEnable.out -> phaseCounter.we

    // ===== PHASE DETECTION =====
    node phase0Const: Input(value=0)
    node phase1Const: Input(value=1)
    node phase2Const: Input(value=2)
    node phase3Const: Input(value=3)
    node phase4Const: Input(value=4)
    node phase5Const: Input(value=5)

    node isPhase0: Comparator
    node isPhase1: Comparator
    node isPhase2: Comparator
    node isPhase3: Comparator
    node isPhase4: Comparator
    node isPhase5: Comparator

    connect phaseCounter.q -> isPhase0.a
    connect phase0Const.out -> isPhase0.b
    connect phaseCounter.q -> isPhase1.a
    connect phase1Const.out -> isPhase1.b
    connect phaseCounter.q -> isPhase2.a
    connect phase2Const.out -> isPhase2.b
    connect phaseCounter.q -> isPhase3.a
    connect phase3Const.out -> isPhase3.b
    connect phaseCounter.q -> isPhase4.a
    connect phase4Const.out -> isPhase4.b
    connect phaseCounter.q -> isPhase5.a
    connect phase5Const.out -> isPhase5.b

    // ===== CONSTANTS =====
    node seven: Input(value=7)
    node minus1: Input(value=255)

    // ===== KEYBOARD SCAN CODES =====
    node keyW: Input(value=17)
    node keyS: Input(value=31)
    node keyUp: Input(value=72)
    node keyDown: Input(value=80)

    // ===== KEYBOARD DETECTION (poll both registers via OR) =====
    node isW_kb0: Comparator
    node isS_kb0: Comparator
    node isUp_kb0: Comparator
    node isDown_kb0: Comparator

    connect keyboard0.out -> isW_kb0.a
    connect keyW.out -> isW_kb0.b
    connect keyboard0.out -> isS_kb0.a
    connect keyS.out -> isS_kb0.b
    connect keyboard0.out -> isUp_kb0.a
    connect keyUp.out -> isUp_kb0.b
    connect keyboard0.out -> isDown_kb0.a
    connect keyDown.out -> isDown_kb0.b

    node isW_kb1: Comparator
    node isS_kb1: Comparator
    node isUp_kb1: Comparator
    node isDown_kb1: Comparator

    connect keyboard1.out -> isW_kb1.a
    connect keyW.out -> isW_kb1.b
    connect keyboard1.out -> isS_kb1.a
    connect keyS.out -> isS_kb1.b
    connect keyboard1.out -> isUp_kb1.a
    connect keyUp.out -> isUp_kb1.b
    connect keyboard1.out -> isDown_kb1.a
    connect keyDown.out -> isDown_kb1.b

    node isW: Or
    node isS: Or
    node isUp: Or
    node isDown: Or

    connect isW_kb0.eq -> isW.a
    connect isW_kb1.eq -> isW.b
    connect isS_kb0.eq -> isS.a
    connect isS_kb1.eq -> isS.b
    connect isUp_kb0.eq -> isUp.a
    connect isUp_kb1.eq -> isUp.b
    connect isDown_kb0.eq -> isDown.a
    connect isDown_kb1.eq -> isDown.b

    // ===== PADDLE MOVEMENT =====
    node leftUpDelta: Mux
    connect zero.out -> leftUpDelta.in0
    connect minus1.out -> leftUpDelta.in1
    connect isW.out -> leftUpDelta.sel

    node leftDelta: Mux
    connect leftUpDelta.out -> leftDelta.in0
    connect one.out -> leftDelta.in1
    connect isS.out -> leftDelta.sel

    node newLeftPaddleY: Adder
    connect leftPaddleY.q -> newLeftPaddleY.a
    connect leftDelta.out -> newLeftPaddleY.b

    node rightUpDelta: Mux
    connect zero.out -> rightUpDelta.in0
    connect minus1.out -> rightUpDelta.in1
    connect isUp.out -> rightUpDelta.sel

    node rightDelta: Mux
    connect rightUpDelta.out -> rightDelta.in0
    connect one.out -> rightDelta.in1
    connect isDown.out -> rightDelta.sel

    node newRightPaddleY: Adder
    connect rightPaddleY.q -> newRightPaddleY.a
    connect rightDelta.out -> newRightPaddleY.b

    // ===== BOUNCE DETECTION =====
    // Y-axis: bounce when at top wall (y=0, heading up) or bottom (y=7, heading down)
    node atTopWall: Comparator
    connect ballY.q -> atTopWall.a
    connect zero.out -> atTopWall.b

    node atBottomWall: Comparator
    connect ballY.q -> atBottomWall.a
    connect seven.out -> atBottomWall.b

    node headingUp: Comparator
    connect ballDY.q -> headingUp.a
    connect minus1.out -> headingUp.b

    node headingDown: Comparator
    connect ballDY.q -> headingDown.a
    connect one.out -> headingDown.b

    node topBounce: And
    connect atTopWall.eq -> topBounce.a
    connect headingUp.eq -> topBounce.b

    node bottomBounce: And
    connect atBottomWall.eq -> bottomBounce.a
    connect headingDown.eq -> bottomBounce.b

    node yBounce: Or
    connect topBounce.out -> yBounce.a
    connect bottomBounce.out -> yBounce.b

    // Flip DY: if current is 1 -> 255, if current is 255 -> 1
    node dyIs1: Comparator
    connect ballDY.q -> dyIs1.a
    connect one.out -> dyIs1.b

    node negDY: Mux
    connect one.out -> negDY.in0
    connect minus1.out -> negDY.in1
    connect dyIs1.eq -> negDY.sel

    node newDY: Mux
    connect ballDY.q -> newDY.in0
    connect negDY.out -> newDY.in1
    connect yBounce.out -> newDY.sel

    // X-axis: bounce only when paddle is at the same Y as the ball
    // Left paddle collision: ball at x=0, heading left, AND leftPaddleY == ballY
    node atLeftWall: Comparator
    connect ballX.q -> atLeftWall.a
    connect zero.out -> atLeftWall.b

    node headingLeft: Comparator
    connect ballDX.q -> headingLeft.a
    connect minus1.out -> headingLeft.b

    node leftPaddleMatch: Comparator
    connect leftPaddleY.q -> leftPaddleMatch.a
    connect ballY.q -> leftPaddleMatch.b

    node leftWallAndHeading: And
    connect atLeftWall.eq -> leftWallAndHeading.a
    connect headingLeft.eq -> leftWallAndHeading.b

    node leftBounce: And
    connect leftWallAndHeading.out -> leftBounce.a
    connect leftPaddleMatch.eq -> leftBounce.b

    // Right paddle collision: ball at x=7, heading right, AND rightPaddleY == ballY
    node atRightWall: Comparator
    connect ballX.q -> atRightWall.a
    connect seven.out -> atRightWall.b

    node headingRight: Comparator
    connect ballDX.q -> headingRight.a
    connect one.out -> headingRight.b

    node rightPaddleMatch: Comparator
    connect rightPaddleY.q -> rightPaddleMatch.a
    connect ballY.q -> rightPaddleMatch.b

    node rightWallAndHeading: And
    connect atRightWall.eq -> rightWallAndHeading.a
    connect headingRight.eq -> rightWallAndHeading.b

    node rightBounce: And
    connect rightWallAndHeading.out -> rightBounce.a
    connect rightPaddleMatch.eq -> rightBounce.b

    node xBounce: Or
    connect leftBounce.out -> xBounce.a
    connect rightBounce.out -> xBounce.b

    // Flip DX: if current is 1 -> 255, if current is 255 -> 1
    node dxIs1: Comparator
    connect ballDX.q -> dxIs1.a
    connect one.out -> dxIs1.b

    node negDX: Mux
    connect one.out -> negDX.in0
    connect minus1.out -> negDX.in1
    connect dxIs1.eq -> negDX.sel

    node newDX: Mux
    connect ballDX.q -> newDX.in0
    connect negDX.out -> newDX.in1
    connect xBounce.out -> newDX.sel

    // ===== BALL MOVEMENT (uses bounced velocity) =====
    node newBallX: Adder
    connect ballX.q -> newBallX.a
    connect newDX.out -> newBallX.b

    node newBallY: Adder
    connect ballY.q -> newBallY.a
    connect newDY.out -> newBallY.b

    // ===== UPDATE GAME STATE (phase 5 only) =====
    node updateEnable: Switch
    node shouldUpdate: And
    connect updateEnable.out -> shouldUpdate.a
    connect isPhase5.eq -> shouldUpdate.b

    // Save old positions before update
    connect ballX.q -> oldBallX.data
    connect ballY.q -> oldBallY.data
    connect leftPaddleY.q -> oldLeftPaddleY.data
    connect rightPaddleY.q -> oldRightPaddleY.data

    connect shouldUpdate.out -> oldBallX.we
    connect shouldUpdate.out -> oldBallY.we
    connect shouldUpdate.out -> oldLeftPaddleY.we
    connect shouldUpdate.out -> oldRightPaddleY.we

    // Update ball position (wrapped to 0-7) and velocity
    node wrappedBallX: BitSlice(low=0, high=2)
    connect newBallX.sum -> wrappedBallX.in
    connect wrappedBallX.out -> ballX.data

    node wrappedBallY: BitSlice(low=0, high=2)
    connect newBallY.sum -> wrappedBallY.in
    connect wrappedBallY.out -> ballY.data

    connect newDX.out -> ballDX.data
    connect newDY.out -> ballDY.data

    // Wrap paddle positions to 0-7 range
    node wrappedLeftY: BitSlice(low=0, high=2)
    connect newLeftPaddleY.sum -> wrappedLeftY.in
    connect wrappedLeftY.out -> leftPaddleY.data

    node wrappedRightY: BitSlice(low=0, high=2)
    connect newRightPaddleY.sum -> wrappedRightY.in
    connect wrappedRightY.out -> rightPaddleY.data

    connect shouldUpdate.out -> ballX.we
    connect shouldUpdate.out -> ballY.we
    connect shouldUpdate.out -> ballDX.we
    connect shouldUpdate.out -> ballDY.we
    connect shouldUpdate.out -> leftPaddleY.we
    connect shouldUpdate.out -> rightPaddleY.we

    // ===== RENDERING: SELECT Y COORDINATE BY PHASE =====
    node yMux0: Mux
    connect oldBallY.q -> yMux0.in0
    connect oldLeftPaddleY.q -> yMux0.in1
    connect isPhase1.eq -> yMux0.sel

    node yMux1: Mux
    connect yMux0.out -> yMux1.in0
    connect oldRightPaddleY.q -> yMux1.in1
    connect isPhase2.eq -> yMux1.sel

    node yMux2: Mux
    connect yMux1.out -> yMux2.in0
    connect ballY.q -> yMux2.in1
    connect isPhase3.eq -> yMux2.sel

    node yMux3: Mux
    connect yMux2.out -> yMux3.in0
    connect leftPaddleY.q -> yMux3.in1
    connect isPhase4.eq -> yMux3.sel

    node selectY: Mux
    connect yMux3.out -> selectY.in0
    connect rightPaddleY.q -> selectY.in1
    connect isPhase5.eq -> selectY.sel

    // ===== RENDERING: SELECT X COORDINATE BY PHASE =====
    node xMux0: Mux
    connect oldBallX.q -> xMux0.in0
    connect zero.out -> xMux0.in1
    connect isPhase1.eq -> xMux0.sel

    node xMux1: Mux
    connect xMux0.out -> xMux1.in0
    connect seven.out -> xMux1.in1
    connect isPhase2.eq -> xMux1.sel

    node xMux2: Mux
    connect xMux1.out -> xMux2.in0
    connect ballX.q -> xMux2.in1
    connect isPhase3.eq -> xMux2.sel

    node xMux3: Mux
    connect xMux2.out -> xMux3.in0
    connect zero.out -> xMux3.in1
    connect isPhase4.eq -> xMux3.sel

    node selectX: Mux
    connect xMux3.out -> selectX.in0
    connect seven.out -> selectX.in1
    connect isPhase5.eq -> selectX.sel

    // ===== ADDRESS CALCULATION: (Y << 3) + X =====
    // In real hardware, a left shift by 3 is just wiring (zero gates).
    node three: Input(value=3)
    node yTimes8: LeftShifter
    connect selectY.out -> yTimes8.value
    connect three.out -> yTimes8.shift

    node ramAddr: Adder
    connect yTimes8.result -> ramAddr.a
    connect selectX.out -> ramAddr.b

    connect ramAddr.sum -> ram.addrA

    // ===== CLEAR/DRAW DATA =====
    // Phases 0-2: clear (write 0), Phases 3-5: draw (write 1)
    node isClearPhase: Or
    node isClearPhase2: Or
    connect isPhase0.eq -> isClearPhase.a
    connect isPhase1.eq -> isClearPhase.b
    connect isClearPhase.out -> isClearPhase2.a
    connect isPhase2.eq -> isClearPhase2.b

    node ramData: Mux
    connect one.out -> ramData.in0
    connect zero.out -> ramData.in1
    connect isClearPhase2.out -> ramData.sel

    connect ramData.out -> ram.dataA

    node writeEnable: Switch
    connect writeEnable.out -> ram.weA
  }
}
`;
