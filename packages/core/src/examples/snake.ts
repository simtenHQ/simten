/**
 * Snake — the canonical Snake game circuit.
 *
 * Single source of truth for every copy in the repo: the ULX3S FPGA project
 * (hardware/ulx3s/projects/snake), the "Snake in Hardware" blog post and
 * landing-page demo, and the Verilog exporter's end-to-end bitstream test.
 * The /circuit editor example carries the same SnakeCore as a source string;
 * hardware/ulx3s/projects/snake/parity-check.ts pins it to this one.
 *
 * A complete 8×8 Snake game in pure logic — no CPU. Structured like the
 * RV32I core: a textbook diagram, drillable level by level.
 *
 *   Snake            FPGA top: SnakeCore + DualPortRAM
 *   └─ SnakeCore             game logic, memory external (like the CPU)
 *      ├─ PhaseSequencer     free-running 2-bit phase counter → one-hot p0–p3
 *      ├─ DirectionUnit      latch dir at p0, decode to ±1 deltas
 *      ├─ HeadUnit           next-head position + pixel address, commits at p3
 *      ├─ FoodUnit           eat detection, respawn at (+3,+5) mod 8, draw flag
 *      ├─ TailUnit           circular body buffer pointers, deferred tail clear
 *      └─ WriteArbiter       one RAM write port shared across the 4 phases
 *
 * The RAM holds both the framebuffer (addresses 0–63) and the circular body
 * buffer (64+). Port A is the game's read/write bus; port B is the VGA-style
 * scan interface:
 *   in:  dir[2]       — 2-bit direction (0=up 1=right 2=down 3=left)
 *        scan_addr[6] — framebuffer scan address (driven by VGA counters)
 *   out: pixel_out[8] — framebuffer pixel value at scan_addr
 *
 * Per game tick (4 clock cycles): p0 latches direction and draws a pending
 * food (skipping the tail latch — that's how growth works), p1 clears the
 * latched tail pixel, p2 pushes the new head address into the body buffer,
 * p3 draws the head and commits all registers.
 *
 * Gameplay is pinned by hardware/ulx3s/projects/snake/gameplay.verify.ts
 * (Tier-B reference-model co-sim). The flat pre-hierarchy structure of this
 * exact logic was verified on the ULX3S over HDMI.
 */

import { circuit, bit, bus } from '../circuit/index.js';
import {
  DualPortRAM,
  Register,
  Constant,
  Comparator,
  Mux,
  Adder,
  BitSlice,
  And,
  Or,
  Not,
} from '../std/index.js';
import type { CircuitLibrary } from '../types/circuit.js';

