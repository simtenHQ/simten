/**
 * SnakeAdvanced end-to-end bitstream test.
 *
 * SnakeAdvanced → exportVerilog (synth_ecp5) → /synth → netlist JSON
 *               → /build (nextpnr-ecp5 + ecppack) → base64 bitstream
 *
 * SnakeAdvanced is a complete 8×8 Snake game implemented entirely in logic
 * gates. It has a 4-phase pipeline, circular buffer body storage, DualPortRAM
 * framebuffer, and a VGA-style scan interface:
 *   in:  dir[2]       — 2-bit direction (0=up 1=right 2=down 3=left)
 *        scan_addr[6] — framebuffer scan address (driven by VGA counters)
 *   out: pixel_out[8] — framebuffer pixel value at scan_addr
 *
 * No simulation-only primitives (Screen, Input, Switch) remain — every node
 * maps directly to ECP5 logic, flip-flops, and block RAM.
 *
 * Requires SYNTH_URL to be set. Skipped automatically when unset.
 */

import { describe, it, expect } from 'vitest';
import { exportVerilog } from '../exporter.js';
import { circuit, bus } from '../../circuit/index.js';
import {
  DualPortRAM,
  Register,
  Constant,
  Comparator,
  Mux,
  Adder,
  BitSlice,
  LeftShifter,
  And,
  Or,
  Not,
} from '../../std/index.js';
import type { CircuitLibrary } from '../../types/circuit.js';
import { synthesizeVerilog, hasSynth } from './synth.js';
import { buildBitstream, hasBuild } from './build.js';

