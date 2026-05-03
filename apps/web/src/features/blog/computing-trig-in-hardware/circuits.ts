/**
 * Circuit definitions for the "Computing Trig in Hardware" blog post.
 *
 * Each circuit builds toward the full CORDIC algorithm, from bit shifting
 * and rotation math to sign detection, iteration control, angle lookup,
 * and the complete iterative rotation engine.
 */

import { circuit, bit } from "@simten/core/circuit";
import type { BlogCircuit } from '../types';
import {
  Input,
  HexDisplay,
  Constant,
  Led,
  RightShifter,
  SignedAdder,
  BusNot,
  SignedComparator,
  Mux,
  Register,
  Incrementer,
  Comparator,
  BitSlice,
} from "@simten/core/std";

// ── Self-contained circuit definitions ──

export const RightShiftDemo = circuit("RightShiftDemo", {
  nodes: {
    value: Input,
    shift: Input,
    shifter: RightShifter,
    result: HexDisplay,
  },
  nodeArgs: { value: { value: 80 }, shift: { value: 1 } },
  connect: ({ nodes: { value, shift, shifter, result } }) => [
    value.out.to(shifter.value),
    shift.out.to(shifter.shift),
    shifter.result.to(result.in),
  ],
});

export const RotationStep = circuit("RotationStep", {
  nodes: {
    x: Input,
    y: Input,
    shift: Input,
    one: Constant,
    zero: Constant,
    yShifted: RightShifter,
    yNeg: BusNot,
    xMinusY: SignedAdder,
    xPlusY: SignedAdder,
    displaySub: HexDisplay,
    displayAdd: HexDisplay,
  },
  nodeArgs: {
    x: { value: 80 },
    y: { value: 0 },
    shift: { value: 0 },
    one: { value: 1 },
    zero: { value: 0 },
  },
  connect: ({ nodes: { x, y, shift, one, zero, yShifted, yNeg, xMinusY, xPlusY, displaySub, displayAdd } }) => [
    y.out.to(yShifted.value),
    shift.out.to(yShifted.shift),
    yShifted.result.to(yNeg.in, xPlusY.b),
    x.out.to(xMinusY.a, xPlusY.a),
    yNeg.out.to(xMinusY.b),
    one.out.to(xMinusY.carry_in),
    zero.out.to(xPlusY.carry_in),
    xMinusY.sum.to(displaySub.in),
    xPlusY.sum.to(displayAdd.in),
  ],
});

export const SignDetection = circuit("SignDetection", {
  nodes: {
    angle: Input,
    zero: Constant,
    cmp: SignedComparator,
    positiveLed: Led,
    addVal: Constant,
    subVal: Constant,
    result: Mux,
    display: HexDisplay,
  },
  nodeArgs: {
    angle: { value: 32 },
    zero: { value: 0 },
    addVal: { value: 10 },
    subVal: { value: 246 },
  },
  connect: ({ nodes: { angle, zero, cmp, positiveLed, addVal, subVal, result, display } }) => [
    angle.out.to(cmp.a),
    zero.out.to(cmp.b),
    cmp.gte.to(positiveLed.in, result.sel),
    subVal.out.to(result.in0),
    addVal.out.to(result.in1),
    result.out.to(display.in),
  ],
});

export const IterationControl = circuit("IterationControl", {
  nodes: {
    iter: Register,
    eight: Constant,
    inc: Incrementer,
    shouldContinue: Comparator,
    display: HexDisplay,
    doneLed: Led,
  },
  nodeArgs: { iter: { initial: 0 }, eight: { value: 8 } },
  connect: ({ nodes: { iter, eight, inc, shouldContinue, display, doneLed } }) => [
    iter.q.to(inc.in, shouldContinue.a, display.in),
    eight.out.to(shouldContinue.b),
    shouldContinue.lt.to(iter.we),
    inc.out.to(iter.data),
    shouldContinue.eq.to(doneLed.in),
  ],
});

