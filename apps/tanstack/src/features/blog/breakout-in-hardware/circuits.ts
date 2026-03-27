/**
 * Circuit definitions for the "Breakout in Hardware" blog post.
 * 32x16 raster-scan architecture with DualPortRAM brick storage.
 */

export const BREAKOUT_DSL = `// Breakout — 32x16 raster-scan architecture, no framebuffer
//
// The RasterDisplay(width=32,height=16) scans through positions:
//   scanX 0-31 (active), 32-33 (hblank), scanY 0-15 (active), 16-17 (vblank)
//   612 ticks per frame (~60fps).
//
// Game layout:
//   Rows 0-3  : bricks (128 total, stored in DualPortRAM)
//   Rows 4-13 : ball movement area
//   Row 14    : empty buffer (paddle bounce row — ball bounces here)
//   Row 15    : paddle (6 pixels wide, center = paddleX)
//
// Brick storage: DualPortRAM(addressWidth=8, dataWidth=8)
//   addr = row*32 + col  (0-127)
//   Port B: display reads brickRAM[scanY*32+scanX] for rendering
//   Port A: game logic reads brickRAM[nextBallY*32+nextBallX] for collision
//           writes 0 on hit, writes 1 to all on reset
//
// Ball: starts at (16, 8), DX in {1,2,254,255}, DY in {1,255}
// Paddle: 6px wide, center paddleX clamped 3..28
// Paddle angle from 4 sections:
//   nextBallX - paddleX == -3 (253) → DX=254 (sharp left)
//   nextBallX - paddleX in {-2,-1} (254,255) → DX=255 (mild left)
//   nextBallX - paddleX in {0,1} → DX=1 (mild right)
//   nextBallX - paddleX == 2 → DX=2 (sharp right)
//
// vblank edge → update game state
// Ball moves every 4th vblank; paddle moves every 2nd vblank

circuit Breakout {
  impl {

    // =========================================================================
    // RasterDisplay — drives scanX(Bus[8]), scanY(Bus[8]), hblank, vblank
    // =========================================================================
    node display: RasterDisplay(width=32, height=16)

    // =========================================================================
    // Constants
    // =========================================================================
    node c0:   Constant(value=0)
    node c1:   Constant(value=1)
    node c2:   Constant(value=2)
    node c3:   Constant(value=3)
    node c4:   Constant(value=4)
    node c5:   Constant(value=5)
    node c14:  Constant(value=14)
    node c15:  Constant(value=15)
    node c16:  Constant(value=16)
    node c28:  Constant(value=28)
    node c29:  Constant(value=29)
    node c30:  Constant(value=30)
    node c31:  Constant(value=31)
    node c32:  Constant(value=32)
    node c253: Constant(value=253)  // -3 unsigned
    node c254: Constant(value=254)  // -2 unsigned
    node c255: Constant(value=255)  // -1 unsigned

    // =========================================================================
    // Brick RAM — 128 bricks, all initially alive (value=1)
    // DualPortRAM: Port A = game logic (read collision addr, write to clear)
    //              Port B = display scan (read for rendering)
    // =========================================================================
    node brickRAM: DualPortRAM(addressWidth=8, dataWidth=8, init={
      0:1, 1:1, 2:1, 3:1, 4:1, 5:1, 6:1, 7:1,
      8:1, 9:1, 10:1, 11:1, 12:1, 13:1, 14:1, 15:1,
      16:1, 17:1, 18:1, 19:1, 20:1, 21:1, 22:1, 23:1,
      24:1, 25:1, 26:1, 27:1, 28:1, 29:1, 30:1, 31:1,
      32:1, 33:1, 34:1, 35:1, 36:1, 37:1, 38:1, 39:1,
      40:1, 41:1, 42:1, 43:1, 44:1, 45:1, 46:1, 47:1,
      48:1, 49:1, 50:1, 51:1, 52:1, 53:1, 54:1, 55:1,
      56:1, 57:1, 58:1, 59:1, 60:1, 61:1, 62:1, 63:1,
      64:1, 65:1, 66:1, 67:1, 68:1, 69:1, 70:1, 71:1,
      72:1, 73:1, 74:1, 75:1, 76:1, 77:1, 78:1, 79:1,
      80:1, 81:1, 82:1, 83:1, 84:1, 85:1, 86:1, 87:1,
      88:1, 89:1, 90:1, 91:1, 92:1, 93:1, 94:1, 95:1,
      96:1, 97:1, 98:1, 99:1, 100:1, 101:1, 102:1, 103:1,
      104:1, 105:1, 106:1, 107:1, 108:1, 109:1, 110:1, 111:1,
      112:1, 113:1, 114:1, 115:1, 116:1, 117:1, 118:1, 119:1,
      120:1, 121:1, 122:1, 123:1, 124:1, 125:1, 126:1, 127:1
    })

    // =========================================================================
    // Game state registers
    // =========================================================================
    node ballX:   Register(initial=16)   // starts at center-right
    node ballY:   Register(initial=8)    // starts mid-screen
    node ballDX:  Register(initial=1)    // moving right
    node ballDY:  Register(initial=255)  // moving up (255 = -1)
    node paddleX: Register(initial=15)   // center (paddle spans 12..17)

    // =========================================================================
    // Keyboard input (left=75, right=77)
    // =========================================================================
    node keyboard:   Input
    node leftCode:   Constant(value=75)
    node rightCode:  Constant(value=77)
    node isLeftCmp:  Comparator
    node isRightCmp: Comparator
    connect keyboard.out   -> isLeftCmp.a
    connect leftCode.out   -> isLeftCmp.b
    connect keyboard.out   -> isRightCmp.a
    connect rightCode.out  -> isRightCmp.b

    // =========================================================================
    // Brick RAM Port B: display scan address = (scanY << 5) + scanX
    // LeftShifter(width=8): scanY<<5 = scanY*32 (for scanY 0-3: 0,32,64,96)
    // =========================================================================
    node scanYsh: LeftShifter(width=8)
    connect display.scanY -> scanYsh.value
    connect c5.out        -> scanYsh.shift

    node scanBrickAddr: Adder(width=8)
    connect scanYsh.result    -> scanBrickAddr.a
    connect display.scanX     -> scanBrickAddr.b
    connect c0.out            -> scanBrickAddr.carry_in
    connect scanBrickAddr.sum -> brickRAM.addrB

    // =========================================================================
    // Brick pixel: scanY < 4 AND brickRAM.outB != 0
    // scanInBrickArea: scanY < 4
    // =========================================================================
    node scanInBrickArea: Comparator
    connect display.scanY  -> scanInBrickArea.a
    connect c4.out         -> scanInBrickArea.b
    // scanInBrickArea.lt = 1 when scanY < 4

    // brickAlive: brickRAM.outB != 0 — compare outB > 0
    node brickAlive: Comparator
    connect brickRAM.outB -> brickAlive.a
    connect c0.out        -> brickAlive.b
    // brickAlive.gt = 1 when outB > 0 (brick exists)

    node brickPixel: And
    connect scanInBrickArea.lt -> brickPixel.a
    connect brickAlive.gt      -> brickPixel.b

    // =========================================================================
    // Ball pixel: scanX == ballX AND scanY == ballY
    // =========================================================================
    node cmpBallX: Comparator
    node cmpBallY: Comparator
    connect display.scanX -> cmpBallX.a
    connect ballX.q       -> cmpBallX.b
    connect display.scanY -> cmpBallY.a
    connect ballY.q       -> cmpBallY.b
    node ballPixel: And
    connect cmpBallX.eq -> ballPixel.a
    connect cmpBallY.eq -> ballPixel.b

    // =========================================================================
    // Paddle pixel: scanY == 15 AND scanX in [paddleX-3 .. paddleX+2]
    // scanY == 15: bits 0-3 all 1, bits 4-7 all 0
    // =========================================================================
    node scanYsplit: Splitter8to8
    connect display.scanY -> scanYsplit.in

    node notScanY4: Not
    node notScanY5: Not
    node notScanY6: Not
    node notScanY7: Not
    connect scanYsplit.bit4 -> notScanY4.in
    connect scanYsplit.bit5 -> notScanY5.in
    connect scanYsplit.bit6 -> notScanY6.in
    connect scanYsplit.bit7 -> notScanY7.in

    // bits 0-3 must be 1: AND(bit0, bit1, bit2, bit3)
    node isScanY15a: And
    node isScanY15b: And
    node isScanY15c: And
    connect scanYsplit.bit0 -> isScanY15a.a
    connect scanYsplit.bit1 -> isScanY15a.b
    connect scanYsplit.bit2 -> isScanY15b.a
    connect scanYsplit.bit3 -> isScanY15b.b
    connect isScanY15a.out  -> isScanY15c.a
    connect isScanY15b.out  -> isScanY15c.b
    // bits 4-7 must be 0: AND(NOT bit4, NOT bit5, NOT bit6, NOT bit7)
    node isScanY15d: And
    node isScanY15e: And
    node isScanY15f: And
    connect notScanY4.out  -> isScanY15d.a
    connect notScanY5.out  -> isScanY15d.b
    connect notScanY6.out  -> isScanY15e.a
    connect notScanY7.out  -> isScanY15e.b
    connect isScanY15d.out -> isScanY15f.a
    connect isScanY15e.out -> isScanY15f.b
    // isScanY15 = AND of upper and lower halves
    node isScanY15: And
    connect isScanY15c.out -> isScanY15.a
    connect isScanY15f.out -> isScanY15.b

    // Paddle range: paddleX-3 <= scanX <= paddleX+2
    node padMinRaw: Adder(width=8)
    connect paddleX.q -> padMinRaw.a
    connect c253.out  -> padMinRaw.b   // +253 = -3 unsigned
    connect c0.out    -> padMinRaw.carry_in

    node padMaxRaw: Adder(width=8)
    connect paddleX.q -> padMaxRaw.a
    connect c2.out    -> padMaxRaw.b
    connect c0.out    -> padMaxRaw.carry_in

    // scanX >= padMin: NOT (scanX < padMin)
    node cmpScanGteMin: Comparator
    connect display.scanX -> cmpScanGteMin.a
    connect padMinRaw.sum -> cmpScanGteMin.b
    node notLtPadMin: Not
    connect cmpScanGteMin.lt -> notLtPadMin.in

    // scanX <= padMax: NOT (padMax < scanX) — i.e. NOT (scanX > padMax)
    node cmpScanLteMax: Comparator
    connect padMaxRaw.sum -> cmpScanLteMax.a
    connect display.scanX -> cmpScanLteMax.b
    node notGtPadMax: Not
    connect cmpScanLteMax.lt -> notGtPadMax.in

    node inPadRange: And
    connect notLtPadMin.out -> inPadRange.a
    connect notGtPadMax.out -> inPadRange.b

    node paddlePixel: And
    connect isScanY15.out  -> paddlePixel.a
    connect inPadRange.out -> paddlePixel.b

    // =========================================================================
    // Combined pixel = ballPixel OR paddlePixel OR brickPixel
    // =========================================================================
    node pixOr1: Or
    connect ballPixel.out   -> pixOr1.a
    connect paddlePixel.out -> pixOr1.b
    node pixOr2: Or
    connect pixOr1.out   -> pixOr2.a
    connect brickPixel.out -> pixOr2.b

    // Convert bit to Bus[8] for dataIn
    node pixelBus: Mux(width=8)
    connect c0.out      -> pixelBus.in0
    connect c1.out      -> pixelBus.in1
    connect pixOr2.out  -> pixelBus.sel
    connect pixelBus.out -> display.dataIn

    // =========================================================================
    // vblank rising-edge detection: onVblank = vblank AND NOT prevVblank
    // =========================================================================
    node prevVblank: Register(initial=0)
    connect display.vblank -> prevVblank.data
    node alwaysHigh: Switch(value=1)
    connect alwaysHigh.out -> prevVblank.we

    node notPrevVblank: Not
    connect prevVblank.q -> notPrevVblank.in

    node onVblank: And
    connect display.vblank     -> onVblank.a
    connect notPrevVblank.out  -> onVblank.b

    // =========================================================================
    // Ball speed divider: ball moves every 4th vblank
    // Paddle speed divider: paddle moves every 2nd vblank
    // =========================================================================
    node ballSpeedCtr: Register(initial=0)
    node ballSpeedInc: Adder(width=8)
    connect ballSpeedCtr.q -> ballSpeedInc.a
    connect c1.out         -> ballSpeedInc.b
    connect c0.out         -> ballSpeedInc.carry_in

    node ballSpeedMax: Constant(value=3)
    node ballSpeedAtMax: Comparator
    connect ballSpeedCtr.q  -> ballSpeedAtMax.a
    connect ballSpeedMax.out -> ballSpeedAtMax.b

    node nextBallSpeed: Mux(width=8)
    connect ballSpeedInc.sum  -> nextBallSpeed.in0
    connect c0.out            -> nextBallSpeed.in1
    connect ballSpeedAtMax.eq -> nextBallSpeed.sel

    connect nextBallSpeed.out -> ballSpeedCtr.data
    connect onVblank.out      -> ballSpeedCtr.we

    node ballUpdate: And
    connect onVblank.out      -> ballUpdate.a
    connect ballSpeedAtMax.eq -> ballUpdate.b

    // Paddle: every 2nd vblank
    node padSpeedCtr: Register(initial=0)
    node padSpeedInc: Adder(width=8)
    connect padSpeedCtr.q -> padSpeedInc.a
    connect c1.out        -> padSpeedInc.b
    connect c0.out        -> padSpeedInc.carry_in

    node padSpeedMax: Constant(value=1)
    node padSpeedAtMax: Comparator
    connect padSpeedCtr.q  -> padSpeedAtMax.a
    connect padSpeedMax.out -> padSpeedAtMax.b

    node nextPadSpeed: Mux(width=8)
    connect padSpeedInc.sum  -> nextPadSpeed.in0
    connect c0.out           -> nextPadSpeed.in1
    connect padSpeedAtMax.eq -> nextPadSpeed.sel

    connect nextPadSpeed.out -> padSpeedCtr.data
    connect onVblank.out     -> padSpeedCtr.we

    node paddleUpdate: And
    connect onVblank.out     -> paddleUpdate.a
    connect padSpeedAtMax.eq -> paddleUpdate.b

    // =========================================================================
    // Current velocity classification
    // movingLeft:  DX >= 128 (i.e., DX is 254 or 255)
    // movingRight: DX < 128 (i.e., DX is 1 or 2)
    // movingUp:    DY >= 128 (DY == 255)
    // movingDown:  DY < 128  (DY == 1)
    // Use: compare c127 < DX → DX > 127
    // =========================================================================
    node movingLeftCmp: Comparator
    connect c127.out    -> movingLeftCmp.a   // reuse c127 declared below
    connect ballDX.q    -> movingLeftCmp.b
    // movingLeftCmp.lt = 1 when 127 < DX, i.e. DX > 127 (moving left)

    node c127: Constant(value=127)

    node movingLeft:  Buffer
    connect movingLeftCmp.lt -> movingLeft.in

    node notMovingLeft: Not
    connect movingLeft.out -> notMovingLeft.in

    // movingRight = NOT movingLeft (DX <= 127, so DX is 1 or 2)
    // movingRight is just notMovingLeft.out

    node movingUpCmp: Comparator
    connect c127.out  -> movingUpCmp.a
    connect ballDY.q  -> movingUpCmp.b
    // movingUpCmp.lt = 1 when DY > 127 (moving up)

    node movingUp: Buffer
    connect movingUpCmp.lt -> movingUp.in

    node movingDown: Not
    connect movingUp.out -> movingDown.in
    // movingDown.out = 1 when DY <= 127 (DY == 1)

    // =========================================================================
    // X wall bounce: DX=2 means two-pixel step — need to handle both edges
    // Left wall:  ballX <= 1 AND movingLeft  → flip DX
    // Right wall: ballX >= 30 AND movingRight → flip DX
    // ballX <= 1: NOT (ballX > 1) → NOT (ballX >= 2) → use cmp(ballX, c2).lt OR eq...
    //   actually: ballX <= 1 ↔ ballX < 2 → cmp(ballX, c2).lt
    // ballX >= 30: NOT (ballX < 30) → NOT cmp(ballX, c30).lt
    // =========================================================================
    node ballAtLeft: Comparator
    connect ballX.q -> ballAtLeft.a
    connect c2.out  -> ballAtLeft.b
    // ballAtLeft.lt = 1 when ballX < 2 (ballX is 0 or 1)

    node hitLeft: And
    connect ballAtLeft.lt    -> hitLeft.a
    connect movingLeft.out   -> hitLeft.b

    node ballAtRight: Comparator
    connect ballX.q  -> ballAtRight.a
    connect c30.out  -> ballAtRight.b
    node notBallLtRight: Not
    connect ballAtRight.lt -> notBallLtRight.in
    // notBallLtRight.out = 1 when ballX >= 30

    node hitRight: And
    connect notBallLtRight.out  -> hitRight.a
    connect notMovingLeft.out   -> hitRight.b

    node flipDX: Or
    connect hitLeft.out  -> flipDX.a
    connect hitRight.out -> flipDX.b

    // =========================================================================
    // Top wall bounce: ballY == 0 AND movingUp
    // =========================================================================
    node ballAtTop: Comparator
    connect ballY.q -> ballAtTop.a
    connect c0.out  -> ballAtTop.b

    node hitTop: And
    connect ballAtTop.eq   -> hitTop.a
    connect movingUp.out   -> hitTop.b

    // =========================================================================
    // New DX after wall bounce (simple flip: 1↔255, 2↔254 — but we detect
    // which case by checking current DX value)
    // DX flip: if DX <= 127: newDX = 256 - DX; if DX > 127: newDX = 256 - DX
    // i.e., newDX = (0 - DX) mod 256 = (256 - DX) mod 256
    // Use Subtractor: 0 - DX = c0 - ballDX
    // =========================================================================
    node dxNegated: Subtractor(width=8)
    connect c0.out   -> dxNegated.a
    connect ballDX.q -> dxNegated.b
    connect c0.out   -> dxNegated.borrow_in
    // dxNegated.difference = (0 - DX) mod 256 = negation

    node newDXbeforePaddle: Mux(width=8)
    connect ballDX.q          -> newDXbeforePaddle.in0  // no wall flip
    connect dxNegated.difference -> newDXbeforePaddle.in1  // flip
    connect flipDX.out        -> newDXbeforePaddle.sel

    // =========================================================================
    // Compute nextBallX using bounced DX (so wall bounce is immediate)
    // nextBallX = ballX + newDXbeforePaddle, masked to 8 bits (mod 256)
    // =========================================================================
    node nextBallXraw: Adder(width=8)
    connect ballX.q                -> nextBallXraw.a
    connect newDXbeforePaddle.out  -> nextBallXraw.b
    connect c0.out                 -> nextBallXraw.carry_in
    // nextBallXraw.sum = nextBallX (8-bit wrapping, but ballX is clamped 0-31)

    // =========================================================================
    // Compute nextBallY using top-wall bounced DY
    // topBouncedDY: if hitTop, flip DY (255→1); else keep
    // =========================================================================
    node dyNegated: Subtractor(width=8)
    connect c0.out   -> dyNegated.a
    connect ballDY.q -> dyNegated.b
    connect c0.out   -> dyNegated.borrow_in

    node topBouncedDY: Mux(width=8)
    connect ballDY.q            -> topBouncedDY.in0
    connect dyNegated.difference -> topBouncedDY.in1
    connect hitTop.out          -> topBouncedDY.sel

    node nextBallYraw: Adder(width=8)
    connect ballY.q          -> nextBallYraw.a
    connect topBouncedDY.out -> nextBallYraw.b
    connect c0.out           -> nextBallYraw.carry_in
    // nextBallYraw.sum = nextBallY

    // =========================================================================
    // Brick collision: nextBallY < 4 AND brickRAM.outA != 0 AND movingUp
    // Brick address for Port A: (nextBallY << 5) + nextBallX
    // =========================================================================
    node nextYsh: LeftShifter(width=8)
    connect nextBallYraw.sum -> nextYsh.value
    connect c5.out           -> nextYsh.shift

    node nextBrickAddr: Adder(width=8)
    connect nextYsh.result   -> nextBrickAddr.a
    connect nextBallXraw.sum -> nextBrickAddr.b
    connect c0.out           -> nextBrickAddr.carry_in
    // addrA connected via mux at bottom (fill vs hit)

    // nextBallY < 4 → movingUp into brick area
    node nextInBrickArea: Comparator
    connect nextBallYraw.sum -> nextInBrickArea.a
    connect c4.out           -> nextInBrickArea.b
    // nextInBrickArea.lt = 1 when nextBallY < 4

    // brickRAM.outA != 0
    node brickAtNext: Comparator
    connect brickRAM.outA -> brickAtNext.a
    connect c0.out        -> brickAtNext.b
    // brickAtNext.gt = 1 when outA > 0

    node hitBrickRaw: And
    connect nextInBrickArea.lt -> hitBrickRaw.a
    connect brickAtNext.gt     -> hitBrickRaw.b

    node hitBrick: And
    connect hitBrickRaw.out -> hitBrick.a
    connect movingUp.out    -> hitBrick.b

    // =========================================================================
    // Paddle bounce: nextBallY == 14 AND inPaddleX AND movingDown
    // =========================================================================
    node nextYis14: Comparator
    connect nextBallYraw.sum -> nextYis14.a
    connect c14.out          -> nextYis14.b

    // nextBallX in paddle range: padMin <= nextBallX <= padMax
    node cmpNextGteMin: Comparator
    connect nextBallXraw.sum -> cmpNextGteMin.a
    connect padMinRaw.sum    -> cmpNextGteMin.b
    node notNextLtMin: Not
    connect cmpNextGteMin.lt -> notNextLtMin.in

    node cmpNextLteMax: Comparator
    connect padMaxRaw.sum    -> cmpNextLteMax.a
    connect nextBallXraw.sum -> cmpNextLteMax.b
    node notNextGtMax: Not
    connect cmpNextLteMax.lt -> notNextGtMax.in

    node nextInPadRange: And
    connect notNextLtMin.out -> nextInPadRange.a
    connect notNextGtMax.out -> nextInPadRange.b

    node paddleHitCheck: And
    connect nextYis14.eq       -> paddleHitCheck.a
    connect nextInPadRange.out -> paddleHitCheck.b

    node hitPaddle: And
    connect paddleHitCheck.out -> hitPaddle.a
    connect movingDown.out     -> hitPaddle.b

    // =========================================================================
    // Paddle angle: offset = nextBallX - paddleX (unsigned, signed interpretation)
    // offset in {253} → DX=254 (sharp left)
    // offset in {254,255} → DX=255 (mild left)
    // offset in {0,1} → DX=1 (mild right)
    // offset in {2} → DX=2 (sharp right)
    // =========================================================================
    node padOffset: Subtractor(width=8)
    connect nextBallXraw.sum -> padOffset.a
    connect paddleX.q        -> padOffset.b
    connect c0.out           -> padOffset.borrow_in

    // isFarLeft: offset == 253
    node isFarLeft: Comparator
    connect padOffset.difference -> isFarLeft.a
    connect c253.out             -> isFarLeft.b

    // isMidLeft: offset >= 254 → NOT (offset < 254)
    node offsetLt254: Comparator
    connect padOffset.difference -> offsetLt254.a
    connect c254.out             -> offsetLt254.b
    node isMidLeft: Not
    connect offsetLt254.lt -> isMidLeft.in
    // isMidLeft.out = 1 when offset >= 254 (i.e., offset is 254 or 255)
    // But also need to exclude farLeft (253 is already < 254, so isMidLeft will be false for 253 ✓)
    // Actually 253 < 254, so offsetLt254.lt=1 → isMidLeft=0 ✓

    // isMidRight: offset <= 1 → offset < 2
    node isMidRight: Comparator
    connect padOffset.difference -> isMidRight.a
    connect c2.out               -> isMidRight.b
    // isMidRight.lt = 1 when offset < 2 (i.e., offset is 0 or 1)

    // isFarRight: offset == 2
    node isFarRight: Comparator
    connect padOffset.difference -> isFarRight.a
    connect c2.out               -> isFarRight.b
    // isFarRight.eq = 1 when offset == 2

    // Build new DX from paddle angle:
    // Priority: farLeft > midLeft > midRight > farRight (mutually exclusive when hit)
    // Start with midRight default (DX=1), then override with farRight, midLeft, farLeft
    node paddleDXa: Mux(width=8)   // midRight or farRight
    connect c1.out          -> paddleDXa.in0   // midRight → DX=1
    connect c2.out          -> paddleDXa.in1   // farRight → DX=2
    connect isFarRight.eq   -> paddleDXa.sel

    node paddleDXb: Mux(width=8)   // above or midLeft
    connect paddleDXa.out   -> paddleDXb.in0
    connect c255.out        -> paddleDXb.in1   // midLeft → DX=255
    connect isMidLeft.out   -> paddleDXb.sel

    node paddleDXc: Mux(width=8)   // above or farLeft
    connect paddleDXb.out   -> paddleDXc.in0
    connect c254.out        -> paddleDXc.in1   // farLeft → DX=254
    connect isFarLeft.eq    -> paddleDXc.sel

    // Final DX: if paddle hit, use angle DX; else keep bounced DX from walls
    node newDX: Mux(width=8)
    connect newDXbeforePaddle.out -> newDX.in0   // no paddle hit
    connect paddleDXc.out         -> newDX.in1   // paddle hit → angle DX
    connect hitPaddle.out         -> newDX.sel

    // =========================================================================
    // DY after all bounces: flip if hitTop OR hitPaddle OR hitBrick
    // =========================================================================
    node flipDYa: Or
    connect hitTop.out    -> flipDYa.a
    connect hitPaddle.out -> flipDYa.b
    node flipDY: Or
    connect flipDYa.out -> flipDY.a
    connect hitBrick.out -> flipDY.b

    node newDY: Mux(width=8)
    connect topBouncedDY.out    -> newDY.in0   // top wall already applied
    connect dyNegated.difference -> newDY.in1  // flip again (for paddle/brick)
    connect hitPaddle.out       -> newDY.sel
    // Wait: if hitTop AND hitPaddle (extremely rare edge case), both would flip.
    // For simplicity, use flipDY to drive a clean negation of the TOP-WALL-BOUNCED DY.
    // Since topBouncedDY already handled hitTop, if hitPaddle or hitBrick also fires,
    // we need to flip topBouncedDY. Let's negate topBouncedDY.
    node topDYneg: Subtractor(width=8)
    connect c0.out           -> topDYneg.a
    connect topBouncedDY.out -> topDYneg.b
    connect c0.out           -> topDYneg.borrow_in

    node paddleBrickFlipDY: Or
    connect hitPaddle.out -> paddleBrickFlipDY.a
    connect hitBrick.out  -> paddleBrickFlipDY.b

    node finalDY: Mux(width=8)
    connect topBouncedDY.out  -> finalDY.in0   // no paddle/brick flip
    connect topDYneg.difference -> finalDY.in1  // flip for paddle or brick
    connect paddleBrickFlipDY.out -> finalDY.sel

    // =========================================================================
    // Ball miss: nextBallY >= 15 AND movingDown AND NOT hitPaddle
    // nextBallY >= 15 → NOT (nextBallY < 15) → NOT cmp(nextBallY, c15).lt
    // =========================================================================
    node nextYlt15: Comparator
    connect nextBallYraw.sum -> nextYlt15.a
    connect c15.out          -> nextYlt15.b
    node nextYge15: Not
    connect nextYlt15.lt -> nextYge15.in

    node ballAtBottom: And
    connect nextYge15.out  -> ballAtBottom.a
    connect movingDown.out -> ballAtBottom.b

    node notHitPaddle: Not
    connect hitPaddle.out -> notHitPaddle.in

    node ballMissed: And
    connect ballAtBottom.out  -> ballMissed.a
    connect notHitPaddle.out  -> ballMissed.b

    // =========================================================================
    // Reset constants
    // =========================================================================
    node resetX:  Constant(value=16)
    node resetY:  Constant(value=8)
    node resetDX: Constant(value=1)
    node resetDY: Constant(value=255)

    // Mux between computed values and reset values
    node actualBallX: Mux(width=8)
    connect nextBallXraw.sum -> actualBallX.in0
    connect resetX.out       -> actualBallX.in1
    connect ballMissed.out   -> actualBallX.sel

    node actualBallY: Mux(width=8)
    connect nextBallYraw.sum -> actualBallY.in0
    connect resetY.out       -> actualBallY.in1
    connect ballMissed.out   -> actualBallY.sel

    node actualDX: Mux(width=8)
    connect newDX.out      -> actualDX.in0
    connect resetDX.out    -> actualDX.in1
    connect ballMissed.out -> actualDX.sel

    node actualDY: Mux(width=8)
    connect finalDY.out    -> actualDY.in0
    connect resetDY.out    -> actualDY.in1
    connect ballMissed.out -> actualDY.sel

    // =========================================================================
    // Register updates — gated by ballUpdate (every 4th vblank)
    // =========================================================================
    connect actualBallX.out -> ballX.data
    connect actualBallY.out -> ballY.data
    connect actualDX.out    -> ballDX.data
    connect actualDY.out    -> ballDY.data
    connect ballUpdate.out  -> ballX.we
    connect ballUpdate.out  -> ballY.we
    connect ballUpdate.out  -> ballDX.we
    connect ballUpdate.out  -> ballDY.we

    // =========================================================================
    // Paddle movement with clamping (paddleX 3..28)
    // =========================================================================
    // Delta: left → -1 (255), right → +1, neither → 0
    node paddleDelta: Mux(width=8)
    connect c0.out         -> paddleDelta.in0
    connect c255.out       -> paddleDelta.in1
    connect isLeftCmp.eq   -> paddleDelta.sel

    node paddleDelta2: Mux(width=8)
    connect paddleDelta.out  -> paddleDelta2.in0
    connect c1.out           -> paddleDelta2.in1
    connect isRightCmp.eq    -> paddleDelta2.sel

    node paddleXnewRaw: Adder(width=8)
    connect paddleX.q       -> paddleXnewRaw.a
    connect paddleDelta2.out -> paddleXnewRaw.b
    connect c0.out          -> paddleXnewRaw.carry_in

    // Clamp: if paddleXnewRaw < 3 → 3; if paddleXnewRaw > 28 → 28
    node paddleAtMin: Comparator
    connect paddleXnewRaw.sum -> paddleAtMin.a
    connect c3.out            -> paddleAtMin.b

    node paddleAtMax: Comparator
    connect paddleXnewRaw.sum -> paddleAtMax.a
    connect c28.out           -> paddleAtMax.b

    node paddleClamped1: Mux(width=8)
    connect paddleXnewRaw.sum -> paddleClamped1.in0
    connect c3.out            -> paddleClamped1.in1
    connect paddleAtMin.lt    -> paddleClamped1.sel  // < 3 → clamp to 3

    node newPaddleX: Mux(width=8)
    connect paddleClamped1.out -> newPaddleX.in0
    connect c28.out            -> newPaddleX.in1
    connect paddleAtMax.gt     -> newPaddleX.sel  // > 28 → clamp to 28

    connect newPaddleX.out -> paddleX.data
    connect paddleUpdate.out -> paddleX.we

    // =========================================================================
    // Brick clear: write 0 to brickRAM on brick hit; write 1 to all on miss
    //
    // Port A write:
    //   On hit: addr = nextBrickAddr, data = 0, weA = ballUpdate AND hitBrick
    //   On miss: cycle through all 128 addresses to write 1
    //     Use a fill counter that runs for 128 cycles when triggered
    // =========================================================================

    // Fill counter for brick reset (0..127, then done)
    node fillCtr: Register(initial=128)  // starts at 128 = "not filling"
    node fillCtrInc: Adder(width=8)
    connect fillCtr.q -> fillCtrInc.a
    connect c1.out    -> fillCtrInc.b
    connect c0.out    -> fillCtrInc.carry_in

    // filling = fillCtr < 128
    node isFilling: Comparator
    connect fillCtr.q   -> isFilling.a
    connect c128.out    -> isFilling.b
    // isFilling.lt = 1 when fillCtr < 128

    node c128: Constant(value=128)

    // fillNextCtr: if at 127, stop at 128; else increment
    // Note: fillCtr reaches 127, then on next write becomes 128 (stops)
    // We write fillCtr.we = onVblank (always advances during fill)
    // fillNext = isFilling ? fillCtrInc.sum : fillCtr.q (hold at 128)
    node fillNext: Mux(width=8)
    connect fillCtrInc.sum -> fillNext.in0  // incrementing
    connect fillCtr.q      -> fillNext.in1  // hold (not filling)
    connect isFilling.lt   -> fillNext.sel  // sel=1 means filling → use in0

    // On miss: reset fillCtr to 0 (start fill sequence)
    node onMissVblank: And
    connect onVblank.out  -> onMissVblank.a
    connect ballMissed.out -> onMissVblank.b

    node fillCtrData: Mux(width=8)
    connect fillNext.out   -> fillCtrData.in0
    connect c0.out         -> fillCtrData.in1   // reset to 0 on miss
    connect onMissVblank.out -> fillCtrData.sel

    // fillCtr write-enable: either we're filling (advance) or on miss (reset)
    node fillCtrWe: Or
    connect isFilling.lt    -> fillCtrWe.a
    connect onMissVblank.out -> fillCtrWe.b

    connect fillCtrData.out -> fillCtr.data
    connect fillCtrWe.out   -> fillCtr.we

    // =========================================================================
    // Port A address and data mux: fill vs normal (brick clear)
    // During fill: addrA = fillCtr (0-127), dataA = 1, weA = isFilling AND onVblank
    // On brick hit: addrA = nextBrickAddr, dataA = 0, weA = ballUpdate AND hitBrick
    // Fill takes priority over hit (fill follows miss which resets ball anyway)
    // =========================================================================
    // weA for brick hit
    node brickHitWe: And
    connect ballUpdate.out -> brickHitWe.a
    connect hitBrick.out   -> brickHitWe.b

    // weA for fill
    node fillWe: And
    connect isFilling.lt -> fillWe.a
    connect onVblank.out -> fillWe.b

    // Combined weA
    node brickRAMweA: Or
    connect brickHitWe.out -> brickRAMweA.a
    connect fillWe.out     -> brickRAMweA.b

    // addrA mux: fill addr vs hit addr
    node brickRAMaddrA: Mux(width=8)
    connect nextBrickAddr.sum -> brickRAMaddrA.in0   // normal: hit addr
    connect fillCtr.q         -> brickRAMaddrA.in1   // fill: counter addr
    connect isFilling.lt      -> brickRAMaddrA.sel

    // dataA mux: 0 for clear, 1 for fill
    node brickRAMdataA: Mux(width=8)
    connect c0.out       -> brickRAMdataA.in0   // brick clear
    connect c1.out       -> brickRAMdataA.in1   // brick restore
    connect isFilling.lt -> brickRAMdataA.sel

    connect brickRAMaddrA.out  -> brickRAM.addrA
    connect brickRAMdataA.out  -> brickRAM.dataA
    connect brickRAMweA.out    -> brickRAM.weA

  }
}
`;
