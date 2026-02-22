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
}

export const SNAKE_CIRCUITS: Record<string, BlogCircuit> = {
  simpleFramebuffer: {
    name: "Simple Framebuffer",
    description:
      "DualPortRAM as a screen framebuffer. Port A reads/writes data, port B is used by the Screen to display pixels.",
    displayDsl: `circuit SimpleFramebuffer {
  clock clk
  impl {
    node ram: DualPortRAM(init={
      0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1,
      9: 1, 14: 1,
      17: 1, 22: 1,
      25: 1, 30: 1,
      33: 1, 38: 1,
      41: 1, 46: 1,
      49: 1, 54: 1,
      56: 1, 57: 1, 58: 1, 59: 1, 60: 1, 61: 1, 62: 1, 63: 1
    })
    node screen: Screen
    connect screen.addrB -> ram.addrB
    connect ram.dataB -> screen.dataIn

    node addr: Input
    node data_in: Input
    node we: Switch
    node readback: HexDisplay

    connect addr.out -> ram.addrA
    connect data_in.out -> ram.dataA
    connect we.out -> ram.weA
    connect clk -> ram.clk
    connect ram.dataA -> readback.in
  }
}`,
    dsl: `
circuit SimpleFramebuffer {
  clock clk
  impl {
    node ram: DualPortRAM(init={
      0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1,
      9: 1, 14: 1,
      17: 1, 22: 1,
      25: 1, 30: 1,
      33: 1, 38: 1,
      41: 1, 46: 1,
      49: 1, 54: 1,
      56: 1, 57: 1, 58: 1, 59: 1, 60: 1, 61: 1, 62: 1, 63: 1
    })
    node screen: Screen
    connect screen.addrB -> ram.addrB
    connect ram.dataB -> screen.dataIn

    node addr: Input
    node data_in: Input
    node we: Switch
    node readback: HexDisplay

    connect addr.out -> ram.addrA
    connect data_in.out -> ram.dataA
    connect we.out -> ram.weA
    connect clk -> ram.clk
    connect ram.dataA -> readback.in
  }
}`,
  },

  coordToPixel: {
    name: "Coordinate to Pixel Address",
    description:
      "Converts (X, Y) coordinates to a linear pixel address using Y*8+X, implemented with chained adders.",
    displayDsl: `circuit CoordToPixel {
  impl {
    node x: Input(value=3)
    node y: Input(value=2)

    node y2: Adder
    connect y.out -> y2.a
    connect y.out -> y2.b

    node y4: Adder
    connect y2.sum -> y4.a
    connect y2.sum -> y4.b

    node y8: Adder
    connect y4.sum -> y8.a
    connect y4.sum -> y8.b

    node addr: Adder
    connect y8.sum -> addr.a
    connect x.out -> addr.b

    node result: HexDisplay
    connect addr.sum -> result.in
  }
}`,
    dsl: `
circuit CoordToPixel {
  impl {
    node x: Input(value=3)
    node y: Input(value=2)

    node y2: Adder
    connect y.out -> y2.a
    connect y.out -> y2.b

    node y4: Adder
    connect y2.sum -> y4.a
    connect y2.sum -> y4.b

    node y8: Adder
    connect y4.sum -> y8.a
    connect y4.sum -> y8.b

    node addr: Adder
    connect y8.sum -> addr.a
    connect x.out -> addr.b

    node result: HexDisplay
    connect addr.sum -> result.in
  }
}`,
  },

  directionDecoder: {
    name: "Direction Decoder",
    description:
      "Decodes keyboard scan codes into deltaX/deltaY movement values using Comparators and a Mux tree.",
    displayDsl: `circuit DirectionDecoder {
  impl {
    node keyCode: Input(value=77)

    node upCode: Constant(value=72)
    node downCode: Constant(value=80)
    node leftCode: Constant(value=75)
    node rightCode: Constant(value=77)
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node minus1: Constant(value=255)

    node isUp: Comparator
    node isDown: Comparator
    node isLeft: Comparator
    node isRight: Comparator

    connect keyCode.out -> isUp.a
    connect upCode.out -> isUp.b
    connect keyCode.out -> isDown.a
    connect downCode.out -> isDown.b
    connect keyCode.out -> isLeft.a
    connect leftCode.out -> isLeft.b
    connect keyCode.out -> isRight.a
    connect rightCode.out -> isRight.b

    node deltaXTemp: Mux
    node deltaX: Mux
    connect zero.out -> deltaXTemp.in0
    connect minus1.out -> deltaXTemp.in1
    connect isLeft.eq -> deltaXTemp.sel
    connect deltaXTemp.out -> deltaX.in0
    connect one.out -> deltaX.in1
    connect isRight.eq -> deltaX.sel

    node deltaYTemp: Mux
    node deltaY: Mux
    connect zero.out -> deltaYTemp.in0
    connect minus1.out -> deltaYTemp.in1
    connect isUp.eq -> deltaYTemp.sel
    connect deltaYTemp.out -> deltaY.in0
    connect one.out -> deltaY.in1
    connect isDown.eq -> deltaY.sel

    node displayDX: HexDisplay
    node displayDY: HexDisplay
    connect deltaX.out -> displayDX.in
    connect deltaY.out -> displayDY.in
  }
}`,
    dsl: `
circuit DirectionDecoder {
  impl {
    node keyCode: Input(value=77)

    node upCode: Constant(value=72)
    node downCode: Constant(value=80)
    node leftCode: Constant(value=75)
    node rightCode: Constant(value=77)
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node minus1: Constant(value=255)

    node isUp: Comparator
    node isDown: Comparator
    node isLeft: Comparator
    node isRight: Comparator

    connect keyCode.out -> isUp.a
    connect upCode.out -> isUp.b
    connect keyCode.out -> isDown.a
    connect downCode.out -> isDown.b
    connect keyCode.out -> isLeft.a
    connect leftCode.out -> isLeft.b
    connect keyCode.out -> isRight.a
    connect rightCode.out -> isRight.b

    node deltaXTemp: Mux
    node deltaX: Mux
    connect zero.out -> deltaXTemp.in0
    connect minus1.out -> deltaXTemp.in1
    connect isLeft.eq -> deltaXTemp.sel
    connect deltaXTemp.out -> deltaX.in0
    connect one.out -> deltaX.in1
    connect isRight.eq -> deltaX.sel

    node deltaYTemp: Mux
    node deltaY: Mux
    connect zero.out -> deltaYTemp.in0
    connect minus1.out -> deltaYTemp.in1
    connect isUp.eq -> deltaYTemp.sel
    connect deltaYTemp.out -> deltaY.in0
    connect one.out -> deltaY.in1
    connect isDown.eq -> deltaY.sel

    node displayDX: HexDisplay
    node displayDY: HexDisplay
    connect deltaX.out -> displayDX.in
    connect deltaY.out -> displayDY.in
  }
}`,
  },

  pixelMover: {
    name: "Pixel Mover",
    description:
      "Position registers with delta addition and BitSlice wraparound, drawing the result to a Screen via DualPortRAM.",
    displayDsl: `circuit PixelMover {
  clock clk
  impl {
    node ram: DualPortRAM
    node screen: Screen
    connect screen.addrB -> ram.addrB
    connect ram.dataB -> screen.dataIn

    node keyboard: Input

    node headX: Register(initial=4)
    node headY: Register(initial=4)
    connect clk -> headX.clk
    connect clk -> headY.clk

    // Direction decoding
    node upCode: Constant(value=72)
    node downCode: Constant(value=80)
    node leftCode: Constant(value=75)
    node rightCode: Constant(value=77)
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node minus1: Constant(value=255)

    node isUp: Comparator
    node isDown: Comparator
    node isLeft: Comparator
    node isRight: Comparator

    connect keyboard.out -> isUp.a
    connect upCode.out -> isUp.b
    connect keyboard.out -> isDown.a
    connect downCode.out -> isDown.b
    connect keyboard.out -> isLeft.a
    connect leftCode.out -> isLeft.b
    connect keyboard.out -> isRight.a
    connect rightCode.out -> isRight.b

    node deltaXTemp: Mux
    node deltaX: Mux
    connect zero.out -> deltaXTemp.in0
    connect minus1.out -> deltaXTemp.in1
    connect isLeft.eq -> deltaXTemp.sel
    connect deltaXTemp.out -> deltaX.in0
    connect one.out -> deltaX.in1
    connect isRight.eq -> deltaX.sel

    node deltaYTemp: Mux
    node deltaY: Mux
    connect zero.out -> deltaYTemp.in0
    connect minus1.out -> deltaYTemp.in1
    connect isUp.eq -> deltaYTemp.sel
    connect deltaYTemp.out -> deltaY.in0
    connect one.out -> deltaY.in1
    connect isDown.eq -> deltaY.sel

    // Next position
    node nextX: Adder
    node nextY: Adder
    connect headX.q -> nextX.a
    connect deltaX.out -> nextX.b
    connect headY.q -> nextY.a
    connect deltaY.out -> nextY.b

    node wrapX: BitSlice(low=0, high=2)
    node wrapY: BitSlice(low=0, high=2)
    connect nextX.sum -> wrapX.in
    connect nextY.sum -> wrapY.in

    connect wrapX.out -> headX.data
    connect wrapY.out -> headY.data

    node enable: Switch
    connect enable.out -> headX.we
    connect enable.out -> headY.we

    // Compute pixel address: Y*8+X
    node y2: Adder
    node y4: Adder
    node y8: Adder
    connect wrapY.out -> y2.a
    connect wrapY.out -> y2.b
    connect y2.sum -> y4.a
    connect y2.sum -> y4.b
    connect y4.sum -> y8.a
    connect y4.sum -> y8.b

    node pixelAddr: Adder
    connect y8.sum -> pixelAddr.a
    connect wrapX.out -> pixelAddr.b

    connect pixelAddr.sum -> ram.addrA
    connect one.out -> ram.dataA
    connect enable.out -> ram.weA
    connect clk -> ram.clk

    node displayX: HexDisplay
    node displayY: HexDisplay
    connect wrapX.out -> displayX.in
    connect wrapY.out -> displayY.in
  }
}`,
    dsl: `
circuit PixelMover {
  clock clk
  impl {
    node ram: DualPortRAM
    node screen: Screen
    connect screen.addrB -> ram.addrB
    connect ram.dataB -> screen.dataIn

    node keyboard: Input

    node headX: Register(initial=4)
    node headY: Register(initial=4)
    connect clk -> headX.clk
    connect clk -> headY.clk

    node upCode: Constant(value=72)
    node downCode: Constant(value=80)
    node leftCode: Constant(value=75)
    node rightCode: Constant(value=77)
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node minus1: Constant(value=255)

    node isUp: Comparator
    node isDown: Comparator
    node isLeft: Comparator
    node isRight: Comparator

    connect keyboard.out -> isUp.a
    connect upCode.out -> isUp.b
    connect keyboard.out -> isDown.a
    connect downCode.out -> isDown.b
    connect keyboard.out -> isLeft.a
    connect leftCode.out -> isLeft.b
    connect keyboard.out -> isRight.a
    connect rightCode.out -> isRight.b

    node deltaXTemp: Mux
    node deltaX: Mux
    connect zero.out -> deltaXTemp.in0
    connect minus1.out -> deltaXTemp.in1
    connect isLeft.eq -> deltaXTemp.sel
    connect deltaXTemp.out -> deltaX.in0
    connect one.out -> deltaX.in1
    connect isRight.eq -> deltaX.sel

    node deltaYTemp: Mux
    node deltaY: Mux
    connect zero.out -> deltaYTemp.in0
    connect minus1.out -> deltaYTemp.in1
    connect isUp.eq -> deltaYTemp.sel
    connect deltaYTemp.out -> deltaY.in0
    connect one.out -> deltaY.in1
    connect isDown.eq -> deltaY.sel

    node nextX: Adder
    node nextY: Adder
    connect headX.q -> nextX.a
    connect deltaX.out -> nextX.b
    connect headY.q -> nextY.a
    connect deltaY.out -> nextY.b

    node wrapX: BitSlice(low=0, high=2)
    node wrapY: BitSlice(low=0, high=2)
    connect nextX.sum -> wrapX.in
    connect nextY.sum -> wrapY.in

    connect wrapX.out -> headX.data
    connect wrapY.out -> headY.data

    node enable: Switch
    connect enable.out -> headX.we
    connect enable.out -> headY.we

    node y2: Adder
    node y4: Adder
    node y8: Adder
    connect wrapY.out -> y2.a
    connect wrapY.out -> y2.b
    connect y2.sum -> y4.a
    connect y2.sum -> y4.b
    connect y4.sum -> y8.a
    connect y4.sum -> y8.b

    node pixelAddr: Adder
    connect y8.sum -> pixelAddr.a
    connect wrapX.out -> pixelAddr.b

    connect pixelAddr.sum -> ram.addrA
    connect one.out -> ram.dataA
    connect enable.out -> ram.weA
    connect clk -> ram.clk

    node displayX: HexDisplay
    node displayY: HexDisplay
    connect wrapX.out -> displayX.in
    connect wrapY.out -> displayY.in
  }
}`,
  },

  phaseDemo: {
    name: "4-Phase Counter",
    description:
      "A 2-bit counter cycling through phases 0-3, with LED indicators showing the active phase.",
    displayDsl: `circuit PhaseDemo {
  clock clk
  impl {
    node phase: Register(initial=0)
    connect clk -> phase.clk

    node one: Constant(value=1)
    node zero: Constant(value=0)
    node two: Constant(value=2)
    node three: Constant(value=3)

    node phaseInc: Adder
    connect phase.q -> phaseInc.a
    connect one.out -> phaseInc.b

    node phaseWrap: BitSlice(low=0, high=1)
    connect phaseInc.sum -> phaseWrap.in

    connect phaseWrap.out -> phase.data

    node enable: Switch
    connect enable.out -> phase.we

    node isPhase0: Comparator
    node isPhase1: Comparator
    node isPhase2: Comparator
    node isPhase3: Comparator

    connect phase.q -> isPhase0.a
    connect zero.out -> isPhase0.b
    connect phase.q -> isPhase1.a
    connect one.out -> isPhase1.b
    connect phase.q -> isPhase2.a
    connect two.out -> isPhase2.b
    connect phase.q -> isPhase3.a
    connect three.out -> isPhase3.b

    node led0: Led
    node led1: Led
    node led2: Led
    node led3: Led

    connect isPhase0.eq -> led0.in
    connect isPhase1.eq -> led1.in
    connect isPhase2.eq -> led2.in
    connect isPhase3.eq -> led3.in

    node display: HexDisplay
    connect phase.q -> display.in
  }
}`,
    dsl: `
circuit PhaseDemo {
  clock clk
  impl {
    node phase: Register(initial=0)
    connect clk -> phase.clk

    node one: Constant(value=1)
    node zero: Constant(value=0)
    node two: Constant(value=2)
    node three: Constant(value=3)

    node phaseInc: Adder
    connect phase.q -> phaseInc.a
    connect one.out -> phaseInc.b

    node phaseWrap: BitSlice(low=0, high=1)
    connect phaseInc.sum -> phaseWrap.in

    connect phaseWrap.out -> phase.data

    node enable: Switch
    connect enable.out -> phase.we

    node isPhase0: Comparator
    node isPhase1: Comparator
    node isPhase2: Comparator
    node isPhase3: Comparator

    connect phase.q -> isPhase0.a
    connect zero.out -> isPhase0.b
    connect phase.q -> isPhase1.a
    connect one.out -> isPhase1.b
    connect phase.q -> isPhase2.a
    connect two.out -> isPhase2.b
    connect phase.q -> isPhase3.a
    connect three.out -> isPhase3.b

    node led0: Led
    node led1: Led
    node led2: Led
    node led3: Led

    connect isPhase0.eq -> led0.in
    connect isPhase1.eq -> led1.in
    connect isPhase2.eq -> led2.in
    connect isPhase3.eq -> led3.in

    node display: HexDisplay
    connect phase.q -> display.in
  }
}`,
  },

  collisionDetector: {
    name: "Collision Detector",
    description:
      "Compares head and food X/Y coordinates to detect collision, outputting a grow signal when they match.",
    displayDsl: `circuit CollisionDetector {
  impl {
    node headX: Input(value=3)
    node headY: Input(value=5)
    node foodX: Input(value=3)
    node foodY: Input(value=5)

    node matchX: Comparator
    node matchY: Comparator
    connect headX.out -> matchX.a
    connect foodX.out -> matchX.b
    connect headY.out -> matchY.a
    connect foodY.out -> matchY.b

    node collision: And
    connect matchX.eq -> collision.a
    connect matchY.eq -> collision.b

    node collisionLed: Led
    connect collision.out -> collisionLed.in

    node zero: Constant(value=0)
    node one: Constant(value=1)
    node growMux: Mux
    connect zero.out -> growMux.in0
    connect one.out -> growMux.in1
    connect collision.out -> growMux.sel

    node growDisplay: HexDisplay
    connect growMux.out -> growDisplay.in
  }
}`,
    dsl: `
circuit CollisionDetector {
  impl {
    node headX: Input(value=3)
    node headY: Input(value=5)
    node foodX: Input(value=3)
    node foodY: Input(value=5)

    node matchX: Comparator
    node matchY: Comparator
    connect headX.out -> matchX.a
    connect foodX.out -> matchX.b
    connect headY.out -> matchY.a
    connect foodY.out -> matchY.b

    node collision: And
    connect matchX.eq -> collision.a
    connect matchY.eq -> collision.b

    node collisionLed: Led
    connect collision.out -> collisionLed.in

    node zero: Constant(value=0)
    node one: Constant(value=1)
    node growMux: Mux
    connect zero.out -> growMux.in0
    connect one.out -> growMux.in1
    connect collision.out -> growMux.sel

    node growDisplay: HexDisplay
    connect growMux.out -> growDisplay.in
  }
}`,
  },
};