export const AngleLookup = circuit("AngleLookup", {
  nodes: {
    iteration: Input,
    angle0: Constant,
    angle1: Constant,
    angle2: Constant,
    angle3: Constant,
    angle4: Constant,
    angle5: Constant,
    angle6: Constant,
    angle7: Constant,
    bit0: BitSlice,
    bit1: BitSlice,
    bit2: BitSlice,
    mux01: Mux,
    mux23: Mux,
    mux45: Mux,
    mux67: Mux,
    mux0123: Mux,
    mux4567: Mux,
    angleSel: Mux,
    display: HexDisplay,
  },
  nodeArgs: {
    iteration: { value: 0 },
    angle0: { value: 32 },
    angle1: { value: 19 },
    angle2: { value: 10 },
    angle3: { value: 5 },
    angle4: { value: 3 },
    angle5: { value: 1 },
    angle6: { value: 1 },
    angle7: { value: 0 },
    bit0: { low: 0, high: 0 },
    bit1: { low: 1, high: 1 },
    bit2: { low: 2, high: 2 },
  },
  connect: ({ nodes: { iteration, angle0, angle1, angle2, angle3, angle4, angle5, angle6, angle7, bit0, bit1, bit2, mux01, mux23, mux45, mux67, mux0123, mux4567, angleSel, display } }) => [
    iteration.out.to(bit0.in, bit1.in, bit2.in),
    bit0.out.to(mux01.sel, mux23.sel, mux45.sel, mux67.sel),
    angle0.out.to(mux01.in0),
    angle1.out.to(mux01.in1),
    angle2.out.to(mux23.in0),
    angle3.out.to(mux23.in1),
    angle4.out.to(mux45.in0),
    angle5.out.to(mux45.in1),
    angle6.out.to(mux67.in0),
    angle7.out.to(mux67.in1),
    bit1.out.to(mux0123.sel, mux4567.sel),
    mux01.out.to(mux0123.in0),
    mux23.out.to(mux0123.in1),
    mux45.out.to(mux4567.in0),
    mux67.out.to(mux4567.in1),
    bit2.out.to(angleSel.sel),
    mux0123.out.to(angleSel.in0),
    mux4567.out.to(angleSel.in1),
    angleSel.out.to(display.in),
  ],
});

export const CORDIC_CIRCUITS: Record<string, BlogCircuit> = {
  rightShiftDemo: {
    name: "Right Shift = Divide by Power of 2",
    description:
      "A RightShifter divides its input by 2^shift. This is the only 'multiplication' CORDIC needs.",
    circuit: RightShiftDemo,
  },

  rotationStep: {
    name: "One Rotation Step",
    description:
      "The core CORDIC operation: x_next = x - (y >> i). A right-shifted value is subtracted using two's complement.",
    circuit: RotationStep,
  },

  signDetection: {
    name: "Rotation Direction",
    description:
      "CORDIC decides which way to rotate by checking the sign of the remaining angle z. If z >= 0, rotate counterclockwise; if z < 0, rotate clockwise.",
    circuit: SignDetection,
  },

  iterationControl: {
    name: "Iteration Counter",
    description:
      "CORDIC runs for a fixed number of iterations (8 in our case). A register counts up and a comparator stops when done.",
    circuit: IterationControl,
  },

  angleLookup: {
    name: "Angle Lookup Table",
    description:
      "CORDIC uses a pre-computed table of atan(2^-i) values. A cascaded mux tree selects the right angle for each iteration.",
    circuit: AngleLookup,
  },
};

/**
 * Full CORDIC circuit — computes sin/cos by rotating a vector using only shifts and adds.
 * Starts at (80, 0) pointing right and rotates 45 degrees.
 * Expected result: x ~ y ~ 93 after 8 iterations.
 */