function buildSnakeAdvanced() {
  const SnakeAdvanced = circuit('SnakeAdvanced', {
    in: { dir: bus(2), scan_addr: bus(6) },
    out: { pixel_out: bus(8) },
    nodes: {
      ram: DualPortRAM,
      foodX: Register, foodY: Register, foodNeedsDrawing: Register,
      headPtr: Register, tailPtr: Register, snakeLen: Register,
      headX: Register, headY: Register,
      tailPixelAddr: Register, nextHeadPixelAddr: Register,
      phase: Register, keyboardLatched: Register,
      zero: Constant, one: Constant, two: Constant, three: Constant,
      bodyBase: Constant, minus1: Constant, five: Constant,
      phaseInc: Adder, phaseWrap: BitSlice,
      phaseEnable: Constant,
      isPhase0: Comparator, isPhase1: Comparator, isPhase2: Comparator, isPhase3: Comparator,
      latchKeyboard: And,
      isUp: Comparator, isDown: Comparator, isLeft: Comparator, isRight: Comparator,
      deltaXTemp: Mux, deltaX: Mux, deltaYTemp: Mux, deltaY: Mux,
      nextHeadXCalc: Adder, nextHeadYCalc: Adder,
      nextHeadX: BitSlice, nextHeadY: BitSlice,
      nextHeadY2: Adder, nextHeadY4: Adder, nextHeadY8: Adder,
      nextPixelAddr: Adder,
      foodY2: Adder, foodY4: Adder, foodY8: Adder, foodPixelAddr: Adder,
      nextHeadAtFoodX: Comparator, nextHeadAtFoodY: Comparator,
      willEatFood: And, latchNextHead: And,
      headPtrNext: Adder, headPtrNextWrap: BitSlice,
      headBodyAddr: Adder, tailBodyAddr: Adder,
      phase0Addr: Mux, addrMux0: Mux, addrMux1: Mux, ramAddr: Mux,
      dataMux0: Mux, dataMux1: Mux, ramData: Mux,
      bufferEmpty: Comparator, bufferNotEmpty: Not,
      deltaXIsZero: Comparator, deltaYIsZero: Comparator,
      bothDeltasZero: And, isMoving: Not,
      shouldMoveTail: Constant, shouldMoveTailActual: And,
      notEatingFood: Not, shouldClearTail: And, shouldClearTailMoving: And,
      writePhase0: And, writePhase1: And, writePhase2: And, writePhase3: And,
      writePhase01: Or, writePhase2or3: Or, writeAny: Or,
      writeEnable: Constant, finalWriteEnable: And,
      latchTail: And, latchTailFinal: And, latchTailNotFood: And,
      notDrawingFood: Not,
      clearFoodFlag: And, clearFoodFlagFinal: And,
      ateFood: And, ateFoodFinal: And,
      foodFlagWriteEnable: Or, foodFlagData: Mux,
      foodXNext: Adder, foodXWrap: BitSlice,
      foodYNext: Adder, foodYWrap: BitSlice,
      updateHead: And, updateHeadFinal: And,
      headPtrInc: Adder, headPtrWrap: BitSlice,
      tailPtrInc: Adder, tailPtrWrap: BitSlice,
      updateTail: And, updateTailFinal: And,
      snakeLenDelta: Mux, snakeLenNew: Adder,
    },
    nodeArgs: {
      ram: { init: { '33': 1, '34': 1, '35': 1, '36': 1, '64': 33, '65': 34, '66': 35, '67': 36 } },
      foodX: { initial: 6 }, foodY: { initial: 3 }, foodNeedsDrawing: { initial: 1 },
      headPtr: { initial: 3 }, tailPtr: { initial: 0 }, snakeLen: { initial: 4 },
      headX: { initial: 4 }, headY: { initial: 4 },
      tailPixelAddr: { initial: 33 }, nextHeadPixelAddr: { initial: 36 },
      phase: { initial: 0 }, keyboardLatched: { initial: 1 },
      zero: { value: 0 }, one: { value: 1 }, two: { value: 2 }, three: { value: 3 },
      bodyBase: { value: 64 }, minus1: { value: 255 }, five: { value: 5 },
      phaseWrap: { low: 0, high: 1 },
      phaseEnable: { value: 1 }, shouldMoveTail: { value: 1 }, writeEnable: { value: 1 },
      nextHeadX: { low: 0, high: 2 }, nextHeadY: { low: 0, high: 2 },
      headPtrNextWrap: { low: 0, high: 5 },
      foodXWrap: { low: 0, high: 2 }, foodYWrap: { low: 0, high: 2 },
      headPtrWrap: { low: 0, high: 5 }, tailPtrWrap: { low: 0, high: 5 },
    },
    connect: ({
      in: inp, out, ram,
      foodX, foodY, foodNeedsDrawing, headPtr, tailPtr, snakeLen, headX, headY,
      tailPixelAddr, nextHeadPixelAddr, phase, keyboardLatched,
      zero, one, two, three, bodyBase, minus1, five,
      phaseInc, phaseWrap, phaseEnable,
      isPhase0, isPhase1, isPhase2, isPhase3, latchKeyboard,
      isUp, isDown, isLeft, isRight,
      deltaXTemp, deltaX, deltaYTemp, deltaY,
      nextHeadXCalc, nextHeadYCalc, nextHeadX, nextHeadY,
      nextHeadY2, nextHeadY4, nextHeadY8, nextPixelAddr,
      foodY2, foodY4, foodY8, foodPixelAddr,
      nextHeadAtFoodX, nextHeadAtFoodY, willEatFood, latchNextHead,
      headPtrNext, headPtrNextWrap, headBodyAddr, tailBodyAddr,
      phase0Addr, addrMux0, addrMux1, ramAddr, dataMux0, dataMux1, ramData,
      bufferEmpty, bufferNotEmpty, deltaXIsZero, deltaYIsZero, bothDeltasZero, isMoving,
      shouldMoveTail, shouldMoveTailActual, notEatingFood, shouldClearTail, shouldClearTailMoving,
      writePhase0, writePhase1, writePhase2, writePhase3,
      writePhase01, writePhase2or3, writeAny, writeEnable, finalWriteEnable,
      latchTail, latchTailFinal, latchTailNotFood, notDrawingFood,
      clearFoodFlag, clearFoodFlagFinal, ateFood, ateFoodFinal,
      foodFlagWriteEnable, foodFlagData,
      foodXNext, foodXWrap, foodYNext, foodYWrap,
      updateHead, updateHeadFinal, headPtrInc, headPtrWrap,
      tailPtrInc, tailPtrWrap, updateTail, updateTailFinal,
      snakeLenDelta, snakeLenNew,
    }) => [
      inp.scan_addr.to(ram.addrB),
      ram.outB.to(out.pixel_out),
      phase.q.to(phaseInc.a, isPhase0.a, isPhase1.a, isPhase2.a, isPhase3.a),
      one.out.to(
        phaseInc.b, isPhase1.b, deltaX.in1, deltaY.in1, headPtrNext.b,
        dataMux1.in1, ramData.in1, foodFlagData.in1,
        headPtrInc.b, tailPtrInc.b, snakeLenDelta.in0, isRight.b,
      ),
      phaseInc.sum.to(phaseWrap.in),
      phaseWrap.out.to(phase.data),
      phaseEnable.out.to(
        phase.we, latchKeyboard.a, latchNextHead.a,
        latchTail.a, clearFoodFlag.a, ateFood.a, updateHead.a, updateTail.a,
      ),
      zero.out.to(
        isPhase0.b, deltaXTemp.in0, deltaYTemp.in0, dataMux0.in0,
        bufferEmpty.b, deltaXIsZero.b, deltaYIsZero.b,
        foodFlagData.in0, snakeLenDelta.in1, isUp.b,
      ),
      two.out.to(isPhase2.b, isDown.b),
      three.out.to(isPhase3.b, foodXNext.b, isLeft.b),
      inp.dir.to(keyboardLatched.data),
      isPhase0.eq.to(latchKeyboard.b, writePhase0.a, latchTail.b, clearFoodFlag.b),
      latchKeyboard.out.to(keyboardLatched.we),
      keyboardLatched.q.to(isUp.a, isDown.a, isLeft.a, isRight.a),
      minus1.out.to(deltaXTemp.in1, deltaYTemp.in1),
      isLeft.eq.to(deltaXTemp.sel),
      deltaXTemp.out.to(deltaX.in0),
      isRight.eq.to(deltaX.sel),
      isUp.eq.to(deltaYTemp.sel),
      deltaYTemp.out.to(deltaY.in0),
      isDown.eq.to(deltaY.sel),
      headX.q.to(nextHeadXCalc.a),
      deltaX.out.to(nextHeadXCalc.b, deltaXIsZero.a),
      headY.q.to(nextHeadYCalc.a),
      deltaY.out.to(nextHeadYCalc.b, deltaYIsZero.a),
      nextHeadXCalc.sum.to(nextHeadX.in),
      nextHeadYCalc.sum.to(nextHeadY.in),
      nextHeadY.out.to(nextHeadY2.a, nextHeadY2.b, nextHeadAtFoodY.a, headY.data),
      nextHeadY2.sum.to(nextHeadY4.a, nextHeadY4.b),
      nextHeadY4.sum.to(nextHeadY8.a, nextHeadY8.b),
      nextHeadY8.sum.to(nextPixelAddr.a),
      nextHeadX.out.to(nextPixelAddr.b, nextHeadAtFoodX.a, headX.data),
      foodY.q.to(foodY2.a, foodY2.b, nextHeadAtFoodY.b, foodYNext.a),
      foodY2.sum.to(foodY4.a, foodY4.b),
      foodY4.sum.to(foodY8.a, foodY8.b),
      foodY8.sum.to(foodPixelAddr.a),
      foodX.q.to(foodPixelAddr.b, nextHeadAtFoodX.b, foodXNext.a),
      nextHeadAtFoodX.eq.to(willEatFood.a),
      nextHeadAtFoodY.eq.to(willEatFood.b),
      nextPixelAddr.sum.to(nextHeadPixelAddr.data),
      isPhase1.eq.to(latchNextHead.b, addrMux0.sel, writePhase1.a),
      latchNextHead.out.to(nextHeadPixelAddr.we),
      headPtr.q.to(headPtrNext.a, headPtrInc.a),
      headPtrNext.sum.to(headPtrNextWrap.in),
      headPtrNextWrap.out.to(headBodyAddr.a),
      bodyBase.out.to(headBodyAddr.b, tailBodyAddr.b),
      tailPtr.q.to(tailBodyAddr.a, tailPtrInc.a),
      tailBodyAddr.sum.to(phase0Addr.in0),
      foodPixelAddr.sum.to(phase0Addr.in1),
      foodNeedsDrawing.q.to(
        phase0Addr.sel, ramData.sel, writePhase0.b,
        notDrawingFood.in, clearFoodFlagFinal.b,
      ),
      phase0Addr.out.to(addrMux0.in0),
      tailPixelAddr.q.to(addrMux0.in1),
      addrMux0.out.to(addrMux1.in0),
      headBodyAddr.sum.to(addrMux1.in1),
      isPhase2.eq.to(addrMux1.sel, dataMux0.sel, writePhase2.a),
      addrMux1.out.to(ramAddr.in0),
      nextHeadPixelAddr.q.to(ramAddr.in1, dataMux0.in1),
      isPhase3.eq.to(
        ramAddr.sel, dataMux1.sel, writePhase3.a,
        ateFood.b, updateHead.b, updateTail.b,
      ),
      ramAddr.out.to(ram.addrA),
      dataMux0.out.to(dataMux1.in0),
      dataMux1.out.to(ramData.in0),
      ramData.out.to(ram.dataA),
      snakeLen.q.to(bufferEmpty.a, snakeLenNew.a),
      bufferEmpty.eq.to(bufferNotEmpty.in),
      deltaXIsZero.eq.to(bothDeltasZero.a),
      deltaYIsZero.eq.to(bothDeltasZero.b),
      bothDeltasZero.out.to(isMoving.in),
      shouldMoveTail.out.to(shouldMoveTailActual.a),
      willEatFood.out.to(notEatingFood.in, ateFoodFinal.b),
      notEatingFood.out.to(shouldMoveTailActual.b),
      shouldMoveTailActual.out.to(shouldClearTail.a),
      isMoving.out.to(shouldClearTail.b, writePhase2.b, writePhase3.b, updateHeadFinal.b),
      shouldClearTail.out.to(shouldClearTailMoving.a),
      bufferNotEmpty.out.to(shouldClearTailMoving.b, latchTailFinal.b),
      shouldClearTailMoving.out.to(writePhase1.b, updateTailFinal.b, snakeLenDelta.sel),
      writePhase0.out.to(writePhase01.a),
      writePhase1.out.to(writePhase01.b),
      writePhase2.out.to(writePhase2or3.a),
      writePhase3.out.to(writePhase2or3.b),
      writePhase01.out.to(writeAny.a),
      writePhase2or3.out.to(writeAny.b),
      writeEnable.out.to(finalWriteEnable.a),
      writeAny.out.to(finalWriteEnable.b),
      finalWriteEnable.out.to(ram.weA),
      ram.outA.to(tailPixelAddr.data),
      latchTail.out.to(latchTailFinal.a),
      latchTailFinal.out.to(latchTailNotFood.a),
      notDrawingFood.out.to(latchTailNotFood.b),
      latchTailNotFood.out.to(tailPixelAddr.we),
      clearFoodFlag.out.to(clearFoodFlagFinal.a),
      ateFood.out.to(ateFoodFinal.a),
      ateFoodFinal.out.to(foodFlagWriteEnable.a, foodFlagData.sel, foodX.we, foodY.we),
      clearFoodFlagFinal.out.to(foodFlagWriteEnable.b),
      foodFlagWriteEnable.out.to(foodNeedsDrawing.we),
      foodFlagData.out.to(foodNeedsDrawing.data),
      foodXNext.sum.to(foodXWrap.in),
      five.out.to(foodYNext.b),
      foodYNext.sum.to(foodYWrap.in),
      foodXWrap.out.to(foodX.data),
      foodYWrap.out.to(foodY.data),
      updateHead.out.to(updateHeadFinal.a),
      updateHeadFinal.out.to(headX.we, headY.we, headPtr.we, snakeLen.we),
      headPtrInc.sum.to(headPtrWrap.in),
      headPtrWrap.out.to(headPtr.data),
      tailPtrInc.sum.to(tailPtrWrap.in),
      tailPtrWrap.out.to(tailPtr.data),
      updateTail.out.to(updateTailFinal.a),
      updateTailFinal.out.to(tailPtr.we),
      snakeLenDelta.out.to(snakeLenNew.b),
      snakeLenNew.sum.to(snakeLen.data),
    ],
  });

  const lib: CircuitLibrary = {
    resolveCircuit: (name) => {
      if (name === 'SnakeAdvanced') return SnakeAdvanced.circuit;
      return SnakeAdvanced._dependencies.get(name)?.circuit;
    },
    getAllPrimitiveNames: () => [...SnakeAdvanced._dependencies.keys()],
  };

  return { circuit: SnakeAdvanced.circuit, lib };
}

