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
    displayDsl: `circuit RightShiftDemo {
  impl {
    node value: Input(value=80)
    node shift: Input(value=1)

    node shifter: RightShifter
    connect value.out -> shifter.value
    connect shift.out -> shifter.shift

    node result: HexDisplay
    connect shifter.result -> result.in
  }
}`,
    dsl: `
circuit RightShiftDemo {
  impl {
    node value: Input(value=80)
    node shift: Input(value=1)

    node shifter: RightShifter
    connect value.out -> shifter.value
    connect shift.out -> shifter.shift

    node result: HexDisplay
    connect shifter.result -> result.in
  }
}`,
  },

  rotationStep: {
    name: "One Rotation Step",
    description:
      "The core CORDIC operation: x_next = x - (y >> i). A right-shifted value is subtracted using two's complement.",
    displayDsl: `circuit RotationStep {
  impl {
    node x: Input(value=80)
    node y: Input(value=0)
    node shift: Input(value=0)

    node one: Constant(value=1)
    node zero: Constant(value=0)

    node yShifted: RightShifter
    connect y.out -> yShifted.value
    connect shift.out -> yShifted.shift

    node yNeg: BusNot
    connect yShifted.result -> yNeg.in

    node xMinusY: SignedAdder
    connect x.out -> xMinusY.a
    connect yNeg.out -> xMinusY.b
    connect one.out -> xMinusY.carry_in

    node xPlusY: SignedAdder
    connect x.out -> xPlusY.a
    connect yShifted.result -> xPlusY.b
    connect zero.out -> xPlusY.carry_in

    node displaySub: HexDisplay
    connect xMinusY.sum -> displaySub.in

    node displayAdd: HexDisplay
    connect xPlusY.sum -> displayAdd.in
  }
}`,
    dsl: `
circuit RotationStep {
  impl {
    node x: Input(value=80)
    node y: Input(value=0)
    node shift: Input(value=0)

    node one: Constant(value=1)
    node zero: Constant(value=0)

    node yShifted: RightShifter
    connect y.out -> yShifted.value
    connect shift.out -> yShifted.shift

    node yNeg: BusNot
    connect yShifted.result -> yNeg.in

    node xMinusY: SignedAdder
    connect x.out -> xMinusY.a
    connect yNeg.out -> xMinusY.b
    connect one.out -> xMinusY.carry_in

    node xPlusY: SignedAdder
    connect x.out -> xPlusY.a
    connect yShifted.result -> xPlusY.b
    connect zero.out -> xPlusY.carry_in

    node displaySub: HexDisplay
    connect xMinusY.sum -> displaySub.in

    node displayAdd: HexDisplay
    connect xPlusY.sum -> displayAdd.in
  }
}`,
  },

  signDetection: {
    name: "Rotation Direction",
    description:
      "CORDIC decides which way to rotate by checking the sign of the remaining angle z. If z >= 0, rotate counterclockwise; if z < 0, rotate clockwise.",
    displayDsl: `circuit SignDetection {
  impl {
    node angle: Input(value=32)
    node zero: Constant(value=0)

    node cmp: SignedComparator
    connect angle.out -> cmp.a
    connect zero.out -> cmp.b

    node positiveLed: Led
    connect cmp.gte -> positiveLed.in

    node addVal: Constant(value=10)
    node subVal: Constant(value=246)

    node result: Mux
    connect subVal.out -> result.in0
    connect addVal.out -> result.in1
    connect cmp.gte -> result.sel

    node display: HexDisplay
    connect result.out -> display.in
  }
}`,
    dsl: `
circuit SignDetection {
  impl {
    node angle: Input(value=32)
    node zero: Constant(value=0)

    node cmp: SignedComparator
    connect angle.out -> cmp.a
    connect zero.out -> cmp.b

    node positiveLed: Led
    connect cmp.gte -> positiveLed.in

    node addVal: Constant(value=10)
    node subVal: Constant(value=246)

    node result: Mux
    connect subVal.out -> result.in0
    connect addVal.out -> result.in1
    connect cmp.gte -> result.sel

    node display: HexDisplay
    connect result.out -> display.in
  }
}`,
  },

  iterationControl: {
    name: "Iteration Counter",
    description:
      "CORDIC runs for a fixed number of iterations (8 in our case). A register counts up and a comparator stops when done.",
    displayDsl: `circuit IterationControl {
  clock clk
  impl {
    node iter: Register(initial=0)
    connect clk -> iter.clk

    node eight: Constant(value=8)

    node inc: Incrementer
    connect iter.q -> inc.in

    node shouldContinue: Comparator
    connect iter.q -> shouldContinue.a
    connect eight.out -> shouldContinue.b

    connect shouldContinue.lt -> iter.we
    connect inc.out -> iter.data

    node display: HexDisplay
    connect iter.q -> display.in

    node doneLed: Led
    connect shouldContinue.eq -> doneLed.in
  }
}`,
    dsl: `
circuit IterationControl {
  clock clk
  impl {
    node iter: Register(initial=0)
    connect clk -> iter.clk

    node eight: Constant(value=8)

    node inc: Incrementer
    connect iter.q -> inc.in

    node shouldContinue: Comparator
    connect iter.q -> shouldContinue.a
    connect eight.out -> shouldContinue.b

    connect shouldContinue.lt -> iter.we
    connect inc.out -> iter.data

    node display: HexDisplay
    connect iter.q -> display.in

    node doneLed: Led
    connect shouldContinue.eq -> doneLed.in
  }
}`,
  },

  angleLookup: {
    name: "Angle Lookup Table",
    description:
      "CORDIC uses a pre-computed table of atan(2^-i) values. A cascaded mux tree selects the right angle for each iteration.",
    displayDsl: `circuit AngleLookup {
  impl {
    node iteration: Input(value=0)

    node angle0: Constant(value=32)
    node angle1: Constant(value=19)
    node angle2: Constant(value=10)
    node angle3: Constant(value=5)
    node angle4: Constant(value=3)
    node angle5: Constant(value=1)
    node angle6: Constant(value=1)
    node angle7: Constant(value=0)

    node bit0: BitSlice(low=0, high=0)
    node bit1: BitSlice(low=1, high=1)
    node bit2: BitSlice(low=2, high=2)
    connect iteration.out -> bit0.in
    connect iteration.out -> bit1.in
    connect iteration.out -> bit2.in

    node mux01: Mux
    node mux23: Mux
    node mux45: Mux
    node mux67: Mux
    connect bit0.out -> mux01.sel
    connect bit0.out -> mux23.sel
    connect bit0.out -> mux45.sel
    connect bit0.out -> mux67.sel
    connect angle0.out -> mux01.in0
    connect angle1.out -> mux01.in1
    connect angle2.out -> mux23.in0
    connect angle3.out -> mux23.in1
    connect angle4.out -> mux45.in0
    connect angle5.out -> mux45.in1
    connect angle6.out -> mux67.in0
    connect angle7.out -> mux67.in1

    node mux0123: Mux
    node mux4567: Mux
    connect bit1.out -> mux0123.sel
    connect bit1.out -> mux4567.sel
    connect mux01.out -> mux0123.in0
    connect mux23.out -> mux0123.in1
    connect mux45.out -> mux4567.in0
    connect mux67.out -> mux4567.in1

    node angleSel: Mux
    connect bit2.out -> angleSel.sel
    connect mux0123.out -> angleSel.in0
    connect mux4567.out -> angleSel.in1

    node display: HexDisplay
    connect angleSel.out -> display.in
  }
}`,
    dsl: `
circuit AngleLookup {
  impl {
    node iteration: Input(value=0)

    node angle0: Constant(value=32)
    node angle1: Constant(value=19)
    node angle2: Constant(value=10)
    node angle3: Constant(value=5)
    node angle4: Constant(value=3)
    node angle5: Constant(value=1)
    node angle6: Constant(value=1)
    node angle7: Constant(value=0)

    node bit0: BitSlice(low=0, high=0)
    node bit1: BitSlice(low=1, high=1)
    node bit2: BitSlice(low=2, high=2)
    connect iteration.out -> bit0.in
    connect iteration.out -> bit1.in
    connect iteration.out -> bit2.in

    node mux01: Mux
    node mux23: Mux
    node mux45: Mux
    node mux67: Mux
    connect bit0.out -> mux01.sel
    connect bit0.out -> mux23.sel
    connect bit0.out -> mux45.sel
    connect bit0.out -> mux67.sel
    connect angle0.out -> mux01.in0
    connect angle1.out -> mux01.in1
    connect angle2.out -> mux23.in0
    connect angle3.out -> mux23.in1
    connect angle4.out -> mux45.in0
    connect angle5.out -> mux45.in1
    connect angle6.out -> mux67.in0
    connect angle7.out -> mux67.in1

    node mux0123: Mux
    node mux4567: Mux
    connect bit1.out -> mux0123.sel
    connect bit1.out -> mux4567.sel
    connect mux01.out -> mux0123.in0
    connect mux23.out -> mux0123.in1
    connect mux45.out -> mux4567.in0
    connect mux67.out -> mux4567.in1

    node angleSel: Mux
    connect bit2.out -> angleSel.sel
    connect mux0123.out -> angleSel.in0
    connect mux4567.out -> angleSel.in1

    node display: HexDisplay
    connect angleSel.out -> display.in
  }
}`,
  },
};