export function buildSnake() {
  /**
   * Free-running phase counter. Increments every clock, wraps mod 4, and
   * decodes to one-hot phase strobes. Everything else in the core is
   * sequenced off p0–p3.
   */
  const PhaseSequencer = circuit('Snake_PhaseSequencer', {
    outputs: { p0: bit, p1: bit, p2: bit, p3: bit },
    nodes: {
      phase: Register({ value: 0 }),
      phaseInc: Adder(),
      phaseWrap: BitSlice({ low: 0, high: 1 }),
      enable: Constant({ value: 1 }),
      zero: Constant({ value: 0 }),
      one: Constant({ value: 1 }),
      two: Constant({ value: 2 }),
      three: Constant({ value: 3 }),
      isPhase0: Comparator(),
      isPhase1: Comparator(),
      isPhase2: Comparator(),
      isPhase3: Comparator(),
    },
    connect: ({
      outputs,
      nodes: {
        phase,
        phaseInc,
        phaseWrap,
        enable,
        zero,
        one,
        two,
        three,
        isPhase0,
        isPhase1,
        isPhase2,
        isPhase3,
      },
    }) => [
      phase.q.to(phaseInc.a, isPhase0.a, isPhase1.a, isPhase2.a, isPhase3.a),
      one.out.to(phaseInc.b, isPhase1.b),
      zero.out.to(isPhase0.b),
      two.out.to(isPhase2.b),
      three.out.to(isPhase3.b),
      phaseInc.sum.to(phaseWrap.in),
      phaseWrap.out.to(phase.data),
      enable.out.to(phase.we),
      isPhase0.eq.to(outputs.p0),
      isPhase1.eq.to(outputs.p1),
      isPhase2.eq.to(outputs.p2),
      isPhase3.eq.to(outputs.p3),
    ],
  });

  /**
   * Latches the direction input at p0 and decodes it to X/Y deltas
   * (8'd255 = -1 in two's complement). A 2-bit direction is always one of
   * the four arrows, so `moving` is constant-true in practice — it exists
   * so the datapath reads honestly.
   */
  const DirectionUnit = circuit('Snake_DirectionUnit', {
    inputs: { dir: bus(2), p0: bit },
    outputs: { dx: bus(8), dy: bus(8), moving: bit },
    nodes: {
      keyboardLatched: Register({ value: 1 }),
      en: Constant({ value: 1 }),
      latchKeyboard: And,
      zero: Constant({ value: 0 }),
      one: Constant({ value: 1 }),
      two: Constant({ value: 2 }),
      three: Constant({ value: 3 }),
      minus1: Constant({ value: 255 }),
      isUp: Comparator(),
      isDown: Comparator(),
      isLeft: Comparator(),
      isRight: Comparator(),
      // 8-bit Muxes for the X/Y delta data path. Carry minus1 (8'd255 =
      // -1 in two's complement) when going left/up; without the width
      // override the Mux defaults to 1-bit and the exporter truncates
      // minus1's output to its LSB (1), so left/up end up adding +1 and
      // mirror right/down on the FPGA.
      deltaXTemp: Mux({ width: 8 }),
      deltaX: Mux({ width: 8 }),
      deltaYTemp: Mux({ width: 8 }),
      deltaY: Mux({ width: 8 }),
      deltaXIsZero: Comparator(),
      deltaYIsZero: Comparator(),
      bothDeltasZero: And,
      isMoving: Not,
    },
    connect: ({
      inputs,
      outputs,
      nodes: {
        keyboardLatched,
        en,
        latchKeyboard,
        zero,
        one,
        two,
        three,
        minus1,
        isUp,
        isDown,
        isLeft,
        isRight,
        deltaXTemp,
        deltaX,
        deltaYTemp,
        deltaY,
        deltaXIsZero,
        deltaYIsZero,
        bothDeltasZero,
        isMoving,
      },
    }) => [
      en.out.to(latchKeyboard.a),
      inputs.p0.to(latchKeyboard.b),
      latchKeyboard.out.to(keyboardLatched.we),
      inputs.dir.to(keyboardLatched.data),
      keyboardLatched.q.to(isUp.a, isDown.a, isLeft.a, isRight.a),
      zero.out.to(isUp.b, deltaXTemp.in0, deltaYTemp.in0, deltaXIsZero.b, deltaYIsZero.b),
      one.out.to(isRight.b, deltaX.in1, deltaY.in1),
      two.out.to(isDown.b),
      three.out.to(isLeft.b),
      minus1.out.to(deltaXTemp.in1, deltaYTemp.in1),
      isLeft.eq.to(deltaXTemp.sel),
      deltaXTemp.out.to(deltaX.in0),
      isRight.eq.to(deltaX.sel),
      isUp.eq.to(deltaYTemp.sel),
      deltaYTemp.out.to(deltaY.in0),
      isDown.eq.to(deltaY.sel),
      deltaX.out.to(outputs.dx, deltaXIsZero.a),
      deltaY.out.to(outputs.dy, deltaYIsZero.a),
      deltaXIsZero.eq.to(bothDeltasZero.a),
      deltaYIsZero.eq.to(bothDeltasZero.b),
      bothDeltasZero.out.to(isMoving.in),
      isMoving.out.to(outputs.moving),
    ],
  });

  /**
   * Computes the next head position (wrapping at the 8×8 walls) and its
   * pixel address (y*8 + x, the ×8 done with adder doublings). The address
   * is latched at p1; head registers commit at p3 when moving.
   */
  const HeadUnit = circuit('Snake_HeadUnit', {
    inputs: { dx: bus(8), dy: bus(8), p1: bit, p3: bit, moving: bit },
    outputs: { nh_addr: bus(8), nhx: bus(3), nhy: bus(3), commit: bit },
    nodes: {
      headX: Register({ value: 4 }),
      headY: Register({ value: 4 }),
      nextHeadPixelAddr: Register({ value: 36 }),
      en: Constant({ value: 1 }),
      nextHeadXCalc: Adder(),
      nextHeadYCalc: Adder(),
      nextHeadX: BitSlice({ low: 0, high: 2 }),
      nextHeadY: BitSlice({ low: 0, high: 2 }),
      nextHeadY2: Adder(),
      nextHeadY4: Adder(),
      nextHeadY8: Adder(),
      nextPixelAddr: Adder(),
      latchNextHead: And,
      updateHead: And,
      updateHeadFinal: And,
    },
    connect: ({
      inputs,
      outputs,
      nodes: {
        headX,
        headY,
        nextHeadPixelAddr,
        en,
        nextHeadXCalc,
        nextHeadYCalc,
        nextHeadX,
        nextHeadY,
        nextHeadY2,
        nextHeadY4,
        nextHeadY8,
        nextPixelAddr,
        latchNextHead,
        updateHead,
        updateHeadFinal,
      },
    }) => [
      headX.q.to(nextHeadXCalc.a),
      inputs.dx.to(nextHeadXCalc.b),
      headY.q.to(nextHeadYCalc.a),
      inputs.dy.to(nextHeadYCalc.b),
      nextHeadXCalc.sum.to(nextHeadX.in),
      nextHeadYCalc.sum.to(nextHeadY.in),
      nextHeadY.out.to(nextHeadY2.a, nextHeadY2.b, headY.data, outputs.nhy),
      nextHeadY2.sum.to(nextHeadY4.a, nextHeadY4.b),
      nextHeadY4.sum.to(nextHeadY8.a, nextHeadY8.b),
      nextHeadY8.sum.to(nextPixelAddr.a),
      nextHeadX.out.to(nextPixelAddr.b, headX.data, outputs.nhx),
      nextPixelAddr.sum.to(nextHeadPixelAddr.data),
      en.out.to(latchNextHead.a, updateHead.a),
      inputs.p1.to(latchNextHead.b),
      latchNextHead.out.to(nextHeadPixelAddr.we),
      inputs.p3.to(updateHead.b),
      updateHead.out.to(updateHeadFinal.a),
      inputs.moving.to(updateHeadFinal.b),
      updateHeadFinal.out.to(headX.we, headY.we, outputs.commit),
      nextHeadPixelAddr.q.to(outputs.nh_addr),
    ],
  });

  /**
   * Food position, eat detection, and the one-tick-delayed draw flag.
   * Eating (next head == food, seen at p3) respawns the food at
   * (x+3, y+5) mod 8 and arms `drawing`; the next tick's p0 draws it and
   * clears the flag.
   */
  const FoodUnit = circuit('Snake_FoodUnit', {
    inputs: { nhx: bus(3), nhy: bus(3), p0: bit, p3: bit },
    outputs: { will_eat: bit, not_eating: bit, drawing: bit, not_drawing: bit, food_addr: bus(8) },
    nodes: {
      foodX: Register({ value: 6 }),
      foodY: Register({ value: 3 }),
      foodNeedsDrawing: Register({ value: 1 }),
      en: Constant({ value: 1 }),
      zero: Constant({ value: 0 }),
      one: Constant({ value: 1 }),
      three: Constant({ value: 3 }),
      five: Constant({ value: 5 }),
      foodY2: Adder(),
      foodY4: Adder(),
      foodY8: Adder(),
      foodPixelAddr: Adder(),
      nextHeadAtFoodX: Comparator(),
      nextHeadAtFoodY: Comparator(),
      willEatFood: And,
      notEatingFood: Not,
      notDrawingFood: Not,
      clearFoodFlag: And,
      clearFoodFlagFinal: And,
      ateFood: And,
      ateFoodFinal: And,
      foodFlagWriteEnable: Or,
      foodFlagData: Mux(),
      foodXNext: Adder(),
      foodXWrap: BitSlice({ low: 0, high: 2 }),
      foodYNext: Adder(),
      foodYWrap: BitSlice({ low: 0, high: 2 }),
    },
    connect: ({
      inputs,
      outputs,
      nodes: {
        foodX,
        foodY,
        foodNeedsDrawing,
        en,
        zero,
        one,
        three,
        five,
        foodY2,
        foodY4,
        foodY8,
        foodPixelAddr,
        nextHeadAtFoodX,
        nextHeadAtFoodY,
        willEatFood,
        notEatingFood,
        notDrawingFood,
        clearFoodFlag,
        clearFoodFlagFinal,
        ateFood,
        ateFoodFinal,
        foodFlagWriteEnable,
        foodFlagData,
        foodXNext,
        foodXWrap,
        foodYNext,
        foodYWrap,
      },
    }) => [
      foodY.q.to(foodY2.a, foodY2.b, nextHeadAtFoodY.b, foodYNext.a),
      foodY2.sum.to(foodY4.a, foodY4.b),
      foodY4.sum.to(foodY8.a, foodY8.b),
      foodY8.sum.to(foodPixelAddr.a),
      foodX.q.to(foodPixelAddr.b, nextHeadAtFoodX.b, foodXNext.a),
      foodPixelAddr.sum.to(outputs.food_addr),
      inputs.nhx.to(nextHeadAtFoodX.a),
      inputs.nhy.to(nextHeadAtFoodY.a),
      nextHeadAtFoodX.eq.to(willEatFood.a),
      nextHeadAtFoodY.eq.to(willEatFood.b),
      willEatFood.out.to(notEatingFood.in, ateFoodFinal.b, outputs.will_eat),
      notEatingFood.out.to(outputs.not_eating),
      en.out.to(clearFoodFlag.a, ateFood.a),
      inputs.p0.to(clearFoodFlag.b),
      inputs.p3.to(ateFood.b),
      foodNeedsDrawing.q.to(notDrawingFood.in, clearFoodFlagFinal.b, outputs.drawing),
      notDrawingFood.out.to(outputs.not_drawing),
      clearFoodFlag.out.to(clearFoodFlagFinal.a),
      ateFood.out.to(ateFoodFinal.a),
      ateFoodFinal.out.to(foodFlagWriteEnable.a, foodFlagData.sel, foodX.we, foodY.we),
      clearFoodFlagFinal.out.to(foodFlagWriteEnable.b),
      foodFlagWriteEnable.out.to(foodNeedsDrawing.we),
      zero.out.to(foodFlagData.in0),
      one.out.to(foodFlagData.in1),
      foodFlagData.out.to(foodNeedsDrawing.data),
      three.out.to(foodXNext.b),
      five.out.to(foodYNext.b),
      foodXNext.sum.to(foodXWrap.in),
      foodYNext.sum.to(foodYWrap.in),
      foodXWrap.out.to(foodX.data),
      foodYWrap.out.to(foodY.data),
    ],
  });

  /**
   * Circular body buffer management: head/tail pointers into the RAM's 64+
   * region, snake length, and the tail-pixel latch. The tail address is
   * latched at p0 (read through the RAM's port A) and cleared at p1 —
   * except on eat ticks, which skip the clear (growth) and defer it to the
   * food-draw tick that follows.
   */
  const TailUnit = circuit('Snake_TailUnit', {
    inputs: {
      p0: bit,
      p3: bit,
      moving: bit,
      not_eating: bit,
      not_drawing: bit,
      commit: bit,
      ram_out: bus(8),
    },
    outputs: { head_body_addr: bus(8), tail_body_addr: bus(8), tail_addr: bus(8), clear_tail: bit },
    nodes: {
      headPtr: Register({ value: 3 }),
      tailPtr: Register({ value: 0 }),
      snakeLen: Register({ value: 4 }),
      tailPixelAddr: Register({ value: 33 }),
      en: Constant({ value: 1 }),
      zero: Constant({ value: 0 }),
      one: Constant({ value: 1 }),
      bodyBase: Constant({ value: 64 }),
      headPtrNext: Adder(),
      headPtrNextWrap: BitSlice({ low: 0, high: 5 }),
      headBodyAddr: Adder(),
      tailBodyAddr: Adder(),
      headPtrInc: Adder(),
      headPtrWrap: BitSlice({ low: 0, high: 5 }),
      tailPtrInc: Adder(),
      tailPtrWrap: BitSlice({ low: 0, high: 5 }),
      snakeLenDelta: Mux(),
      snakeLenNew: Adder(),
      bufferEmpty: Comparator(),
      bufferNotEmpty: Not,
      shouldMoveTail: Constant({ value: 1 }),
      shouldMoveTailActual: And,
      shouldClearTail: And,
      shouldClearTailMoving: And,
      latchTail: And,
      latchTailFinal: And,
      latchTailNotFood: And,
      updateTail: And,
      updateTailFinal: And,
    },
    connect: ({
      inputs,
      outputs,
      nodes: {
        headPtr,
        tailPtr,
        snakeLen,
        tailPixelAddr,
        en,
        zero,
        one,
        bodyBase,
        headPtrNext,
        headPtrNextWrap,
        headBodyAddr,
        tailBodyAddr,
        headPtrInc,
        headPtrWrap,
        tailPtrInc,
        tailPtrWrap,
        snakeLenDelta,
        snakeLenNew,
        bufferEmpty,
        bufferNotEmpty,
        shouldMoveTail,
        shouldMoveTailActual,
        shouldClearTail,
        shouldClearTailMoving,
        latchTail,
        latchTailFinal,
        latchTailNotFood,
        updateTail,
        updateTailFinal,
      },
    }) => [
      headPtr.q.to(headPtrNext.a, headPtrInc.a),
      one.out.to(headPtrNext.b, headPtrInc.b, tailPtrInc.b, snakeLenDelta.in0),
      zero.out.to(bufferEmpty.b, snakeLenDelta.in1),
      headPtrNext.sum.to(headPtrNextWrap.in),
      headPtrNextWrap.out.to(headBodyAddr.a),
      bodyBase.out.to(headBodyAddr.b, tailBodyAddr.b),
      tailPtr.q.to(tailBodyAddr.a, tailPtrInc.a),
      headBodyAddr.sum.to(outputs.head_body_addr),
      tailBodyAddr.sum.to(outputs.tail_body_addr),
      snakeLen.q.to(bufferEmpty.a, snakeLenNew.a),
      bufferEmpty.eq.to(bufferNotEmpty.in),
      shouldMoveTail.out.to(shouldMoveTailActual.a),
      inputs.not_eating.to(shouldMoveTailActual.b),
      shouldMoveTailActual.out.to(shouldClearTail.a),
      inputs.moving.to(shouldClearTail.b),
      shouldClearTail.out.to(shouldClearTailMoving.a),
      bufferNotEmpty.out.to(shouldClearTailMoving.b, latchTailFinal.b),
      shouldClearTailMoving.out.to(updateTailFinal.b, snakeLenDelta.sel, outputs.clear_tail),
      en.out.to(latchTail.a, updateTail.a),
      inputs.p0.to(latchTail.b),
      latchTail.out.to(latchTailFinal.a),
      latchTailFinal.out.to(latchTailNotFood.a),
      inputs.not_drawing.to(latchTailNotFood.b),
      latchTailNotFood.out.to(tailPixelAddr.we),
      inputs.ram_out.to(tailPixelAddr.data),
      tailPixelAddr.q.to(outputs.tail_addr),
      inputs.p3.to(updateTail.b),
      updateTail.out.to(updateTailFinal.a),
      updateTailFinal.out.to(tailPtr.we),
      inputs.commit.to(headPtr.we, snakeLen.we),
      headPtrInc.sum.to(headPtrWrap.in),
      headPtrWrap.out.to(headPtr.data),
      tailPtrInc.sum.to(tailPtrWrap.in),
      tailPtrWrap.out.to(tailPtr.data),
      snakeLenDelta.out.to(snakeLenNew.b),
      snakeLenNew.sum.to(snakeLen.data),
    ],
  });

  /**
   * One RAM write port, four customers. Mux chain picks the address and
   * data for the current phase (p0: draw food / read tail, p1: clear tail
   * pixel, p2: push head into body buffer, p3: draw head pixel); the write
   * strobe is the OR of the per-phase write conditions.
   */
  const WriteArbiter = circuit('Snake_WriteArbiter', {
    inputs: {
      p0: bit,
      p1: bit,
      p2: bit,
      p3: bit,
      drawing: bit,
      clear_tail: bit,
      moving: bit,
      food_addr: bus(8),
      tail_body_addr: bus(8),
      tail_addr: bus(8),
      head_body_addr: bus(8),
      nh_addr: bus(8),
    },
    outputs: { ram_addr: bus(8), ram_data: bus(8), ram_we: bit },
    nodes: {
      zero: Constant({ value: 0 }),
      one: Constant({ value: 1 }),
      phase0Addr: Mux(),
      addrMux0: Mux(),
      addrMux1: Mux(),
      ramAddr: Mux(),
      dataMux0: Mux(),
      dataMux1: Mux(),
      ramData: Mux(),
      writePhase0: And,
      writePhase1: And,
      writePhase2: And,
      writePhase3: And,
      writePhase01: Or,
      writePhase2or3: Or,
      writeAny: Or,
      writeEnable: Constant({ value: 1 }),
      finalWriteEnable: And,
    },
    connect: ({
      inputs,
      outputs,
      nodes: {
        zero,
        one,
        phase0Addr,
        addrMux0,
        addrMux1,
        ramAddr,
        dataMux0,
        dataMux1,
        ramData,
        writePhase0,
        writePhase1,
        writePhase2,
        writePhase3,
        writePhase01,
        writePhase2or3,
        writeAny,
        writeEnable,
        finalWriteEnable,
      },
    }) => [
      inputs.tail_body_addr.to(phase0Addr.in0),
      inputs.food_addr.to(phase0Addr.in1),
      inputs.drawing.to(phase0Addr.sel, ramData.sel, writePhase0.b),
      phase0Addr.out.to(addrMux0.in0),
      inputs.tail_addr.to(addrMux0.in1),
      inputs.p1.to(addrMux0.sel, writePhase1.a),
      addrMux0.out.to(addrMux1.in0),
      inputs.head_body_addr.to(addrMux1.in1),
      inputs.p2.to(addrMux1.sel, dataMux0.sel, writePhase2.a),
      addrMux1.out.to(ramAddr.in0),
      inputs.nh_addr.to(ramAddr.in1, dataMux0.in1),
      inputs.p3.to(ramAddr.sel, dataMux1.sel, writePhase3.a),
      ramAddr.out.to(outputs.ram_addr),
      zero.out.to(dataMux0.in0),
      dataMux0.out.to(dataMux1.in0),
      one.out.to(dataMux1.in1, ramData.in1),
      dataMux1.out.to(ramData.in0),
      ramData.out.to(outputs.ram_data),
      inputs.p0.to(writePhase0.a),
      inputs.clear_tail.to(writePhase1.b),
      inputs.moving.to(writePhase2.b, writePhase3.b),
      writePhase0.out.to(writePhase01.a),
      writePhase1.out.to(writePhase01.b),
      writePhase2.out.to(writePhase2or3.a),
      writePhase3.out.to(writePhase2or3.b),
      writePhase01.out.to(writeAny.a),
      writePhase2or3.out.to(writeAny.b),
      writeEnable.out.to(finalWriteEnable.a),
      writeAny.out.to(finalWriteEnable.b),
      finalWriteEnable.out.to(outputs.ram_we),
    ],
  });

  /**
   * The complete game logic with the memory external — same shape as the
   * RV32I core. Wire ram_addr/ram_data/ram_we/ram_out to a DualPortRAM's
   * port A and scan the framebuffer through port B.
   */
  const SnakeCore = circuit('SnakeCore', {
    inputs: { dir: bus(2), ram_out: bus(8) },
    outputs: { ram_addr: bus(8), ram_data: bus(8), ram_we: bit },
    nodes: {
      phaser: PhaseSequencer,
      dirs: DirectionUnit,
      head: HeadUnit,
      food: FoodUnit,
      tail: TailUnit,
      writer: WriteArbiter,
    },
    connect: ({ inputs, outputs, nodes: { phaser, dirs, head, food, tail, writer } }) => [
      inputs.dir.to(dirs.dir),
      inputs.ram_out.to(tail.ram_out),
      phaser.p0.to(dirs.p0, food.p0, tail.p0, writer.p0),
      phaser.p1.to(head.p1, writer.p1),
      phaser.p2.to(writer.p2),
      phaser.p3.to(head.p3, food.p3, tail.p3, writer.p3),
      dirs.dx.to(head.dx),
      dirs.dy.to(head.dy),
      dirs.moving.to(head.moving, tail.moving, writer.moving),
      head.nhx.to(food.nhx),
      head.nhy.to(food.nhy),
      head.nh_addr.to(writer.nh_addr),
      head.commit.to(tail.commit),
      food.not_eating.to(tail.not_eating),
      food.not_drawing.to(tail.not_drawing),
      food.drawing.to(writer.drawing),
      food.food_addr.to(writer.food_addr),
      tail.clear_tail.to(writer.clear_tail),
      tail.head_body_addr.to(writer.head_body_addr),
      tail.tail_body_addr.to(writer.tail_body_addr),
      tail.tail_addr.to(writer.tail_addr),
      writer.ram_addr.to(outputs.ram_addr),
      writer.ram_data.to(outputs.ram_data),
      writer.ram_we.to(outputs.ram_we),
    ],
  });

  /**
   * FPGA top: the core plus its memory. RAM init: framebuffer pixels 33–36
   * are the starting snake (row y=4, x=1..4); body buffer entries 64–67
   * hold those pixel addresses (tail at index 0, head at 3).
   */
  const Snake = circuit('Snake', {
    inputs: { dir: bus(2), scan_addr: bus(6) },
    outputs: { pixel_out: bus(8) },
    nodes: {
      core: SnakeCore,
      ram: DualPortRAM({
        memory: { '33': 1, '34': 1, '35': 1, '36': 1, '64': 33, '65': 34, '66': 35, '67': 36 },
      }),
    },
    connect: ({ inputs, outputs, nodes: { core, ram } }) => [
      inputs.dir.to(core.dir),
      inputs.scan_addr.to(ram.addrB),
      ram.outB.to(outputs.pixel_out),
      ram.outA.to(core.ram_out),
      core.ram_addr.to(ram.addrA),
      core.ram_data.to(ram.dataA),
      core.ram_we.to(ram.weA),
    ],
  });

  const lib: CircuitLibrary = {
    resolveCircuit: (name) => {
      if (name === 'Snake') return Snake.circuit;
      return Snake._dependencies.get(name)?.circuit;
    },
    getAllPrimitiveNames: () => [...Snake._dependencies.keys()],
  };

  return { circuit: Snake.circuit, lib, built: Snake, core: SnakeCore };
}

/**
 * Shared built instance for read-only consumers (simulation, embedding).
 * Anything that mutates the circuit IR (fault injection, layout experiments)
 * must call buildSnake() for a private copy instead.
 */
export const Snake = /* @__PURE__ */ buildSnake().built;
