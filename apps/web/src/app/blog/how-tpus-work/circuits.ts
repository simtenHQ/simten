/**
 * Circuit definitions for the "How TPUs Do Calculations" blog post.
 *
 * Builds up from a simple MAC unit to a full 2x2 systolic array
 * with wavefront control, all defined in circuit DSL.
 */

export interface BlogCircuit {
  name: string;
  description: string;
  displayDsl: string;
  dsl: string;
}

/** The PE definition reused across multiple circuits */
const PE_DEFINITION = `circuit ProcessingElement_VerticalWeight {
  input dataIn: Bus[8]
  input weightIn: Bus[8]
  input partialSumIn: Bus[16]
  input weightValid: Bit
  input resetAccum: Bit
  clock clk
  output dataOut: Bus[8]
  output weightOut: Bus[8]
  output weightValidOut: Bit
  output result: Bus[16]

  impl {
    node weightReg: Register
    node weightPipe: Register
    node validPipe: DFlipFlop
    node mult: Multiplier
    node adder: Adder(width=16)
    node accum: Register
    node dataPipe: Register
    node accum_mux: Mux
    node one: Constant(value=1)
    node zero: Constant(value=0)
    node zero16: Constant(value=0)

    connect weightIn -> weightReg.data
    connect weightValid -> weightReg.we
    connect clk -> weightReg.clk

    connect weightIn -> weightPipe.data
    connect one.out -> weightPipe.we
    connect clk -> weightPipe.clk
    connect weightPipe.q -> weightOut

    connect weightValid -> validPipe.d
    connect clk -> validPipe.clk
    connect validPipe.q -> weightValidOut

    connect dataIn -> mult.a
    connect weightReg.q -> mult.b
    connect mult.product -> adder.a
    connect accum.q -> adder.b
    connect zero.out -> adder.carry_in

    connect resetAccum -> accum_mux.sel
    connect adder.sum -> accum_mux.in0
    connect zero16.out -> accum_mux.in1

    connect accum_mux.out -> accum.data
    connect one.out -> accum.we
    connect clk -> accum.clk
    connect accum.q -> result

    connect dataIn -> dataPipe.data
    connect one.out -> dataPipe.we
    connect clk -> dataPipe.clk
    connect dataPipe.q -> dataOut
  }
}`;

