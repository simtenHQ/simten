/**
 * Circuit definitions for the "Computing Trig in Hardware" blog post.
 *
 * Each circuit builds toward the full CORDIC algorithm, from bit shifting
 * and rotation math to sign detection, iteration control, angle lookup,
 * and the complete iterative rotation engine.
 */

export interface BlogCircuit {
  name: string;
  description: string;
  displayDsl: string;
  dsl: string;
}

export const CORDIC_CIRCUITS: Record<string, BlogCircuit> = {
  rightShiftDemo: {
    name: "Right Shift = Divide by Power of 2",
    description:
      "A RightShifter divides its input by 2^shift. This is the only 'multiplication' CORDIC needs.",
    displayDsl: `
const RightShiftDemo = component('RightShiftDemo')
  .node('value', Input, { value: 80 })
  .node('shift', Input, { value: 1 })
  .node('shifter', RightShifter)
  .node('result', HexDisplay)
  .connect(({ in: inp, out, value, shift, shifter, result }) => [
    value.out.to(shifter.value),
    shift.out.to(shifter.shift),
    shifter.result.to(result.in),
  ])
  .build()
`,
    dsl: `
const RightShiftDemo = component('RightShiftDemo')
  .node('value', Input, { value: 80 })
  .node('shift', Input, { value: 1 })
  .node('shifter', RightShifter)
  .node('result', HexDisplay)
  .connect(({ in: inp, out, value, shift, shifter, result }) => [
    value.out.to(shifter.value),
    shift.out.to(shifter.shift),
    shifter.result.to(result.in),
  ])
  .build()
`,
  },

  rotationStep: {
    name: "One Rotation Step",
    description:
      "The core CORDIC operation: x_next = x - (y >> i). A right-shifted value is subtracted using two's complement.",
    displayDsl: `
const RotationStep = component('RotationStep')
  .node('x', Input, { value: 80 })
  .node('y', Input, { value: 0 })
  .node('shift', Input, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .node('yShifted', RightShifter)
  .node('yNeg', BusNot)
  .node('xMinusY', SignedAdder)
  .node('xPlusY', SignedAdder)
  .node('displaySub', HexDisplay)
  .node('displayAdd', HexDisplay)
  .connect(({ in: inp, out, x, y, shift, one, zero, yShifted, yNeg, xMinusY, xPlusY, displaySub, displayAdd }) => [
    y.out.to(yShifted.value),
    shift.out.to(yShifted.shift),
    yShifted.result.to(yNeg.in, xPlusY.b),
    x.out.to(xMinusY.a, xPlusY.a),
    yNeg.out.to(xMinusY.b),
    one.out.to(xMinusY.carry_in),
    zero.out.to(xPlusY.carry_in),
    xMinusY.sum.to(displaySub.in),
    xPlusY.sum.to(displayAdd.in),
  ])
  .build()
`,
    dsl: `
const RotationStep = component('RotationStep')
  .node('x', Input, { value: 80 })
  .node('y', Input, { value: 0 })
  .node('shift', Input, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .node('yShifted', RightShifter)
  .node('yNeg', BusNot)
  .node('xMinusY', SignedAdder)
  .node('xPlusY', SignedAdder)
  .node('displaySub', HexDisplay)
  .node('displayAdd', HexDisplay)
  .connect(({ in: inp, out, x, y, shift, one, zero, yShifted, yNeg, xMinusY, xPlusY, displaySub, displayAdd }) => [
    y.out.to(yShifted.value),
    shift.out.to(yShifted.shift),
    yShifted.result.to(yNeg.in, xPlusY.b),
    x.out.to(xMinusY.a, xPlusY.a),
    yNeg.out.to(xMinusY.b),
    one.out.to(xMinusY.carry_in),
    zero.out.to(xPlusY.carry_in),
    xMinusY.sum.to(displaySub.in),
    xPlusY.sum.to(displayAdd.in),
  ])
  .build()
`,
  },

  signDetection: {
    name: "Rotation Direction",
    description:
      "CORDIC decides which way to rotate by checking the sign of the remaining angle z. If z >= 0, rotate counterclockwise; if z < 0, rotate clockwise.",
    displayDsl: `
const SignDetection = component('SignDetection')
  .node('angle', Input, { value: 32 })
  .node('zero', Constant, { value: 0 })
  .node('cmp', SignedComparator)
  .node('positiveLed', Led)
  .node('addVal', Constant, { value: 10 })
  .node('subVal', Constant, { value: 246 })
  .node('result', Mux)
  .node('display', HexDisplay)
  .connect(({ in: inp, out, angle, zero, cmp, positiveLed, addVal, subVal, result, display }) => [
    angle.out.to(cmp.a),
    zero.out.to(cmp.b),
    cmp.gte.to(positiveLed.in, result.sel),
    subVal.out.to(result.in0),
    addVal.out.to(result.in1),
    result.out.to(display.in),
  ])
  .build()
`,
    dsl: `
const SignDetection = component('SignDetection')
  .node('angle', Input, { value: 32 })
  .node('zero', Constant, { value: 0 })
  .node('cmp', SignedComparator)
  .node('positiveLed', Led)
  .node('addVal', Constant, { value: 10 })
  .node('subVal', Constant, { value: 246 })
  .node('result', Mux)
  .node('display', HexDisplay)
  .connect(({ in: inp, out, angle, zero, cmp, positiveLed, addVal, subVal, result, display }) => [
    angle.out.to(cmp.a),
    zero.out.to(cmp.b),
    cmp.gte.to(positiveLed.in, result.sel),
    subVal.out.to(result.in0),
    addVal.out.to(result.in1),
    result.out.to(display.in),
  ])
  .build()
`,
  },

  iterationControl: {
    name: "Iteration Counter",
    description:
      "CORDIC runs for a fixed number of iterations (8 in our case). A register counts up and a comparator stops when done.",
    displayDsl: `
const IterationControl = component('IterationControl')
  .node('iter', Register, { initial: 0 })
  .node('eight', Constant, { value: 8 })
  .node('inc', Incrementer)
  .node('shouldContinue', Comparator)
  .node('display', HexDisplay)
  .node('doneLed', Led)
  .connect(({ in: inp, out, iter, eight, inc, shouldContinue, display, doneLed }) => [
    iter.q.to(inc.in, shouldContinue.a, display.in),
    eight.out.to(shouldContinue.b),
    shouldContinue.lt.to(iter.we),
    inc.out.to(iter.data),
    shouldContinue.eq.to(doneLed.in),
  ])
  .build()
`,
    dsl: `
const IterationControl = component('IterationControl')
  .node('iter', Register, { initial: 0 })
  .node('eight', Constant, { value: 8 })
  .node('inc', Incrementer)
  .node('shouldContinue', Comparator)
  .node('display', HexDisplay)
  .node('doneLed', Led)
  .connect(({ in: inp, out, iter, eight, inc, shouldContinue, display, doneLed }) => [
    iter.q.to(inc.in, shouldContinue.a, display.in),
    eight.out.to(shouldContinue.b),
    shouldContinue.lt.to(iter.we),
    inc.out.to(iter.data),
    shouldContinue.eq.to(doneLed.in),
  ])
  .build()
`,
  },

  angleLookup: {
    name: "Angle Lookup Table",
    description:
      "CORDIC uses a pre-computed table of atan(2^-i) values. A cascaded mux tree selects the right angle for each iteration.",
    displayDsl: `
const AngleLookup = component('AngleLookup')
  .node('iteration', Input, { value: 0 })
  .node('angle0', Constant, { value: 32 })
  .node('angle1', Constant, { value: 19 })
  .node('angle2', Constant, { value: 10 })
  .node('angle3', Constant, { value: 5 })
  .node('angle4', Constant, { value: 3 })
  .node('angle5', Constant, { value: 1 })
  .node('angle6', Constant, { value: 1 })
  .node('angle7', Constant, { value: 0 })
  .node('bit0', BitSlice, { low: 0, high: 0 })
  .node('bit1', BitSlice, { low: 1, high: 1 })
  .node('bit2', BitSlice, { low: 2, high: 2 })
  .node('mux01', Mux)
  .node('mux23', Mux)
  .node('mux45', Mux)
  .node('mux67', Mux)
  .node('mux0123', Mux)
  .node('mux4567', Mux)
  .node('angleSel', Mux)
  .node('display', HexDisplay)
  .connect(({ in: inp, out, iteration, angle0, angle1, angle2, angle3, angle4, angle5, angle6, angle7, bit0, bit1, bit2, mux01, mux23, mux45, mux67, mux0123, mux4567, angleSel, display }) => [
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
  ])
  .build()
`,
    dsl: `
const AngleLookup = component('AngleLookup')
  .node('iteration', Input, { value: 0 })
  .node('angle0', Constant, { value: 32 })
  .node('angle1', Constant, { value: 19 })
  .node('angle2', Constant, { value: 10 })
  .node('angle3', Constant, { value: 5 })
  .node('angle4', Constant, { value: 3 })
  .node('angle5', Constant, { value: 1 })
  .node('angle6', Constant, { value: 1 })
  .node('angle7', Constant, { value: 0 })
  .node('bit0', BitSlice, { low: 0, high: 0 })
  .node('bit1', BitSlice, { low: 1, high: 1 })
  .node('bit2', BitSlice, { low: 2, high: 2 })
  .node('mux01', Mux)
  .node('mux23', Mux)
  .node('mux45', Mux)
  .node('mux67', Mux)
  .node('mux0123', Mux)
  .node('mux4567', Mux)
  .node('angleSel', Mux)
  .node('display', HexDisplay)
  .connect(({ in: inp, out, iteration, angle0, angle1, angle2, angle3, angle4, angle5, angle6, angle7, bit0, bit1, bit2, mux01, mux23, mux45, mux67, mux0123, mux4567, angleSel, display }) => [
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
  ])
  .build()
`,
  },
};

