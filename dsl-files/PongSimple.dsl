circuit PongSimple {
  impl {
    node ram: DualPortRAM
    node screen: Screen
    connect screen.addrB -> ram.addrB
    connect ram.outB -> screen.dataIn

    // Multi-register keyboard controller (2 independent scan code registers)
    // Hardware distributes pressed keys in sorted order: keyboard0 gets lowest scan code, keyboard1 gets next
    // Circuit polls both registers using OR logic to detect any key
    node keyboard0: Input
    node keyboard1: Input

    // Game state registers
    node ballX: Register
    node ballY: Register
    node ballDX: Register
    node ballDY: Register
    node leftPaddleY: Register
    node rightPaddleY: Register

    // Old positions (for clearing)
    node oldBallX: Register
    node oldBallY: Register
    node oldLeftPaddleY: Register
    node oldRightPaddleY: Register

    // Phase counter (0-5 using a Register)
    node phaseCounter: Register

    // Increment phase
    node phaseIncrement: Adder
    connect phaseCounter.q -> phaseIncrement.a
    node one: Input  // 1
    connect one.out -> phaseIncrement.b

    // Wrap at 6 (reset to 0)
    node phaseMod: Comparator
    node six: Input  // 6
    connect phaseIncrement.sum -> phaseMod.a
    connect six.out -> phaseMod.b

    node nextPhase: Mux
    connect phaseIncrement.sum -> nextPhase.in0
    node zero: Input  // 0
    connect zero.out -> nextPhase.in1
    connect phaseMod.eq -> nextPhase.sel

    connect nextPhase.out -> phaseCounter.data
    node phaseEnable: Switch
    connect phaseEnable.out -> phaseCounter.we

    // Phase detection
    node phase0Const: Input  // 0
    node phase1Const: Input  // 1
    node phase2Const: Input  // 2
    node phase3Const: Input  // 3
    node phase4Const: Input  // 4
    node phase5Const: Input  // 5

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

    // Constants
    node seven: Input      // 7
    node minus1: Input     // 255

    // Keyboard scan codes
    node keyW: Input       // 17 (W)
    node keyS: Input       // 31 (S)
    node keyUp: Input      // 72 (Up arrow)
    node keyDown: Input    // 80 (Down arrow)

    // Keyboard detection - poll BOTH registers using OR logic
    // This is like hardware polling multiple input ports

    // Check keyboard0 for W/S/Up/Down
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

    // Check keyboard1 for W/S/Up/Down
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

    // Combine results: key is pressed if detected in ANY register
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

    // Left paddle movement
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

    // Right paddle movement
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

    // Ball movement
    node newBallX: Adder
    node newBallY: Adder
    connect ballX.q -> newBallX.a
    connect ballDX.q -> newBallX.b
    connect ballY.q -> newBallY.a
    connect ballDY.q -> newBallY.b

    // Update game state only in phase 5
    node updateEnable: Switch
    node shouldUpdate: And
    connect updateEnable.out -> shouldUpdate.a
    connect isPhase5.eq -> shouldUpdate.b

    // Save old positions
    connect ballX.q -> oldBallX.data
    connect ballY.q -> oldBallY.data
    connect leftPaddleY.q -> oldLeftPaddleY.data
    connect rightPaddleY.q -> oldRightPaddleY.data

    connect shouldUpdate.out -> oldBallX.we
    connect shouldUpdate.out -> oldBallY.we
    connect shouldUpdate.out -> oldLeftPaddleY.we
    connect shouldUpdate.out -> oldRightPaddleY.we

    // Update new positions
    connect newBallX.sum -> ballX.data
    connect newBallY.sum -> ballY.data
    connect newLeftPaddleY.sum -> leftPaddleY.data
    connect newRightPaddleY.sum -> rightPaddleY.data

    connect shouldUpdate.out -> ballX.we
    connect shouldUpdate.out -> ballY.we
    connect shouldUpdate.out -> leftPaddleY.we
    connect shouldUpdate.out -> rightPaddleY.we

    // Select Y coordinate based on phase (using priority encoder with OR gates)
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

    // Select X coordinate based on phase
    node xMux0: Mux
    connect oldBallX.q -> xMux0.in0
    connect zero.out -> xMux0.in1  // Left paddle X=0
    connect isPhase1.eq -> xMux0.sel

    node xMux1: Mux
    connect xMux0.out -> xMux1.in0
    connect seven.out -> xMux1.in1  // Right paddle X=7
    connect isPhase2.eq -> xMux1.sel

    node xMux2: Mux
    connect xMux1.out -> xMux2.in0
    connect ballX.q -> xMux2.in1
    connect isPhase3.eq -> xMux2.sel

    node xMux3: Mux
    connect xMux2.out -> xMux3.in0
    connect zero.out -> xMux3.in1  // Left paddle X=0
    connect isPhase4.eq -> xMux3.sel

    node selectX: Mux
    connect xMux3.out -> selectX.in0
    connect seven.out -> selectX.in1  // Right paddle X=7
    connect isPhase5.eq -> selectX.sel

    // Calculate address: Y * 8 + X
    node yTimes2: Adder
    connect selectY.out -> yTimes2.a
    connect selectY.out -> yTimes2.b

    node yTimes4: Adder
    connect yTimes2.sum -> yTimes4.a
    connect yTimes2.sum -> yTimes4.b

    node yTimes8: Adder
    connect yTimes4.sum -> yTimes8.a
    connect yTimes4.sum -> yTimes8.b

    node ramAddr: Adder
    connect yTimes8.sum -> ramAddr.a
    connect selectX.out -> ramAddr.b

    connect ramAddr.sum -> ram.addrA

    // Data: 0 for clear phases (0-2), 1 for draw phases (3-5)
    node isClearPhase: Or
    node isClearPhase2: Or
    connect isPhase0.eq -> isClearPhase.a
    connect isPhase1.eq -> isClearPhase.b
    connect isClearPhase.out -> isClearPhase2.a
    connect isPhase2.eq -> isClearPhase2.b

    node ramData: Mux
    connect one.out -> ramData.in0   // Default: draw (1)
    connect zero.out -> ramData.in1  // If clear phase: 0
    connect isClearPhase2.out -> ramData.sel

    connect ramData.out -> ram.dataA

    node writeEnable: Switch
    connect writeEnable.out -> ram.weA
  }
}