const d = describe.skipIf(!hasSynth() || !hasBuild());

d('SnakeAdvanced — full pipeline to ECP5 bitstream', () => {
  it(
    'synth_ecp5 → nextpnr-ecp5 → ecppack → bitstream',
    { timeout: 300_000 }, // nextpnr is slower on a ~100-node circuit
    async () => {
      const { circuit, lib } = buildSnakeAdvanced();
      const exportResult = exportVerilog(circuit, lib, { target: 'synthesis' });

      // Step 1: Synthesise for ECP5 target
      const synthResp = await synthesizeVerilog(exportResult, 'SnakeAdvanced', 'ecp5');
      if (!synthResp.success) {
        console.error('synth failed:', JSON.stringify(
          { error: synthResp.error, log: synthResp.log?.slice(-1000) }, null, 2,
        ));
      }
      expect(synthResp.success).toBe(true);
      expect(synthResp.netlist).toBeTruthy();

      // Step 2: Place-and-route + bitstream
      const buildResp = await buildBitstream(synthResp.netlist!, 'SnakeAdvanced');
      if (!buildResp.success) {
        console.error('build failed:', JSON.stringify(
          { error: buildResp.error, log: buildResp.log?.slice(-1500) }, null, 2,
        ));
      }

      expect(buildResp.success).toBe(true);
      expect(buildResp.bitstream).toBeTruthy();

      // Bitstream should be a real ECP5 85K file (~1.8MB after ecppack)
      const decoded = Buffer.from(buildResp.bitstream!, 'base64');
      expect(decoded.length).toBeGreaterThan(100_000);

      // nextpnr reports ~99 MHz for SnakeAdvanced on ECP5 85K
      expect(buildResp.timing).toBeDefined();
      expect(buildResp.timing!.achieved_mhz).toBeGreaterThan(50);

      // Utilization: ~491 LUTs, ~51 FFs, 0 BRAM (RAM too small to infer block RAM)
      expect(buildResp.utilization).toBeDefined();
      expect(buildResp.utilization!.comb).toBeGreaterThan(100);
      expect(buildResp.utilization!.ff).toBeGreaterThan(10);
    },
  );
});