/**
 * Full CORDIC DSL — computes sin/cos by rotating a vector using only shifts and adds.
 * Starts at (80, 0) pointing right and rotates 45 degrees.
 * Expected result: x ~ y ~ 93 after 8 iterations.
 */
export const CORDIC_DSL = `
circuit CORDICIteration {
  clock clk

  impl {
    node x: Register(initial=80)
    node y: Register(initial=0)
    node z: Register(initial=32)
    node iteration: Register(initial=0)

    node zero: Constant(value=0)
    node one: Constant(value=1)
    node eight: Constant(value=8)

    node zPositive: SignedComparator
    connect z.q -> zPositive.a
    connect zero.out -> zPositive.b

    node xShifted: RightShifter
    node yShifted: RightShifter
    connect x.q -> xShifted.value
    connect y.q -> yShifted.value
    connect iteration.q -> xShifted.shift
    connect iteration.q -> yShifted.shift

    node yShiftedNeg: BusNot
    connect yShifted.result -> yShiftedNeg.in

    node xSubtract: SignedAdder
    connect x.q -> xSubtract.a
    connect yShiftedNeg.out -> xSubtract.b
    connect one.out -> xSubtract.carry_in

    node xAdd: SignedAdder
    connect x.q -> xAdd.a
    connect yShifted.result -> xAdd.b
    connect zero.out -> xAdd.carry_in

    node xUpdate: Mux
    connect zPositive.gte -> xUpdate.sel
    connect xAdd.sum -> xUpdate.in0
    connect xSubtract.sum -> xUpdate.in1

    node xShiftedNeg: BusNot
    connect xShifted.result -> xShiftedNeg.in

    node yAdd: SignedAdder
    connect y.q -> yAdd.a
    connect xShifted.result -> yAdd.b
    connect zero.out -> yAdd.carry_in

    node ySubtract: SignedAdder
    connect y.q -> ySubtract.a
    connect xShiftedNeg.out -> ySubtract.b
    connect one.out -> ySubtract.carry_in

    node yUpdate: Mux
    connect zPositive.gte -> yUpdate.sel
    connect ySubtract.sum -> yUpdate.in0
    connect yAdd.sum -> yUpdate.in1

    node angle0: Constant(value=32)
    node angle1: Constant(value=19)
    node angle2: Constant(value=10)
    node angle3: Constant(value=5)
    node angle4: Constant(value=3)
    node angle5: Constant(value=1)
    node angle6: Constant(value=1)
    node angle7: Constant(value=0)

    node bit0: BitSlice(low=0, high=0)
    node bit1: BitSlice(low=1, high=1)
    node bit2: BitSlice(low=2, high=2)
    connect iteration.q -> bit0.in
    connect iteration.q -> bit1.in
    connect iteration.q -> bit2.in

    node mux01: Mux
    node mux23: Mux
    node mux45: Mux
    node mux67: Mux
    connect bit0.out -> mux01.sel
    connect bit0.out -> mux23.sel
    connect bit0.out -> mux45.sel
    connect bit0.out -> mux67.sel
    connect angle0.out -> mux01.in0
    connect angle1.out -> mux01.in1
    connect angle2.out -> mux23.in0
    connect angle3.out -> mux23.in1
    connect angle4.out -> mux45.in0
    connect angle5.out -> mux45.in1
    connect angle6.out -> mux67.in0
    connect angle7.out -> mux67.in1

    node mux0123: Mux
    node mux4567: Mux
    connect bit1.out -> mux0123.sel
    connect bit1.out -> mux4567.sel
    connect mux01.out -> mux0123.in0
    connect mux23.out -> mux0123.in1
    connect mux45.out -> mux4567.in0
    connect mux67.out -> mux4567.in1

    node angleSel: Mux
    connect bit2.out -> angleSel.sel
    connect mux0123.out -> angleSel.in0
    connect mux4567.out -> angleSel.in1

    node angleNeg: BusNot
    connect angleSel.out -> angleNeg.in

    node zSubtract: SignedAdder
    connect z.q -> zSubtract.a
    connect angleNeg.out -> zSubtract.b
    connect one.out -> zSubtract.carry_in

    node zAdd: SignedAdder
    connect z.q -> zAdd.a
    connect angleSel.out -> zAdd.b
    connect zero.out -> zAdd.carry_in

    node zUpdate: Mux
    connect zPositive.gte -> zUpdate.sel
    connect zAdd.sum -> zUpdate.in0
    connect zSubtract.sum -> zUpdate.in1

    node iterInc: Incrementer
    connect iteration.q -> iterInc.in

    node shouldContinue: Comparator
    connect iteration.q -> shouldContinue.a
    connect eight.out -> shouldContinue.b

    connect shouldContinue.lt -> x.we
    connect shouldContinue.lt -> y.we
    connect shouldContinue.lt -> z.we
    connect shouldContinue.lt -> iteration.we

    connect xUpdate.out -> x.data
    connect yUpdate.out -> y.data
    connect zUpdate.out -> z.data
    connect iterInc.out -> iteration.data

    node xDisplay: HexDisplay
    node yDisplay: HexDisplay
    node zDisplay: HexDisplay
    node iterDisplay: HexDisplay

    connect x.q -> xDisplay.in
    connect y.q -> yDisplay.in
    connect z.q -> zDisplay.in
    connect iteration.q -> iterDisplay.in

    node doneCheck: Comparator
    node doneLed: Led
    connect iteration.q -> doneCheck.a
    connect eight.out -> doneCheck.b
    connect doneCheck.eq -> doneLed.in

    connect clk -> x.clk
    connect clk -> y.clk
    connect clk -> z.clk
    connect clk -> iteration.clk
  }
}
`;