export const TPU_CIRCUITS: Record<string, BlogCircuit> = {
  simpleMACUnit: {
    name: "Simple MAC Unit",
    description:
      "Multiply two numbers and accumulate the result into a register. The fundamental operation of neural networks.",
    displayDsl: `circuit SimpleMACUnit {
  clock clk
  impl {
    node a: Input(value=3)
    node b: Input(value=4)

    node mult: Multiplier
    connect a.out -> mult.a
    connect b.out -> mult.b

    node adder: Adder(width=16)
    node accum: Register
    node zero: Constant(value=0)
    node one: Constant(value=1)

    connect mult.product -> adder.a
    connect accum.q -> adder.b
    connect zero.out -> adder.carry_in

    node resetSwitch: Switch
    node accumMux: Mux
    connect adder.sum -> accumMux.in0
    connect zero.out -> accumMux.in1
    connect resetSwitch.out -> accumMux.sel

    connect accumMux.out -> accum.data
    connect one.out -> accum.we
    connect clk -> accum.clk

    node display: HexDisplay
    connect accum.q -> display.in
  }
}`,
    dsl: `
circuit SimpleMACUnit {
  clock clk
  impl {
    node a: Input(value=3)
    node b: Input(value=4)

    node mult: Multiplier
    connect a.out -> mult.a
    connect b.out -> mult.b

    node adder: Adder(width=16)
    node accum: Register
    node zero: Constant(value=0)
    node one: Constant(value=1)

    connect mult.product -> adder.a
    connect accum.q -> adder.b
    connect zero.out -> adder.carry_in

    node resetSwitch: Switch
    node accumMux: Mux
    connect adder.sum -> accumMux.in0
    connect zero.out -> accumMux.in1
    connect resetSwitch.out -> accumMux.sel

    connect accumMux.out -> accum.data
    connect one.out -> accum.we
    connect clk -> accum.clk

    node display: HexDisplay
    connect accum.q -> display.in
  }
}`,
  },

  weightLoader: {
    name: "Weight Loader",
    description:
      "A register that stores a weight only when the valid signal is high. A pipeline register passes the weight through for vertical distribution.",
    displayDsl: `circuit WeightLoader {
  clock clk
  impl {
    node weightIn: Input(value=7)
    node weightValid: Switch

    node weightReg: Register
    connect weightIn.out -> weightReg.data
    connect weightValid.out -> weightReg.we
    connect clk -> weightReg.clk

    node storedWeight: HexDisplay
    connect weightReg.q -> storedWeight.in

    node one: Constant(value=1)
    node pipeReg: Register
    connect weightIn.out -> pipeReg.data
    connect one.out -> pipeReg.we
    connect clk -> pipeReg.clk

    node passThrough: HexDisplay
    connect pipeReg.q -> passThrough.in
  }
}`,
    dsl: `
circuit WeightLoader {
  clock clk
  impl {
    node weightIn: Input(value=7)
    node weightValid: Switch

    node weightReg: Register
    connect weightIn.out -> weightReg.data
    connect weightValid.out -> weightReg.we
    connect clk -> weightReg.clk

    node storedWeight: HexDisplay
    connect weightReg.q -> storedWeight.in

    node one: Constant(value=1)
    node pipeReg: Register
    connect weightIn.out -> pipeReg.data
    connect one.out -> pipeReg.we
    connect clk -> pipeReg.clk

    node passThrough: HexDisplay
    connect pipeReg.q -> passThrough.in
  }
}`,
  },

  processingElement: {
    name: "Processing Element",
    description:
      "A full PE with weight storage, data pipeline, and MAC accumulator. Load a weight, then stream data through.",
    displayDsl: `circuit TestPE {
  clock clk
  impl {
    node pe: ProcessingElement_VerticalWeight
    connect clk -> pe.clk

    node dataIn: Input(value=3)
    node weightIn: Input(value=5)
    node weightValid: Switch
    node resetAccum: Switch
    node zero16: Constant(value=0)

    connect dataIn.out -> pe.dataIn
    connect weightIn.out -> pe.weightIn
    connect weightValid.out -> pe.weightValid
    connect resetAccum.out -> pe.resetAccum
    connect zero16.out -> pe.partialSumIn

    node resultDisplay: HexDisplay
    node dataOutDisplay: HexDisplay
    connect pe.result -> resultDisplay.in
    connect pe.dataOut -> dataOutDisplay.in
  }
}`,
    dsl: `
${PE_DEFINITION}

circuit TestPE {
  clock clk
  impl {
    node pe: ProcessingElement_VerticalWeight
    connect clk -> pe.clk

    node dataIn: Input(value=3)
    node weightIn: Input(value=5)
    node weightValid: Switch
    node resetAccum: Switch
    node zero16: Constant(value=0)

    connect dataIn.out -> pe.dataIn
    connect weightIn.out -> pe.weightIn
    connect weightValid.out -> pe.weightValid
    connect resetAccum.out -> pe.resetAccum
    connect zero16.out -> pe.partialSumIn

    node resultDisplay: HexDisplay
    node dataOutDisplay: HexDisplay
    connect pe.result -> resultDisplay.in
    connect pe.dataOut -> dataOutDisplay.in
  }
}`,
  },

  twoPERow: {
    name: "Two-PE Row",
    description:
      "Two PEs connected horizontally. Data flows left to right with a one-cycle delay between elements.",
    displayDsl: `circuit TwoPERow {
  clock clk
  impl {
    node pe0: ProcessingElement_VerticalWeight
    node pe1: ProcessingElement_VerticalWeight
    connect clk -> pe0.clk
    connect clk -> pe1.clk

    node data0: Input(value=2)
    node weight0: Input(value=3)
    node weight1: Input(value=5)
    node valid0: Switch
    node valid1: Switch
    node reset: Switch
    node zero16: Constant(value=0)

    connect data0.out -> pe0.dataIn
    connect pe0.dataOut -> pe1.dataIn

    connect weight0.out -> pe0.weightIn
    connect weight1.out -> pe1.weightIn
    connect valid0.out -> pe0.weightValid
    connect valid1.out -> pe1.weightValid
    connect reset.out -> pe0.resetAccum
    connect reset.out -> pe1.resetAccum
    connect zero16.out -> pe0.partialSumIn
    connect zero16.out -> pe1.partialSumIn

    node result0: HexDisplay
    node result1: HexDisplay
    connect pe0.result -> result0.in
    connect pe1.result -> result1.in
  }
}`,
    dsl: `
${PE_DEFINITION}

circuit TwoPERow {
  clock clk
  impl {
    node pe0: ProcessingElement_VerticalWeight
    node pe1: ProcessingElement_VerticalWeight
    connect clk -> pe0.clk
    connect clk -> pe1.clk

    node data0: Input(value=2)
    node weight0: Input(value=3)
    node weight1: Input(value=5)
    node valid0: Switch
    node valid1: Switch
    node reset: Switch
    node zero16: Constant(value=0)

    connect data0.out -> pe0.dataIn
    connect pe0.dataOut -> pe1.dataIn

    connect weight0.out -> pe0.weightIn
    connect weight1.out -> pe1.weightIn
    connect valid0.out -> pe0.weightValid
    connect valid1.out -> pe1.weightValid
    connect reset.out -> pe0.resetAccum
    connect reset.out -> pe1.resetAccum
    connect zero16.out -> pe0.partialSumIn
    connect zero16.out -> pe1.partialSumIn

    node result0: HexDisplay
    node result1: HexDisplay
    connect pe0.result -> result0.in
    connect pe1.result -> result1.in
  }
}`,
  },

  twoPEColumn: {
    name: "Two-PE Column",
    description:
      "Two PEs stacked vertically. Weights propagate from top to bottom with the valid signal.",
    displayDsl: `circuit TwoPEColumn {
  clock clk
  impl {
    node pe0: ProcessingElement_VerticalWeight
    node pe1: ProcessingElement_VerticalWeight
    connect clk -> pe0.clk
    connect clk -> pe1.clk

    node dataTop: Input(value=4)
    node dataBot: Input(value=6)
    node weightIn: Input(value=3)
    node weightValid: Switch
    node reset: Switch
    node zero16: Constant(value=0)

    connect dataTop.out -> pe0.dataIn
    connect dataBot.out -> pe1.dataIn

    connect weightIn.out -> pe0.weightIn
    connect pe0.weightOut -> pe1.weightIn
    connect weightValid.out -> pe0.weightValid
    connect pe0.weightValidOut -> pe1.weightValid

    connect reset.out -> pe0.resetAccum
    connect reset.out -> pe1.resetAccum
    connect zero16.out -> pe0.partialSumIn
    connect zero16.out -> pe1.partialSumIn

    node result0: HexDisplay
    node result1: HexDisplay
    node validLed: Led
    connect pe0.result -> result0.in
    connect pe1.result -> result1.in
    connect pe0.weightValidOut -> validLed.in
  }
}`,
    dsl: `
${PE_DEFINITION}

circuit TwoPEColumn {
  clock clk
  impl {
    node pe0: ProcessingElement_VerticalWeight
    node pe1: ProcessingElement_VerticalWeight
    connect clk -> pe0.clk
    connect clk -> pe1.clk

    node dataTop: Input(value=4)
    node dataBot: Input(value=6)
    node weightIn: Input(value=3)
    node weightValid: Switch
    node reset: Switch
    node zero16: Constant(value=0)

    connect dataTop.out -> pe0.dataIn
    connect dataBot.out -> pe1.dataIn

    connect weightIn.out -> pe0.weightIn
    connect pe0.weightOut -> pe1.weightIn
    connect weightValid.out -> pe0.weightValid
    connect pe0.weightValidOut -> pe1.weightValid

    connect reset.out -> pe0.resetAccum
    connect reset.out -> pe1.resetAccum
    connect zero16.out -> pe0.partialSumIn
    connect zero16.out -> pe1.partialSumIn

    node result0: HexDisplay
    node result1: HexDisplay
    node validLed: Led
    connect pe0.result -> result0.in
    connect pe1.result -> result1.in
    connect pe0.weightValidOut -> validLed.in
  }
}`,
  },

  wavefrontController: {
    name: "Wavefront Controller",
    description:
      "A phase register drives multi-step computation. Each phase has its own enable counter. LEDs show the active phase.",
    displayDsl: `circuit WavefrontController {
  clock clk
  impl {
    node phase: Register(initial=0)
    connect clk -> phase.clk

    node enable: Switch
    node inc: Incrementer
    node phaseMux: Mux

    connect phase.q -> inc.in
    connect phase.q -> phaseMux.in0
    connect inc.out -> phaseMux.in1
    connect enable.out -> phaseMux.sel
    connect phaseMux.out -> phase.data
    node one: Constant(value=1)
    connect one.out -> phase.we

    node zero: Constant(value=0)
    node const1: Constant(value=1)
    node const2: Constant(value=2)
    node const3: Constant(value=3)

    node isPhase0: Comparator
    node isPhase1: Comparator
    node isPhase2: Comparator
    node isPhase3: Comparator

    connect phase.q -> isPhase0.a
    connect zero.out -> isPhase0.b
    connect phase.q -> isPhase1.a
    connect const1.out -> isPhase1.b
    connect phase.q -> isPhase2.a
    connect const2.out -> isPhase2.b
    connect phase.q -> isPhase3.a
    connect const3.out -> isPhase3.b

    node led0: Led
    node led1: Led
    node led2: Led
    node led3: Led
    connect isPhase0.eq -> led0.in
    connect isPhase1.eq -> led1.in
    connect isPhase2.eq -> led2.in
    connect isPhase3.eq -> led3.in

    node display: HexDisplay
    connect phase.q -> display.in
  }
}`,
    dsl: `
circuit WavefrontController {
  clock clk
  impl {
    node phase: Register(initial=0)
    connect clk -> phase.clk

    node enable: Switch
    node inc: Incrementer
    node phaseMux: Mux

    connect phase.q -> inc.in
    connect phase.q -> phaseMux.in0
    connect inc.out -> phaseMux.in1
    connect enable.out -> phaseMux.sel
    connect phaseMux.out -> phase.data
    node one: Constant(value=1)
    connect one.out -> phase.we

    node zero: Constant(value=0)
    node const1: Constant(value=1)
    node const2: Constant(value=2)
    node const3: Constant(value=3)

    node isPhase0: Comparator
    node isPhase1: Comparator
    node isPhase2: Comparator
    node isPhase3: Comparator

    connect phase.q -> isPhase0.a
    connect zero.out -> isPhase0.b
    connect phase.q -> isPhase1.a
    connect const1.out -> isPhase1.b
    connect phase.q -> isPhase2.a
    connect const2.out -> isPhase2.b
    connect phase.q -> isPhase3.a
    connect const3.out -> isPhase3.b

    node led0: Led
    node led1: Led
    node led2: Led
    node led3: Led
    connect isPhase0.eq -> led0.in
    connect isPhase1.eq -> led1.in
    connect isPhase2.eq -> led2.in
    connect isPhase3.eq -> led3.in

    node display: HexDisplay
    connect phase.q -> display.in
  }
}`,
  },
};