/**
 * Full CORDIC DSL — computes sin/cos by rotating a vector using only shifts and adds.
 * Starts at (80, 0) pointing right and rotates 45 degrees.
 * Expected result: x ~ y ~ 93 after 8 iterations.
 */
export const CORDIC_DSL = `
const CORDICIteration = component('CORDICIteration')
  .node('x', Register, { initial: 80 })
  .node('y', Register, { initial: 0 })
  .node('z', Register, { initial: 32 })
  .node('iteration', Register, { initial: 0 })
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('eight', Constant, { value: 8 })
  .node('zPositive', SignedComparator)
  .node('xShifted', RightShifter)
  .node('yShifted', RightShifter)
  .node('yShiftedNeg', BusNot)
  .node('xSubtract', SignedAdder)
  .node('xAdd', SignedAdder)
  .node('xUpdate', Mux)
  .node('xShiftedNeg', BusNot)
  .node('yAdd', SignedAdder)
  .node('ySubtract', SignedAdder)
  .node('yUpdate', Mux)
  .node('angle0', Constant, { value: 32 })
  .node('angle1', Constant, { value: 19 })
  .node('angle2', Constant, { value: 10 })
  .node('angle3', Constant, { value: 5 })
  .node('angle4', Constant, { value: 3 })
  .node('angle5', Constant, { value: 1 })
  .node('angle6', Constant, { value: 1 })
  .node('angle7', Constant, { value: 0 })
  .node('bit0', BitSlice, { low: 0, high: 0 })
  .node('bit1', BitSlice, { low: 1, high: 1 })
  .node('bit2', BitSlice, { low: 2, high: 2 })
  .node('mux01', Mux)
  .node('mux23', Mux)
  .node('mux45', Mux)
  .node('mux67', Mux)
  .node('mux0123', Mux)
  .node('mux4567', Mux)
  .node('angleSel', Mux)
  .node('angleNeg', BusNot)
  .node('zSubtract', SignedAdder)
  .node('zAdd', SignedAdder)
  .node('zUpdate', Mux)
  .node('iterInc', Incrementer)
  .node('shouldContinue', Comparator)
  .node('xDisplay', HexDisplay)
  .node('yDisplay', HexDisplay)
  .node('zDisplay', HexDisplay)
  .node('iterDisplay', HexDisplay)
  .node('doneCheck', Comparator)
  .node('doneLed', Led)
  .connect(({ in: inp, out, x, y, z, iteration, zero, one, eight, zPositive, xShifted, yShifted, yShiftedNeg, xSubtract, xAdd, xUpdate, xShiftedNeg, yAdd, ySubtract, yUpdate, angle0, angle1, angle2, angle3, angle4, angle5, angle6, angle7, bit0, bit1, bit2, mux01, mux23, mux45, mux67, mux0123, mux4567, angleSel, angleNeg, zSubtract, zAdd, zUpdate, iterInc, shouldContinue, xDisplay, yDisplay, zDisplay, iterDisplay, doneCheck, doneLed }) => [
    z.q.to(zPositive.a, zSubtract.a, zAdd.a, zDisplay.in),
    zero.out.to(zPositive.b, xAdd.carry_in, yAdd.carry_in, zAdd.carry_in),
    x.q.to(xShifted.value, xSubtract.a, xAdd.a, xDisplay.in),
    y.q.to(yShifted.value, yAdd.a, ySubtract.a, yDisplay.in),
    iteration.q.to(xShifted.shift, yShifted.shift, bit0.in, bit1.in, bit2.in, iterInc.in, shouldContinue.a, iterDisplay.in, doneCheck.a),
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
    doneCheck.eq.to(doneLed.in),
  ])
  .build()
`;
