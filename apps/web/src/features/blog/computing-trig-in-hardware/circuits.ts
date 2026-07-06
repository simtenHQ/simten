/**
 * Circuit definitions for the "Computing Trig in Hardware" blog post.
 *
 * Each circuit builds toward the full CORDIC algorithm, from bit shifting
 * and rotation math to sign detection, iteration control, angle lookup,
 * and the complete iterative rotation engine.
 */

import { bit, bus, circuit } from '@simten/core/circuit';
import {
  BitSlice,
  BusNot,
  Comparator,
  Constant,
  HexDisplay,
  Incrementer,
  Input,
  Led,
  Mux,
  Register,
  RightShifter,
  SignedAdder,
  SignedComparator,
} from '@simten/core/std';
import type { BlogCircuit } from '../types';

// ── Self-contained circuit definitions ──

export const RightShiftDemo = circuit('RightShiftDemo', {
  nodes: {
    value: Input({ value: 80 }),
    shift: Input({ value: 1 }),
    shifter: RightShifter(),
    result: HexDisplay,
  },
  connect: ({ nodes: { value, shift, shifter, result } }) => [
    value.out.to(shifter.value),
    shift.out.to(shifter.shift),
    shifter.result.to(result.in),
  ],
});

export const RotationStep = circuit('RotationStep', {
  nodes: {
    x: Input({ value: 80 }),
    y: Input({ value: 0 }),
    shift: Input({ value: 0 }),
    one: Constant({ value: 1 }),
    zero: Constant({ value: 0 }),
    yShifted: RightShifter(),
    yNeg: BusNot,
    xMinusY: SignedAdder,
    xPlusY: SignedAdder,
    displaySub: HexDisplay,
    displayAdd: HexDisplay,
  },
  connect: ({
    nodes: { x, y, shift, one, zero, yShifted, yNeg, xMinusY, xPlusY, displaySub, displayAdd },
  }) => [
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

export const SignDetection = circuit('SignDetection', {
  nodes: {
    angle: Input({ value: 32 }),
    zero: Constant({ value: 0 }),
    cmp: SignedComparator,
    positiveLed: Led,
    addVal: Constant({ value: 10 }),
    subVal: Constant({ value: 246 }),
    result: Mux(),
    display: HexDisplay,
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

export const IterationControl = circuit('IterationControl', {
  nodes: {
    iter: Register({ value: 0 }),
    eight: Constant({ value: 8 }),
    inc: Incrementer,
    shouldContinue: Comparator(),
    display: HexDisplay,
    doneLed: Led,
  },
  connect: ({ nodes: { iter, eight, inc, shouldContinue, display, doneLed } }) => [
    iter.q.to(inc.in, shouldContinue.a, display.in),
    eight.out.to(shouldContinue.b),
    shouldContinue.lt.to(iter.we),
    inc.out.to(iter.data),
    shouldContinue.eq.to(doneLed.in),
  ],
});

export const AngleLookup = circuit('AngleLookup', {
  nodes: {
    iteration: Input({ value: 0 }),
    angle0: Constant({ value: 32 }),
    angle1: Constant({ value: 19 }),
    angle2: Constant({ value: 10 }),
    angle3: Constant({ value: 5 }),
    angle4: Constant({ value: 3 }),
    angle5: Constant({ value: 1 }),
    angle6: Constant({ value: 1 }),
    angle7: Constant({ value: 0 }),
    bit0: BitSlice({ low: 0, high: 0 }),
    bit1: BitSlice({ low: 1, high: 1 }),
    bit2: BitSlice({ low: 2, high: 2 }),
    mux01: Mux(),
    mux23: Mux(),
    mux45: Mux(),
    mux67: Mux(),
    mux0123: Mux(),
    mux4567: Mux(),
    angleSel: Mux(),
    display: HexDisplay,
  },
  connect: ({
    nodes: {
      iteration,
      angle0,
      angle1,
      angle2,
      angle3,
      angle4,
      angle5,
      angle6,
      angle7,
      bit0,
      bit1,
      bit2,
      mux01,
      mux23,
      mux45,
      mux67,
      mux0123,
      mux4567,
      angleSel,
      display,
    },
  }) => [
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
    name: 'Right Shift = Divide by Power of 2',
    description:
      "A RightShifter divides its input by 2^shift. This is the only 'multiplication' CORDIC needs.",
    circuit: RightShiftDemo,
  },

  rotationStep: {
    name: 'One Rotation Step',
    description:
      "The core CORDIC operation: x_next = x - (y >> i). A right-shifted value is subtracted using two's complement.",
    circuit: RotationStep,
  },

  signDetection: {
    name: 'Rotation Direction',
    description:
      'CORDIC decides which way to rotate by checking the sign of the remaining angle z. If z >= 0, rotate counterclockwise; if z < 0, rotate clockwise.',
    circuit: SignDetection,
  },

  iterationControl: {
    name: 'Iteration Counter',
    description:
      'CORDIC runs for a fixed number of iterations (8 in our case). A register counts up and a comparator stops when done.',
    circuit: IterationControl,
  },

  angleLookup: {
    name: 'Angle Lookup Table',
    description:
      'CORDIC uses a pre-computed table of atan(2^-i) values. A cascaded mux tree selects the right angle for each iteration.',
    circuit: AngleLookup,
  },
};

/**
 * Inner CORDIC iteration logic — pure combinational.
 *
 * Takes the current (x, y, z, iter) and produces the next-cycle values plus
 * a write_enable signal (active while iter < 8) and a done flag (iter == 8).
 *
 * Encapsulating this as its own composite means the outer CORDICCircuit
 * shows just the four state registers + this single block on canvas, with
 * a drilldown badge to inspect the full iteration math.
 */
const CORDICStep = circuit('CORDICStep', {
  inputs: { x_in: bus(8), y_in: bus(8), z_in: bus(8), iter_in: bus(8) },
  outputs: {
    x_next: bus(8),
    y_next: bus(8),
    z_next: bus(8),
    iter_next: bus(8),
    write_enable: bit,
    done: bit,
  },
  nodes: {
    zero: Constant({ value: 0 }),
    one: Constant({ value: 1 }),
    eight: Constant({ value: 8 }),
    zPositive: SignedComparator,
    xShifted: RightShifter(),
    yShifted: RightShifter(),
    yShiftedNeg: BusNot,
    xSubtract: SignedAdder,
    xAdd: SignedAdder,
    xUpdate: Mux(),
    xShiftedNeg: BusNot,
    yAdd: SignedAdder,
    ySubtract: SignedAdder,
    yUpdate: Mux(),
    angle0: Constant({ value: 32 }),
    angle1: Constant({ value: 19 }),
    angle2: Constant({ value: 10 }),
    angle3: Constant({ value: 5 }),
    angle4: Constant({ value: 3 }),
    angle5: Constant({ value: 1 }),
    angle6: Constant({ value: 1 }),
    angle7: Constant({ value: 0 }),
    bit0: BitSlice({ low: 0, high: 0 }),
    bit1: BitSlice({ low: 1, high: 1 }),
    bit2: BitSlice({ low: 2, high: 2 }),
    mux01: Mux(),
    mux23: Mux(),
    mux45: Mux(),
    mux67: Mux(),
    mux0123: Mux(),
    mux4567: Mux(),
    angleSel: Mux(),
    angleNeg: BusNot,
    zSubtract: SignedAdder,
    zAdd: SignedAdder,
    zUpdate: Mux(),
    iterInc: Incrementer,
    shouldContinue: Comparator(),
    doneCheck: Comparator(),
  },
  connect: ({
    inputs,
    outputs,
    nodes: {
      zero,
      one,
      eight,
      zPositive,
      xShifted,
      yShifted,
      yShiftedNeg,
      xSubtract,
      xAdd,
      xUpdate,
      xShiftedNeg,
      yAdd,
      ySubtract,
      yUpdate,
      angle0,
      angle1,
      angle2,
      angle3,
      angle4,
      angle5,
      angle6,
      angle7,
      bit0,
      bit1,
      bit2,
      mux01,
      mux23,
      mux45,
      mux67,
      mux0123,
      mux4567,
      angleSel,
      angleNeg,
      zSubtract,
      zAdd,
      zUpdate,
      iterInc,
      shouldContinue,
      doneCheck,
    },
  }) => [
    inputs.z_in.to(zPositive.a, zSubtract.a, zAdd.a),
    zero.out.to(zPositive.b, xAdd.carry_in, yAdd.carry_in, zAdd.carry_in),
    inputs.x_in.to(xShifted.value, xSubtract.a, xAdd.a),
    inputs.y_in.to(yShifted.value, yAdd.a, ySubtract.a),
    inputs.iter_in.to(
      xShifted.shift,
      yShifted.shift,
      bit0.in,
      bit1.in,
      bit2.in,
      iterInc.in,
      shouldContinue.a,
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
    xUpdate.out.to(outputs.x_next),
    yUpdate.out.to(outputs.y_next),
    zUpdate.out.to(outputs.z_next),
    iterInc.out.to(outputs.iter_next),
    shouldContinue.lt.to(outputs.write_enable),
    doneCheck.eq.to(outputs.done),
  ],
});

/**
 * Full CORDIC circuit — computes sin/cos by rotating a vector using only shifts and adds.
 * Starts at (80, 0) pointing right and rotates 45 degrees.
 * Expected result: x ~ y ~ 93 after 8 iterations.
 *
 * The four state registers feed a CORDICStep block that produces their
 * next-cycle values. Double-click `step` on the canvas to inspect the
 * full iteration math (shifters, signed adders, angle ROM, mux tree).
 */
export const CORDICCircuit = circuit('CORDICIteration', {
  outputs: { done: bit },
  nodes: {
    x: Register({ value: 80 }),
    y: Register({ value: 0 }),
    z: Register({ value: 32 }),
    iteration: Register({ value: 0 }),
    step: CORDICStep,
    xDisplay: HexDisplay,
    yDisplay: HexDisplay,
    zDisplay: HexDisplay,
    iterDisplay: HexDisplay,
    doneLed: Led,
  },
  connect: ({
    outputs,
    nodes: { x, y, z, iteration, step, xDisplay, yDisplay, zDisplay, iterDisplay, doneLed },
  }) => [
    x.q.to(step.x_in, xDisplay.in),
    y.q.to(step.y_in, yDisplay.in),
    z.q.to(step.z_in, zDisplay.in),
    iteration.q.to(step.iter_in, iterDisplay.in),
    step.x_next.to(x.data),
    step.y_next.to(y.data),
    step.z_next.to(z.data),
    step.iter_next.to(iteration.data),
    step.write_enable.to(x.we, y.we, z.we, iteration.we),
    step.done.to(doneLed.in, outputs.done),
  ],
});
