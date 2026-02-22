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
    // This ensures direction only changes at cycle boundaries, preventing disconnected segments
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
    // This ensures phase 2 writes the correct value to body, and phase 3 draws it
    connect nextPixelAddr.sum -> nextHeadPixelAddr.data
    node latchNextHead: And
    connect phaseEnable.out -> latchNextHead.a
    connect isPhase1.eq -> latchNextHead.b
    connect latchNextHead.out -> nextHeadPixelAddr.we

    // Body RAM addressing (just headPtr or tailPtr + bodyBase, since we store 1 byte per segment)
    // IMPORTANT: For head, we write to headPtr + 1 (next position), not headPtr (current position)
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
    // Phase 0: Draw food (if foodNeedsDrawing) OR read tail address
    // Phase 1: Clear tail pixel
    // Phase 2: Write head address to body
    // Phase 3: Draw head pixel, update pointers

    // Phase 0: Food drawing OR tail reading
    node phase0Addr: Mux
    connect tailBodyAddr.sum -> phase0Addr.in0       // Normal: read tail
    connect foodPixelAddr.sum -> phase0Addr.in1      // Food mode: draw food
    connect foodNeedsDrawing.q -> phase0Addr.sel

    // RAM address selection
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
    // Phase 0: 1 (draw food pixel) - only when foodNeedsDrawing
    // Phase 1: 0 (clear tail pixel)
    // Phase 2: nextHeadPixelAddr (write head address to body)
    // Phase 3: 1 (draw head pixel)

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

    // Movement detection: only move tail if snake is actually moving
    // isMoving = (deltaX != 0) OR (deltaY != 0)
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
    // Phase 0: Draw food (if foodNeedsDrawing)
    // Phase 1: Clear tail (if moving AND shouldMoveTail AND buffer not empty AND not eating food)
    // Phase 2: Write head address to body (ONLY when moving)
    // Phase 3: Draw head pixel (ONLY when moving)

    node shouldMoveTail: Switch(value=1)

    // Prevent tail clearing when about to eat food (makes snake grow!)
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

    // Phase 0: Draw food
    node writePhase0: And
    connect isPhase0.eq -> writePhase0.a
    connect foodNeedsDrawing.q -> writePhase0.b

    node writePhase1: And
    connect isPhase1.eq -> writePhase1.a
    connect shouldClearTailMoving.out -> writePhase1.b

    // Phase 2 and 3 writes only when moving
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

    // tailPixelAddr: Latch in phase 0 (read from RAM port A)
    // But ONLY if not drawing food (foodNeedsDrawing would prevent read)
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

    // Clear foodNeedsDrawing flag after food is drawn (in phase 0)
    node clearFoodFlag: And
    connect phaseEnable.out -> clearFoodFlag.a
    connect isPhase0.eq -> clearFoodFlag.b
    node clearFoodFlagFinal: And
    connect clearFoodFlag.out -> clearFoodFlagFinal.a
    connect foodNeedsDrawing.q -> clearFoodFlagFinal.b

    // Food respawn: When snake eats food in phase 3
    node ateFood: And
    node ateFoodFinal: And
    connect phaseEnable.out -> ateFood.a
    connect isPhase3.eq -> ateFood.b
    connect ateFood.out -> ateFoodFinal.a
    connect willEatFood.out -> ateFoodFinal.b

    // foodNeedsDrawing write enable: set (1) when eaten, clear (0) when drawn
    node foodFlagWriteEnable: Or
    connect ateFoodFinal.out -> foodFlagWriteEnable.a
    connect clearFoodFlagFinal.out -> foodFlagWriteEnable.b
    connect foodFlagWriteEnable.out -> foodNeedsDrawing.we

    // foodNeedsDrawing data: 1 when eaten, 0 when cleared
    node foodFlagData: Mux
    connect zero.out -> foodFlagData.in0
    connect one.out -> foodFlagData.in1
    connect ateFoodFinal.out -> foodFlagData.sel
    connect foodFlagData.out -> foodNeedsDrawing.data

    // Food respawn to new position (simple pseudo-random: +3 X, +5 Y)
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

    // Update food position when eaten
    connect foodXWrap.out -> foodX.data
    connect foodYWrap.out -> foodY.data
    connect ateFoodFinal.out -> foodX.we
    connect ateFoodFinal.out -> foodY.we

    // headX, headY: Update in phase 3 with nextHeadX/Y (NOT the pixel address!)
    // ONLY update when actually moving to prevent duplicate body buffer entries
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

    // headPtr: Increment in phase 3 (only when moving)
    node headPtrInc: Adder
    connect headPtr.q -> headPtrInc.a
    connect one.out -> headPtrInc.b

    node headPtrWrap: BitSlice(low=0, high=5)  // Take bits [0:5] for 0-63
    connect headPtrInc.sum -> headPtrWrap.in

    connect headPtrWrap.out -> headPtr.data
    connect updateHeadFinal.out -> headPtr.we

    // tailPtr: Conditionally increment in phase 3
    node tailPtrInc: Adder
    connect tailPtr.q -> tailPtrInc.a
    connect one.out -> tailPtrInc.b

    node tailPtrWrap: BitSlice(low=0, high=5)  // Take bits [0:5] for 0-63
    connect tailPtrInc.sum -> tailPtrWrap.in

    connect tailPtrWrap.out -> tailPtr.data
    node updateTail: And
    node updateTailFinal: And
    connect phaseEnable.out -> updateTail.a
    connect isPhase3.eq -> updateTail.b
    connect updateTail.out -> updateTailFinal.a
    connect shouldClearTailMoving.out -> updateTailFinal.b
    connect updateTailFinal.out -> tailPtr.we

    // snakeLen: Update in phase 3
    // +1 if not moving tail (growing), 0 if moving tail (constant length)
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
