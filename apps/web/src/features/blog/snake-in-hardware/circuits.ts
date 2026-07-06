/**
 * Circuit definitions for the "Snake in Hardware" blog post.
 *
 * Each circuit builds toward the final Snake game, from framebuffers
 * and address computation to direction decoding, movement, phased
 * operations, collision detection, and the full Snake circuit.
 */

import { circuit } from '@simten/core/circuit';
import {
  Adder,
  And,
  BitSlice,
  Comparator,
  Constant,
  DualPortRAM,
  HexDisplay,
  Input,
  Led,
  LeftShifter,
  Mux,
  Register,
  Screen,
  Switch,
} from '@simten/core/std';
import type { BlogCircuit } from '../types';

// ── Module-level circuit definitions ──

const SimpleFramebuffer = circuit('SimpleFramebuffer', {
  nodes: {
    ram: DualPortRAM(),
    screen: Screen(),
    addr: Input(),
    data_in: Input(),
    we: Switch(),
    readback: HexDisplay,
  },
  connect: ({ nodes: { ram, screen, addr, data_in, we, readback } }) => [
    screen.addrB.to(ram.addrB),
    ram.outB.to(screen.dataIn),
    addr.out.to(ram.addrA),
    data_in.out.to(ram.dataA),
    we.out.to(ram.weA),
    ram.outA.to(readback.in),
  ],
});

const CoordToPixel = circuit('CoordToPixel', {
  nodes: {
    x: Input({ value: 3 }),
    y: Input({ value: 2 }),
    three: Input({ value: 3 }),
    y8: LeftShifter(),
    addr: Adder(),
    result: HexDisplay,
  },
  connect: ({ nodes: { x, y, three, y8, addr, result } }) => [
    y.out.to(y8.value),
    three.out.to(y8.shift),
    y8.result.to(addr.a),
    x.out.to(addr.b),
    addr.sum.to(result.in),
  ],
});

const DirectionDecoder = circuit('DirectionDecoder', {
  nodes: {
    keyCode: Input({ value: 77 }),
    upCode: Constant({ value: 72 }),
    downCode: Constant({ value: 80 }),
    leftCode: Constant({ value: 75 }),
    rightCode: Constant({ value: 77 }),
    zero: Constant({ value: 0 }),
    one: Constant({ value: 1 }),
    minus1: Constant({ value: 255 }),
    isUp: Comparator(),
    isDown: Comparator(),
    isLeft: Comparator(),
    isRight: Comparator(),
    deltaXTemp: Mux(),
    deltaX: Mux(),
    deltaYTemp: Mux(),
    deltaY: Mux(),
    displayDX: HexDisplay,
    displayDY: HexDisplay,
  },
  connect: ({
    nodes: {
      keyCode,
      upCode,
      downCode,
      leftCode,
      rightCode,
      zero,
      one,
      minus1,
      isUp,
      isDown,
      isLeft,
      isRight,
      deltaXTemp,
      deltaX,
      deltaYTemp,
      deltaY,
      displayDX,
      displayDY,
    },
  }) => [
    keyCode.out.to(isUp.a, isDown.a, isLeft.a, isRight.a),
    upCode.out.to(isUp.b),
    downCode.out.to(isDown.b),
    leftCode.out.to(isLeft.b),
    rightCode.out.to(isRight.b),
    zero.out.to(deltaXTemp.in0, deltaYTemp.in0),
    minus1.out.to(deltaXTemp.in1, deltaYTemp.in1),
    isLeft.eq.to(deltaXTemp.sel),
    deltaXTemp.out.to(deltaX.in0),
    one.out.to(deltaX.in1, deltaY.in1),
    isRight.eq.to(deltaX.sel),
    isUp.eq.to(deltaYTemp.sel),
    deltaYTemp.out.to(deltaY.in0),
    isDown.eq.to(deltaY.sel),
    deltaX.out.to(displayDX.in),
    deltaY.out.to(displayDY.in),
  ],
});

