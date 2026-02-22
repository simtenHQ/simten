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

/** Full systolic DSL including PE definition + Systolic2x2_Wavefront + TestWavefront */
export const SYSTOLIC_DSL = `
circuit ProcessingElement_VerticalWeight {
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
}

circuit Systolic2x2_Wavefront {
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
    node pe00: ProcessingElement_VerticalWeight
    node pe01: ProcessingElement_VerticalWeight
    node pe10: ProcessingElement_VerticalWeight
    node pe11: ProcessingElement_VerticalWeight

    node reg_a00: Register
    node reg_a01: Register
    node reg_a10: Register
    node reg_a11: Register
    node reg_b00: Register
    node reg_b01: Register
    node reg_b10: Register
    node reg_b11: Register

    node phase: Register
    node phase_inc: Incrementer
    node phase_mux: Mux

    node is_phase_0: Comparator
    node is_phase_1: Comparator
    node is_phase_2: Comparator
    node is_phase_3: Comparator

    node running: DFlipFlop
    node start_or_running: Or

    node k0_enable: Register
    node k0_enable_inc: Incrementer
    node k0_enable_mux: Mux
    node k0_step_0: Comparator
    node k0_step_1: Comparator
    node k0_step_2: Comparator
    node k0_step_3: Comparator
    node k0_step_4: Comparator
    node k0_step_5: Comparator

    node k1_enable: Register
    node k1_enable_inc: Incrementer
    node k1_enable_mux: Mux
    node k1_step_0: Comparator
    node k1_step_1: Comparator
    node k1_step_2: Comparator
    node k1_step_3: Comparator
    node k1_step_4: Comparator
    node k1_step_5: Comparator

    node advance_from_reset: DFlipFlop
    node advance_to_k1: DFlipFlop
    node advance_to_done: DFlipFlop
    node reset_to_k0: And
    node k0_to_k1: And
    node k1_to_done: And
    node transition_or_1: Or
    node any_phase_transition: Or

    node a_row0_mux: Mux
    node a_row1_mux: Mux
    node b_col0_mux: Mux
    node b_col1_mux: Mux

    node a_row0_inject: Or
    node a_row1_inject: Or
    node a_row0_gate: Mux
    node a_row1_gate: Mux

    node weightValid: Or

    node done_latch: DFlipFlop
    node done_hold: Or

    node zero8: Constant(value=0)
    node zero16: Constant(value=0)
    node one: Constant(value=1)
    node zero: Constant(value=0)
    node const_0: Constant(value=0)
    node const_1: Constant(value=1)
    node const_2: Constant(value=2)
    node const_3: Constant(value=3)
    node const_4: Constant(value=4)
    node const_5: Constant(value=5)

    connect a00 -> reg_a00.data
    connect a01 -> reg_a01.data
    connect a10 -> reg_a10.data
    connect a11 -> reg_a11.data
    connect b00 -> reg_b00.data
    connect b01 -> reg_b01.data
    connect b10 -> reg_b10.data
    connect b11 -> reg_b11.data

    connect start -> reg_a00.we
    connect start -> reg_a01.we
    connect start -> reg_a10.we
    connect start -> reg_a11.we
    connect start -> reg_b00.we
    connect start -> reg_b01.we
    connect start -> reg_b10.we
    connect start -> reg_b11.we

    connect clk -> reg_a00.clk
    connect clk -> reg_a01.clk
    connect clk -> reg_a10.clk
    connect clk -> reg_a11.clk
    connect clk -> reg_b00.clk
    connect clk -> reg_b01.clk
    connect clk -> reg_b10.clk
    connect clk -> reg_b11.clk

    connect start -> start_or_running.a
    connect running.q -> start_or_running.b
    connect start_or_running.out -> running.d
    connect clk -> running.clk

    connect phase.q -> phase_inc.in

    connect reset_to_k0.out -> transition_or_1.a
    connect k0_to_k1.out -> transition_or_1.b

    connect transition_or_1.out -> any_phase_transition.a
    connect k1_to_done.out -> any_phase_transition.b

    connect any_phase_transition.out -> phase_mux.sel
    connect phase_inc.out -> phase_mux.in1
    connect phase.q -> phase_mux.in0

    connect phase_mux.out -> phase.data
    connect start_or_running.out -> phase.we
    connect clk -> phase.clk

    connect phase.q -> is_phase_0.a
    connect const_0.out -> is_phase_0.b

    connect phase.q -> is_phase_1.a
    connect const_1.out -> is_phase_1.b

    connect phase.q -> is_phase_2.a
    connect const_2.out -> is_phase_2.b

    connect phase.q -> is_phase_3.a
    connect const_3.out -> is_phase_3.b

    connect k0_enable.q -> k0_enable_inc.in
    connect is_phase_1.eq -> k0_enable_mux.sel
    connect zero.out -> k0_enable_mux.in0
    connect k0_enable_inc.out -> k0_enable_mux.in1

    connect k0_enable_mux.out -> k0_enable.data
    connect start_or_running.out -> k0_enable.we
    connect clk -> k0_enable.clk

    connect k0_enable.q -> k0_step_0.a
    connect const_0.out -> k0_step_0.b

    connect k0_enable.q -> k0_step_1.a
    connect const_1.out -> k0_step_1.b

    connect k0_enable.q -> k0_step_2.a
    connect const_2.out -> k0_step_2.b

    connect k0_enable.q -> k0_step_3.a
    connect const_3.out -> k0_step_3.b

    connect k0_enable.q -> k0_step_4.a
    connect const_4.out -> k0_step_4.b

    connect k0_enable.q -> k0_step_5.a
    connect const_5.out -> k0_step_5.b

    connect k1_enable.q -> k1_enable_inc.in
    connect is_phase_2.eq -> k1_enable_mux.sel
    connect zero.out -> k1_enable_mux.in0
    connect k1_enable_inc.out -> k1_enable_mux.in1

    connect k1_enable_mux.out -> k1_enable.data
    connect start_or_running.out -> k1_enable.we
    connect clk -> k1_enable.clk

    connect k1_enable.q -> k1_step_0.a
    connect const_0.out -> k1_step_0.b

    connect k1_enable.q -> k1_step_1.a
    connect const_1.out -> k1_step_1.b

    connect k1_enable.q -> k1_step_2.a
    connect const_2.out -> k1_step_2.b

    connect k1_enable.q -> k1_step_3.a
    connect const_3.out -> k1_step_3.b

    connect k1_enable.q -> k1_step_4.a
    connect const_4.out -> k1_step_4.b

    connect k1_enable.q -> k1_step_5.a
    connect const_5.out -> k1_step_5.b

    connect is_phase_0.eq -> advance_from_reset.d
    connect clk -> advance_from_reset.clk

    connect advance_from_reset.q -> reset_to_k0.a
    connect is_phase_0.eq -> reset_to_k0.b

    connect k0_step_5.eq -> advance_to_k1.d
    connect clk -> advance_to_k1.clk

    connect advance_to_k1.q -> k0_to_k1.a
    connect is_phase_1.eq -> k0_to_k1.b

    connect k1_step_5.eq -> advance_to_done.d
    connect clk -> advance_to_done.clk

    connect advance_to_done.q -> k1_to_done.a
    connect is_phase_2.eq -> k1_to_done.b

    connect k0_step_0.eq -> weightValid.a
    connect k1_step_0.eq -> weightValid.b

    connect k0_step_2.eq -> a_row0_inject.a
    connect k1_step_2.eq -> a_row0_inject.b

    connect k0_step_3.eq -> a_row1_inject.a
    connect k1_step_3.eq -> a_row1_inject.b

    connect is_phase_2.eq -> a_row0_mux.sel
    connect reg_a00.q -> a_row0_mux.in0
    connect reg_a01.q -> a_row0_mux.in1

    connect is_phase_2.eq -> a_row1_mux.sel
    connect reg_a10.q -> a_row1_mux.in0
    connect reg_a11.q -> a_row1_mux.in1

    connect a_row0_inject.out -> a_row0_gate.sel
    connect zero8.out -> a_row0_gate.in0
    connect a_row0_mux.out -> a_row0_gate.in1

    connect a_row1_inject.out -> a_row1_gate.sel
    connect zero8.out -> a_row1_gate.in0
    connect a_row1_mux.out -> a_row1_gate.in1

    connect is_phase_2.eq -> b_col0_mux.sel
    connect reg_b00.q -> b_col0_mux.in0
    connect reg_b10.q -> b_col0_mux.in1

    connect is_phase_2.eq -> b_col1_mux.sel
    connect reg_b01.q -> b_col1_mux.in0
    connect reg_b11.q -> b_col1_mux.in1

    connect b_col0_mux.out -> pe00.weightIn
    connect pe00.weightOut -> pe10.weightIn

    connect b_col1_mux.out -> pe01.weightIn
    connect pe01.weightOut -> pe11.weightIn

    connect weightValid.out -> pe00.weightValid
    connect pe00.weightValidOut -> pe10.weightValid

    connect weightValid.out -> pe01.weightValid
    connect pe01.weightValidOut -> pe11.weightValid

    connect is_phase_0.eq -> pe00.resetAccum
    connect is_phase_0.eq -> pe01.resetAccum
    connect is_phase_0.eq -> pe10.resetAccum
    connect is_phase_0.eq -> pe11.resetAccum

    connect a_row0_gate.out -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn
    connect a_row1_gate.out -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn

    connect zero16.out -> pe00.partialSumIn
    connect zero16.out -> pe01.partialSumIn
    connect zero16.out -> pe10.partialSumIn
    connect zero16.out -> pe11.partialSumIn

    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk

    connect is_phase_3.eq -> done_hold.a
    connect done_latch.q -> done_hold.b
    connect done_hold.out -> done_latch.d
    connect clk -> done_latch.clk

    connect pe00.result -> c00
    connect pe01.result -> c01
    connect pe10.result -> c10
    connect pe11.result -> c11
    connect done_latch.q -> done
  }
}

circuit TestWavefront {
  clock clk

  impl {
    node sys: Systolic2x2_Wavefront

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
