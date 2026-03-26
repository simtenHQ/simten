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
    dsl: `// Snake — a complete game built entirely from logic gates
// Features: food spawning, snake growth, circular buffer body storage,
// 4-phase pipeline (calculate, clear tail, write body, draw head).
// Use arrow key codes via the keyboard Input node. Press play to run.

circuit SnakeAdvanced {
  impl {
    // Dual-Port RAM and Screen
    // Storage: pixel addresses (0-63), not X/Y — halves RAM operations
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
    connect ram.outB -> screen.dataIn

    // RAM Layout:
    // 0-63:   Screen framebuffer (8x8 pixels)
    // 64-127: Snake body storage (64 segments max, 1 byte each: pixel address)

    // Keyboard input
    node keyboard: Input

    // Food position
    node foodX: Register(initial=6)
    node foodY: Register(initial=3)
    node foodNeedsDrawing: Register(initial=1)

    // Snake circular buffer pointers
    node headPtr: Register(initial=3)
    node tailPtr: Register(initial=0)
    node snakeLen: Register(initial=4)

    // Current head position (X, Y coordinates)
    node headX: Register(initial=4)
    node headY: Register(initial=4)

    // Tail pixel address read from RAM (in phase 0)
    node tailPixelAddr: Register(initial=33)

    // NEXT head pixel address (calculated and latched in phase 0)
    node nextHeadPixelAddr: Register(initial=36)

    // Phase counter: 0-3
    // Phase 0: Calculate next head, read tail address from body
    // Phase 1: Clear tail pixel in framebuffer
    // Phase 2: Write head address to body
    // Phase 3: Draw head pixel, update pointers
    node phase: Register(initial=0)

    // Constants
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)
    node three: Constant(value=3)
    node bodyBase: Constant(value=64)
    node minus1: Constant(value=255)
    node eight: Constant(value=8)

    // Phase increment (wraps with 2-bit counter)
    node phaseInc: Adder
    connect phase.q -> phaseInc.a
    connect one.out -> phaseInc.b

    node phaseWrap: BitSlice(low=0, high=1)
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

    // Latched keyboard (updated phase 0 only — prevents mid-cycle direction change)
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

    // Direction detection
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

    // Next head position
    node nextHeadXCalc: Adder
    node nextHeadYCalc: Adder
    connect headX.q -> nextHeadXCalc.a
    connect deltaX.out -> nextHeadXCalc.b
    connect headY.q -> nextHeadYCalc.a
    connect deltaY.out -> nextHeadYCalc.b

    // Wrap to 0-7
    node nextHeadX: BitSlice(low=0, high=2)
    node nextHeadY: BitSlice(low=0, high=2)
    connect nextHeadXCalc.sum -> nextHeadX.in
    connect nextHeadYCalc.sum -> nextHeadY.in

    // Convert to pixel address: Y * 8 + X
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

    // Food pixel address: foodY * 8 + foodX
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

    // Food collision detection
    node nextHeadAtFoodX: Comparator
    node nextHeadAtFoodY: Comparator
    connect nextHeadX.out -> nextHeadAtFoodX.a
    connect foodX.q -> nextHeadAtFoodX.b
    connect nextHeadY.out -> nextHeadAtFoodY.a
    connect foodY.q -> nextHeadAtFoodY.b

    node willEatFood: And
    connect nextHeadAtFoodX.eq -> willEatFood.a
    connect nextHeadAtFoodY.eq -> willEatFood.b

    // Latch next head pixel address in phase 1
    connect nextPixelAddr.sum -> nextHeadPixelAddr.data
    node latchNextHead: And
    connect phaseEnable.out -> latchNextHead.a
    connect isPhase1.eq -> latchNextHead.b
    connect latchNextHead.out -> nextHeadPixelAddr.we

    // Body RAM addressing
    node headPtrNext: Adder
    connect headPtr.q -> headPtrNext.a
    connect one.out -> headPtrNext.b

    node headPtrNextWrap: BitSlice(low=0, high=5)
    connect headPtrNext.sum -> headPtrNextWrap.in

    node headBodyAddr: Adder
    connect headPtrNextWrap.out -> headBodyAddr.a
    connect bodyBase.out -> headBodyAddr.b

    node tailBodyAddr: Adder
    connect tailPtr.q -> tailBodyAddr.a
    connect bodyBase.out -> tailBodyAddr.b

    // RAM Port A address multiplexing across phases
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

    // RAM write enable logic
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

    // tailPixelAddr: Latch in phase 0
    connect ram.outA -> tailPixelAddr.data
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

    // Clear foodNeedsDrawing after drawing
    node clearFoodFlag: And
    connect phaseEnable.out -> clearFoodFlag.a
    connect isPhase0.eq -> clearFoodFlag.b
    node clearFoodFlagFinal: And
    connect clearFoodFlag.out -> clearFoodFlagFinal.a
    connect foodNeedsDrawing.q -> clearFoodFlagFinal.b

    // Food respawn when eaten
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

    // Food respawn position (pseudo-random: +3 X, +5 Y)
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

    // Head position update (phase 3, only when moving)
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

    // headPtr increment (phase 3, only when moving)
    node headPtrInc: Adder
    connect headPtr.q -> headPtrInc.a
    connect one.out -> headPtrInc.b

    node headPtrWrap: BitSlice(low=0, high=5)
    connect headPtrInc.sum -> headPtrWrap.in

    connect headPtrWrap.out -> headPtr.data
    connect updateHeadFinal.out -> headPtr.we

    // tailPtr conditional increment (phase 3)
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

    // Snake length tracking
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
}`,
  },
  {
    id: "tpu-3x3",
    title: "3x3 Systolic Array (TPU)",
    description: "Google's TPU architecture — 9 processing elements doing matrix multiplication in a wavefront pattern. Watch A*B compute one cycle at a time.",
    category: "cpu",
    nodes: "~120 nodes",
    dsl: `// 3x3 Systolic Array — How TPUs Do Matrix Multiplication
// Architecture: weight-stationary with registered partial-sum flow.
// - Cycle 0: load all 9 weights into PEs
// - Staggered data injection: row r starts at cycle 1+r
// - Results emerge at bottom row in wavefront order
// - 9 ticks total for a 3x3 multiply (3N for NxN)
//
// Test: A=[[1,2,3],[4,5,6],[7,8,9]] * B=[[2,0,1],[0,2,0],[1,0,2]]
// Expected C = [[5,4,7],[14,10,16],[23,16,25]]
// Toggle 'start' switch then step through 9 cycles.

circuit PE_Systolic {
  input dataIn: Bus[8]
  input weightIn: Bus[8]
  input partialSumIn: Bus[16]
  input weightValid: Bit
  clock clk
  output dataOut: Bus[8]
  output partialSumOut: Bus[16]

  impl {
    node weightReg: Register
    node mult: Multiplier
    node adder: Adder(width=16)
    node psumReg: Register
    node dataPipe: Register
    node one: Constant(value=1)
    node zero: Constant(value=0)

    connect weightIn -> weightReg.data
    connect weightValid -> weightReg.we
    connect clk -> weightReg.clk

    connect dataIn -> mult.a
    connect weightReg.q -> mult.b

    connect partialSumIn -> adder.a
    connect mult.product -> adder.b
    connect zero.out -> adder.carry_in

    connect adder.sum -> psumReg.data
    connect one.out -> psumReg.we
    connect clk -> psumReg.clk
    connect psumReg.q -> partialSumOut

    connect dataIn -> dataPipe.data
    connect one.out -> dataPipe.we
    connect clk -> dataPipe.clk
    connect dataPipe.q -> dataOut
  }
}

circuit Systolic3x3 {
  input a00: Bus[8]
  input a01: Bus[8]
  input a02: Bus[8]
  input a10: Bus[8]
  input a11: Bus[8]
  input a12: Bus[8]
  input a20: Bus[8]
  input a21: Bus[8]
  input a22: Bus[8]
  input b00: Bus[8]
  input b01: Bus[8]
  input b02: Bus[8]
  input b10: Bus[8]
  input b11: Bus[8]
  input b12: Bus[8]
  input b20: Bus[8]
  input b21: Bus[8]
  input b22: Bus[8]
  input start: Bit
  clock clk
  output c00: Bus[16]
  output c01: Bus[16]
  output c02: Bus[16]
  output c10: Bus[16]
  output c11: Bus[16]
  output c12: Bus[16]
  output c20: Bus[16]
  output c21: Bus[16]
  output c22: Bus[16]
  output done: Bit

  impl {
    node pe00: PE_Systolic
    node pe01: PE_Systolic
    node pe02: PE_Systolic
    node pe10: PE_Systolic
    node pe11: PE_Systolic
    node pe12: PE_Systolic
    node pe20: PE_Systolic
    node pe21: PE_Systolic
    node pe22: PE_Systolic
    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe02.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk
    connect clk -> pe12.clk
    connect clk -> pe20.clk
    connect clk -> pe21.clk
    connect clk -> pe22.clk

    node zero: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)
    node three: Constant(value=3)
    node four: Constant(value=4)
    node five: Constant(value=5)
    node six: Constant(value=6)
    node seven: Constant(value=7)
    node eight: Constant(value=8)
    node nine: Constant(value=9)

    // Cycle counter (0..9, stops at 9)
    node counter: Register(initial=0)
    node counterInc: Incrementer
    node counterMux: Mux
    node notDone: Comparator
    node shouldAdvance: And

    connect counter.q -> counterInc.in
    connect counter.q -> notDone.a
    connect nine.out -> notDone.b
    connect start -> shouldAdvance.a
    connect notDone.lt -> shouldAdvance.b
    connect shouldAdvance.out -> counterMux.sel
    connect counter.q -> counterMux.in0
    connect counterInc.out -> counterMux.in1
    connect counterMux.out -> counter.data
    connect one.out -> counter.we
    connect clk -> counter.clk

    // Cycle decoder
    node isCycle0: Comparator
    node isCycle1: Comparator
    node isCycle2: Comparator
    node isCycle3: Comparator
    node isCycle4: Comparator
    node isCycle5: Comparator
    node isCycle6: Comparator
    node isCycle7: Comparator
    node isCycle8: Comparator
    connect counter.q -> isCycle0.a
    connect zero.out -> isCycle0.b
    connect counter.q -> isCycle1.a
    connect one.out -> isCycle1.b
    connect counter.q -> isCycle2.a
    connect two.out -> isCycle2.b
    connect counter.q -> isCycle3.a
    connect three.out -> isCycle3.b
    connect counter.q -> isCycle4.a
    connect four.out -> isCycle4.b
    connect counter.q -> isCycle5.a
    connect five.out -> isCycle5.b
    connect counter.q -> isCycle6.a
    connect six.out -> isCycle6.b
    connect counter.q -> isCycle7.a
    connect seven.out -> isCycle7.b
    connect counter.q -> isCycle8.a
    connect eight.out -> isCycle8.b

    // Weight loading (cycle 0 only)
    node loadWeights: And
    connect isCycle0.eq -> loadWeights.a
    connect start -> loadWeights.b
    connect b00 -> pe00.weightIn
    connect b01 -> pe01.weightIn
    connect b02 -> pe02.weightIn
    connect b10 -> pe10.weightIn
    connect b11 -> pe11.weightIn
    connect b12 -> pe12.weightIn
    connect b20 -> pe20.weightIn
    connect b21 -> pe21.weightIn
    connect b22 -> pe22.weightIn
    connect loadWeights.out -> pe00.weightValid
    connect loadWeights.out -> pe01.weightValid
    connect loadWeights.out -> pe02.weightValid
    connect loadWeights.out -> pe10.weightValid
    connect loadWeights.out -> pe11.weightValid
    connect loadWeights.out -> pe12.weightValid
    connect loadWeights.out -> pe20.weightValid
    connect loadWeights.out -> pe21.weightValid
    connect loadWeights.out -> pe22.weightValid

    // Data injection (staggered: row r starts at cycle 1+r)
    node muxR0a: Mux
    node muxR0b: Mux
    node muxR0c: Mux
    connect isCycle1.eq -> muxR0a.sel
    connect zero.out -> muxR0a.in0
    connect a00 -> muxR0a.in1
    connect isCycle2.eq -> muxR0b.sel
    connect muxR0a.out -> muxR0b.in0
    connect a10 -> muxR0b.in1
    connect isCycle3.eq -> muxR0c.sel
    connect muxR0b.out -> muxR0c.in0
    connect a20 -> muxR0c.in1

    node muxR1a: Mux
    node muxR1b: Mux
    node muxR1c: Mux
    connect isCycle2.eq -> muxR1a.sel
    connect zero.out -> muxR1a.in0
    connect a01 -> muxR1a.in1
    connect isCycle3.eq -> muxR1b.sel
    connect muxR1a.out -> muxR1b.in0
    connect a11 -> muxR1b.in1
    connect isCycle4.eq -> muxR1c.sel
    connect muxR1b.out -> muxR1c.in0
    connect a21 -> muxR1c.in1

    node muxR2a: Mux
    node muxR2b: Mux
    node muxR2c: Mux
    connect isCycle3.eq -> muxR2a.sel
    connect zero.out -> muxR2a.in0
    connect a02 -> muxR2a.in1
    connect isCycle4.eq -> muxR2b.sel
    connect muxR2a.out -> muxR2b.in0
    connect a12 -> muxR2b.in1
    connect isCycle5.eq -> muxR2c.sel
    connect muxR2b.out -> muxR2c.in0
    connect a22 -> muxR2c.in1

    // Horizontal data flow (left -> right)
    connect muxR0c.out -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn
    connect pe01.dataOut -> pe02.dataIn
    connect muxR1c.out -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn
    connect pe11.dataOut -> pe12.dataIn
    connect muxR2c.out -> pe20.dataIn
    connect pe20.dataOut -> pe21.dataIn
    connect pe21.dataOut -> pe22.dataIn

    // Vertical partial-sum flow (top -> bottom)
    connect zero.out -> pe00.partialSumIn
    connect zero.out -> pe01.partialSumIn
    connect zero.out -> pe02.partialSumIn
    connect pe00.partialSumOut -> pe10.partialSumIn
    connect pe01.partialSumOut -> pe11.partialSumIn
    connect pe02.partialSumOut -> pe12.partialSumIn
    connect pe10.partialSumOut -> pe20.partialSumIn
    connect pe11.partialSumOut -> pe21.partialSumIn
    connect pe12.partialSumOut -> pe22.partialSumIn

    // Result registers (C[k][j] emerges at PE(2,j) on cycle k+j+4)
    node result_c00: Register
    connect pe20.partialSumOut -> result_c00.data
    connect isCycle4.eq -> result_c00.we
    connect clk -> result_c00.clk

    node result_c10: Register
    connect pe20.partialSumOut -> result_c10.data
    connect isCycle5.eq -> result_c10.we
    connect clk -> result_c10.clk

    node result_c20: Register
    connect pe20.partialSumOut -> result_c20.data
    connect isCycle6.eq -> result_c20.we
    connect clk -> result_c20.clk

    node result_c01: Register
    connect pe21.partialSumOut -> result_c01.data
    connect isCycle5.eq -> result_c01.we
    connect clk -> result_c01.clk

    node result_c11: Register
    connect pe21.partialSumOut -> result_c11.data
    connect isCycle6.eq -> result_c11.we
    connect clk -> result_c11.clk

    node result_c21: Register
    connect pe21.partialSumOut -> result_c21.data
    connect isCycle7.eq -> result_c21.we
    connect clk -> result_c21.clk

    node result_c02: Register
    connect pe22.partialSumOut -> result_c02.data
    connect isCycle6.eq -> result_c02.we
    connect clk -> result_c02.clk

    node result_c12: Register
    connect pe22.partialSumOut -> result_c12.data
    connect isCycle7.eq -> result_c12.we
    connect clk -> result_c12.clk

    node result_c22: Register
    connect pe22.partialSumOut -> result_c22.data
    connect isCycle8.eq -> result_c22.we
    connect clk -> result_c22.clk

    connect result_c00.q -> c00
    connect result_c01.q -> c01
    connect result_c02.q -> c02
    connect result_c10.q -> c10
    connect result_c11.q -> c11
    connect result_c12.q -> c12
    connect result_c20.q -> c20
    connect result_c21.q -> c21
    connect result_c22.q -> c22

    // Done = counter reached 9
    node isDone: Comparator
    connect counter.q -> isDone.a
    connect nine.out -> isDone.b
    connect isDone.eq -> done
  }
}

circuit TestSystolic3x3 {
  clock clk
  impl {
    node sys: Systolic3x3

    // Matrix A = [[1,2,3],[4,5,6],[7,8,9]]
    node a00: Input(value=1)
    node a01: Input(value=2)
    node a02: Input(value=3)
    node a10: Input(value=4)
    node a11: Input(value=5)
    node a12: Input(value=6)
    node a20: Input(value=7)
    node a21: Input(value=8)
    node a22: Input(value=9)

    // Matrix B = [[2,0,1],[0,2,0],[1,0,2]]
    node b00: Input(value=2)
    node b01: Input(value=0)
    node b02: Input(value=1)
    node b10: Input(value=0)
    node b11: Input(value=2)
    node b12: Input(value=0)
    node b20: Input(value=1)
    node b21: Input(value=0)
    node b22: Input(value=2)

    node start: Switch

    connect a00.out -> sys.a00
    connect a01.out -> sys.a01
    connect a02.out -> sys.a02
    connect a10.out -> sys.a10
    connect a11.out -> sys.a11
    connect a12.out -> sys.a12
    connect a20.out -> sys.a20
    connect a21.out -> sys.a21
    connect a22.out -> sys.a22
    connect b00.out -> sys.b00
    connect b01.out -> sys.b01
    connect b02.out -> sys.b02
    connect b10.out -> sys.b10
    connect b11.out -> sys.b11
    connect b12.out -> sys.b12
    connect b20.out -> sys.b20
    connect b21.out -> sys.b21
    connect b22.out -> sys.b22

    connect start.out -> sys.start
    connect clk -> sys.clk

    // Result displays (3x3 matrix C)
    node display_c00: HexDisplay
    node display_c01: HexDisplay
    node display_c02: HexDisplay
    node display_c10: HexDisplay
    node display_c11: HexDisplay
    node display_c12: HexDisplay
    node display_c20: HexDisplay
    node display_c21: HexDisplay
    node display_c22: HexDisplay
    node done_led: Led

    connect sys.c00 -> display_c00.in
    connect sys.c01 -> display_c01.in
    connect sys.c02 -> display_c02.in
    connect sys.c10 -> display_c10.in
    connect sys.c11 -> display_c11.in
    connect sys.c12 -> display_c12.in
    connect sys.c20 -> display_c20.in
    connect sys.c21 -> display_c21.in
    connect sys.c22 -> display_c22.in
    connect sys.done -> done_led.in
  }
}`,
  },
  {
    id: "fibonacci",
    title: "Fibonacci Generator",
    description: "Pure datapath — two registers and one adder produce the Fibonacci sequence every clock tick. No software, no ROM, no instructions.",
    category: "math",
    nodes: "~12 nodes",
    dsl: `// Hardware Fibonacci Sequence Generator
// Pure datapath — no software, no ROM, no instructions.
// Two registers + one adder produce the Fibonacci sequence every clock tick.
// Output: 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, ... (wraps at 8-bit)

circuit Fibonacci {
  description "Hardware Fibonacci generator - pure datapath, no software"
  output fib: Bus[8]
  clock clk
  impl {
    node reg_a: Register
    node reg_b: Register
    node adder: Adder
    node one_bit: Constant(value=1)

    // Seed trick: DFlipFlop starts false, goes true after first tick
    // q_bar is true only on first tick, injecting +1 via carry_in
    node init: DFlipFlop
    connect one_bit.out -> init.d
    connect init.q_bar -> adder.carry_in

    // reg_a + reg_b + (1 on first tick only)
    connect reg_a.q -> adder.a
    connect reg_b.q -> adder.b

    // Shift: reg_a <- reg_b, reg_b <- sum
    connect reg_b.q -> reg_a.data
    connect one_bit.out -> reg_a.we
    connect adder.sum -> reg_b.data
    connect one_bit.out -> reg_b.we

    connect reg_b.q -> fib
  }
}

circuit FibonacciDemo {
  description "Interactive Fibonacci with hex display and 8 LEDs showing binary"
  clock clk
  impl {
    node fib: Fibonacci
    node display: HexDisplay
    node leds: Splitter8to8
    node led0: Led
    node led1: Led
    node led2: Led
    node led3: Led
    node led4: Led
    node led5: Led
    node led6: Led
    node led7: Led

    connect fib.fib -> display.in
    connect fib.fib -> leds.in

    connect leds.bit0 -> led0.in
    connect leds.bit1 -> led1.in
    connect leds.bit2 -> led2.in
    connect leds.bit3 -> led3.in
    connect leds.bit4 -> led4.in
    connect leds.bit5 -> led5.in
    connect leds.bit6 -> led6.in
    connect leds.bit7 -> led7.in
  }
}`,
  },
  {
    id: "rule30",
    title: "Rule 30 Cellular Automaton",
    description: "Wolfram's famous Rule 30 — the simplest known source of cryptographic randomness. 8 cells in a ring, two gates per cell, chaos from one seed.",
    category: "math",
    nodes: "~40 nodes",
    dsl: `// Rule 30 Cellular Automaton
//
// Stephen Wolfram's famous Rule 30 — the simplest known source of
// cryptographic-grade pseudorandomness. One rule applied to 8 cells
// in a ring produces chaotic, non-repeating patterns.
//
// The rule: next = left XOR (center OR right)
// That's it. Two gates per cell. Turing complete.
//
// Seed one cell in the middle, watch chaos emerge.

circuit Rule30Cell {
  description "Single Rule 30 cell: next = left XOR (center OR right)"
  input left: Bit
  input center: Bit
  input right: Bit
  output next: Bit
  impl {
    node or1: Or
    node xor1: Xor
    connect center -> or1.a
    connect right -> or1.b
    connect left -> xor1.a
    connect or1.out -> xor1.b
    connect xor1.out -> next
  }
}

circuit Rule30 {
  description "Rule 30 cellular automaton — 8 cells in a ring, chaos from a single seed"
  clock clk
  impl {
    node c0: DFlipFlop
    node c1: DFlipFlop
    node c2: DFlipFlop
    node c3: DFlipFlop
    node c4: DFlipFlop
    node c5: DFlipFlop
    node c6: DFlipFlop
    node c7: DFlipFlop

    node r0: Rule30Cell
    node r1: Rule30Cell
    node r2: Rule30Cell
    node r3: Rule30Cell
    node r4: Rule30Cell
    node r5: Rule30Cell
    node r6: Rule30Cell
    node r7: Rule30Cell

    // Seed trick: cell 4 starts ON
    node one: Constant(value=1)
    node init: DFlipFlop
    connect one.out -> init.d

    node mux4: Mux
    connect one.out -> mux4.in0
    connect r4.next -> mux4.in1
    connect init.q -> mux4.sel
    connect mux4.out -> c4.d

    // Toroidal connections — wrapping at edges
    connect c7.q -> r0.left
    connect c0.q -> r0.center
    connect c1.q -> r0.right
    connect r0.next -> c0.d

    connect c0.q -> r1.left
    connect c1.q -> r1.center
    connect c2.q -> r1.right
    connect r1.next -> c1.d

    connect c1.q -> r2.left
    connect c2.q -> r2.center
    connect c3.q -> r2.right
    connect r2.next -> c2.d

    connect c2.q -> r3.left
    connect c3.q -> r3.center
    connect c4.q -> r3.right
    connect r3.next -> c3.d

    connect c3.q -> r4.left
    connect c4.q -> r4.center
    connect c5.q -> r4.right

    connect c4.q -> r5.left
    connect c5.q -> r5.center
    connect c6.q -> r5.right
    connect r5.next -> c5.d

    connect c5.q -> r6.left
    connect c6.q -> r6.center
    connect c7.q -> r6.right
    connect r6.next -> c6.d

    connect c6.q -> r7.left
    connect c7.q -> r7.center
    connect c0.q -> r7.right
    connect r7.next -> c7.d

    // 8 LEDs showing the current state
    node led0: Led
    node led1: Led
    node led2: Led
    node led3: Led
    node led4: Led
    node led5: Led
    node led6: Led
    node led7: Led
    connect c0.q -> led0.in
    connect c1.q -> led1.in
    connect c2.q -> led2.in
    connect c3.q -> led3.in
    connect c4.q -> led4.in
    connect c5.q -> led5.in
    connect c6.q -> led6.in
    connect c7.q -> led7.in

    node combine: Combiner8to8
    connect c0.q -> combine.bit0
    connect c1.q -> combine.bit1
    connect c2.q -> combine.bit2
    connect c3.q -> combine.bit3
    connect c4.q -> combine.bit4
    connect c5.q -> combine.bit5
    connect c6.q -> combine.bit6
    connect c7.q -> combine.bit7

    node display: HexDisplay
    connect combine.out -> display.in
  }
}`,
  },
  {
    id: "alu",
    title: "8-Bit ALU",
    description: "The heart of every CPU — 8 operations (ADD, SUB, AND, OR, XOR, NOT, SHL, SHR) selected by a 3-bit opcode, with zero/carry/negative flags.",
    category: "cpu",
    nodes: "~30 nodes",
    dsl: `// 8-Bit ALU — The Heart of Every CPU
//
// 8 operations selected by 3-bit opcode:
//   000: ADD    001: SUB    010: AND    011: OR
//   100: XOR    101: NOT    110: SHL    111: SHR
//
// Toggle the opcode switches below to change operations in real time.
// Status flags: Zero, Carry, Negative

circuit ALU {
  description "8-bit ALU — 8 operations, 3 status flags, the heart of every CPU"
  input a: Bus[8]
  input b: Bus[8]
  input op0: Bit
  input op1: Bit
  input op2: Bit
  output result: Bus[8]
  output zero: Bit
  output carry: Bit
  output negative: Bit
  impl {
    node gnd: Constant(value=0)

    node add: Adder
    node sub: Subtractor
    node band: BusAnd
    node bor: BusOr
    node bxor: BusXor
    node bnot: BusNot
    node shl: LeftShifter
    node shr: RightShifter

    connect a -> add.a
    connect b -> add.b
    connect gnd.out -> add.carry_in

    connect a -> sub.a
    connect b -> sub.b
    connect gnd.out -> sub.borrow_in

    connect a -> band.a
    connect b -> band.b

    connect a -> bor.a
    connect b -> bor.b

    connect a -> bxor.a
    connect b -> bxor.b

    connect a -> bnot.in

    connect a -> shl.value
    connect b -> shl.shift

    connect a -> shr.value
    connect b -> shr.shift

    // 3-level mux tree selects result from opcode
    node m01: Mux(width=8)
    connect add.sum -> m01.in0
    connect sub.difference -> m01.in1
    connect op0 -> m01.sel

    node m23: Mux(width=8)
    connect band.out -> m23.in0
    connect bor.out -> m23.in1
    connect op0 -> m23.sel

    node m45: Mux(width=8)
    connect bxor.out -> m45.in0
    connect bnot.out -> m45.in1
    connect op0 -> m45.sel

    node m67: Mux(width=8)
    connect shl.result -> m67.in0
    connect shr.result -> m67.in1
    connect op0 -> m67.sel

    node m03: Mux(width=8)
    connect m01.out -> m03.in0
    connect m23.out -> m03.in1
    connect op1 -> m03.sel

    node m47: Mux(width=8)
    connect m45.out -> m47.in0
    connect m67.out -> m47.in1
    connect op1 -> m47.sel

    node mfinal: Mux(width=8)
    connect m03.out -> mfinal.in0
    connect m47.out -> mfinal.in1
    connect op2 -> mfinal.sel

    connect mfinal.out -> result

    // --- Flags ---
    connect add.carry_out -> carry

    node split_r: Splitter8to8
    connect mfinal.out -> split_r.in
    connect split_r.bit7 -> negative

    // Zero = NOR tree (result == 0)
    node or01: Or
    node or23: Or
    node or45: Or
    node or67: Or
    connect split_r.bit0 -> or01.a
    connect split_r.bit1 -> or01.b
    connect split_r.bit2 -> or23.a
    connect split_r.bit3 -> or23.b
    connect split_r.bit4 -> or45.a
    connect split_r.bit5 -> or45.b
    connect split_r.bit6 -> or67.a
    connect split_r.bit7 -> or67.b

    node or_lo: Or
    node or_hi: Or
    connect or01.out -> or_lo.a
    connect or23.out -> or_lo.b
    connect or45.out -> or_hi.a
    connect or67.out -> or_hi.b

    node or_all: Or
    connect or_lo.out -> or_all.a
    connect or_hi.out -> or_all.b

    node inv_z: Not
    connect or_all.out -> inv_z.in
    connect inv_z.out -> zero
  }
}

circuit ALUDemo {
  description "Interactive ALU — toggle opcode switches to change operations in real time"
  impl {
    node a: Input(value=42)
    node b: Input(value=13)

    node op0: Switch
    node op1: Switch
    node op2: Switch

    node alu: ALU
    connect a.out -> alu.a
    connect b.out -> alu.b
    connect op0.out -> alu.op0
    connect op1.out -> alu.op1
    connect op2.out -> alu.op2

    node disp_a: HexDisplay
    node disp_b: HexDisplay
    node disp_result: HexDisplay
    connect a.out -> disp_a.in
    connect b.out -> disp_b.in
    connect alu.result -> disp_result.in

    node led_zero: Led
    node led_carry: Led
    node led_neg: Led
    connect alu.zero -> led_zero.in
    connect alu.carry -> led_carry.in
    connect alu.negative -> led_neg.in
  }
}`,
  },
  {
    id: "half-adder",
    title: "Half Adder",
    description: "The simplest arithmetic circuit — XOR for sum, AND for carry. The building block of every adder in every CPU ever made.",
    category: "basics",
    nodes: "4 nodes",
    dsl: `// Half Adder — the simplest arithmetic circuit
// XOR computes sum, AND computes carry.
// This is the building block of every adder in every CPU.
// Toggle the switches and watch the outputs change.

circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit
  impl {
    node xor1: Xor
    node and1: And
    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum
    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}

circuit HalfAdderDemo {
  impl {
    node sw_a: Switch
    node sw_b: Switch
    node dut: HalfAdder
    node led_sum: Led
    node led_carry: Led
    connect sw_a.out -> dut.a
    connect sw_b.out -> dut.b
    connect dut.sum -> led_sum.in
    connect dut.carry -> led_carry.in
  }
}`,
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