const PixelMover = circuit('PixelMover', {
  nodes: {
    ram: DualPortRAM(),
    screen: Screen(),
    keyboard: Input({ value: 77 }),
    headX: Register({ value: 4 }),
    headY: Register({ value: 4 }),
    upCode: Constant({ value: 72 }),
    downCode: Constant({ value: 80 }),
    leftCode: Constant({ value: 75 }),
    rightCode: Constant({ value: 77 }),
    zero: Constant({ value: 0 }),
    one: Constant({ value: 1 }),
    minus1: Constant({ value: 255 }),
    isUp: Comparator(),
    isDown: Comparator(),
    isLeft: Comparator(),
    isRight: Comparator(),
    deltaXTemp: Mux(),
    deltaX: Mux(),
    deltaYTemp: Mux(),
    deltaY: Mux(),
    nextX: Adder(),
    nextY: Adder(),
    wrapX: BitSlice({ low: 0, high: 2 }),
    wrapY: BitSlice({ low: 0, high: 2 }),
    enable: Switch(),
    shiftAmt: Constant({ value: 3 }),
    y8: LeftShifter(),
    pixelAddr: Adder(),
    displayX: HexDisplay,
    displayY: HexDisplay,
  },
  connect: ({
    nodes: {
      ram,
      screen,
      keyboard,
      headX,
      headY,
      upCode,
      downCode,
      leftCode,
      rightCode,
      zero,
      one,
      minus1,
      isUp,
      isDown,
      isLeft,
      isRight,
      deltaXTemp,
      deltaX,
      deltaYTemp,
      deltaY,
      nextX,
      nextY,
      wrapX,
      wrapY,
      enable,
      shiftAmt,
      y8,
      pixelAddr,
      displayX,
      displayY,
    },
  }) => [
    screen.addrB.to(ram.addrB),
    ram.outB.to(screen.dataIn),
    keyboard.out.to(isUp.a, isDown.a, isLeft.a, isRight.a),
    upCode.out.to(isUp.b),
    downCode.out.to(isDown.b),
    leftCode.out.to(isLeft.b),
    rightCode.out.to(isRight.b),
    zero.out.to(deltaXTemp.in0, deltaYTemp.in0),
    minus1.out.to(deltaXTemp.in1, deltaYTemp.in1),
    isLeft.eq.to(deltaXTemp.sel),
    deltaXTemp.out.to(deltaX.in0),
    one.out.to(deltaX.in1, deltaY.in1, ram.dataA),
    isRight.eq.to(deltaX.sel),
    isUp.eq.to(deltaYTemp.sel),
    deltaYTemp.out.to(deltaY.in0),
    isDown.eq.to(deltaY.sel),
    headX.q.to(nextX.a),
    deltaX.out.to(nextX.b),
    headY.q.to(nextY.a),
    deltaY.out.to(nextY.b),
    nextX.sum.to(wrapX.in),
    nextY.sum.to(wrapY.in),
    wrapX.out.to(headX.data, pixelAddr.b, displayX.in),
    wrapY.out.to(headY.data, y8.value, displayY.in),
    enable.out.to(headX.we, headY.we, ram.weA),
    shiftAmt.out.to(y8.shift),
    y8.result.to(pixelAddr.a),
    pixelAddr.sum.to(ram.addrA),
  ],
});

const PhaseDemo = circuit('PhaseDemo', {
  nodes: {
    phase: Register({ value: 0 }),
    one: Constant({ value: 1 }),
    zero: Constant({ value: 0 }),
    two: Constant({ value: 2 }),
    three: Constant({ value: 3 }),
    phaseInc: Adder(),
    phaseWrap: BitSlice({ low: 0, high: 1 }),
    enable: Switch(),
    isPhase0: Comparator(),
    isPhase1: Comparator(),
    isPhase2: Comparator(),
    isPhase3: Comparator(),
    led0: Led,
    led1: Led,
    led2: Led,
    led3: Led,
    display: HexDisplay,
  },
  connect: ({
    nodes: {
      phase,
      one,
      zero,
      two,
      three,
      phaseInc,
      phaseWrap,
      enable,
      isPhase0,
      isPhase1,
      isPhase2,
      isPhase3,
      led0,
      led1,
      led2,
      led3,
      display,
    },
  }) => [
    phase.q.to(phaseInc.a, isPhase0.a, isPhase1.a, isPhase2.a, isPhase3.a, display.in),
    one.out.to(phaseInc.b, isPhase1.b),
    phaseInc.sum.to(phaseWrap.in),
    phaseWrap.out.to(phase.data),
    enable.out.to(phase.we),
    zero.out.to(isPhase0.b),
    two.out.to(isPhase2.b),
    three.out.to(isPhase3.b),
    isPhase0.eq.to(led0.in),
    isPhase1.eq.to(led1.in),
    isPhase2.eq.to(led2.in),
    isPhase3.eq.to(led3.in),
  ],
});

