import type { ChallengeStage, ChallengeMetadata } from './types.js';

export const SNAKE_METADATA: ChallengeMetadata = {
  slug: 'snake',
  title: 'Build Snake in Hardware',
  description:
    'Wire up a complete Snake game stage by stage — framebuffers, direction decoding, movement, collision detection, and a phase pipeline. No CPU, no software.',
  stages: 6,
  difficulty: 'Intermediate',
};

export const SNAKE_STAGES: ChallengeStage[] = [
  // ── Stage 1: Framebuffer ──────────────────────────────────────────
  {
    id: "framebuffer",
    title: "The Framebuffer",
    concept:
      "A Screen reads pixels from a DualPortRAM. Port A writes data in, Port B reads it out to the display. Wire them together and light up a pixel.",
    objective:
      "Connect the RAM and Screen so that writing value 1 to address 9 lights up the pixel at row 1, column 1.",
    hints: [
      "The RAM has two ports. Port A (addrA, dataA, weA) is for writing. Port B (addrB, outB) is for reading.",
      "The Screen automatically scans addresses via its addrB output. Connect that to ram.addrB.",
      "The Screen's dataIn port needs the data coming back from ram.outB.",
      "Connect addr.out → ram.addrA, data_in.out → ram.dataA, and we.out → ram.weA.",
    ],
    scaffold: `circuit Framebuffer {
  impl {
    node addr: Input(value=9)
    node data_in: Input(value=1)
    node we: Switch

    node ram: DualPortRAM
    node screen: Screen

    // YOUR CODE HERE
    // Connect addr, data_in, and we to the RAM's port A
    // Connect the Screen to the RAM's port B
  }
}`,
    solution: `circuit Framebuffer {
  impl {
    node addr: Input(value=9)
    node data_in: Input(value=1)
    node we: Switch

    node ram: DualPortRAM
    node screen: Screen

    connect addr.out -> ram.addrA
    connect data_in.out -> ram.dataA
    connect we.out -> ram.weA
    connect screen.addrB -> ram.addrB
    connect ram.outB -> screen.dataIn
  }
}`,
    nodePositions: {
      addr: { x: 0, y: 0 },
      data_in: { x: 0, y: 100 },
      we: { x: 0, y: 200 },
      ram: { x: 280, y: 60 },
      screen: { x: 560, y: 60 },
    },
    height: 300,
    checks: [
      {
        description: "Writing to address 9 stores the value",
        node: "ram",
        port: "outB",
        expected: 1,
        inputs: [
          ["we", 1],
          ["addr", 9],
          ["data_in", 1],
        ],
        ticks: 1,
      },
    ],
  },

  // ── Stage 2: Coordinate → Address ─────────────────────────────────
  {
    id: "coord-to-address",
    title: "Coordinate to Address",
    concept:
      "The screen is an 8×8 grid stored as 64 bytes. To draw at (X, Y) we need a linear address: Y × 8 + X. Multiplying by 8 is a left shift by 3 — in real hardware, that's just wiring (zero gates).",
    objective:
      "Wire the LeftShifter and Adder so that inputs X=3, Y=4 produce address 35.",
    hints: [
      "A LeftShifter has inputs 'value' and 'shift', and output 'result'.",
      "Connect y.out to the shifter's value, and three.out to its shift amount.",
      "The Adder takes inputs 'a' and 'b' and outputs 'sum'.",
      "Connect the shifter's result to the adder's 'a', and x.out to 'b'.",
    ],
    scaffold: `circuit CoordToAddress {
  impl {
    node x: Input(value=3)
    node y: Input(value=4)
    node three: Constant(value=3)

    node y8: LeftShifter
    node addr: Adder

    node result: HexDisplay

    // YOUR CODE HERE
    // Shift y left by 3 (multiply by 8)
    // Add x to get the final address
    // Connect the result to the display
  }
}`,
    solution: `circuit CoordToAddress {
  impl {
    node x: Input(value=3)
    node y: Input(value=4)
    node three: Constant(value=3)

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
    nodePositions: {
      x: { x: 0, y: 120 },
      y: { x: 0, y: 0 },
      three: { x: 0, y: 240 },
      y8: { x: 220, y: 60 },
      addr: { x: 420, y: 90 },
      result: { x: 600, y: 90 },
    },
    height: 320,
    checks: [
      {
        description: "(3, 4) → address 35",
        node: "addr",
        port: "sum",
        expected: 35,
        inputs: [
          ["x", 3],
          ["y", 4],
        ],
      },
      {
        description: "(0, 0) → address 0",
        node: "addr",
        port: "sum",
        expected: 0,
        inputs: [
          ["x", 0],
          ["y", 0],
        ],
      },
      {
        description: "(7, 7) → address 63",
        node: "addr",
        port: "sum",
        expected: 63,
        inputs: [
          ["x", 7],
          ["y", 7],
        ],
      },
    ],
  },

  // ── Stage 3: Direction Decoder ────────────────────────────────────
  {
    id: "direction-decoder",
    title: "Decoding Player Input",
    concept:
      "Arrow keys produce scan codes: Up=72, Down=80, Left=75, Right=77. We need to convert these into movement deltas: deltaX and deltaY, each −1, 0, or +1. Four Comparators detect which key is pressed, and a Mux tree selects the right delta.",
    objective:
      'Wire the comparators and mux tree so that key code 77 (Right) produces deltaX=1, deltaY=0.',
    hints: [
      "Each Comparator has inputs 'a' and 'b' and output 'eq'. Connect keyCode.out to the 'a' input of each comparator.",
      "Connect each direction constant (scanUp, scanDown, etc.) to the 'b' input of the matching comparator.",
      "A Mux has 'in0', 'in1', and 'sel'. When sel=0, output=in0. When sel=1, output=in1.",
      "For deltaX: start with 0, mux in 255 (−1) if Left, then mux in 1 if Right. Chain: zero→dxMux1.in0, minus1→dxMux1.in1, isLeft.eq→dxMux1.sel, then dxMux1.out→dxMux2.in0, one→dxMux2.in1, isRight.eq→dxMux2.sel.",
    ],
    scaffold: `circuit DirectionDecoder {
  impl {
    node keyCode: Input(value=77)

    node scanUp: Constant(value=72)
    node scanDown: Constant(value=80)
    node scanLeft: Constant(value=75)
    node scanRight: Constant(value=77)

    node zero: Constant(value=0)
    node one: Constant(value=1)
    node minus1: Constant(value=255)

    node isUp: Comparator
    node isDown: Comparator
    node isLeft: Comparator
    node isRight: Comparator

    node dyMux1: Mux
    node dyMux2: Mux
    node dxMux1: Mux
    node dxMux2: Mux

    node displayDX: HexDisplay
    node displayDY: HexDisplay

    // YOUR CODE HERE
    // 1. Connect keyCode to each comparator's 'a' input
    // 2. Connect scan code constants to each comparator's 'b' input
    // 3. Build deltaY mux chain: 0 by default, 255 if Up, 1 if Down
    // 4. Build deltaX mux chain: 0 by default, 255 if Left, 1 if Right
    // 5. Connect results to the hex displays
  }
}`,
    solution: `circuit DirectionDecoder {
  impl {
    node keyCode: Input(value=77)

    node scanUp: Constant(value=72)
    node scanDown: Constant(value=80)
    node scanLeft: Constant(value=75)
    node scanRight: Constant(value=77)

    node zero: Constant(value=0)
    node one: Constant(value=1)
    node minus1: Constant(value=255)

    node isUp: Comparator
    node isDown: Comparator
    node isLeft: Comparator
    node isRight: Comparator

    connect keyCode.out -> isUp.a
    connect scanUp.out -> isUp.b
    connect keyCode.out -> isDown.a
    connect scanDown.out -> isDown.b
    connect keyCode.out -> isLeft.a
    connect scanLeft.out -> isLeft.b
    connect keyCode.out -> isRight.a
    connect scanRight.out -> isRight.b

    node dyMux1: Mux
    connect zero.out -> dyMux1.in0
    connect minus1.out -> dyMux1.in1
    connect isUp.eq -> dyMux1.sel

    node dyMux2: Mux
    connect dyMux1.out -> dyMux2.in0
    connect one.out -> dyMux2.in1
    connect isDown.eq -> dyMux2.sel

    node dxMux1: Mux
    connect zero.out -> dxMux1.in0
    connect minus1.out -> dxMux1.in1
    connect isLeft.eq -> dxMux1.sel

    node dxMux2: Mux
    connect dxMux1.out -> dxMux2.in0
    connect one.out -> dxMux2.in1
    connect isRight.eq -> dxMux2.sel

    node displayDX: HexDisplay
    node displayDY: HexDisplay
    connect dxMux2.out -> displayDX.in
    connect dyMux2.out -> displayDY.in
  }
}`,
    nodePositions: {
      keyCode: { x: 0, y: 150 },
      scanUp: { x: 0, y: 0 },
      scanDown: { x: 0, y: 50 },
      scanLeft: { x: 0, y: 300 },
      scanRight: { x: 0, y: 350 },
      zero: { x: 200, y: 0 },
      one: { x: 200, y: 400 },
      minus1: { x: 200, y: 50 },
      isUp: { x: 200, y: 120 },
      isDown: { x: 200, y: 200 },
      isLeft: { x: 200, y: 280 },
      isRight: { x: 200, y: 360 },
      dyMux1: { x: 420, y: 100 },
      dyMux2: { x: 420, y: 200 },
      dxMux1: { x: 420, y: 300 },
      dxMux2: { x: 420, y: 400 },
      displayDY: { x: 620, y: 150 },
      displayDX: { x: 620, y: 350 },
    },
    height: 400,
    checks: [
      {
        description: "Right (77) → deltaX=1",
        node: "dxMux2",
        port: "out",
        expected: 1,
        inputs: [["keyCode", 77]],
      },
      {
        description: "Right (77) → deltaY=0",
        node: "dyMux2",
        port: "out",
        expected: 0,
        inputs: [["keyCode", 77]],
      },
      {
        description: "Up (72) → deltaY=255 (−1)",
        node: "dyMux2",
        port: "out",
        expected: 255,
        inputs: [["keyCode", 72]],
      },
      {
        description: "Left (75) → deltaX=255 (−1)",
        node: "dxMux2",
        port: "out",
        expected: 255,
        inputs: [["keyCode", 75]],
      },
    ],
  },

  // ── Stage 4: Collision Detection ──────────────────────────────────
  {
    id: "collision",
    title: "Eating Food",
    concept:
      "When the snake's head lands on the food, it's a collision. Compare headX with foodX and headY with foodY — if both match, the snake eats.",
    objective:
      "Wire the comparators and And gate so that matching head/food coordinates produce collision=1.",
    hints: [
      "Connect headX.out and foodX.out to matchX's 'a' and 'b' inputs.",
      "Do the same for headY/foodY → matchY.",
      "The And gate combines matchX.eq and matchY.eq.",
      "Connect the And gate's output to the LED and to the Mux's sel input.",
    ],
    scaffold: `circuit CollisionDetector {
  impl {
    node headX: Input(value=3)
    node headY: Input(value=5)
    node foodX: Input(value=3)
    node foodY: Input(value=5)

    node matchX: Comparator
    node matchY: Comparator
    node collision: And

    node collisionLed: Led

    node zero: Constant(value=0)
    node one: Constant(value=1)
    node growMux: Mux
    node growDisplay: HexDisplay

    // YOUR CODE HERE
    // 1. Compare headX with foodX, headY with foodY
    // 2. AND the two equality outputs
    // 3. Light the LED on collision
    // 4. Wire the Mux: output 0 normally, 1 on collision
    // 5. Connect to the display
  }
}`,
    solution: `circuit CollisionDetector {
  impl {
    node headX: Input(value=3)
    node headY: Input(value=5)
    node foodX: Input(value=3)
    node foodY: Input(value=5)

    node matchX: Comparator
    connect headX.out -> matchX.a
    connect foodX.out -> matchX.b

    node matchY: Comparator
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
    nodePositions: {
      headX: { x: 0, y: 0 },
      headY: { x: 0, y: 100 },
      foodX: { x: 0, y: 220 },
      foodY: { x: 0, y: 320 },
      matchX: { x: 220, y: 50 },
      matchY: { x: 220, y: 270 },
      collision: { x: 420, y: 150 },
      collisionLed: { x: 620, y: 100 },
      zero: { x: 220, y: 400 },
      one: { x: 220, y: 480 },
      growMux: { x: 420, y: 420 },
      growDisplay: { x: 620, y: 420 },
    },
    height: 380,
    checks: [
      {
        description: "Matching coords → collision",
        node: "collision",
        port: "out",
        expected: 1,
        inputs: [
          ["headX", 3],
          ["headY", 5],
          ["foodX", 3],
          ["foodY", 5],
        ],
      },
      {
        description: "Different X → no collision",
        node: "collision",
        port: "out",
        expected: 0,
        inputs: [
          ["headX", 2],
          ["headY", 5],
          ["foodX", 3],
          ["foodY", 5],
        ],
      },
      {
        description: "Grow signal = 1 on collision",
        node: "growMux",
        port: "out",
        expected: 1,
        inputs: [
          ["headX", 3],
          ["headY", 5],
          ["foodX", 3],
          ["foodY", 5],
        ],
      },
    ],
  },

  // ── Stage 5: Phase Counter ────────────────────────────────────────
  {
    id: "phase-counter",
    title: "Multi-Step Operations",
    concept:
      "A single RAM port can only read or write one address per clock cycle. Moving the snake requires multiple operations, so we use a 4-phase counter: 0 → 1 → 2 → 3 → 0. A BitSlice keeps only the low 2 bits, wrapping automatically.",
    objective:
      "Wire the register, adder, and BitSlice so the counter cycles through 0–3 on each tick.",
    hints: [
      "The Register stores the current phase. Connect clk to phase.clk.",
      "The Adder increments: phase.q + one.out.",
      "BitSlice(low=0, high=1) extracts 2 bits, wrapping 4 back to 0.",
      "Feed the wrapped value back to phase.data. Connect enable.out to phase.we.",
    ],
    scaffold: `circuit PhaseCounter {
  clock clk
  impl {
    node phase: Register(initial=0)
    node one: Constant(value=1)
    node phaseInc: Adder
    node phaseWrap: BitSlice(low=0, high=1)

    node enable: Switch

    node display: HexDisplay

    // YOUR CODE HERE
    // 1. Connect the clock to the register
    // 2. Add 1 to the current phase
    // 3. Wrap with BitSlice to keep it 0-3
    // 4. Feed wrapped value back to the register
    // 5. Wire the enable switch and display
  }
}`,
    solution: `circuit PhaseCounter {
  clock clk
  impl {
    node phase: Register(initial=0)
    connect clk -> phase.clk

    node one: Constant(value=1)
    node phaseInc: Adder
    connect phase.q -> phaseInc.a
    connect one.out -> phaseInc.b

    node phaseWrap: BitSlice(low=0, high=1)
    connect phaseInc.sum -> phaseWrap.in
    connect phaseWrap.out -> phase.data

    node enable: Switch
    connect enable.out -> phase.we

    node display: HexDisplay
    connect phase.q -> display.in
  }
}`,
    nodePositions: {
      enable: { x: 0, y: 0 },
      one: { x: 0, y: 150 },
      phase: { x: 200, y: 0 },
      phaseInc: { x: 370, y: 50 },
      phaseWrap: { x: 530, y: 50 },
      display: { x: 530, y: 0 },
    },
    height: 260,
    checks: [
      {
        description: "Starts at 0",
        node: "phase",
        port: "q",
        expected: 0,
        inputs: [["enable", 1]],
        ticks: 0,
      },
      {
        description: "After 1 tick → 1",
        node: "phase",
        port: "q",
        expected: 1,
        inputs: [["enable", 1]],
        ticks: 1,
      },
      {
        description: "After 4 ticks → wraps to 0",
        node: "phase",
        port: "q",
        expected: 0,
        inputs: [["enable", 1]],
        ticks: 4,
      },
    ],
  },

  // ── Stage 6: Moving a Pixel ───────────────────────────────────────
  {
    id: "pixel-mover",
    title: "Moving a Pixel",
    concept:
      "Two Registers store headX and headY. Each tick, an Adder adds the direction delta, and a BitSlice wraps the result to 0–7. The wrapped coordinates are converted to a pixel address and written to the framebuffer.",
    objective:
      "Wire the movement logic so the pixel moves right (deltaX=1) on each tick, wrapping from column 7 back to 0.",
    hints: [
      "Connect clk to both headX.clk and headY.clk.",
      "Add deltaX to headX.q, and deltaY to headY.q using the Adders.",
      "BitSlice(low=0, high=2) extracts 3 bits (0–7). Feed the Adder sums through it.",
      "Convert to pixel address: shift Y left by 3, add X. Connect to ram.addrA with data=1.",
    ],
    scaffold: `circuit PixelMover {
  clock clk
  impl {
    node deltaX: Constant(value=1)
    node deltaY: Constant(value=0)
    node enable: Switch

    node headX: Register(initial=4)
    node headY: Register(initial=4)

    node addX: Adder
    node addY: Adder
    node wrapX: BitSlice(low=0, high=2)
    node wrapY: BitSlice(low=0, high=2)

    node three: Constant(value=3)
    node shiftY: LeftShifter
    node pixelAddr: Adder

    node one: Constant(value=1)
    node ram: DualPortRAM
    node screen: Screen

    node displayX: HexDisplay
    node displayY: HexDisplay

    // YOUR CODE HERE
    // 1. Connect clocks and enable to both registers
    // 2. Add deltas to current position
    // 3. Wrap both axes to 0-7 with BitSlice
    // 4. Feed wrapped values back to registers
    // 5. Calculate pixel address: (Y << 3) + X
    // 6. Write to RAM and display on screen
    // 7. Show current position on hex displays
  }
}`,
    solution: `circuit PixelMover {
  clock clk
  impl {
    node deltaX: Constant(value=1)
    node deltaY: Constant(value=0)
    node enable: Switch

    node headX: Register(initial=4)
    node headY: Register(initial=4)
    connect clk -> headX.clk
    connect clk -> headY.clk
    connect enable.out -> headX.we
    connect enable.out -> headY.we

    node addX: Adder
    connect headX.q -> addX.a
    connect deltaX.out -> addX.b

    node addY: Adder
    connect headY.q -> addY.a
    connect deltaY.out -> addY.b

    node wrapX: BitSlice(low=0, high=2)
    node wrapY: BitSlice(low=0, high=2)
    connect addX.sum -> wrapX.in
    connect addY.sum -> wrapY.in
    connect wrapX.out -> headX.data
    connect wrapY.out -> headY.data

    node three: Constant(value=3)
    node shiftY: LeftShifter
    connect headY.q -> shiftY.value
    connect three.out -> shiftY.shift

    node pixelAddr: Adder
    connect shiftY.result -> pixelAddr.a
    connect headX.q -> pixelAddr.b

    node one: Constant(value=1)
    node ram: DualPortRAM
    connect pixelAddr.sum -> ram.addrA
    connect one.out -> ram.dataA
    connect enable.out -> ram.weA
    connect screen.addrB -> ram.addrB
    connect ram.outB -> screen.dataIn

    node screen: Screen

    node displayX: HexDisplay
    node displayY: HexDisplay
    connect headX.q -> displayX.in
    connect headY.q -> displayY.in
  }
}`,
    nodePositions: {
      deltaX: { x: 0, y: 0 },
      deltaY: { x: 0, y: 100 },
      enable: { x: 0, y: 200 },
      headX: { x: 180, y: 0 },
      headY: { x: 180, y: 120 },
      addX: { x: 340, y: 0 },
      addY: { x: 340, y: 120 },
      wrapX: { x: 480, y: 0 },
      wrapY: { x: 480, y: 120 },
      three: { x: 180, y: 260 },
      shiftY: { x: 340, y: 260 },
      pixelAddr: { x: 480, y: 260 },
      one: { x: 340, y: 380 },
      ram: { x: 620, y: 260 },
      screen: { x: 780, y: 260 },
      displayX: { x: 620, y: 0 },
      displayY: { x: 620, y: 120 },
    },
    height: 420,
    checks: [
      {
        description: "Starts at X=4",
        node: "headX",
        port: "q",
        expected: 4,
        inputs: [["enable", 1]],
        ticks: 0,
      },
      {
        description: "After 1 tick → X=5",
        node: "headX",
        port: "q",
        expected: 5,
        inputs: [["enable", 1]],
        ticks: 1,
      },
      {
        description: "After 4 ticks → X wraps to 0",
        node: "headX",
        port: "q",
        expected: 0,
        inputs: [["enable", 1]],
        ticks: 4,
      },
    ],
  },
];