/**
 * Full SnakeAdvanced DSL — the complete Snake game circuit.
 * Uses DualPortRAM for both framebuffer and snake body storage,
 * a 4-phase pipeline for coordinated read/compute/write operations,
 * direction decoding, collision detection, and food spawning.
 */
export const SNAKE_ADVANCED_DSL = `
circuit SnakeAdvanced {
  impl {
    // Dual-Port RAM and Screen
    // NEW STORAGE SCHEME: Store pixel addresses (0-63), not X/Y coordinates!
    // This cuts RAM operations in half (1 byte per segment instead of 2)
    node ram: DualPortRAM(init={
      64: 33,   // Segment 0 (tail): pixel address 33 = (1,4)
      65: 34,   // Segment 1: pixel address 34 = (2,4)
      66: 35,   // Segment 2: pixel address 35 = (3,4)
      67: 36,   // Segment 3 (head): pixel address 36 = (4,4)
      33: 1,    // Framebuffer: pixel at address 33 ON
      34: 1,    // Framebuffer: pixel at address 34 ON
      35: 1,    // Framebuffer: pixel at address 35 ON
      36: 1     // Framebuffer: pixel at address 36 ON
    })
    node screen: Screen
    connect screen.addrB -> ram.addrB
    connect ram.dataB -> screen.dataIn

    // RAM Layout:
    // 0-63:   Screen framebuffer (8x8 pixels)
    // 64-127: Snake body storage (64 segments max, 1 byte each: pixel address)

    // Keyboard input
    node keyboard: Input

    // Food position
    node foodX: Register(initial=6)
    node foodY: Register(initial=3)
    node foodNeedsDrawing: Register(initial=1)  // Draw initial food on first cycle

    // Snake circular buffer pointers
    node headPtr: Register(initial=3)      // Head index in buffer (0-63)
    node tailPtr: Register(initial=0)      // Tail index in buffer (0-63)
    node snakeLen: Register(initial=4)     // Current snake length

    // Current head position (X, Y coordinates)
    node headX: Register(initial=4)
    node headY: Register(initial=4)

    // Tail pixel address read from RAM (in phase 0)
    node tailPixelAddr: Register(initial=33)

    // NEXT head pixel address (calculated and latched in phase 0)
    node nextHeadPixelAddr: Register(initial=36)

    // Phase counter: 0-2 (3 phases!)
    // Phase 0: Calculate next head pixel address, latch. Read tail pixel address from body
    // Phase 1: Clear tail pixel in framebuffer (if moving)
    // Phase 2: Write head pixel address to body, draw head pixel, update pointers
    node phase: Register(initial=0)

    // Constants
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)
    node three: Constant(value=3)
    node bodyBase: Constant(value=64)
    node minus1: Constant(value=255)
    node eight: Constant(value=8)

    // Phase increment (0 -> 1 -> 2 -> 3 -> 0, wraps automatically with 2-bit counter)
    node phaseInc: Adder
    connect phase.q -> phaseInc.a
    connect one.out -> phaseInc.b

    node phaseWrap: BitSlice(low=0, high=1)  // Take bits [0:1] for 0-3 (wraps to 0 at 4)
    connect phaseInc.sum -> phaseWrap.in

    connect phaseWrap.out -> phase.data
    node phaseEnable: Switch(value=1)
    connect phaseEnable.out -> phase.we

    // Phase detection
    node isPhase0: Comparator
    node isPhase1: Comparator
    node isPhase2: Comparator
    node isPhase3: Comparator

    connect phase.q -> isPhase0.a
    connect zero.out -> isPhase0.b
    connect phase.q -> isPhase1.a
    connect one.out -> isPhase1.b
    connect phase.q -> isPhase2.a
    connect two.out -> isPhase2.b
    connect phase.q -> isPhase3.a
    connect three.out -> isPhase3.b

    // Latched keyboard input (updated in phase 0 to prevent mid-cycle direction changes)
    node keyboardLatched: Register(initial=0)
    connect keyboard.out -> keyboardLatched.data
    node latchKeyboard: And
    connect phaseEnable.out -> latchKeyboard.a
    connect isPhase0.eq -> latchKeyboard.b
    connect latchKeyboard.out -> keyboardLatched.we

    // Direction codes (Arrow keys)
    node upCode: Constant(value=72)
    node downCode: Constant(value=80)
    node leftCode: Constant(value=75)
    node rightCode: Constant(value=77)

    // Direction detection (uses LATCHED keyboard to prevent mid-cycle direction changes)
    node isUp: Comparator
    node isDown: Comparator
    node isLeft: Comparator
    node isRight: Comparator

    connect keyboardLatched.q -> isUp.a
    connect upCode.out -> isUp.b
    connect keyboardLatched.q -> isDown.a
    connect downCode.out -> isDown.b
    connect keyboardLatched.q -> isLeft.a
    connect leftCode.out -> isLeft.b
    connect keyboardLatched.q -> isRight.a
    connect rightCode.out -> isRight.b

    // Calculate deltaX and deltaY
    node deltaXTemp: Mux
    node deltaX: Mux
    connect zero.out -> deltaXTemp.in0
    connect minus1.out -> deltaXTemp.in1
    connect isLeft.eq -> deltaXTemp.sel
    connect deltaXTemp.out -> deltaX.in0
    connect one.out -> deltaX.in1
    connect isRight.eq -> deltaX.sel

    node deltaYTemp: Mux
    node deltaY: Mux
    connect zero.out -> deltaYTemp.in0
    connect minus1.out -> deltaYTemp.in1
    connect isUp.eq -> deltaYTemp.sel
    connect deltaYTemp.out -> deltaY.in0
    connect one.out -> deltaY.in1
    connect isDown.eq -> deltaY.sel

    // Calculate NEXT head position (headX + deltaX, headY + deltaY)
    node nextHeadXCalc: Adder
    node nextHeadYCalc: Adder
    connect headX.q -> nextHeadXCalc.a
    connect deltaX.out -> nextHeadXCalc.b
    connect headY.q -> nextHeadYCalc.a
    connect deltaY.out -> nextHeadYCalc.b

    // Wrap to 0-7 (3 bits for 8x8 screen)
    node nextHeadX: BitSlice(low=0, high=2)
    node nextHeadY: BitSlice(low=0, high=2)
    connect nextHeadXCalc.sum -> nextHeadX.in
    connect nextHeadYCalc.sum -> nextHeadY.in

    // Convert (nextHeadX, nextHeadY) to pixel address: Y * 8 + X
    node nextHeadY2: Adder
    node nextHeadY4: Adder
    node nextHeadY8: Adder
    connect nextHeadY.out -> nextHeadY2.a
    connect nextHeadY.out -> nextHeadY2.b
    connect nextHeadY2.sum -> nextHeadY4.a
    connect nextHeadY2.sum -> nextHeadY4.b
    connect nextHeadY4.sum -> nextHeadY8.a
    connect nextHeadY4.sum -> nextHeadY8.b

    node nextPixelAddr: Adder
    connect nextHeadY8.sum -> nextPixelAddr.a
    connect nextHeadX.out -> nextPixelAddr.b

    // Calculate food pixel address: foodY * 8 + foodX
    node foodY2: Adder
    node foodY4: Adder
    node foodY8: Adder
    connect foodY.q -> foodY2.a
    connect foodY.q -> foodY2.b
    connect foodY2.sum -> foodY4.a
    connect foodY2.sum -> foodY4.b
    connect foodY4.sum -> foodY8.a
    connect foodY4.sum -> foodY8.b

    node foodPixelAddr: Adder
    connect foodY8.sum -> foodPixelAddr.a
    connect foodX.q -> foodPixelAddr.b

    // Collision detection: nextHead position == food position
    node nextHeadAtFoodX: Comparator
    node nextHeadAtFoodY: Comparator
    connect nextHeadX.out -> nextHeadAtFoodX.a
    connect foodX.q -> nextHeadAtFoodX.b
    connect nextHeadY.out -> nextHeadAtFoodY.a
    connect foodY.q -> nextHeadAtFoodY.b

    node willEatFood: And
    connect nextHeadAtFoodX.eq -> willEatFood.a
    connect nextHeadAtFoodY.eq -> willEatFood.b

    // Latch next head pixel address in phase 1 (two phases before drawing)
    connect nextPixelAddr.sum -> nextHeadPixelAddr.data
    node latchNextHead: And
    connect phaseEnable.out -> latchNextHead.a
    connect isPhase1.eq -> latchNextHead.b
    connect latchNextHead.out -> nextHeadPixelAddr.we

    // Body RAM addressing
    node headPtrNext: Adder
    connect headPtr.q -> headPtrNext.a
    connect one.out -> headPtrNext.b

    node headPtrNextWrap: BitSlice(low=0, high=5)  // Wrap to 0-63
    connect headPtrNext.sum -> headPtrNextWrap.in

    node headBodyAddr: Adder
    connect headPtrNextWrap.out -> headBodyAddr.a
    connect bodyBase.out -> headBodyAddr.b

    node tailBodyAddr: Adder
    connect tailPtr.q -> tailBodyAddr.a
    connect bodyBase.out -> tailBodyAddr.b

    // RAM Port A address multiplexing
    node phase0Addr: Mux
    connect tailBodyAddr.sum -> phase0Addr.in0
    connect foodPixelAddr.sum -> phase0Addr.in1
    connect foodNeedsDrawing.q -> phase0Addr.sel

    node addrMux0: Mux
    connect phase0Addr.out -> addrMux0.in0
    connect tailPixelAddr.q -> addrMux0.in1
    connect isPhase1.eq -> addrMux0.sel

    node addrMux1: Mux
    connect addrMux0.out -> addrMux1.in0
    connect headBodyAddr.sum -> addrMux1.in1
    connect isPhase2.eq -> addrMux1.sel

    node ramAddr: Mux
    connect addrMux1.out -> ramAddr.in0
    connect nextHeadPixelAddr.q -> ramAddr.in1
    connect isPhase3.eq -> ramAddr.sel

    connect ramAddr.out -> ram.addrA

    // RAM data selection
    node dataMux0: Mux
    connect zero.out -> dataMux0.in0
    connect nextHeadPixelAddr.q -> dataMux0.in1
    connect isPhase2.eq -> dataMux0.sel

    node dataMux1: Mux
    connect dataMux0.out -> dataMux1.in0
    connect one.out -> dataMux1.in1
    connect isPhase3.eq -> dataMux1.sel

    node ramData: Mux
    connect dataMux1.out -> ramData.in0
    connect one.out -> ramData.in1
    connect foodNeedsDrawing.q -> ramData.sel

    connect ramData.out -> ram.dataA

    // Buffer occupancy check
    node bufferEmpty: Comparator
    connect snakeLen.q -> bufferEmpty.a
    connect zero.out -> bufferEmpty.b

    node bufferNotEmpty: Not
    connect bufferEmpty.eq -> bufferNotEmpty.in

    // Movement detection
    node deltaXIsZero: Comparator
    node deltaYIsZero: Comparator
    connect deltaX.out -> deltaXIsZero.a
    connect zero.out -> deltaXIsZero.b
    connect deltaY.out -> deltaYIsZero.a
    connect zero.out -> deltaYIsZero.b

    node bothDeltasZero: And
    connect deltaXIsZero.eq -> bothDeltasZero.a
    connect deltaYIsZero.eq -> bothDeltasZero.b

    node isMoving: Not
    connect bothDeltasZero.out -> isMoving.in

    // RAM write enable
    node shouldMoveTail: Switch(value=1)

    node shouldMoveTailActual: And
    node notEatingFood: Not
    connect shouldMoveTail.out -> shouldMoveTailActual.a
    connect willEatFood.out -> notEatingFood.in
    connect notEatingFood.out -> shouldMoveTailActual.b

    node shouldClearTail: And
    node shouldClearTailMoving: And
    connect shouldMoveTailActual.out -> shouldClearTail.a
    connect isMoving.out -> shouldClearTail.b
    connect shouldClearTail.out -> shouldClearTailMoving.a
    connect bufferNotEmpty.out -> shouldClearTailMoving.b

    node writePhase0: And
    connect isPhase0.eq -> writePhase0.a
    connect foodNeedsDrawing.q -> writePhase0.b

    node writePhase1: And
    connect isPhase1.eq -> writePhase1.a
    connect shouldClearTailMoving.out -> writePhase1.b

    node writePhase2: And
    connect isPhase2.eq -> writePhase2.a
    connect isMoving.out -> writePhase2.b

    node writePhase3: And
    connect isPhase3.eq -> writePhase3.a
    connect isMoving.out -> writePhase3.b

    node writePhase01: Or
    connect writePhase0.out -> writePhase01.a
    connect writePhase1.out -> writePhase01.b

    node writePhase2or3: Or
    connect writePhase2.out -> writePhase2or3.a
    connect writePhase3.out -> writePhase2or3.b

    node writeAny: Or
    connect writePhase01.out -> writeAny.a
    connect writePhase2or3.out -> writeAny.b

    node writeEnable: Switch(value=1)
    node finalWriteEnable: And
    connect writeEnable.out -> finalWriteEnable.a
    connect writeAny.out -> finalWriteEnable.b
    connect finalWriteEnable.out -> ram.weA

    // Register updates
    connect ram.dataA -> tailPixelAddr.data
    node latchTail: And
    node latchTailFinal: And
    node latchTailNotFood: And
    connect phaseEnable.out -> latchTail.a
    connect isPhase0.eq -> latchTail.b
    connect latchTail.out -> latchTailFinal.a
    connect bufferNotEmpty.out -> latchTailFinal.b
    connect latchTailFinal.out -> latchTailNotFood.a
    node notDrawingFood: Not
    connect foodNeedsDrawing.q -> notDrawingFood.in
    connect notDrawingFood.out -> latchTailNotFood.b
    connect latchTailNotFood.out -> tailPixelAddr.we

    node clearFoodFlag: And
    connect phaseEnable.out -> clearFoodFlag.a
    connect isPhase0.eq -> clearFoodFlag.b
    node clearFoodFlagFinal: And
    connect clearFoodFlag.out -> clearFoodFlagFinal.a
    connect foodNeedsDrawing.q -> clearFoodFlagFinal.b

    node ateFood: And
    node ateFoodFinal: And
    connect phaseEnable.out -> ateFood.a
    connect isPhase3.eq -> ateFood.b
    connect ateFood.out -> ateFoodFinal.a
    connect willEatFood.out -> ateFoodFinal.b

    node foodFlagWriteEnable: Or
    connect ateFoodFinal.out -> foodFlagWriteEnable.a
    connect clearFoodFlagFinal.out -> foodFlagWriteEnable.b
    connect foodFlagWriteEnable.out -> foodNeedsDrawing.we

    node foodFlagData: Mux
    connect zero.out -> foodFlagData.in0
    connect one.out -> foodFlagData.in1
    connect ateFoodFinal.out -> foodFlagData.sel
    connect foodFlagData.out -> foodNeedsDrawing.data

    node foodXNext: Adder
    connect foodX.q -> foodXNext.a
    connect three.out -> foodXNext.b

    node foodXWrap: BitSlice(low=0, high=2)
    connect foodXNext.sum -> foodXWrap.in

    node foodYNext: Adder
    connect foodY.q -> foodYNext.a
    node five: Constant(value=5)
    connect five.out -> foodYNext.b

    node foodYWrap: BitSlice(low=0, high=2)
    connect foodYNext.sum -> foodYWrap.in

    connect foodXWrap.out -> foodX.data
    connect foodYWrap.out -> foodY.data
    connect ateFoodFinal.out -> foodX.we
    connect ateFoodFinal.out -> foodY.we

    connect nextHeadX.out -> headX.data
    connect nextHeadY.out -> headY.data
    node updateHead: And
    node updateHeadFinal: And
    connect phaseEnable.out -> updateHead.a
    connect isPhase3.eq -> updateHead.b
    connect updateHead.out -> updateHeadFinal.a
    connect isMoving.out -> updateHeadFinal.b
    connect updateHeadFinal.out -> headX.we
    connect updateHeadFinal.out -> headY.we

    node headPtrInc: Adder
    connect headPtr.q -> headPtrInc.a
    connect one.out -> headPtrInc.b

    node headPtrWrap: BitSlice(low=0, high=5)
    connect headPtrInc.sum -> headPtrWrap.in

    connect headPtrWrap.out -> headPtr.data
    connect updateHeadFinal.out -> headPtr.we

    node tailPtrInc: Adder
    connect tailPtr.q -> tailPtrInc.a
    connect one.out -> tailPtrInc.b

    node tailPtrWrap: BitSlice(low=0, high=5)
    connect tailPtrInc.sum -> tailPtrWrap.in

    connect tailPtrWrap.out -> tailPtr.data
    node updateTail: And
    node updateTailFinal: And
    connect phaseEnable.out -> updateTail.a
    connect isPhase3.eq -> updateTail.b
    connect updateTail.out -> updateTailFinal.a
    connect shouldClearTailMoving.out -> updateTailFinal.b
    connect updateTailFinal.out -> tailPtr.we

    node snakeLenDelta: Mux
    connect one.out -> snakeLenDelta.in0
    connect zero.out -> snakeLenDelta.in1
    connect shouldClearTailMoving.out -> snakeLenDelta.sel

    node snakeLenNew: Adder
    connect snakeLen.q -> snakeLenNew.a
    connect snakeLenDelta.out -> snakeLenNew.b

    connect snakeLenNew.sum -> snakeLen.data
    connect updateHeadFinal.out -> snakeLen.we
  }
}
`;