const CollisionDetector = circuit('CollisionDetector', {
  nodes: {
    headX: Input({ value: 3 }),
    headY: Input({ value: 5 }),
    foodX: Input({ value: 3 }),
    foodY: Input({ value: 5 }),
    matchX: Comparator(),
    matchY: Comparator(),
    collision: And,
    collisionLed: Led,
    zero: Constant({ value: 0 }),
    one: Constant({ value: 1 }),
    growMux: Mux(),
    growDisplay: HexDisplay,
  },
  connect: ({
    nodes: {
      headX,
      headY,
      foodX,
      foodY,
      matchX,
      matchY,
      collision,
      collisionLed,
      zero,
      one,
      growMux,
      growDisplay,
    },
  }) => [
    headX.out.to(matchX.a),
    foodX.out.to(matchX.b),
    headY.out.to(matchY.a),
    foodY.out.to(matchY.b),
    matchX.eq.to(collision.a),
    matchY.eq.to(collision.b),
    collision.out.to(collisionLed.in, growMux.sel),
    zero.out.to(growMux.in0),
    one.out.to(growMux.in1),
    growMux.out.to(growDisplay.in),
  ],
});

// The full Snake game circuit is the canonical, hardware-verified copy from
// @simten/core/examples — the same circuit the ULX3S FPGA project synthesizes.
// Drift between the copies in this repo is pinned by
// hardware/ulx3s/projects/snake/parity-check.ts.
export { Snake } from '@simten/core/examples';