export const CORDICCircuit = circuit("CORDICIteration", {
  // `done` is asserted when the iteration counter reaches the final value.
  // Formal output port (replaces a hook-side substring scan over portValues
  // looking for a node named "doneLed"); the visual doneLed node stays for
  // on-canvas rendering.
  outputs: { done: bit },
  nodes: {
    x: Register,
    y: Register,
    z: Register,
    iteration: Register,
    zero: Constant,
    one: Constant,
    eight: Constant,
    zPositive: SignedComparator,
    xShifted: RightShifter,
    yShifted: RightShifter,
    yShiftedNeg: BusNot,
    xSubtract: SignedAdder,
    xAdd: SignedAdder,
    xUpdate: Mux,
    xShiftedNeg: BusNot,
    yAdd: SignedAdder,
    ySubtract: SignedAdder,
    yUpdate: Mux,
    angle0: Constant,
    angle1: Constant,
    angle2: Constant,
    angle3: Constant,
    angle4: Constant,
    angle5: Constant,
    angle6: Constant,
    angle7: Constant,
    bit0: BitSlice,
    bit1: BitSlice,
    bit2: BitSlice,
    mux01: Mux,
    mux23: Mux,
    mux45: Mux,
    mux67: Mux,
    mux0123: Mux,
    mux4567: Mux,
    angleSel: Mux,
    angleNeg: BusNot,
    zSubtract: SignedAdder,
    zAdd: SignedAdder,
    zUpdate: Mux,
    iterInc: Incrementer,
    shouldContinue: Comparator,
    xDisplay: HexDisplay,
    yDisplay: HexDisplay,
    zDisplay: HexDisplay,
    iterDisplay: HexDisplay,
    doneCheck: Comparator,
    doneLed: Led,
  },
  nodeArgs: {
    x: { initial: 80 },
    y: { initial: 0 },
    z: { initial: 32 },
    iteration: { initial: 0 },
    zero: { value: 0 },
    one: { value: 1 },
    eight: { value: 8 },
    angle0: { value: 32 },
    angle1: { value: 19 },
    angle2: { value: 10 },
    angle3: { value: 5 },
    angle4: { value: 3 },
    angle5: { value: 1 },
    angle6: { value: 1 },
    angle7: { value: 0 },
    bit0: { low: 0, high: 0 },
    bit1: { low: 1, high: 1 },
    bit2: { low: 2, high: 2 },
  },
  connect: ({ outputs, nodes: { x, y, z, iteration, zero, one, eight, zPositive, xShifted, yShifted, yShiftedNeg, xSubtract, xAdd, xUpdate, xShiftedNeg, yAdd, ySubtract, yUpdate, angle0, angle1, angle2, angle3, angle4, angle5, angle6, angle7, bit0, bit1, bit2, mux01, mux23, mux45, mux67, mux0123, mux4567, angleSel, angleNeg, zSubtract, zAdd, zUpdate, iterInc, shouldContinue, xDisplay, yDisplay, zDisplay, iterDisplay, doneCheck, doneLed } }) => [
    z.q.to(zPositive.a, zSubtract.a, zAdd.a, zDisplay.in),
    zero.out.to(zPositive.b, xAdd.carry_in, yAdd.carry_in, zAdd.carry_in),
    x.q.to(xShifted.value, xSubtract.a, xAdd.a, xDisplay.in),
    y.q.to(yShifted.value, yAdd.a, ySubtract.a, yDisplay.in),
    iteration.q.to(
      xShifted.shift,
      yShifted.shift,
      bit0.in,
      bit1.in,
      bit2.in,
      iterInc.in,
      shouldContinue.a,
      iterDisplay.in,
      doneCheck.a,
    ),
    yShifted.result.to(yShiftedNeg.in, xAdd.b),
    yShiftedNeg.out.to(xSubtract.b),
    one.out.to(xSubtract.carry_in, ySubtract.carry_in, zSubtract.carry_in),
    zPositive.gte.to(xUpdate.sel, yUpdate.sel, zUpdate.sel),
    xAdd.sum.to(xUpdate.in0),
    xSubtract.sum.to(xUpdate.in1),
    xShifted.result.to(xShiftedNeg.in, yAdd.b),
    xShiftedNeg.out.to(ySubtract.b),
    ySubtract.sum.to(yUpdate.in0),
    yAdd.sum.to(yUpdate.in1),
    bit0.out.to(mux01.sel, mux23.sel, mux45.sel, mux67.sel),
    angle0.out.to(mux01.in0),
    angle1.out.to(mux01.in1),
    angle2.out.to(mux23.in0),
    angle3.out.to(mux23.in1),
    angle4.out.to(mux45.in0),
    angle5.out.to(mux45.in1),
    angle6.out.to(mux67.in0),
    angle7.out.to(mux67.in1),
    bit1.out.to(mux0123.sel, mux4567.sel),
    mux01.out.to(mux0123.in0),
    mux23.out.to(mux0123.in1),
    mux45.out.to(mux4567.in0),
    mux67.out.to(mux4567.in1),
    bit2.out.to(angleSel.sel),
    mux0123.out.to(angleSel.in0),
    mux4567.out.to(angleSel.in1),
    angleSel.out.to(angleNeg.in, zAdd.b),
    angleNeg.out.to(zSubtract.b),
    zAdd.sum.to(zUpdate.in0),
    zSubtract.sum.to(zUpdate.in1),
    eight.out.to(shouldContinue.b, doneCheck.b),
    shouldContinue.lt.to(x.we, y.we, z.we, iteration.we),
    xUpdate.out.to(x.data),
    yUpdate.out.to(y.data),
    zUpdate.out.to(z.data),
    iterInc.out.to(iteration.data),
    doneCheck.eq.to(doneLed.in, outputs.done),
  ],
});