/**
 * Full systolic DSL: PE_Systolic + Systolic2x2 + TestWavefront
 *
 * Architecture: weight-stationary with combinational partial-sum flow.
 * - Cycle 0: load all weights into PEs
 * - Cycles 1–3: pipelined data flow (activations right, partial sums down)
 * - Cycle 4: counter reaches 4, done fires
 *
 * Total: 4 ticks (1 weight load + 3 data flow = 2N−1 for N=2).
 */
export const SYSTOLIC_DSL = `
circuit PE_Systolic {
  input dataIn: Bus[8]
  input weightIn: Bus[8]
  input partialSumIn: Bus[16]
  input weightValid: Bit
  clock clk
  output dataOut: Bus[8]
  output partialSumOut: Bus[16]

  impl {
    node weightReg: Register
    node mult: Multiplier
    node adder: Adder(width=16)
    node dataPipe: Register
    node one: Constant(value=1)
    node zero: Constant(value=0)

    // Weight register: latches weight when weightValid is high
    connect weightIn -> weightReg.data
    connect weightValid -> weightReg.we
    connect clk -> weightReg.clk

    // Multiply: dataIn * stored weight
    connect dataIn -> mult.a
    connect weightReg.q -> mult.b

    // Add: incoming partial sum + local product (COMBINATIONAL output)
    connect partialSumIn -> adder.a
    connect mult.product -> adder.b
    connect zero.out -> adder.carry_in
    connect adder.sum -> partialSumOut

    // Data pipeline: 1-cycle delay for horizontal flow
    connect dataIn -> dataPipe.data
    connect one.out -> dataPipe.we
    connect clk -> dataPipe.clk
    connect dataPipe.q -> dataOut
  }
}

circuit Systolic2x2 {
  input a00: Bus[8]
  input a01: Bus[8]
  input a10: Bus[8]
  input a11: Bus[8]
  input b00: Bus[8]
  input b01: Bus[8]
  input b10: Bus[8]
  input b11: Bus[8]
  input start: Bit
  clock clk
  output c00: Bus[16]
  output c01: Bus[16]
  output c10: Bus[16]
  output c11: Bus[16]
  output done: Bit

  impl {
    // ===== Processing Elements (2x2 grid) =====
    node pe00: PE_Systolic
    node pe01: PE_Systolic
    node pe10: PE_Systolic
    node pe11: PE_Systolic
    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk

    // ===== Constants =====
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)
    node three: Constant(value=3)
    node four: Constant(value=4)

    // ===== Cycle Counter (0 -> 1 -> 2 -> 3 -> 4, stops at 4) =====
    node counter: Register(initial=0)
    node counterInc: Incrementer
    node counterMux: Mux
    node notDone: Comparator
    node shouldAdvance: And

    connect counter.q -> counterInc.in
    connect counter.q -> notDone.a
    connect four.out -> notDone.b
    connect start -> shouldAdvance.a
    connect notDone.lt -> shouldAdvance.b
    connect shouldAdvance.out -> counterMux.sel
    connect counter.q -> counterMux.in0
    connect counterInc.out -> counterMux.in1
    connect counterMux.out -> counter.data
    connect one.out -> counter.we
    connect clk -> counter.clk

    // ===== Cycle Decoder =====
    node isCycle0: Comparator
    node isCycle1: Comparator
    node isCycle2: Comparator
    node isCycle3: Comparator
    connect counter.q -> isCycle0.a
    connect zero.out -> isCycle0.b
    connect counter.q -> isCycle1.a
    connect one.out -> isCycle1.b
    connect counter.q -> isCycle2.a
    connect two.out -> isCycle2.b
    connect counter.q -> isCycle3.a
    connect three.out -> isCycle3.b

    // ===== Weight Loading (cycle 0 only) =====
    node loadWeights: And
    connect isCycle0.eq -> loadWeights.a
    connect start -> loadWeights.b
    connect b00 -> pe00.weightIn
    connect b01 -> pe01.weightIn
    connect b10 -> pe10.weightIn
    connect b11 -> pe11.weightIn
    connect loadWeights.out -> pe00.weightValid
    connect loadWeights.out -> pe01.weightValid
    connect loadWeights.out -> pe10.weightValid
    connect loadWeights.out -> pe11.weightValid

    // ===== Data Injection =====
    // Row 0: cycle 1 -> A[0][0], cycle 2 -> A[1][0], else 0
    node muxR0a: Mux
    node muxR0b: Mux
    connect isCycle1.eq -> muxR0a.sel
    connect zero.out -> muxR0a.in0
    connect a00 -> muxR0a.in1
    connect isCycle2.eq -> muxR0b.sel
    connect muxR0a.out -> muxR0b.in0
    connect a10 -> muxR0b.in1

    // Row 1: cycle 1 -> A[0][1], cycle 2 -> A[1][1], else 0
    node muxR1a: Mux
    node muxR1b: Mux
    connect isCycle1.eq -> muxR1a.sel
    connect zero.out -> muxR1a.in0
    connect a01 -> muxR1a.in1
    connect isCycle2.eq -> muxR1b.sel
    connect muxR1a.out -> muxR1b.in0
    connect a11 -> muxR1b.in1

    // ===== Horizontal Data Flow (left -> right) =====
    connect muxR0b.out -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn
    connect muxR1b.out -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn

    // ===== Vertical Partial-Sum Flow (top -> bottom) =====
    connect zero.out -> pe00.partialSumIn
    connect zero.out -> pe01.partialSumIn
    connect pe00.partialSumOut -> pe10.partialSumIn
    connect pe01.partialSumOut -> pe11.partialSumIn

    // ===== Result Registers =====
    // C[0][0] emerges at PE(1,0) during cycle 1
    node result_c00: Register
    connect pe10.partialSumOut -> result_c00.data
    connect isCycle1.eq -> result_c00.we
    connect clk -> result_c00.clk

    // C[1][0] emerges at PE(1,0) during cycle 2
    node result_c10: Register
    connect pe10.partialSumOut -> result_c10.data
    connect isCycle2.eq -> result_c10.we
    connect clk -> result_c10.clk

    // C[0][1] emerges at PE(1,1) during cycle 2
    node result_c01: Register
    connect pe11.partialSumOut -> result_c01.data
    connect isCycle2.eq -> result_c01.we
    connect clk -> result_c01.clk

    // C[1][1] emerges at PE(1,1) during cycle 3
    node result_c11: Register
    connect pe11.partialSumOut -> result_c11.data
    connect isCycle3.eq -> result_c11.we
    connect clk -> result_c11.clk

    // ===== Outputs =====
    connect result_c00.q -> c00
    connect result_c01.q -> c01
    connect result_c10.q -> c10
    connect result_c11.q -> c11

    // Done = counter reached 4
    node isDone: Comparator
    connect counter.q -> isDone.a
    connect four.out -> isDone.b
    connect isDone.eq -> done
  }
}

circuit TestWavefront {
  clock clk
  impl {
    node sys: Systolic2x2

    node a00: Input(value=1)
    node a01: Input(value=2)
    node a10: Input(value=3)
    node a11: Input(value=4)
    node b00: Input(value=5)
    node b01: Input(value=6)
    node b10: Input(value=7)
    node b11: Input(value=8)

    node start: Switch

    connect a00.out -> sys.a00
    connect a01.out -> sys.a01
    connect a10.out -> sys.a10
    connect a11.out -> sys.a11
    connect b00.out -> sys.b00
    connect b01.out -> sys.b01
    connect b10.out -> sys.b10
    connect b11.out -> sys.b11

    connect start.out -> sys.start
    connect clk -> sys.clk

    node display_c00: HexDisplay
    node display_c01: HexDisplay
    node display_c10: HexDisplay
    node display_c11: HexDisplay
    node done_led: Led

    connect sys.c00 -> display_c00.in
    connect sys.c01 -> display_c01.in
    connect sys.c10 -> display_c10.in
    connect sys.c11 -> display_c11.in
    connect sys.done -> done_led.in
  }
}
`;