export const SNAKE_CIRCUITS: Record<string, BlogCircuit> = {
  simpleFramebuffer: {
    name: 'Simple Framebuffer',
    description:
      'DualPortRAM as a screen framebuffer. Port A reads/writes data, port B is used by the Screen to display pixels.',
    circuit: SimpleFramebuffer,
    layout: {
      // Inputs (left)
      addr: { x: 0, y: 0 },
      data_in: { x: 0, y: 120 },
      we: { x: 0, y: 240 },
      // RAM + Screen (center)
      ram: { x: 250, y: 60 },
      screen: { x: 500, y: 0 },
      // Output (right)
      readback: { x: 500, y: 180 },
    },
  },

  coordToPixel: {
    name: 'Coordinate to Pixel Address',
    description:
      'Converts (X, Y) coordinates to a linear pixel address using (Y << 3) + X. A left shift by 3 is just wiring in real hardware — zero gates.',
    circuit: CoordToPixel,
    layout: {
      x: { x: 0, y: 0 },
      y: { x: 0, y: 120 },
      three: { x: 0, y: 240 },
      y8: { x: 200, y: 120 },
      addr: { x: 400, y: 60 },
      result: { x: 600, y: 60 },
    },
  },

  directionDecoder: {
    name: 'Direction Decoder',
    description:
      'Decodes keyboard scan codes into deltaX/deltaY movement values using Comparators and a Mux tree.',
    circuit: DirectionDecoder,
    layout: {
      // Input (left)
      keyCode: { x: 0, y: 140 },
      // Constants (left column)
      upCode: { x: 0, y: 0 },
      downCode: { x: 0, y: 60 },
      leftCode: { x: 0, y: 280 },
      rightCode: { x: 0, y: 340 },
      zero: { x: 220, y: 280 },
      one: { x: 220, y: 340 },
      minus1: { x: 220, y: 400 },
      // Comparators
      isUp: { x: 220, y: 0 },
      isDown: { x: 220, y: 60 },
      isLeft: { x: 220, y: 140 },
      isRight: { x: 220, y: 200 },
      // Mux tree (X)
      deltaXTemp: { x: 440, y: 160 },
      deltaX: { x: 620, y: 160 },
      // Mux tree (Y)
      deltaYTemp: { x: 440, y: 20 },
      deltaY: { x: 620, y: 20 },
      // Displays (right)
      displayDX: { x: 800, y: 160 },
      displayDY: { x: 800, y: 20 },
    },
  },

  pixelMover: {
    name: 'Pixel Mover',
    description:
      'Position registers with delta addition and BitSlice wraparound, drawing the result to a Screen via DualPortRAM.',
    circuit: PixelMover,
    layout: {
      // Input
      keyboard: { x: 0, y: 200 },
      enable: { x: 0, y: 500 },
      // Direction constants
      upCode: { x: 0, y: 0 },
      downCode: { x: 0, y: 60 },
      leftCode: { x: 0, y: 340 },
      rightCode: { x: 0, y: 400 },
      zero: { x: 180, y: 340 },
      one: { x: 180, y: 400 },
      minus1: { x: 180, y: 460 },
      // Comparators
      isUp: { x: 180, y: 0 },
      isDown: { x: 180, y: 60 },
      isLeft: { x: 180, y: 140 },
      isRight: { x: 180, y: 200 },
      // Delta muxes
      deltaXTemp: { x: 380, y: 160 },
      deltaX: { x: 520, y: 160 },
      deltaYTemp: { x: 380, y: 20 },
      deltaY: { x: 520, y: 20 },
      // Position registers
      headX: { x: 520, y: 300 },
      headY: { x: 520, y: 400 },
      // Next position
      nextX: { x: 680, y: 160 },
      nextY: { x: 680, y: 20 },
      wrapX: { x: 820, y: 160 },
      wrapY: { x: 820, y: 20 },
      // Pixel address
      shiftAmt: { x: 820, y: 300 },
      y8: { x: 960, y: 20 },
      pixelAddr: { x: 960, y: 100 },
      // RAM + Screen
      ram: { x: 1100, y: 60 },
      screen: { x: 1100, y: 250 },
      // Displays
      displayX: { x: 960, y: 200 },
      displayY: { x: 960, y: 300 },
    },
  },

  phaseDemo: {
    name: '4-Phase Counter',
    description:
      'A 2-bit counter cycling through phases 0-3, with LED indicators showing the active phase.',
    circuit: PhaseDemo,
    layout: {
      // Control (left)
      enable: { x: 0, y: 100 },
      one: { x: 60, y: 230 },
      // Phase register + increment
      phase: { x: 200, y: 100 },
      phaseInc: { x: 200, y: 0 },
      phaseWrap: { x: 200, y: 230 },
      // Constants
      zero: { x: 420, y: 0 },
      two: { x: 420, y: 160 },
      three: { x: 420, y: 240 },
      // Comparators
      isPhase0: { x: 580, y: 0 },
      isPhase1: { x: 580, y: 80 },
      isPhase2: { x: 580, y: 160 },
      isPhase3: { x: 580, y: 240 },
      // LEDs (right)
      led0: { x: 760, y: 0 },
      led1: { x: 760, y: 80 },
      led2: { x: 760, y: 160 },
      led3: { x: 760, y: 240 },
      display: { x: 760, y: 340 },
    },
  },

  collisionDetector: {
    name: 'Collision Detector',
    description:
      'Compares head and food X/Y coordinates to detect collision, outputting a grow signal when they match.',
    circuit: CollisionDetector,
    layout: {
      // Inputs (left, 2x2 grid)
      headX: { x: 0, y: 0 },
      headY: { x: 0, y: 120 },
      foodX: { x: 0, y: 260 },
      foodY: { x: 0, y: 380 },
      // Comparators
      matchX: { x: 220, y: 60 },
      matchY: { x: 220, y: 300 },
      // AND gate
      collision: { x: 420, y: 160 },
      collisionLed: { x: 620, y: 100 },
      // Grow mux
      zero: { x: 420, y: 300 },
      one: { x: 420, y: 380 },
      growMux: { x: 620, y: 300 },
      growDisplay: { x: 780, y: 300 },
    },
  },
};
