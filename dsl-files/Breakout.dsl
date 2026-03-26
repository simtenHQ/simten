// Breakout — a complete game built from logic gates
//
// 8x8 screen: rows 0-1 are bricks, row 7 is paddle, ball bounces between.
// Arrow keys move the paddle. Ball bounces off walls, paddle, and bricks.
// Clock divider makes ball move every 4 frames.
//
// 10-phase pipeline:
//   0: Read next-ball-addr from RAM (latch brick collision)
//   1: Clear old ball pixel
//   2: Clear old paddle-left pixel
//   3: Clear old paddle-center pixel
//   4: Clear old paddle-right pixel + clear hit brick
//   5: Draw new ball pixel
//   6: Draw new paddle-left pixel
//   7: Draw new paddle-center pixel
//   8: Draw new paddle-right pixel
//   9: Update all game state registers
//
// Ball physics model:
//   nextBall = ball + velocity  (always)
//   On wall/paddle/brick hit: flip velocity (takes effect NEXT frame)
//   Ball always moves to nextBall this frame — no "stay in place" logic

circuit Breakout {
  impl {
    // =========================================================================
    // RAM and Screen
    // =========================================================================
    node ram: DualPortRAM(init={
      // Row 0: 8 bricks
      0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1,
      // Row 1: 8 bricks
      8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1,
      // Paddle at center=3: cols 2,3,4 on row 7 (addrs 58,59,60)
      58: 1, 59: 1, 60: 1
    })
    node screen: Screen
    connect screen.addrB -> ram.addrB
    connect ram.outB -> screen.dataIn

    // =========================================================================
    // Keyboard
    // =========================================================================
    node keyboard: Input
    node leftCode:  Constant(value=75)
    node rightCode: Constant(value=77)
    node isLeft:  Comparator
    node isRight: Comparator
    connect keyboard.out -> isLeft.a
    connect leftCode.out -> isLeft.b
    connect keyboard.out -> isRight.a
    connect rightCode.out -> isRight.b

    // =========================================================================
    // Constants
    // =========================================================================
    node zero:   Constant(value=0)
    node one:    Constant(value=1)
    node two:    Constant(value=2)
    node three:  Constant(value=3)
    node four:   Constant(value=4)
    node five:   Constant(value=5)
    node six:    Constant(value=6)
    node seven:  Constant(value=7)
    node eight:  Constant(value=8)
    node nine:   Constant(value=9)
    node minus1: Constant(value=255)

    // =========================================================================
    // Phase counter: 0-9 (resets at 10)
    // =========================================================================
    node phase: Register(initial=0)
    node always: Switch(value=1)

    node phaseInc: Adder
    connect phase.q -> phaseInc.a
    connect one.out -> phaseInc.b

    // Wrap at 10: if phaseInc == 10 then 0 else phaseInc
    node phaseIs10: Comparator
    node ten: Constant(value=10)
    connect phaseInc.sum -> phaseIs10.a
    connect ten.out -> phaseIs10.b

    node phaseNext: Mux(width=8)
    connect phaseInc.sum -> phaseNext.in0
    connect zero.out -> phaseNext.in1
    connect phaseIs10.eq -> phaseNext.sel

    connect phaseNext.out -> phase.data
    connect always.out -> phase.we

    // Phase detectors
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

    connect phase.q -> isP0.a
    connect zero.out -> isP0.b
    connect phase.q -> isP1.a
    connect one.out -> isP1.b
    connect phase.q -> isP2.a
    connect two.out -> isP2.b
    connect phase.q -> isP3.a
    connect three.out -> isP3.b
    connect phase.q -> isP4.a
    connect four.out -> isP4.b
    connect phase.q -> isP5.a
    connect five.out -> isP5.b
    connect phase.q -> isP6.a
    connect six.out -> isP6.b
    connect phase.q -> isP7.a
    connect seven.out -> isP7.b
    connect phase.q -> isP8.a
    connect eight.out -> isP8.b
    connect phase.q -> isP9.a
    connect nine.out -> isP9.b

    // =========================================================================
    // Ball speed divider: ball moves once every 4 frames (40 ticks)
    // =========================================================================
    node speedCtr: Register(initial=0)
    node speedCtrInc: Adder
    connect speedCtr.q -> speedCtrInc.a
    connect one.out -> speedCtrInc.b

    node speedAtMax: Comparator
    connect speedCtr.q -> speedAtMax.a
    connect three.out -> speedAtMax.b

    node nextSpeedCtr: Mux(width=8)
    connect speedCtrInc.sum -> nextSpeedCtr.in0
    connect zero.out -> nextSpeedCtr.in1
    connect speedAtMax.eq -> nextSpeedCtr.sel

    connect nextSpeedCtr.out -> speedCtr.data
    node onP9: And
    connect always.out -> onP9.a
    connect isP9.eq -> onP9.b
    connect onP9.out -> speedCtr.we

    // =========================================================================
    // Game state registers
    // =========================================================================
    node ballX:      Register(initial=3)
    node ballY:      Register(initial=4)
    node ballDX:     Register(initial=1)   // 1=right, 255=left
    node ballDY:     Register(initial=1)   // 1=down, 255=up
    node oldBallX:   Register(initial=3)
    node oldBallY:   Register(initial=4)
    node paddleX:    Register(initial=3)   // paddle center (1..6)
    node oldPaddleX: Register(initial=3)
    node brickHitLatch: Register(initial=0)

    // =========================================================================
    // Paddle movement (clamped 1..6)
    // =========================================================================
    node paddleDelta: Mux(width=8)
    connect zero.out -> paddleDelta.in0
    connect minus1.out -> paddleDelta.in1
    connect isLeft.eq -> paddleDelta.sel

    node paddleDelta2: Mux(width=8)
    connect paddleDelta.out -> paddleDelta2.in0
    connect one.out -> paddleDelta2.in1
    connect isRight.eq -> paddleDelta2.sel

    node paddleXRaw: Adder
    connect paddleX.q -> paddleXRaw.a
    connect paddleDelta2.out -> paddleXRaw.b

    // Clamp: if raw==0 then 1, if raw==7 then 6, else raw
    node paddleAtMin: Comparator
    connect paddleXRaw.sum -> paddleAtMin.a
    connect zero.out -> paddleAtMin.b

    node paddleAtMax: Comparator
    connect paddleXRaw.sum -> paddleAtMax.a
    connect seven.out -> paddleAtMax.b

    node paddleClamped1: Mux(width=8)
    connect paddleXRaw.sum -> paddleClamped1.in0
    connect one.out -> paddleClamped1.in1
    connect paddleAtMin.eq -> paddleClamped1.sel

    node paddleNewX: Mux(width=8)
    connect paddleClamped1.out -> paddleNewX.in0
    connect six.out -> paddleNewX.in1
    connect paddleAtMax.eq -> paddleNewX.sel

    // =========================================================================
    // Ball next position — ball ALWAYS moves to nextBall this frame
    // nextBallX = (ballX + ballDX) & 0x7
    // nextBallY = (ballY + ballDY) & 0x7
    // =========================================================================
    node nextBallXRaw: Adder
    connect ballX.q -> nextBallXRaw.a
    connect ballDX.q -> nextBallXRaw.b
    node nextBallX: BitSlice(low=0, high=2)
    connect nextBallXRaw.sum -> nextBallX.in

    node nextBallYRaw: Adder
    connect ballY.q -> nextBallYRaw.a
    connect ballDY.q -> nextBallYRaw.b
    node nextBallY: BitSlice(low=0, high=2)
    connect nextBallYRaw.sum -> nextBallY.in

    // =========================================================================
    // Collision detection — velocity flip stored for NEXT frame
    // Ball still moves to nextBall this frame regardless of collision
    // =========================================================================

    // Direction indicators (current velocity)
    node movingLeft:  Comparator
    node movingRight: Comparator
    node movingUp:    Comparator
    node movingDown:  Comparator
    connect ballDX.q -> movingLeft.a
    connect minus1.out -> movingLeft.b
    connect ballDX.q -> movingRight.a
    connect one.out -> movingRight.b
    connect ballDY.q -> movingUp.a
    connect minus1.out -> movingUp.b
    connect ballDY.q -> movingDown.a
    connect one.out -> movingDown.b

    // X wall hits: check current position + direction (avoids wrap ambiguity)
    // If ballX==0 and moving left  → next would wrap → flip DX
    // If ballX==7 and moving right → next would wrap → flip DX
    node ballAtLeft:  Comparator
    node ballAtRight: Comparator
    connect ballX.q -> ballAtLeft.a
    connect zero.out -> ballAtLeft.b
    connect ballX.q -> ballAtRight.a
    connect seven.out -> ballAtRight.b

    node hitLeft:  And
    connect ballAtLeft.eq  -> hitLeft.a
    connect movingLeft.eq  -> hitLeft.b
    node hitRight: And
    connect ballAtRight.eq -> hitRight.a
    connect movingRight.eq -> hitRight.b

    node flipDX: Or
    connect hitLeft.out -> flipDX.a
    connect hitRight.out -> flipDX.b

    // Top wall: ballY==0 and moving up → next would wrap up → flip DY
    node ballAtTop: Comparator
    connect ballY.q -> ballAtTop.a
    connect zero.out -> ballAtTop.b
    node hitTop: And
    connect ballAtTop.eq -> hitTop.a
    connect movingUp.eq -> hitTop.b

    // Paddle hit: nextBallY == 7 (ball entering paddle row), moving down,
    // and nextBallX within paddle range [paddleNewX-1 .. paddleNewX+1]
    node nextYIs7: Comparator
    connect nextBallY.out -> nextYIs7.a
    connect seven.out -> nextYIs7.b

    node padMinX: Adder
    connect paddleNewX.out -> padMinX.a
    connect minus1.out -> padMinX.b
    node padMinXW: BitSlice(low=0, high=2)
    connect padMinX.sum -> padMinXW.in

    node padMaxX: Adder
    connect paddleNewX.out -> padMaxX.a
    connect one.out -> padMaxX.b
    node padMaxXW: BitSlice(low=0, high=2)
    connect padMaxX.sum -> padMaxXW.in

    node cmpMin: Comparator
    connect nextBallX.out -> cmpMin.a
    connect padMinXW.out -> cmpMin.b
    node notLtMin: Not
    connect cmpMin.lt -> notLtMin.in

    node cmpMax: Comparator
    connect padMaxXW.out -> cmpMax.a
    connect nextBallX.out -> cmpMax.b
    node notGtMax: Not
    connect cmpMax.lt -> notGtMax.in

    node inPaddleRange: And
    connect notLtMin.out -> inPaddleRange.a
    connect notGtMax.out -> inPaddleRange.b

    node paddleHitCk: And
    connect nextYIs7.eq -> paddleHitCk.a
    connect inPaddleRange.out -> paddleHitCk.b

    node hitPaddle: And
    connect paddleHitCk.out -> hitPaddle.a
    connect movingDown.eq -> hitPaddle.b

    // Brick hit: nextBallY < 2 AND brickHitLatch != 0
    // (brickHitLatch is sampled at phase 0 from nextBallAddr — already correct)
    node nextYSmall: Comparator
    connect nextBallY.out -> nextYSmall.a
    connect two.out -> nextYSmall.b

    node brickNonZero: Comparator
    connect brickHitLatch.q -> brickNonZero.a
    connect zero.out -> brickNonZero.b

    node hitBrick: And
    connect brickNonZero.gt -> hitBrick.a
    connect nextYSmall.lt -> hitBrick.b

    // =========================================================================
    // New velocities: flip on collision, take effect next frame
    // =========================================================================
    node dxIsOne: Comparator
    connect ballDX.q -> dxIsOne.a
    connect one.out -> dxIsOne.b
    node dxFlipped: Mux(width=8)
    connect one.out -> dxFlipped.in0
    connect minus1.out -> dxFlipped.in1
    connect dxIsOne.eq -> dxFlipped.sel
    node newDX: Mux(width=8)
    connect ballDX.q -> newDX.in0
    connect dxFlipped.out -> newDX.in1
    connect flipDX.out -> newDX.sel

    node dyIsOne: Comparator
    connect ballDY.q -> dyIsOne.a
    connect one.out -> dyIsOne.b
    node dyFlipped: Mux(width=8)
    connect one.out -> dyFlipped.in0
    connect minus1.out -> dyFlipped.in1
    connect dyIsOne.eq -> dyFlipped.sel

    node flipDYa: Or
    connect hitTop.out -> flipDYa.a
    connect hitPaddle.out -> flipDYa.b
    node flipDY: Or
    connect flipDYa.out -> flipDY.a
    connect hitBrick.out -> flipDY.b

    node newDY: Mux(width=8)
    connect ballDY.q -> newDY.in0
    connect dyFlipped.out -> newDY.in1
    connect flipDY.out -> newDY.sel

    // =========================================================================
    // RAM address computation: addr = Y*8 + X
    // =========================================================================
    // Old ball address
    node obY2: Adder
    connect oldBallY.q -> obY2.a
    connect oldBallY.q -> obY2.b
    node obY4: Adder
    connect obY2.sum -> obY4.a
    connect obY2.sum -> obY4.b
    node obY8: Adder
    connect obY4.sum -> obY8.a
    connect obY4.sum -> obY8.b
    node oldBallAddr: Adder
    connect obY8.sum -> oldBallAddr.a
    connect oldBallX.q -> oldBallAddr.b

    // Next ball address (used for brick check at phase 0 AND draw at phase 5)
    node nbY2: Adder
    connect nextBallY.out -> nbY2.a
    connect nextBallY.out -> nbY2.b
    node nbY4: Adder
    connect nbY2.sum -> nbY4.a
    connect nbY2.sum -> nbY4.b
    node nbY8: Adder
    connect nbY4.sum -> nbY8.a
    connect nbY4.sum -> nbY8.b
    node nextBallAddr: Adder
    connect nbY8.sum -> nextBallAddr.a
    connect nextBallX.out -> nextBallAddr.b

    // Paddle row base = 56 (7*8)
    node paddleRow: Constant(value=56)

    // Old paddle addresses: left, center, right
    node oldPadL: Adder
    node oldPadLX: Adder
    connect oldPaddleX.q -> oldPadLX.a
    connect minus1.out -> oldPadLX.b
    node oldPadLXW: BitSlice(low=0, high=2)
    connect oldPadLX.sum -> oldPadLXW.in
    connect paddleRow.out -> oldPadL.a
    connect oldPadLXW.out -> oldPadL.b

    node oldPadC: Adder
    connect paddleRow.out -> oldPadC.a
    connect oldPaddleX.q -> oldPadC.b

    node oldPadR: Adder
    node oldPadRX: Adder
    connect oldPaddleX.q -> oldPadRX.a
    connect one.out -> oldPadRX.b
    node oldPadRXW: BitSlice(low=0, high=2)
    connect oldPadRX.sum -> oldPadRXW.in
    connect paddleRow.out -> oldPadR.a
    connect oldPadRXW.out -> oldPadR.b

    // New paddle addresses: left, center, right
    node newPadLX: Adder
    connect paddleNewX.out -> newPadLX.a
    connect minus1.out -> newPadLX.b
    node newPadLXW: BitSlice(low=0, high=2)
    connect newPadLX.sum -> newPadLXW.in
    node newPadL: Adder
    connect paddleRow.out -> newPadL.a
    connect newPadLXW.out -> newPadL.b

    node newPadC: Adder
    connect paddleRow.out -> newPadC.a
    connect paddleNewX.out -> newPadC.b

    node newPadRX: Adder
    connect paddleNewX.out -> newPadRX.a
    connect one.out -> newPadRX.b
    node newPadRXW: BitSlice(low=0, high=2)
    connect newPadRX.sum -> newPadRXW.in
    node newPadR: Adder
    connect paddleRow.out -> newPadR.a
    connect newPadRXW.out -> newPadR.b

    // =========================================================================
    // RAM address mux (10 phases)
    //   0: nextBallAddr (read for brick check)
    //   1: oldBallAddr (clear)
    //   2: oldPadL (clear)
    //   3: oldPadC (clear)
    //   4: oldPadR or nextBallAddr if hitBrick (clear)
    //   5: nextBallAddr (draw ball — ball always moves to next position)
    //   6: newPadL (draw)
    //   7: newPadC (draw)
    //   8: newPadR (draw)
    //   9: (no write, benign)
    // =========================================================================

    // Phase 4 address: brick clear address if hit, else old paddle right
    node p4Addr: Mux(width=8)
    connect oldPadR.sum -> p4Addr.in0
    connect nextBallAddr.sum -> p4Addr.in1
    connect hitBrick.out -> p4Addr.sel

    // Chain of muxes: default is nextBallAddr (phase 0)
    node a1: Mux(width=8)
    connect nextBallAddr.sum -> a1.in0
    connect oldBallAddr.sum -> a1.in1
    connect isP1.eq -> a1.sel

    node a2: Mux(width=8)
    connect a1.out -> a2.in0
    connect oldPadL.sum -> a2.in1
    connect isP2.eq -> a2.sel

    node a3: Mux(width=8)
    connect a2.out -> a3.in0
    connect oldPadC.sum -> a3.in1
    connect isP3.eq -> a3.sel

    node a4: Mux(width=8)
    connect a3.out -> a4.in0
    connect p4Addr.out -> a4.in1
    connect isP4.eq -> a4.sel

    node a5: Mux(width=8)
    connect a4.out -> a5.in0
    connect nextBallAddr.sum -> a5.in1
    connect isP5.eq -> a5.sel

    node a6: Mux(width=8)
    connect a5.out -> a6.in0
    connect newPadL.sum -> a6.in1
    connect isP6.eq -> a6.sel

    node a7: Mux(width=8)
    connect a6.out -> a7.in0
    connect newPadC.sum -> a7.in1
    connect isP7.eq -> a7.sel

    node a8: Mux(width=8)
    connect a7.out -> a8.in0
    connect newPadR.sum -> a8.in1
    connect isP8.eq -> a8.sel

    connect a8.out -> ram.addrA

    // =========================================================================
    // RAM data: 0 for clear phases (1-4), 1 for draw phases (5-8)
    // =========================================================================
    node isDrawPhase: Or
    node isDrawPhase2: Or
    node isDrawPhase3: Or
    connect isP5.eq -> isDrawPhase.a
    connect isP6.eq -> isDrawPhase.b
    connect isDrawPhase.out -> isDrawPhase2.a
    connect isP7.eq -> isDrawPhase2.b
    connect isDrawPhase2.out -> isDrawPhase3.a
    connect isP8.eq -> isDrawPhase3.b

    node ramData: Mux
    connect zero.out -> ramData.in0
    connect one.out -> ramData.in1
    connect isDrawPhase3.out -> ramData.sel
    connect ramData.out -> ram.dataA

    // =========================================================================
    // RAM write enable: phases 1-8 (not 0 or 9)
    // =========================================================================
    node isClearPhase: Or
    node isClearPhase2: Or
    node isClearPhase3: Or
    connect isP1.eq -> isClearPhase.a
    connect isP2.eq -> isClearPhase.b
    connect isClearPhase.out -> isClearPhase2.a
    connect isP3.eq -> isClearPhase2.b
    connect isClearPhase2.out -> isClearPhase3.a
    connect isP4.eq -> isClearPhase3.b

    node anyWritePhase: Or
    connect isClearPhase3.out -> anyWritePhase.a
    connect isDrawPhase3.out -> anyWritePhase.b

    node weSwitch: Switch(value=1)
    node finalWE: And
    connect weSwitch.out -> finalWE.a
    connect anyWritePhase.out -> finalWE.b
    connect finalWE.out -> ram.weA

    // =========================================================================
    // Brick hit latch: sample ram.outA at phase 0
    // =========================================================================
    connect ram.outA -> brickHitLatch.data
    node latchBrick: And
    connect always.out -> latchBrick.a
    connect isP0.eq -> latchBrick.b
    connect latchBrick.out -> brickHitLatch.we

    // =========================================================================
    // Register updates on phase 9
    // =========================================================================
    connect ballX.q -> oldBallX.data
    connect ballY.q -> oldBallY.data
    connect onP9.out -> oldBallX.we
    connect onP9.out -> oldBallY.we

    connect paddleX.q -> oldPaddleX.data
    connect onP9.out -> oldPaddleX.we

    connect paddleNewX.out -> paddleX.data
    connect onP9.out -> paddleX.we

    // Ball always moves to nextBallX/Y — no anyBounce hold-in-place
    // Velocity (newDX/newDY) is flipped on collision and stored for next frame
    node updateBall: And
    connect onP9.out -> updateBall.a
    connect speedAtMax.eq -> updateBall.b

    connect nextBallX.out -> ballX.data
    connect nextBallY.out -> ballY.data
    connect updateBall.out -> ballX.we
    connect updateBall.out -> ballY.we

    connect newDX.out -> ballDX.data
    connect newDY.out -> ballDY.data
    connect updateBall.out -> ballDX.we
    connect updateBall.out -> ballDY.we
  }
}
