// Breakout — raster-scan architecture, no framebuffer RAM
//
// The RasterDisplay scans through positions (scanX 0-9, scanY 0-9).
// Each tick, the circuit provides dataIn combinationally: is there a
// ball, paddle, or brick at (scanX, scanY) right now?
//
// Game elements:
//   Rows 0-1 : 16 bricks (8 per row), stored as bits in bricksR0/bricksR1
//   Row 7    : 3-wide paddle, centered on paddleX
//   Ball     : single pixel at (ballX, ballY)
//
// State updates happen once per frame during vblank (scanY >= 8).
// Ball moves every frame; bricks clear on collision; paddle moves on keypress.

circuit Breakout {
  impl {

    // =========================================================================
    // RasterDisplay — drives scanX, scanY, hblank, vblank
    // Circuit provides dataIn combinationally each tick
    // =========================================================================
    node display: RasterDisplay

    // =========================================================================
    // Constants
    // =========================================================================
    node c0:   Constant(value=0)
    node c1:   Constant(value=1)
    node c2:   Constant(value=2)
    node c3:   Constant(value=3)
    node c6:   Constant(value=6)
    node c7:   Constant(value=7)
    node c255: Constant(value=255)   // unsigned -1

    // =========================================================================
    // Game state registers
    // =========================================================================
    // Ball position (wraps mod 8 via BitSlice)
    node ballX:  Register(initial=3)
    node ballY:  Register(initial=4)
    // Ball velocity: 1=positive, 255=negative (unsigned -1)
    node ballDX: Register(initial=1)
    node ballDY: Register(initial=1)
    // Paddle center column (clamped 1..6)
    node paddleX: Register(initial=3)
    // Brick state: each bit = 1 if brick alive, bit N = column N
    node bricksR0: Register(initial=255)   // row 0 (scanY==0), all 8 bricks alive
    node bricksR1: Register(initial=255)   // row 1 (scanY==1), all 8 bricks alive

    // =========================================================================
    // Keyboard input
    // =========================================================================
    node keyboard: Input
    node leftCode:  Constant(value=75)
    node rightCode: Constant(value=77)
    node isLeftCmp:  Comparator
    node isRightCmp: Comparator
    connect keyboard.out -> isLeftCmp.a
    connect leftCode.out -> isLeftCmp.b
    connect keyboard.out -> isRightCmp.a
    connect rightCode.out -> isRightCmp.b

    // =========================================================================
    // Split bricksR0 and bricksR1 into individual bits
    // =========================================================================
    node splitR0: Splitter8to8
    node splitR1: Splitter8to8
    connect bricksR0.q -> splitR0.in
    connect bricksR1.q -> splitR1.in

    // =========================================================================
    // Extract scanX bits for 8-to-1 Mux tree (brick pixel selection)
    // scanX is Bus[4]; Splitter8to8 treats upper bits as 0 — fine for 0..9 range
    // We only use bits 0,1,2 (scanX <= 7 during active area)
    // =========================================================================
    node scanXsplit: Splitter8to8
    connect display.scanX -> scanXsplit.in

    // 8-to-1 Mux: select bit[scanX] from bricksR0
    // Level 0: pairs using scanXsplit.bit0
    node r0m00: Mux
    node r0m01: Mux
    node r0m02: Mux
    node r0m03: Mux
    connect splitR0.bit0 -> r0m00.in0
    connect splitR0.bit1 -> r0m00.in1
    connect scanXsplit.bit0 -> r0m00.sel
    connect splitR0.bit2 -> r0m01.in0
    connect splitR0.bit3 -> r0m01.in1
    connect scanXsplit.bit0 -> r0m01.sel
    connect splitR0.bit4 -> r0m02.in0
    connect splitR0.bit5 -> r0m02.in1
    connect scanXsplit.bit0 -> r0m02.sel
    connect splitR0.bit6 -> r0m03.in0
    connect splitR0.bit7 -> r0m03.in1
    connect scanXsplit.bit0 -> r0m03.sel
    // Level 1: using scanXsplit.bit1
    node r0m10: Mux
    node r0m11: Mux
    connect r0m00.out -> r0m10.in0
    connect r0m01.out -> r0m10.in1
    connect scanXsplit.bit1 -> r0m10.sel
    connect r0m02.out -> r0m11.in0
    connect r0m03.out -> r0m11.in1
    connect scanXsplit.bit1 -> r0m11.sel
    // Level 2: using scanXsplit.bit2 — final selected bit from row 0
    node r0bitSel: Mux
    connect r0m10.out -> r0bitSel.in0
    connect r0m11.out -> r0bitSel.in1
    connect scanXsplit.bit2 -> r0bitSel.sel

    // 8-to-1 Mux: select bit[scanX] from bricksR1
    node r1m00: Mux
    node r1m01: Mux
    node r1m02: Mux
    node r1m03: Mux
    connect splitR1.bit0 -> r1m00.in0
    connect splitR1.bit1 -> r1m00.in1
    connect scanXsplit.bit0 -> r1m00.sel
    connect splitR1.bit2 -> r1m01.in0
    connect splitR1.bit3 -> r1m01.in1
    connect scanXsplit.bit0 -> r1m01.sel
    connect splitR1.bit4 -> r1m02.in0
    connect splitR1.bit5 -> r1m02.in1
    connect scanXsplit.bit0 -> r1m02.sel
    connect splitR1.bit6 -> r1m03.in0
    connect splitR1.bit7 -> r1m03.in1
    connect scanXsplit.bit0 -> r1m03.sel
    node r1m10: Mux
    node r1m11: Mux
    connect r1m00.out -> r1m10.in0
    connect r1m01.out -> r1m10.in1
    connect scanXsplit.bit1 -> r1m10.sel
    connect r1m02.out -> r1m11.in0
    connect r1m03.out -> r1m11.in1
    connect scanXsplit.bit1 -> r1m11.sel
    node r1bitSel: Mux
    connect r1m10.out -> r1bitSel.in0
    connect r1m11.out -> r1bitSel.in1
    connect scanXsplit.bit2 -> r1bitSel.sel

    // =========================================================================
    // Brick pixel: alive brick at (scanX, scanY)
    // scanY == 0 → use row 0 bit; scanY == 1 → use row 1 bit
    // brickInRange: scanY is 0 or 1 (bit1,bit2,bit3 all zero)
    // =========================================================================
    node scanYsplit: Splitter8to8
    connect display.scanY -> scanYsplit.in

    // scanY == 0: bit0=0, bit1=0, bit2=0, bit3=0 → all zero = isY0
    node notY0bit0: Not
    node notY0bit1: Not
    node notY0bit2: Not
    node notY0bit3: Not
    connect scanYsplit.bit0 -> notY0bit0.in
    connect scanYsplit.bit1 -> notY0bit1.in
    connect scanYsplit.bit2 -> notY0bit2.in
    connect scanYsplit.bit3 -> notY0bit3.in
    node isYRow0a: And
    node isYRow0b: And
    node isYRow0: And
    connect notY0bit0.out -> isYRow0a.a
    connect notY0bit1.out -> isYRow0a.b
    connect notY0bit2.out -> isYRow0b.a
    connect notY0bit3.out -> isYRow0b.b
    connect isYRow0a.out -> isYRow0.a
    connect isYRow0b.out -> isYRow0.b

    // scanY == 1: bit0=1, others 0
    node isYRow1a: And
    node isYRow1b: And
    node isYRow1: And
    connect scanYsplit.bit0 -> isYRow1a.a
    connect notY0bit1.out -> isYRow1a.b
    connect notY0bit2.out -> isYRow1b.a
    connect notY0bit3.out -> isYRow1b.b
    connect isYRow1a.out -> isYRow1.a
    connect isYRow1b.out -> isYRow1.b

    // brickInRange = isYRow0 OR isYRow1
    node brickInRange: Or
    connect isYRow0.out -> brickInRange.a
    connect isYRow1.out -> brickInRange.b

    // Select between row0 and row1 bits based on scanY bit 0
    node rowBitSel: Mux
    connect r0bitSel.out -> rowBitSel.in0
    connect r1bitSel.out -> rowBitSel.in1
    connect scanYsplit.bit0 -> rowBitSel.sel

    // brickPixel = brickInRange AND rowBitSel (brick alive at this scan pos)
    node brickPixel: And
    connect brickInRange.out -> brickPixel.a
    connect rowBitSel.out -> brickPixel.b

    // =========================================================================
    // Ball pixel: scanX == ballX AND scanY == ballY
    // =========================================================================
    node cmpBallX: Comparator
    node cmpBallY: Comparator
    connect display.scanX -> cmpBallX.a
    connect ballX.q -> cmpBallX.b
    connect display.scanY -> cmpBallY.a
    connect ballY.q -> cmpBallY.b
    node ballPixel: And
    connect cmpBallX.eq -> ballPixel.a
    connect cmpBallY.eq -> ballPixel.b

    // =========================================================================
    // Paddle pixel: scanY == 7 AND scanX in [paddleX-1, paddleX+1]
    // =========================================================================
    // scanY == 7 detection: bit0=1, bit1=1, bit2=1, bit3=0
    node notScanY3: Not
    connect scanYsplit.bit3 -> notScanY3.in
    node isScanY7a: And
    node isScanY7b: And
    node isScanY7: And
    connect scanYsplit.bit0 -> isScanY7a.a
    connect scanYsplit.bit1 -> isScanY7a.b
    connect scanYsplit.bit2 -> isScanY7b.a
    connect notScanY3.out -> isScanY7b.b
    connect isScanY7a.out -> isScanY7.a
    connect isScanY7b.out -> isScanY7.b

    // Paddle range: paddleX-1 <= scanX <= paddleX+1
    // paddleX-1 (with wrapping clamp handled by clamping paddleX to 1..6)
    node padMinRaw: Adder
    connect paddleX.q -> padMinRaw.a
    connect c255.out -> padMinRaw.b
    node padMin: BitSlice(low=0, high=2)
    connect padMinRaw.sum -> padMin.in

    node padMaxRaw: Adder
    connect paddleX.q -> padMaxRaw.a
    connect c1.out -> padMaxRaw.b
    node padMax: BitSlice(low=0, high=2)
    connect padMaxRaw.sum -> padMax.in

    // scanX >= padMin: NOT (scanX < padMin)
    node cmpScanGteMin: Comparator
    connect display.scanX -> cmpScanGteMin.a
    connect padMin.out -> cmpScanGteMin.b
    node notLtMin: Not
    connect cmpScanGteMin.lt -> notLtMin.in

    // scanX <= padMax: NOT (scanX > padMax)
    node cmpScanLteMax: Comparator
    connect padMax.out -> cmpScanLteMax.a
    connect display.scanX -> cmpScanLteMax.b
    node notGtMax: Not
    connect cmpScanLteMax.lt -> notGtMax.in

    node inPadRange: And
    connect notLtMin.out -> inPadRange.a
    connect notGtMax.out -> inPadRange.b

    node paddlePixel: And
    connect isScanY7.out -> paddlePixel.a
    connect inPadRange.out -> paddlePixel.b

    // =========================================================================
    // Combined pixel = ballPixel OR paddlePixel OR brickPixel
    // =========================================================================
    node pixOr1: Or
    connect ballPixel.out -> pixOr1.a
    connect paddlePixel.out -> pixOr1.b
    node pixOr2: Or
    connect pixOr1.out -> pixOr2.a
    connect brickPixel.out -> pixOr2.b

    // Convert bit to Bus[8] for dataIn using Mux(width=8)
    node pixelBus: Mux(width=8)
    connect c0.out -> pixelBus.in0
    connect c1.out -> pixelBus.in1
    connect pixOr2.out -> pixelBus.sel

    connect pixelBus.out -> display.dataIn

    // =========================================================================
    // Wall bounce detection (X walls + top wall only — these don't depend on next position)
    // =========================================================================
    // Moving left: ballDX == 255
    node movingLeft: Comparator
    connect ballDX.q -> movingLeft.a
    connect c255.out -> movingLeft.b
    // Moving right: ballDX == 1
    node movingRight: Comparator
    connect ballDX.q -> movingRight.a
    connect c1.out -> movingRight.b
    // Moving up: ballDY == 255
    node movingUp: Comparator
    connect ballDY.q -> movingUp.a
    connect c255.out -> movingUp.b
    // Moving down: ballDY == 1
    node movingDown: Comparator
    connect ballDY.q -> movingDown.a
    connect c1.out -> movingDown.b

    // Ball at left edge: ballX == 0
    node ballAtLeft: Comparator
    connect ballX.q -> ballAtLeft.a
    connect c0.out -> ballAtLeft.b
    // Ball at right edge: ballX == 7
    node ballAtRight: Comparator
    connect ballX.q -> ballAtRight.a
    connect c7.out -> ballAtRight.b
    // Ball at top: ballY == 0
    node ballAtTop: Comparator
    connect ballY.q -> ballAtTop.a
    connect c0.out -> ballAtTop.b

    // hitLeft: at left edge and moving left
    node hitLeft: And
    connect ballAtLeft.eq -> hitLeft.a
    connect movingLeft.eq -> hitLeft.b
    // hitRight: at right edge and moving right
    node hitRight: And
    connect ballAtRight.eq -> hitRight.a
    connect movingRight.eq -> hitRight.b
    // flipDX: either wall hit
    node flipDX: Or
    connect hitLeft.out -> flipDX.a
    connect hitRight.out -> flipDX.b

    // hitTop: at top and moving up
    node hitTop: And
    connect ballAtTop.eq -> hitTop.a
    connect movingUp.eq -> hitTop.b

    // =========================================================================
    // Paddle bounce: nextBallY == 6 (one row above paddle), moving down
    // Ball bounces before entering paddle row so they don't visually overlap
    // =========================================================================
    node nextYcmp6: Comparator
    connect nextBallY.out -> nextYcmp6.a
    connect c6.out -> nextYcmp6.b

    // Paddle range check using nextBallX vs current padMin/padMax
    node cmpNextGteMin: Comparator
    connect nextBallX.out -> cmpNextGteMin.a
    connect padMin.out -> cmpNextGteMin.b
    node notNextLtMin: Not
    connect cmpNextGteMin.lt -> notNextLtMin.in

    node cmpNextLteMax: Comparator
    connect padMax.out -> cmpNextLteMax.a
    connect nextBallX.out -> cmpNextLteMax.b
    node notNextGtMax: Not
    connect cmpNextLteMax.lt -> notNextGtMax.in

    node nextInPadRange: And
    connect notNextLtMin.out -> nextInPadRange.a
    connect notNextGtMax.out -> nextInPadRange.b

    node paddleHitCk: And
    connect nextYcmp6.eq -> paddleHitCk.a
    connect nextInPadRange.out -> paddleHitCk.b

    node hitPaddle: And
    connect paddleHitCk.out -> hitPaddle.a
    connect movingDown.eq -> hitPaddle.b

    // =========================================================================
    // Brick collision at next ball position
    // Use same 8-to-1 Mux tree but driven by nextBallX bits
    // =========================================================================
    node nextBallXsplit: Splitter8to8
    connect nextBallX.out -> nextBallXsplit.in

    // 8-to-1 Mux for bricksR0 using nextBallX
    node nb_r0m00: Mux
    node nb_r0m01: Mux
    node nb_r0m02: Mux
    node nb_r0m03: Mux
    connect splitR0.bit0 -> nb_r0m00.in0
    connect splitR0.bit1 -> nb_r0m00.in1
    connect nextBallXsplit.bit0 -> nb_r0m00.sel
    connect splitR0.bit2 -> nb_r0m01.in0
    connect splitR0.bit3 -> nb_r0m01.in1
    connect nextBallXsplit.bit0 -> nb_r0m01.sel
    connect splitR0.bit4 -> nb_r0m02.in0
    connect splitR0.bit5 -> nb_r0m02.in1
    connect nextBallXsplit.bit0 -> nb_r0m02.sel
    connect splitR0.bit6 -> nb_r0m03.in0
    connect splitR0.bit7 -> nb_r0m03.in1
    connect nextBallXsplit.bit0 -> nb_r0m03.sel
    node nb_r0m10: Mux
    node nb_r0m11: Mux
    connect nb_r0m00.out -> nb_r0m10.in0
    connect nb_r0m01.out -> nb_r0m10.in1
    connect nextBallXsplit.bit1 -> nb_r0m10.sel
    connect nb_r0m02.out -> nb_r0m11.in0
    connect nb_r0m03.out -> nb_r0m11.in1
    connect nextBallXsplit.bit1 -> nb_r0m11.sel
    node nb_r0bitSel: Mux
    connect nb_r0m10.out -> nb_r0bitSel.in0
    connect nb_r0m11.out -> nb_r0bitSel.in1
    connect nextBallXsplit.bit2 -> nb_r0bitSel.sel

    // 8-to-1 Mux for bricksR1 using nextBallX
    node nb_r1m00: Mux
    node nb_r1m01: Mux
    node nb_r1m02: Mux
    node nb_r1m03: Mux
    connect splitR1.bit0 -> nb_r1m00.in0
    connect splitR1.bit1 -> nb_r1m00.in1
    connect nextBallXsplit.bit0 -> nb_r1m00.sel
    connect splitR1.bit2 -> nb_r1m01.in0
    connect splitR1.bit3 -> nb_r1m01.in1
    connect nextBallXsplit.bit0 -> nb_r1m01.sel
    connect splitR1.bit4 -> nb_r1m02.in0
    connect splitR1.bit5 -> nb_r1m02.in1
    connect nextBallXsplit.bit0 -> nb_r1m02.sel
    connect splitR1.bit6 -> nb_r1m03.in0
    connect splitR1.bit7 -> nb_r1m03.in1
    connect nextBallXsplit.bit0 -> nb_r1m03.sel
    node nb_r1m10: Mux
    node nb_r1m11: Mux
    connect nb_r1m00.out -> nb_r1m10.in0
    connect nb_r1m01.out -> nb_r1m10.in1
    connect nextBallXsplit.bit1 -> nb_r1m10.sel
    connect nb_r1m02.out -> nb_r1m11.in0
    connect nb_r1m03.out -> nb_r1m11.in1
    connect nextBallXsplit.bit1 -> nb_r1m11.sel
    node nb_r1bitSel: Mux
    connect nb_r1m10.out -> nb_r1bitSel.in0
    connect nb_r1m11.out -> nb_r1bitSel.in1
    connect nextBallXsplit.bit2 -> nb_r1bitSel.sel

    // nextBallY == 0: row 0 brick check
    node nextBallYsplit: Splitter8to8
    connect nextBallY.out -> nextBallYsplit.in

    node notNBY0: Not
    node notNBY1: Not
    node notNBY2: Not
    node notNBY3: Not
    connect nextBallYsplit.bit0 -> notNBY0.in
    connect nextBallYsplit.bit1 -> notNBY1.in
    connect nextBallYsplit.bit2 -> notNBY2.in
    connect nextBallYsplit.bit3 -> notNBY3.in

    node isNBRow0a: And
    node isNBRow0b: And
    node isNBRow0: And
    connect notNBY0.out -> isNBRow0a.a
    connect notNBY1.out -> isNBRow0a.b
    connect notNBY2.out -> isNBRow0b.a
    connect notNBY3.out -> isNBRow0b.b
    connect isNBRow0a.out -> isNBRow0.a
    connect isNBRow0b.out -> isNBRow0.b

    node isNBRow1a: And
    node isNBRow1b: And
    node isNBRow1: And
    connect nextBallYsplit.bit0 -> isNBRow1a.a
    connect notNBY1.out -> isNBRow1a.b
    connect notNBY2.out -> isNBRow1b.a
    connect notNBY3.out -> isNBRow1b.b
    connect isNBRow1a.out -> isNBRow1.a
    connect isNBRow1b.out -> isNBRow1.b

    // nextBallInBrickArea = isNBRow0 OR isNBRow1
    node nextInBrickArea: Or
    connect isNBRow0.out -> nextInBrickArea.a
    connect isNBRow1.out -> nextInBrickArea.b

    // brickAliveAtNext: select row bit using nextBallY bit 0
    node nbRowBitSel: Mux
    connect nb_r0bitSel.out -> nbRowBitSel.in0
    connect nb_r1bitSel.out -> nbRowBitSel.in1
    connect nextBallYsplit.bit0 -> nbRowBitSel.sel

    // hitBrick = nextInBrickArea AND brickAliveAtNext AND (movingDown.eq OR movingUp.eq)
    // (Ball can only hit bricks when moving toward them — rows 0-1 are at top)
    node hitBrickRaw: And
    connect nextInBrickArea.out -> hitBrickRaw.a
    connect nbRowBitSel.out -> hitBrickRaw.b

    // Only flip DY if ball is entering brick area from below (movingUp)
    // or if it's currently at boundary, just check movingUp
    node hitBrick: And
    connect hitBrickRaw.out -> hitBrick.a
    connect movingUp.eq -> hitBrick.b

    // =========================================================================
    // New velocities: flip on collision
    // =========================================================================
    // newDX: flip if flipDX
    node dxIsOne: Comparator
    connect ballDX.q -> dxIsOne.a
    connect c1.out -> dxIsOne.b
    node dxFlipped: Mux(width=8)
    connect c1.out -> dxFlipped.in0
    connect c255.out -> dxFlipped.in1
    connect dxIsOne.eq -> dxFlipped.sel
    node newDX: Mux(width=8)
    connect ballDX.q -> newDX.in0
    connect dxFlipped.out -> newDX.in1
    connect flipDX.out -> newDX.sel

    // nextBallX uses the BOUNCED DX (newDX) so walls work correctly
    node nextBallXraw: Adder
    connect ballX.q -> nextBallXraw.a
    connect newDX.out -> nextBallXraw.b
    node nextBallX: BitSlice(low=0, high=2)
    connect nextBallXraw.sum -> nextBallX.in

    // For Y: top wall bounce applied before computing nextBallY
    // Paddle/brick bounces use nextBallY so they take effect NEXT frame
    node topBouncedDY: Mux(width=8)
    connect ballDY.q -> topBouncedDY.in0
    connect dyFlipped.out -> topBouncedDY.in1
    connect hitTop.out -> topBouncedDY.sel

    node nextBallYraw: Adder
    connect ballY.q -> nextBallYraw.a
    connect topBouncedDY.out -> nextBallYraw.b
    node nextBallY: BitSlice(low=0, high=2)
    connect nextBallYraw.sum -> nextBallY.in

    // newDY: flip if hitTop OR hitPaddle OR hitBrick
    node dyIsOne: Comparator
    connect ballDY.q -> dyIsOne.a
    connect c1.out -> dyIsOne.b
    node dyFlipped: Mux(width=8)
    connect c1.out -> dyFlipped.in0
    connect c255.out -> dyFlipped.in1
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
    // Paddle movement with clamping (1..6)
    // =========================================================================
    node paddleDelta: Mux(width=8)
    connect c0.out -> paddleDelta.in0
    connect c255.out -> paddleDelta.in1
    connect isLeftCmp.eq -> paddleDelta.sel

    node paddleDelta2: Mux(width=8)
    connect paddleDelta.out -> paddleDelta2.in0
    connect c1.out -> paddleDelta2.in1
    connect isRightCmp.eq -> paddleDelta2.sel

    node paddleXraw: Adder
    connect paddleX.q -> paddleXraw.a
    connect paddleDelta2.out -> paddleXraw.b

    node paddleAtMin: Comparator
    connect paddleXraw.sum -> paddleAtMin.a
    connect c0.out -> paddleAtMin.b
    node paddleAtMax: Comparator
    connect paddleXraw.sum -> paddleAtMax.a
    connect c7.out -> paddleAtMax.b

    node paddleClamped1: Mux(width=8)
    connect paddleXraw.sum -> paddleClamped1.in0
    connect c1.out -> paddleClamped1.in1
    connect paddleAtMin.eq -> paddleClamped1.sel

    node newPaddleX: Mux(width=8)
    connect paddleClamped1.out -> newPaddleX.in0
    connect c6.out -> newPaddleX.in1
    connect paddleAtMax.eq -> newPaddleX.sel

    // =========================================================================
    // Brick clearing: compute clear mask and AND with brick registers
    // Clear mask = NOT(1 << nextBallX) — clears the hit brick bit
    // =========================================================================
    node shiftOne: LeftShifter
    connect c1.out -> shiftOne.value
    connect nextBallX.out -> shiftOne.shift
    node clearMask: BusNot
    connect shiftOne.result -> clearMask.in

    // New brick values with hit brick cleared
    node newBricksR0: BusAnd
    connect bricksR0.q -> newBricksR0.a
    connect clearMask.out -> newBricksR0.b

    node newBricksR1: BusAnd
    connect bricksR1.q -> newBricksR1.a
    connect clearMask.out -> newBricksR1.b

    // =========================================================================
    // State update enable: fire once per frame on the RISING EDGE of vblank.
    // vblank stays high for 20 ticks (scanY=8..9, each 10 ticks wide).
    // A naive "vblank=1" write-enable would write 20 times per frame,
    // cascading nextBallX/nextBallY through 20 updates each frame.
    // Edge detection: onVblank = vblank AND NOT prevVblank
    // prevVblank is a 1-tick-delayed copy of the vblank signal.
    // =========================================================================
    node prevVblank: Register(initial=0)
    connect display.vblank -> prevVblank.data
    // prevVblank always captures vblank (no write-enable = always writes)
    node alwaysHigh: Switch(value=1)
    connect alwaysHigh.out -> prevVblank.we

    node notPrevVblank: Not
    connect prevVblank.q -> notPrevVblank.in

    node onVblank: And
    connect display.vblank -> onVblank.a
    connect notPrevVblank.out -> onVblank.b

    // Ball miss detection: nextBallY >= 7 and moving down and NOT hitting paddle
    // When missed, reset ball to starting position
    node nextYGe7: Comparator
    connect nextBallY.out -> nextYGe7.a
    connect c7.out -> nextYGe7.b
    node ballMovingDown: And
    connect nextYGe7.eq -> ballMovingDown.a
    connect movingDown.eq -> ballMovingDown.b
    // Also check nextYGe7.gt for Y=7 wrap case
    node nextYIs7orMore: Or
    connect nextYGe7.eq -> nextYIs7orMore.a
    connect nextYGe7.gt -> nextYIs7orMore.b
    node ballAtBottom: And
    connect nextYIs7orMore.out -> ballAtBottom.a
    connect movingDown.eq -> ballAtBottom.b

    node notHitPaddle: Not
    connect hitPaddle.out -> notHitPaddle.in
    node ballMissed: And
    connect ballAtBottom.out -> ballMissed.a
    connect notHitPaddle.out -> ballMissed.b

    // Reset position constants
    node resetX: Constant(value=3)
    node resetY: Constant(value=4)
    node resetDX: Constant(value=1)
    node resetDY: Constant(value=255)

    // Mux between next position and reset position
    node actualBallX: Mux(width=8)
    connect nextBallX.out -> actualBallX.in0
    connect resetX.out -> actualBallX.in1
    connect ballMissed.out -> actualBallX.sel

    node actualBallY: Mux(width=8)
    connect nextBallY.out -> actualBallY.in0
    connect resetY.out -> actualBallY.in1
    connect ballMissed.out -> actualBallY.sel

    node actualDX: Mux(width=8)
    connect newDX.out -> actualDX.in0
    connect resetDX.out -> actualDX.in1
    connect ballMissed.out -> actualDX.sel

    node actualDY: Mux(width=8)
    connect newDY.out -> actualDY.in0
    connect resetDY.out -> actualDY.in1
    connect ballMissed.out -> actualDY.sel

    // Ball updates
    connect actualBallX.out -> ballX.data
    connect actualBallY.out -> ballY.data
    connect onVblank.out -> ballX.we
    connect onVblank.out -> ballY.we

    // Velocity updates
    connect actualDX.out -> ballDX.data
    connect actualDY.out -> ballDY.data
    connect onVblank.out -> ballDX.we
    connect onVblank.out -> ballDY.we

    // Paddle update
    connect newPaddleX.out -> paddleX.data
    connect onVblank.out -> paddleX.we

    // Brick R0 update: on vblank AND ball is hitting a row-0 brick
    node vblankHitR0: And
    connect onVblank.out -> vblankHitR0.a
    connect isNBRow0.out -> vblankHitR0.b
    node vblankHitR0b: And
    connect vblankHitR0.out -> vblankHitR0b.a
    connect hitBrickRaw.out -> vblankHitR0b.b

    // On miss: reset bricks to 255 (all alive). On hit: use cleared value.
    node allBricks: Constant(value=255)
    node onMissVblank: And
    connect onVblank.out -> onMissVblank.a
    connect ballMissed.out -> onMissVblank.b

    node brickR0data: Mux(width=8)
    connect newBricksR0.out -> brickR0data.in0
    connect allBricks.out -> brickR0data.in1
    connect ballMissed.out -> brickR0data.sel

    node brickR0we: Or
    connect vblankHitR0b.out -> brickR0we.a
    connect onMissVblank.out -> brickR0we.b

    connect brickR0data.out -> bricksR0.data
    connect brickR0we.out -> bricksR0.we

    // Brick R1 update: on vblank AND ball is hitting a row-1 brick
    node vblankHitR1: And
    connect onVblank.out -> vblankHitR1.a
    connect isNBRow1.out -> vblankHitR1.b
    node vblankHitR1b: And
    connect vblankHitR1.out -> vblankHitR1b.a
    connect hitBrickRaw.out -> vblankHitR1b.b

    node brickR1data: Mux(width=8)
    connect newBricksR1.out -> brickR1data.in0
    connect allBricks.out -> brickR1data.in1
    connect ballMissed.out -> brickR1data.sel

    node brickR1we: Or
    connect vblankHitR1b.out -> brickR1we.a
    connect onMissVblank.out -> brickR1we.b

    connect brickR1data.out -> bricksR1.data
    connect brickR1we.out -> bricksR1.we
  }
}
