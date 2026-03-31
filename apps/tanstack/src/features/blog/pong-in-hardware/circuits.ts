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
    // ===== SCREEN (16x16) =====
    node ram: DualPortRAM
    node screen: Screen(width=16, height=16)
    connect screen.addrB -> ram.addrB
    connect ram.outB -> screen.dataIn

    // ===== KEYBOARD (two registers for multi-key polling) =====
    node keyboard0: Input
    node keyboard1: Input

    // ===== GAME STATE REGISTERS =====
    node ballX: Register(initial=8)
    node ballY: Register(initial=8)
    node ballDX: Register(initial=1)
    node ballDY: Register(initial=1)
    node leftPaddleY: Register(initial=6)
    node rightPaddleY: Register(initial=6)

    // Old positions (for clearing previous frame)
    node oldBallX: Register(initial=8)
    node oldBallY: Register(initial=8)
    node oldLeftPaddleY: Register(initial=6)
    node oldRightPaddleY: Register(initial=6)


    // ===== PHASE COUNTER (0-13) =====
    // 14 phases for 3-pixel-tall paddles:
    // P0: clear old ball  P1-3: clear old left paddle  P4-6: clear old right paddle
    // P7: draw new ball   P8-10: draw new left paddle  P11-13: draw new right paddle
    node phaseCounter: Register
    node phaseIncrement: Adder
    connect phaseCounter.q -> phaseIncrement.a
    node one: Input(value=1)
    connect one.out -> phaseIncrement.b

    node phaseMod: Comparator
    node fourteen: Input(value=14)
    connect phaseIncrement.sum -> phaseMod.a
    connect fourteen.out -> phaseMod.b

    node nextPhase: Mux(width=8)
    connect phaseIncrement.sum -> nextPhase.in0
    node zero: Input(value=0)
    connect zero.out -> nextPhase.in1
    connect phaseMod.eq -> nextPhase.sel

    connect nextPhase.out -> phaseCounter.data
    node phaseEnable: Switch
    connect phaseEnable.out -> phaseCounter.we

    // ===== PHASE DETECTION =====
    node p0c: Input(value=0)
    node p1c: Input(value=1)
    node p2c: Input(value=2)
    node p3c: Input(value=3)
    node p4c: Input(value=4)
    node p5c: Input(value=5)
    node p6c: Input(value=6)
    node p7c: Input(value=7)
    node p8c: Input(value=8)
    node p9c: Input(value=9)
    node p10c: Input(value=10)
    node p11c: Input(value=11)
    node p12c: Input(value=12)
    node p13c: Input(value=13)

    node isP0: Comparator
    node isP1: Comparator
    node isP2: Comparator
    node isP3: Comparator
    node isP4: Comparator
    node isP5: Comparator
    node isP6: Comparator
    node isP7: Comparator
    node isP8: Comparator
    node isP9: Comparator
    node isP10: Comparator
    node isP11: Comparator
    node isP12: Comparator
    node isP13: Comparator

    connect phaseCounter.q -> isP0.a
    connect p0c.out -> isP0.b
    connect phaseCounter.q -> isP1.a
    connect p1c.out -> isP1.b
    connect phaseCounter.q -> isP2.a
    connect p2c.out -> isP2.b
    connect phaseCounter.q -> isP3.a
    connect p3c.out -> isP3.b
    connect phaseCounter.q -> isP4.a
    connect p4c.out -> isP4.b
    connect phaseCounter.q -> isP5.a
    connect p5c.out -> isP5.b
    connect phaseCounter.q -> isP6.a
    connect p6c.out -> isP6.b
    connect phaseCounter.q -> isP7.a
    connect p7c.out -> isP7.b
    connect phaseCounter.q -> isP8.a
    connect p8c.out -> isP8.b
    connect phaseCounter.q -> isP9.a
    connect p9c.out -> isP9.b
    connect phaseCounter.q -> isP10.a
    connect p10c.out -> isP10.b
    connect phaseCounter.q -> isP11.a
    connect p11c.out -> isP11.b
    connect phaseCounter.q -> isP12.a
    connect p12c.out -> isP12.b
    connect phaseCounter.q -> isP13.a
    connect p13c.out -> isP13.b

    // ===== CONSTANTS =====
    node fifteen: Input(value=15)
    node thirteen: Input(value=13)
    node six: Input(value=6)
    node two: Input(value=2)
    node four: Input(value=4)
    node minus1: Input(value=255)
    node halfRange: Input(value=128)

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
    node leftUpDelta: Mux(width=8)
    connect zero.out -> leftUpDelta.in0
    connect minus1.out -> leftUpDelta.in1
    connect isW.out -> leftUpDelta.sel

    node leftDelta: Mux(width=8)
    connect leftUpDelta.out -> leftDelta.in0
    connect one.out -> leftDelta.in1
    connect isS.out -> leftDelta.sel

    node newLeftPaddleY: Adder
    connect leftPaddleY.q -> newLeftPaddleY.a
    connect leftDelta.out -> newLeftPaddleY.b

    node rightUpDelta: Mux(width=8)
    connect zero.out -> rightUpDelta.in0
    connect minus1.out -> rightUpDelta.in1
    connect isUp.out -> rightUpDelta.sel

    node rightDelta: Mux(width=8)
    connect rightUpDelta.out -> rightDelta.in0
    connect one.out -> rightDelta.in1
    connect isDown.out -> rightDelta.sel

    node newRightPaddleY: Adder
    connect rightPaddleY.q -> newRightPaddleY.a
    connect rightDelta.out -> newRightPaddleY.b

    // ===== BOUNCE DETECTION =====
    // Y-axis: bounce at top wall (y=0 heading up) or bottom (y=7 heading down)
    node atTopWall: Comparator
    connect ballY.q -> atTopWall.a
    connect zero.out -> atTopWall.b

    node atBottomWall: Comparator
    connect ballY.q -> atBottomWall.a
    connect fifteen.out -> atBottomWall.b

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

    node dyIs1: Comparator
    connect ballDY.q -> dyIs1.a
    connect one.out -> dyIs1.b

    node negDY: Mux(width=8)
    connect one.out -> negDY.in0
    connect minus1.out -> negDY.in1
    connect dyIs1.eq -> negDY.sel

    node newDY: Mux(width=8)
    connect ballDY.q -> newDY.in0
    connect negDY.out -> newDY.in1
    connect yBounce.out -> newDY.sel

    // X-axis: bounce when approaching paddle (x=1 heading left, x=6 heading right)
    // Ball bounces BEFORE entering the paddle column, not while overlapping it.
    // Left paddle: ball at x=1, heading left, ballY in [paddleY, paddleY+2]
    node nearLeftWall: Comparator
    connect ballX.q -> nearLeftWall.a
    connect one.out -> nearLeftWall.b

    node headingLeft: Comparator
    connect ballDX.q -> headingLeft.a
    connect minus1.out -> headingLeft.b

    node leftPaddleTop: Comparator
    connect ballY.q -> leftPaddleTop.a
    connect leftPaddleY.q -> leftPaddleTop.b

    node leftPaddleBottom: Adder
    connect leftPaddleY.q -> leftPaddleBottom.a
    connect two.out -> leftPaddleBottom.b

    node leftPaddleBot: Comparator
    connect ballY.q -> leftPaddleBot.a
    connect leftPaddleBottom.sum -> leftPaddleBot.b

    node leftAboveOrEq: Not
    connect leftPaddleTop.lt -> leftAboveOrEq.in

    node leftBelowOrEq: Or
    connect leftPaddleBot.eq -> leftBelowOrEq.a
    connect leftPaddleBot.lt -> leftBelowOrEq.b

    node leftPaddleMatch: And
    connect leftAboveOrEq.out -> leftPaddleMatch.a
    connect leftBelowOrEq.out -> leftPaddleMatch.b

    node leftWallAndHeading: And
    connect nearLeftWall.eq -> leftWallAndHeading.a
    connect headingLeft.eq -> leftWallAndHeading.b

    node leftBounce: And
    connect leftWallAndHeading.out -> leftBounce.a
    connect leftPaddleMatch.out -> leftBounce.b

    // Right paddle: ball at x=14, heading right, ballY in [paddleY, paddleY+2]
    node nearRightWall: Comparator
    node wallBounceRight: Input(value=14)
    connect ballX.q -> nearRightWall.a
    connect wallBounceRight.out -> nearRightWall.b

    node headingRight: Comparator
    connect ballDX.q -> headingRight.a
    connect one.out -> headingRight.b

    node rightPaddleTop: Comparator
    connect ballY.q -> rightPaddleTop.a
    connect rightPaddleY.q -> rightPaddleTop.b

    node rightPaddleBottom: Adder
    connect rightPaddleY.q -> rightPaddleBottom.a
    connect two.out -> rightPaddleBottom.b

    node rightPaddleBot: Comparator
    connect ballY.q -> rightPaddleBot.a
    connect rightPaddleBottom.sum -> rightPaddleBot.b

    node rightAboveOrEq: Not
    connect rightPaddleTop.lt -> rightAboveOrEq.in

    node rightBelowOrEq: Or
    connect rightPaddleBot.eq -> rightBelowOrEq.a
    connect rightPaddleBot.lt -> rightBelowOrEq.b

    node rightPaddleMatch: And
    connect rightAboveOrEq.out -> rightPaddleMatch.a
    connect rightBelowOrEq.out -> rightPaddleMatch.b

    node rightWallAndHeading: And
    connect nearRightWall.eq -> rightWallAndHeading.a
    connect headingRight.eq -> rightWallAndHeading.b

    node rightBounce: And
    connect rightWallAndHeading.out -> rightBounce.a
    connect rightPaddleMatch.out -> rightBounce.b

    node xBounce: Or
    connect leftBounce.out -> xBounce.a
    connect rightBounce.out -> xBounce.b

    node dxIs1: Comparator
    connect ballDX.q -> dxIs1.a
    connect one.out -> dxIs1.b

    node negDX: Mux(width=8)
    connect one.out -> negDX.in0
    connect minus1.out -> negDX.in1
    connect dxIs1.eq -> negDX.sel

    node newDX: Mux(width=8)
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

    // ===== UPDATE GAME STATE (phase 13 — last phase) =====
    node updateEnable: Switch
    node shouldUpdate: And
    connect updateEnable.out -> shouldUpdate.a
    connect isP13.eq -> shouldUpdate.b

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
    node wrappedBallX: BitSlice(low=0, high=3)
    connect newBallX.sum -> wrappedBallX.in
    connect wrappedBallX.out -> ballX.data

    node wrappedBallY: BitSlice(low=0, high=3)
    connect newBallY.sum -> wrappedBallY.in
    connect wrappedBallY.out -> ballY.data

    connect newDX.out -> ballDX.data
    connect newDY.out -> ballDY.data

    // Clamp paddle Y to 0-5 (3-tall paddle on 8-pixel screen)
    // Negative wrap (>128) -> 0, Over 5 -> 5, else use value
    node leftYOver: Comparator
    connect newLeftPaddleY.sum -> leftYOver.a
    connect thirteen.out -> leftYOver.b

    node leftYNeg: Comparator
    connect newLeftPaddleY.sum -> leftYNeg.a
    connect halfRange.out -> leftYNeg.b

    node leftYClamped1: Mux(width=8)
    connect newLeftPaddleY.sum -> leftYClamped1.in0
    connect thirteen.out -> leftYClamped1.in1
    connect leftYOver.gt -> leftYClamped1.sel

    node leftYClamped: Mux(width=8)
    connect leftYClamped1.out -> leftYClamped.in0
    connect zero.out -> leftYClamped.in1
    connect leftYNeg.gt -> leftYClamped.sel

    connect leftYClamped.out -> leftPaddleY.data

    node rightYOver: Comparator
    connect newRightPaddleY.sum -> rightYOver.a
    connect thirteen.out -> rightYOver.b

    node rightYNeg: Comparator
    connect newRightPaddleY.sum -> rightYNeg.a
    connect halfRange.out -> rightYNeg.b

    node rightYClamped1: Mux(width=8)
    connect newRightPaddleY.sum -> rightYClamped1.in0
    connect thirteen.out -> rightYClamped1.in1
    connect rightYOver.gt -> rightYClamped1.sel

    node rightYClamped: Mux(width=8)
    connect rightYClamped1.out -> rightYClamped.in0
    connect zero.out -> rightYClamped.in1
    connect rightYNeg.gt -> rightYClamped.sel

    connect rightYClamped.out -> rightPaddleY.data

    connect shouldUpdate.out -> ballX.we
    connect shouldUpdate.out -> ballY.we
    connect shouldUpdate.out -> ballDX.we
    connect shouldUpdate.out -> ballDY.we
    connect shouldUpdate.out -> leftPaddleY.we
    connect shouldUpdate.out -> rightPaddleY.we

    // ===== PADDLE Y OFFSETS FOR 3-PIXEL RENDERING =====
    // Within each paddle group, phases offset by 0, 1, 2
    // P1/P4/P8/P11 -> 0, P2/P5/P9/P12 -> 1, P3/P6/P10/P13 -> 2
    node isOff1a: Or
    connect isP2.eq -> isOff1a.a
    connect isP5.eq -> isOff1a.b
    node isOff1b: Or
    connect isP9.eq -> isOff1b.a
    connect isP12.eq -> isOff1b.b
    node isOffset1: Or
    connect isOff1a.out -> isOffset1.a
    connect isOff1b.out -> isOffset1.b

    node isOff2a: Or
    connect isP3.eq -> isOff2a.a
    connect isP6.eq -> isOff2a.b
    node isOff2b: Or
    connect isP10.eq -> isOff2b.a
    connect isP13.eq -> isOff2b.b
    node isOffset2: Or
    connect isOff2a.out -> isOffset2.a
    connect isOff2b.out -> isOffset2.b

    node paddleOffset: Mux(width=8)
    connect zero.out -> paddleOffset.in0
    connect one.out -> paddleOffset.in1
    connect isOffset1.out -> paddleOffset.sel

    node paddleOffset2: Mux(width=8)
    connect paddleOffset.out -> paddleOffset2.in0
    connect two.out -> paddleOffset2.in1
    connect isOffset2.out -> paddleOffset2.sel

    // ===== RENDERING: PHASE GROUP DETECTION =====
    node isClearLeft: Or
    connect isP1.eq -> isClearLeft.a
    connect isP2.eq -> isClearLeft.b
    node isClearLeft2: Or
    connect isClearLeft.out -> isClearLeft2.a
    connect isP3.eq -> isClearLeft2.b

    node isClearRight: Or
    connect isP4.eq -> isClearRight.a
    connect isP5.eq -> isClearRight.b
    node isClearRight2: Or
    connect isClearRight.out -> isClearRight2.a
    connect isP6.eq -> isClearRight2.b

    node isDrawLeft: Or
    connect isP8.eq -> isDrawLeft.a
    connect isP9.eq -> isDrawLeft.b
    node isDrawLeft2: Or
    connect isDrawLeft.out -> isDrawLeft2.a
    connect isP10.eq -> isDrawLeft2.b

    node isDrawRight: Or
    connect isP11.eq -> isDrawRight.a
    connect isP12.eq -> isDrawRight.b
    node isDrawRight2: Or
    connect isDrawRight.out -> isDrawRight2.a
    connect isP13.eq -> isDrawRight2.b

    // ===== RENDERING: SELECT Y COORDINATE =====
    // Paddle base Y depends on phase group
    node basePaddleY0: Mux(width=8)
    connect oldLeftPaddleY.q -> basePaddleY0.in0
    connect oldRightPaddleY.q -> basePaddleY0.in1
    connect isClearRight2.out -> basePaddleY0.sel

    node basePaddleY1: Mux(width=8)
    connect basePaddleY0.out -> basePaddleY1.in0
    connect leftPaddleY.q -> basePaddleY1.in1
    connect isDrawLeft2.out -> basePaddleY1.sel

    node basePaddleY: Mux(width=8)
    connect basePaddleY1.out -> basePaddleY.in0
    connect rightPaddleY.q -> basePaddleY.in1
    connect isDrawRight2.out -> basePaddleY.sel

    // paddlePixelY = basePaddleY + offset (0, 1, or 2)
    node paddlePixelY: Adder
    connect basePaddleY.out -> paddlePixelY.a
    connect paddleOffset2.out -> paddlePixelY.b

    // Is this a paddle phase?
    node isPaddlePhase1: Or
    connect isClearLeft2.out -> isPaddlePhase1.a
    connect isClearRight2.out -> isPaddlePhase1.b
    node isPaddlePhase2: Or
    connect isDrawLeft2.out -> isPaddlePhase2.a
    connect isDrawRight2.out -> isPaddlePhase2.b
    node isPaddlePhase: Or
    connect isPaddlePhase1.out -> isPaddlePhase.a
    connect isPaddlePhase2.out -> isPaddlePhase.b

    // Ball Y: use oldBallY for clear (P0), ballY for draw (P7)
    node selectBallY: Mux(width=8)
    connect ballY.q -> selectBallY.in0
    connect oldBallY.q -> selectBallY.in1
    connect isP0.eq -> selectBallY.sel

    // Final Y: ball phases use ball Y, paddle phases use paddlePixelY
    node selectY: Mux(width=8)
    connect selectBallY.out -> selectY.in0
    connect paddlePixelY.sum -> selectY.in1
    connect isPaddlePhase.out -> selectY.sel

    // ===== RENDERING: SELECT X COORDINATE =====
    node isLeftPaddle: Or
    connect isClearLeft2.out -> isLeftPaddle.a
    connect isDrawLeft2.out -> isLeftPaddle.b

    node isRightPaddle: Or
    connect isClearRight2.out -> isRightPaddle.a
    connect isDrawRight2.out -> isRightPaddle.b

    node selectBallX: Mux(width=8)
    connect ballX.q -> selectBallX.in0
    connect oldBallX.q -> selectBallX.in1
    connect isP0.eq -> selectBallX.sel

    node selectX0: Mux(width=8)
    connect selectBallX.out -> selectX0.in0
    connect zero.out -> selectX0.in1
    connect isLeftPaddle.out -> selectX0.sel

    node selectX: Mux(width=8)
    connect selectX0.out -> selectX.in0
    connect fifteen.out -> selectX.in1
    connect isRightPaddle.out -> selectX.sel

    // ===== ADDRESS CALCULATION: (Y << 4) + X =====
    node yTimes16: LeftShifter
    connect selectY.out -> yTimes16.value
    connect four.out -> yTimes16.shift

    node ramAddr: Adder
    connect yTimes16.result -> ramAddr.a
    connect selectX.out -> ramAddr.b

    connect ramAddr.sum -> ram.addrA

    // ===== CLEAR/DRAW DATA =====
    // Phases 0-6: clear (write 0), Phases 7-13: draw (write 1)
    node isClearPhase: Comparator
    connect phaseCounter.q -> isClearPhase.a
    connect p7c.out -> isClearPhase.b

    node ramData: Mux(width=8)
    connect one.out -> ramData.in0
    connect zero.out -> ramData.in1
    connect isClearPhase.lt -> ramData.sel

    connect ramData.out -> ram.dataA

    node writeEnable: Switch
    connect writeEnable.out -> ram.weA
  }
}
`;
