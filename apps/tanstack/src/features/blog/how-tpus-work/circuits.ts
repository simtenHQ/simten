/**
 * Circuit definitions for the "How TPUs Do Calculations" blog post.
 *
 * Builds up from a simple multiply-add to a full 3x3 systolic array
 * with wavefront control, all defined in circuit DSL.
 *
 * All building blocks use the same PE_Systolic architecture as the final array:
 *   - Weight register with valid-bit gating
 *   - Multiplier: dataIn × stored weight
 *   - Registered adder: partialSumIn + product → psumReg → partialSumOut
 *   - Data pipeline register: 1-cycle delay for horizontal flow
 *   - Both partial sums and data are registered (1 cycle per PE in each direction)
 */

export interface BlogCircuit {
  name: string;
  description: string;
  displayDsl: string;
  dsl: string;
  nodePositions?: Record<string, { x: number; y: number }>;
}

/** The PE definition used by all circuits — registered partial-sum output */
const PE_SYSTOLIC_DEFINITION = `circuit PE_Systolic {
  input dataIn: Bus[8]
  input weightIn: Bus[8]
  input partialSumIn: Bus[16]
  input weightValid: Bit
  input validIn: Bit
  clock clk
  output dataOut: Bus[8]
  output partialSumOut: Bus[16]
  output validOut: Bit

  impl {
    node weightReg: Register(width=8)
    node mult: Multiplier
    node adder: Adder(width=16)
    node psumReg: Register(width=16)
    node dataPipe: Register(width=8)
    node validPipe: DFlipFlop
    node one: Constant(value=1)
    node zero: Constant(value=0)

    // Weight register: latches weight when weightValid is high
    connect weightIn -> weightReg.data
    connect weightValid -> weightReg.we
    connect clk -> weightReg.clk

    // Multiply: dataIn × stored weight
    connect dataIn -> mult.a
    connect weightReg.q -> mult.b

    // Add: incoming partial sum + local product
    connect partialSumIn -> adder.a
    connect mult.product -> adder.b
    connect zero.out -> adder.carry_in

    // Registered partial-sum output (1-cycle delay, like real hardware)
    connect adder.sum -> psumReg.data
    connect one.out -> psumReg.we
    connect clk -> psumReg.clk
    connect psumReg.q -> partialSumOut

    // Data pipeline: 1-cycle delay for horizontal flow
    connect dataIn -> dataPipe.data
    connect one.out -> dataPipe.we
    connect clk -> dataPipe.clk
    connect dataPipe.q -> dataOut

    // Valid pipeline: propagates valid signal with data (same latency)
    connect validIn -> validPipe.d
    connect clk -> validPipe.clk
    connect validPipe.q -> validOut
  }
}`;

export const TPU_CIRCUITS: Record<string, BlogCircuit> = {
  /**
   * Section 1: Multiply-Add — the fundamental operation.
   * Purely combinational: partialSumIn + (data × weight) = result.
   * No accumulator, no clock. This is what one PE computes in a single step.
   */
  multiplyAdd: {
    name: "Multiply-Add Unit",
    description:
      "Multiply two numbers and add to a partial sum. The fundamental operation inside every PE.",
    displayDsl: `circuit MultiplyAdd {
  impl {
    node data: Input(value=3)
    node weight: Input(value=5)
    node partialSumIn: Input(value=10)

    node mult: Multiplier
    connect data.out -> mult.a
    connect weight.out -> mult.b

    node adder: Adder(width=16)
    node zero: Constant(value=0)
    connect partialSumIn.out -> adder.a
    connect mult.product -> adder.b
    connect zero.out -> adder.carry_in

    node result: HexDisplay
    connect adder.sum -> result.in
  }
}`,
    dsl: `
circuit MultiplyAdd {
  impl {
    node data: Input(value=3)
    node weight: Input(value=5)
    node partialSumIn: Input(value=10)

    node mult: Multiplier
    connect data.out -> mult.a
    connect weight.out -> mult.b

    node adder: Adder(width=16)
    node zero: Constant(value=0)
    connect partialSumIn.out -> adder.a
    connect mult.product -> adder.b
    connect zero.out -> adder.carry_in

    node result: HexDisplay
    connect adder.sum -> result.in
  }
}`,
    nodePositions: {
      // Inputs (left)
      data:          { x: 0,   y: 0 },
      weight:        { x: 0,   y: 120 },
      partialSumIn:  { x: 0,   y: 240 },
      // Processing (center)
      mult:          { x: 250, y: 40 },
      zero:          { x: 250, y: 240 },
      adder:         { x: 470, y: 100 },
      // Output (right)
      result:        { x: 680, y: 100 },
    },
  },

  /**
   * Section 2: Weight Register — latch once, hold fixed while data streams.
   * Shows: weight register with valid-bit gating + multiplier preview.
   * No pipeline register (that concept appears in the PE section).
   */
  weightRegister: {
    name: "Weight Register",
    description:
      "A register that stores a weight only when the valid signal is high. The weight stays fixed while data streams through.",
    displayDsl: `circuit WeightRegister {
  clock clk
  impl {
    node weightIn: Input(value=7)
    node weightValid: Switch
    node dataIn: Input(value=3)

    node weightReg: Register
    connect weightIn.out -> weightReg.data
    connect weightValid.out -> weightReg.we
    connect clk -> weightReg.clk

    node storedWeight: HexDisplay
    connect weightReg.q -> storedWeight.in

    node mult: Multiplier
    connect dataIn.out -> mult.a
    connect weightReg.q -> mult.b

    node product: HexDisplay
    connect mult.product -> product.in
  }
}`,
    dsl: `
circuit WeightRegister {
  clock clk
  impl {
    node weightIn: Input(value=7)
    node weightValid: Switch
    node dataIn: Input(value=3)

    node weightReg: Register
    connect weightIn.out -> weightReg.data
    connect weightValid.out -> weightReg.we
    connect clk -> weightReg.clk

    node storedWeight: HexDisplay
    connect weightReg.q -> storedWeight.in

    node mult: Multiplier
    connect dataIn.out -> mult.a
    connect weightReg.q -> mult.b

    node product: HexDisplay
    connect mult.product -> product.in
  }
}`,
    nodePositions: {
      // Inputs (left)
      weightIn:     { x: 0,   y: 0 },
      weightValid:  { x: 0,   y: 140 },
      dataIn:       { x: 0,   y: 280 },
      // Register (center)
      weightReg:    { x: 260, y: 40 },
      // Multiplier (center-right)
      mult:         { x: 260, y: 220 },
      // Outputs (right)
      storedWeight: { x: 500, y: 40 },
      product:      { x: 500, y: 220 },
    },
  },

  /**
   * Section 3: The Processing Element — the actual PE_Systolic design.
   * Weight register + multiplier + registered partial-sum adder + data pipeline.
   */
  processingElement: {
    name: "Processing Element",
    description:
      "A full PE with weight register, multiplier, registered partial-sum adder, and data pipeline. The building block of the systolic array.",
    displayDsl: `circuit TestPE {
  clock clk
  impl {
    node pe: PE_Systolic
    connect clk -> pe.clk

    node dataIn: Input(value=3)
    node weightIn: Input(value=5)
    node weightValid: Switch
    node partialSumIn: Input(value=0)

    connect dataIn.out -> pe.dataIn
    connect weightIn.out -> pe.weightIn
    connect weightValid.out -> pe.weightValid
    connect partialSumIn.out -> pe.partialSumIn

    node partialSumOut: HexDisplay
    node dataOut: HexDisplay
    connect pe.partialSumOut -> partialSumOut.in
    connect pe.dataOut -> dataOut.in
  }
}`,
    dsl: `
${PE_SYSTOLIC_DEFINITION}

circuit TestPE {
  clock clk
  impl {
    node pe: PE_Systolic
    connect clk -> pe.clk

    node dataIn: Input(value=3)
    node weightIn: Input(value=5)
    node weightValid: Switch
    node partialSumIn: Input(value=0)

    connect dataIn.out -> pe.dataIn
    connect weightIn.out -> pe.weightIn
    connect weightValid.out -> pe.weightValid
    connect partialSumIn.out -> pe.partialSumIn

    node partialSumOut: HexDisplay
    node dataOut: HexDisplay
    connect pe.partialSumOut -> partialSumOut.in
    connect pe.dataOut -> dataOut.in
  }
}`,
    nodePositions: {
      // Inputs (left)
      dataIn:        { x: 0,   y: 0 },
      weightIn:      { x: 0,   y: 120 },
      weightValid:   { x: 0,   y: 240 },
      partialSumIn:  { x: 0,   y: 350 },
      // PE (center)
      pe:            { x: 280, y: 100 },
      // Outputs (right)
      partialSumOut: { x: 540, y: 40 },
      dataOut:       { x: 540, y: 220 },
    },
  },

  /**
   * Section 4: Horizontal Data Flow — two PEs in a row.
   * Data flows left→right via pipeline registers. Each PE has its own weight
   * and computes partialSumIn + data×weight independently (partialSumIn=0 for each).
   */
  twoPERow: {
    name: "Two-PE Row",
    description:
      "Two PEs connected horizontally. Data flows left to right with a one-cycle delay between elements.",
    displayDsl: `circuit TwoPERow {
  clock clk
  impl {
    node pe0: PE_Systolic
    node pe1: PE_Systolic
    connect clk -> pe0.clk
    connect clk -> pe1.clk

    node data0: Input(value=2)
    node weight0: Input(value=3)
    node weight1: Input(value=5)
    node weightValid: Switch
    node zero16: Constant(value=0)

    connect data0.out -> pe0.dataIn
    connect pe0.dataOut -> pe1.dataIn

    connect weight0.out -> pe0.weightIn
    connect weight1.out -> pe1.weightIn
    connect weightValid.out -> pe0.weightValid
    connect weightValid.out -> pe1.weightValid
    connect zero16.out -> pe0.partialSumIn
    connect zero16.out -> pe1.partialSumIn

    node result0: HexDisplay
    node result1: HexDisplay
    connect pe0.partialSumOut -> result0.in
    connect pe1.partialSumOut -> result1.in
  }
}`,
    dsl: `
${PE_SYSTOLIC_DEFINITION}

circuit TwoPERow {
  clock clk
  impl {
    node pe0: PE_Systolic
    node pe1: PE_Systolic
    connect clk -> pe0.clk
    connect clk -> pe1.clk

    node data0: Input(value=2)
    node weight0: Input(value=3)
    node weight1: Input(value=5)
    node weightValid: Switch
    node zero16: Constant(value=0)

    connect data0.out -> pe0.dataIn
    connect pe0.dataOut -> pe1.dataIn

    connect weight0.out -> pe0.weightIn
    connect weight1.out -> pe1.weightIn
    connect weightValid.out -> pe0.weightValid
    connect weightValid.out -> pe1.weightValid
    connect zero16.out -> pe0.partialSumIn
    connect zero16.out -> pe1.partialSumIn

    node result0: HexDisplay
    node result1: HexDisplay
    connect pe0.partialSumOut -> result0.in
    connect pe1.partialSumOut -> result1.in
  }
}`,
    nodePositions: {
      // Inputs (left)
      data0:       { x: 0,   y: 0 },
      weight0:     { x: 0,   y: 120 },
      weight1:     { x: 0,   y: 240 },
      weightValid: { x: 0,   y: 360 },
      zero16:      { x: 200, y: 360 },
      // PEs (center)
      pe0:         { x: 280, y: 60 },
      pe1:         { x: 520, y: 60 },
      // Outputs (right)
      result0:     { x: 760, y: 0 },
      result1:     { x: 760, y: 160 },
    },
  },

  /**
   * Section 5: Vertical Partial-Sum Flow — two PEs in a column.
   * Partial sums flow top→bottom through registers (1 cycle per PE).
   * Both PEs receive the same data; PE0 computes data×weight0 (registered),
   * PE1 adds data×weight1 to the delayed partial sum. The bottom PE's
   * output is the full dot product, available one cycle after the top PE.
   */
  twoPEColumn: {
    name: "Two-PE Column",
    description:
      "Two PEs stacked vertically. Partial sums flow down through registers — one PE per clock cycle, just like real hardware.",
    displayDsl: `circuit TwoPEColumn {
  clock clk
  impl {
    node pe0: PE_Systolic
    node pe1: PE_Systolic
    connect clk -> pe0.clk
    connect clk -> pe1.clk

    node dataIn: Input(value=4)
    node weight0: Input(value=3)
    node weight1: Input(value=5)
    node weightValid: Switch
    node zero16: Constant(value=0)

    connect dataIn.out -> pe0.dataIn
    connect dataIn.out -> pe1.dataIn

    connect weight0.out -> pe0.weightIn
    connect weight1.out -> pe1.weightIn
    connect weightValid.out -> pe0.weightValid
    connect weightValid.out -> pe1.weightValid

    connect zero16.out -> pe0.partialSumIn
    connect pe0.partialSumOut -> pe1.partialSumIn

    node topResult: HexDisplay
    node bottomResult: HexDisplay
    connect pe0.partialSumOut -> topResult.in
    connect pe1.partialSumOut -> bottomResult.in
  }
}`,
    dsl: `
${PE_SYSTOLIC_DEFINITION}

circuit TwoPEColumn {
  clock clk
  impl {
    node pe0: PE_Systolic
    node pe1: PE_Systolic
    connect clk -> pe0.clk
    connect clk -> pe1.clk

    node dataIn: Input(value=4)
    node weight0: Input(value=3)
    node weight1: Input(value=5)
    node weightValid: Switch
    node zero16: Constant(value=0)

    connect dataIn.out -> pe0.dataIn
    connect dataIn.out -> pe1.dataIn

    connect weight0.out -> pe0.weightIn
    connect weight1.out -> pe1.weightIn
    connect weightValid.out -> pe0.weightValid
    connect weightValid.out -> pe1.weightValid

    connect zero16.out -> pe0.partialSumIn
    connect pe0.partialSumOut -> pe1.partialSumIn

    node topResult: HexDisplay
    node bottomResult: HexDisplay
    connect pe0.partialSumOut -> topResult.in
    connect pe1.partialSumOut -> bottomResult.in
  }
}`,
    nodePositions: {
      // Inputs (left)
      dataIn:       { x: 0,   y: 120 },
      weight0:      { x: 0,   y: 0 },
      weight1:      { x: 0,   y: 280 },
      weightValid:  { x: 0,   y: 400 },
      zero16:       { x: 200, y: 400 },
      // PEs (center, stacked vertically)
      pe0:          { x: 300, y: 20 },
      pe1:          { x: 300, y: 260 },
      // Outputs (right)
      topResult:    { x: 560, y: 20 },
      bottomResult: { x: 560, y: 260 },
    },
  },

  /**
   * Section 6: Wavefront Controller — unchanged.
   */
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
    nodePositions: {
      // Control (left)
      enable:   { x: 0,   y: 100 },
      // Phase register + increment (center-left)
      phase:    { x: 200, y: 100 },
      inc:      { x: 200, y: 0 },
      phaseMux: { x: 200, y: 230 },
      one:      { x: 60,  y: 230 },
      // Constants (center)
      zero:     { x: 420, y: 0 },
      const1:   { x: 420, y: 80 },
      const2:   { x: 420, y: 160 },
      const3:   { x: 420, y: 240 },
      // Comparators (center-right)
      isPhase0: { x: 580, y: 0 },
      isPhase1: { x: 580, y: 80 },
      isPhase2: { x: 580, y: 160 },
      isPhase3: { x: 580, y: 240 },
      // LEDs (right)
      led0:     { x: 760, y: 0 },
      led1:     { x: 760, y: 80 },
      led2:     { x: 760, y: 160 },
      led3:     { x: 760, y: 240 },
      // Display (bottom-right)
      display:  { x: 760, y: 340 },
    },
  },
};

/**
 * 2x2 systolic array with registered partial-sum flow.
 *
 * With registered psumOut, partial sums take 1 cycle per PE vertically.
 * Data injection is staggered: row r starts at cycle 1+r.
 * C[k][j] emerges at PE(N-1,j) on cycle k+j+N+1 (N=2).
 * Total: 3N = 6 ticks for N=2.
 */
export const SYSTOLIC_2X2_DSL = `
${PE_SYSTOLIC_DEFINITION}

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
    node five: Constant(value=5)
    node six: Constant(value=6)

    // ===== Cycle Counter (0..6, stops at 6) =====
    node counter: Register(initial=0)
    node counterInc: Incrementer
    node counterMux: Mux
    node notDone: Comparator
    node shouldAdvance: And

    connect counter.q -> counterInc.in
    connect counter.q -> notDone.a
    connect six.out -> notDone.b
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
    node isCycle4: Comparator
    node isCycle5: Comparator
    connect counter.q -> isCycle0.a
    connect zero.out -> isCycle0.b
    connect counter.q -> isCycle1.a
    connect one.out -> isCycle1.b
    connect counter.q -> isCycle2.a
    connect two.out -> isCycle2.b
    connect counter.q -> isCycle3.a
    connect three.out -> isCycle3.b
    connect counter.q -> isCycle4.a
    connect four.out -> isCycle4.b
    connect counter.q -> isCycle5.a
    connect five.out -> isCycle5.b

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

    // ===== Data Injection (staggered: row r starts at cycle 1+r) =====
    // Row 0: cycle 1 -> A[0][0], cycle 2 -> A[1][0], else 0
    node muxR0a: Mux
    node muxR0b: Mux
    connect isCycle1.eq -> muxR0a.sel
    connect zero.out -> muxR0a.in0
    connect a00 -> muxR0a.in1
    connect isCycle2.eq -> muxR0b.sel
    connect muxR0a.out -> muxR0b.in0
    connect a10 -> muxR0b.in1

    // Row 1: cycle 2 -> A[0][1], cycle 3 -> A[1][1], else 0
    node muxR1a: Mux
    node muxR1b: Mux
    connect isCycle2.eq -> muxR1a.sel
    connect zero.out -> muxR1a.in0
    connect a01 -> muxR1a.in1
    connect isCycle3.eq -> muxR1b.sel
    connect muxR1a.out -> muxR1b.in0
    connect a11 -> muxR1b.in1

    // ===== Horizontal Data Flow (left -> right) =====
    connect muxR0b.out -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn
    connect muxR1b.out -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn

    // ===== Vertical Partial-Sum Flow (top -> bottom, registered) =====
    connect zero.out -> pe00.partialSumIn
    connect zero.out -> pe01.partialSumIn
    connect pe00.partialSumOut -> pe10.partialSumIn
    connect pe01.partialSumOut -> pe11.partialSumIn

    // ===== Result Registers =====
    // C[k][j] at PE(1,j) on cycle k+j+3

    // C[0][0] at PE(1,0) cycle 3
    node result_c00: Register
    connect pe10.partialSumOut -> result_c00.data
    connect isCycle3.eq -> result_c00.we
    connect clk -> result_c00.clk

    // C[1][0] at PE(1,0) cycle 4
    node result_c10: Register
    connect pe10.partialSumOut -> result_c10.data
    connect isCycle4.eq -> result_c10.we
    connect clk -> result_c10.clk

    // C[0][1] at PE(1,1) cycle 4
    node result_c01: Register
    connect pe11.partialSumOut -> result_c01.data
    connect isCycle4.eq -> result_c01.we
    connect clk -> result_c01.clk

    // C[1][1] at PE(1,1) cycle 5
    node result_c11: Register
    connect pe11.partialSumOut -> result_c11.data
    connect isCycle5.eq -> result_c11.we
    connect clk -> result_c11.clk

    // ===== Outputs =====
    connect result_c00.q -> c00
    connect result_c01.q -> c01
    connect result_c10.q -> c10
    connect result_c11.q -> c11

    // Done = counter reached 6 (one cycle after last result captured at cycle 5)
    node isDone: Comparator
    connect counter.q -> isDone.a
    connect six.out -> isDone.b
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

/** Backwards-compat alias */
export const SYSTOLIC_DSL = SYSTOLIC_2X2_DSL;

/**
 * Full 3x3 systolic array: PE_Systolic + Systolic3x3 + TestSystolic3x3
 *
 * Architecture: weight-stationary with registered partial-sum flow.
 * - Cycle 0: load all 9 weights into PEs
 * - Staggered data injection: row r starts at cycle 1+r
 * - Valid signals propagate through PE pipeline alongside data
 * - Result registers latch when valid arrives at bottom PE
 * - Per-column valid counter distinguishes C[0][j] vs C[1][j] vs C[2][j]
 * - No global cycle-number assumptions for result timing
 *
 * This design is correct for both DSL simulation and Verilog synthesis.
 *
 * Test: A=[[1,2,3],[4,5,6],[7,8,9]] × B=[[2,0,1],[0,2,0],[1,0,2]]
 * Expected C = [[5,4,7],[14,10,16],[23,16,25]]
 */
export const SYSTOLIC_3X3_DSL = `
${PE_SYSTOLIC_DEFINITION}

circuit Systolic3x3 {
  input a00: Bus[8]
  input a01: Bus[8]
  input a02: Bus[8]
  input a10: Bus[8]
  input a11: Bus[8]
  input a12: Bus[8]
  input a20: Bus[8]
  input a21: Bus[8]
  input a22: Bus[8]
  input b00: Bus[8]
  input b01: Bus[8]
  input b02: Bus[8]
  input b10: Bus[8]
  input b11: Bus[8]
  input b12: Bus[8]
  input b20: Bus[8]
  input b21: Bus[8]
  input b22: Bus[8]
  input start: Bit
  clock clk
  output c00: Bus[16]
  output c01: Bus[16]
  output c02: Bus[16]
  output c10: Bus[16]
  output c11: Bus[16]
  output c12: Bus[16]
  output c20: Bus[16]
  output c21: Bus[16]
  output c22: Bus[16]
  output done: Bit

  impl {
    // ===== Processing Elements (3x3 grid) =====
    node pe00: PE_Systolic
    node pe01: PE_Systolic
    node pe02: PE_Systolic
    node pe10: PE_Systolic
    node pe11: PE_Systolic
    node pe12: PE_Systolic
    node pe20: PE_Systolic
    node pe21: PE_Systolic
    node pe22: PE_Systolic
    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe02.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk
    connect clk -> pe12.clk
    connect clk -> pe20.clk
    connect clk -> pe21.clk
    connect clk -> pe22.clk

    // ===== Constants =====
    // zero is 16-bit: feeds both 8-bit counter comparisons and 16-bit partialSumIn
    node zero: Constant(value=0, width=16)
    node one: Constant(value=1, width=8)
    node two: Constant(value=2, width=8)
    node three: Constant(value=3, width=8)
    node four: Constant(value=4, width=8)
    node five: Constant(value=5, width=8)
    node nine: Constant(value=9, width=8)

    // ===== Cycle Counter (0..9, stops at 9) =====
    node counter: Register(initial=0)
    node counterInc: Incrementer
    node counterMux: Mux
    node notDone: Comparator
    node shouldAdvance: And

    // notDone uses counter.q (not counterMux.out) to avoid combinational loop
    connect counter.q -> counterInc.in
    connect counter.q -> notDone.a
    connect nine.out -> notDone.b
    connect start -> shouldAdvance.a
    connect notDone.lt -> shouldAdvance.b
    connect shouldAdvance.out -> counterMux.sel
    connect counter.q -> counterMux.in0
    connect counterInc.out -> counterMux.in1
    connect counterMux.out -> counter.data
    connect one.out -> counter.we
    connect clk -> counter.clk

    // ===== Cycle Decoder (all use counter.q) =====
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
    connect b02 -> pe02.weightIn
    connect b10 -> pe10.weightIn
    connect b11 -> pe11.weightIn
    connect b12 -> pe12.weightIn
    connect b20 -> pe20.weightIn
    connect b21 -> pe21.weightIn
    connect b22 -> pe22.weightIn
    connect loadWeights.out -> pe00.weightValid
    connect loadWeights.out -> pe01.weightValid
    connect loadWeights.out -> pe02.weightValid
    connect loadWeights.out -> pe10.weightValid
    connect loadWeights.out -> pe11.weightValid
    connect loadWeights.out -> pe12.weightValid
    connect loadWeights.out -> pe20.weightValid
    connect loadWeights.out -> pe21.weightValid
    connect loadWeights.out -> pe22.weightValid

    // ===== Data Injection (staggered: row r starts at cycle 1+r) =====
    // Row 0: cycle 1 -> A[0][0], cycle 2 -> A[1][0], cycle 3 -> A[2][0]
    node muxR0a: Mux
    node muxR0b: Mux
    node muxR0c: Mux
    connect isCycle1.eq -> muxR0a.sel
    connect zero.out -> muxR0a.in0
    connect a00 -> muxR0a.in1
    connect isCycle2.eq -> muxR0b.sel
    connect muxR0a.out -> muxR0b.in0
    connect a10 -> muxR0b.in1
    connect isCycle3.eq -> muxR0c.sel
    connect muxR0b.out -> muxR0c.in0
    connect a20 -> muxR0c.in1

    // Row 1: cycle 2 -> A[0][1], cycle 3 -> A[1][1], cycle 4 -> A[2][1]
    node muxR1a: Mux
    node muxR1b: Mux
    node muxR1c: Mux
    connect isCycle2.eq -> muxR1a.sel
    connect zero.out -> muxR1a.in0
    connect a01 -> muxR1a.in1
    connect isCycle3.eq -> muxR1b.sel
    connect muxR1a.out -> muxR1b.in0
    connect a11 -> muxR1b.in1
    connect isCycle4.eq -> muxR1c.sel
    connect muxR1b.out -> muxR1c.in0
    connect a21 -> muxR1c.in1

    // Row 2: cycle 3 -> A[0][2], cycle 4 -> A[1][2], cycle 5 -> A[2][2]
    node muxR2a: Mux
    node muxR2b: Mux
    node muxR2c: Mux
    connect isCycle3.eq -> muxR2a.sel
    connect zero.out -> muxR2a.in0
    connect a02 -> muxR2a.in1
    connect isCycle4.eq -> muxR2b.sel
    connect muxR2a.out -> muxR2b.in0
    connect a12 -> muxR2b.in1
    connect isCycle5.eq -> muxR2c.sel
    connect muxR2b.out -> muxR2c.in0
    connect a22 -> muxR2c.in1

    // ===== Valid Signal Injection (active when data is being injected) =====
    // Row 0: valid during cycles 1, 2, 3
    node r0validA: Or
    node r0valid: Or
    connect isCycle1.eq -> r0validA.a
    connect isCycle2.eq -> r0validA.b
    connect r0validA.out -> r0valid.a
    connect isCycle3.eq -> r0valid.b

    // Row 1: valid during cycles 2, 3, 4 (staggered by 1)
    node isCycle4: Comparator
    connect counter.q -> isCycle4.a
    connect four.out -> isCycle4.b
    node r1validA: Or
    node r1valid: Or
    connect isCycle2.eq -> r1validA.a
    connect isCycle3.eq -> r1validA.b
    connect r1validA.out -> r1valid.a
    connect isCycle4.eq -> r1valid.b

    // Row 2: valid during cycles 3, 4, 5 (staggered by 2)
    node isCycle5: Comparator
    connect counter.q -> isCycle5.a
    connect five.out -> isCycle5.b
    node r2validA: Or
    node r2valid: Or
    connect isCycle3.eq -> r2validA.a
    connect isCycle4.eq -> r2validA.b
    connect r2validA.out -> r2valid.a
    connect isCycle5.eq -> r2valid.b

    // ===== Horizontal Data Flow (left -> right) =====
    connect muxR0c.out -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn
    connect pe01.dataOut -> pe02.dataIn
    connect muxR1c.out -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn
    connect pe11.dataOut -> pe12.dataIn
    connect muxR2c.out -> pe20.dataIn
    connect pe20.dataOut -> pe21.dataIn
    connect pe21.dataOut -> pe22.dataIn

    // ===== Valid Signal Flow (left -> right, through PE pipeline) =====
    connect r0valid.out -> pe00.validIn
    connect pe00.validOut -> pe01.validIn
    connect pe01.validOut -> pe02.validIn
    connect r1valid.out -> pe10.validIn
    connect pe10.validOut -> pe11.validIn
    connect pe11.validOut -> pe12.validIn
    connect r2valid.out -> pe20.validIn
    connect pe20.validOut -> pe21.validIn
    connect pe21.validOut -> pe22.validIn

    // ===== Vertical Partial-Sum Flow (top -> bottom) =====
    connect zero.out -> pe00.partialSumIn
    connect zero.out -> pe01.partialSumIn
    connect zero.out -> pe02.partialSumIn
    connect pe00.partialSumOut -> pe10.partialSumIn
    connect pe01.partialSumOut -> pe11.partialSumIn
    connect pe02.partialSumOut -> pe12.partialSumIn
    connect pe10.partialSumOut -> pe20.partialSumIn
    connect pe11.partialSumOut -> pe21.partialSumIn
    connect pe12.partialSumOut -> pe22.partialSumIn

    // ===== Result Capture (pipeline-aligned valid + counter) =====
    // Key hardware rule: valid signals and counters must be in the same
    // pipeline stage before they interact. We register both the valid
    // and the partial sum from the bottom PE, so the control decision
    // (valid_d AND counter comparison) uses values from the same snapshot.
    //
    // Pipeline: pe20.validOut → valid_d (registered) → c00we = valid_d AND (count == 0)
    //           pe20.psumOut  → psum_d  (registered) → result_c00.data
    //           col0count incremented by validOut (undelayed) on previous cycle
    //
    // This ensures both valid_d and col0count.q reflect the same clock domain.

    // --- Column 0: PE(2,0) ---
    // Register valid and psum to align pipeline stages
    node col0validD: DFlipFlop
    connect pe20.validOut -> col0validD.d
    connect clk -> col0validD.clk
    node col0psumD: Register
    connect pe20.partialSumOut -> col0psumD.data
    connect one.out -> col0psumD.we
    connect clk -> col0psumD.clk

    // Counter: incremented by UNDELAYED validOut (so count is ready next cycle)
    node col0count: Register(initial=0)
    node col0countInc: Incrementer
    connect col0count.q -> col0countInc.in
    connect col0countInc.out -> col0count.data
    connect pe20.validOut -> col0count.we
    connect clk -> col0count.clk

    // Classify using DELAYED valid + CURRENT counter (same pipeline stage)
    node col0is0: Comparator
    node col0is1: Comparator
    node col0is2: Comparator
    connect col0count.q -> col0is0.a
    connect one.out -> col0is0.b
    connect col0count.q -> col0is1.a
    connect two.out -> col0is1.b
    connect col0count.q -> col0is2.a
    connect three.out -> col0is2.b

    node c00we: And
    connect col0validD.q -> c00we.a
    connect col0is0.eq -> c00we.b
    node result_c00: Register
    connect col0psumD.q -> result_c00.data
    connect c00we.out -> result_c00.we
    connect clk -> result_c00.clk

    node c10we: And
    connect col0validD.q -> c10we.a
    connect col0is1.eq -> c10we.b
    node result_c10: Register
    connect col0psumD.q -> result_c10.data
    connect c10we.out -> result_c10.we
    connect clk -> result_c10.clk

    node c20we: And
    connect col0validD.q -> c20we.a
    connect col0is2.eq -> c20we.b
    node result_c20: Register
    connect col0psumD.q -> result_c20.data
    connect c20we.out -> result_c20.we
    connect clk -> result_c20.clk

    // --- Column 1: PE(2,1) ---
    node col1validD: DFlipFlop
    connect pe21.validOut -> col1validD.d
    connect clk -> col1validD.clk
    node col1psumD: Register
    connect pe21.partialSumOut -> col1psumD.data
    connect one.out -> col1psumD.we
    connect clk -> col1psumD.clk

    node col1count: Register(initial=0)
    node col1countInc: Incrementer
    connect col1count.q -> col1countInc.in
    connect col1countInc.out -> col1count.data
    connect pe21.validOut -> col1count.we
    connect clk -> col1count.clk

    node col1is0: Comparator
    node col1is1: Comparator
    node col1is2: Comparator
    connect col1count.q -> col1is0.a
    connect one.out -> col1is0.b
    connect col1count.q -> col1is1.a
    connect two.out -> col1is1.b
    connect col1count.q -> col1is2.a
    connect three.out -> col1is2.b

    node c01we: And
    connect col1validD.q -> c01we.a
    connect col1is0.eq -> c01we.b
    node result_c01: Register
    connect col1psumD.q -> result_c01.data
    connect c01we.out -> result_c01.we
    connect clk -> result_c01.clk

    node c11we: And
    connect col1validD.q -> c11we.a
    connect col1is1.eq -> c11we.b
    node result_c11: Register
    connect col1psumD.q -> result_c11.data
    connect c11we.out -> result_c11.we
    connect clk -> result_c11.clk

    node c21we: And
    connect col1validD.q -> c21we.a
    connect col1is2.eq -> c21we.b
    node result_c21: Register
    connect col1psumD.q -> result_c21.data
    connect c21we.out -> result_c21.we
    connect clk -> result_c21.clk

    // --- Column 2: PE(2,2) ---
    node col2validD: DFlipFlop
    connect pe22.validOut -> col2validD.d
    connect clk -> col2validD.clk
    node col2psumD: Register
    connect pe22.partialSumOut -> col2psumD.data
    connect one.out -> col2psumD.we
    connect clk -> col2psumD.clk

    node col2count: Register(initial=0)
    node col2countInc: Incrementer
    connect col2count.q -> col2countInc.in
    connect col2countInc.out -> col2count.data
    connect pe22.validOut -> col2count.we
    connect clk -> col2count.clk

    node col2is0: Comparator
    node col2is1: Comparator
    node col2is2: Comparator
    connect col2count.q -> col2is0.a
    connect one.out -> col2is0.b
    connect col2count.q -> col2is1.a
    connect two.out -> col2is1.b
    connect col2count.q -> col2is2.a
    connect three.out -> col2is2.b

    node c02we: And
    connect col2validD.q -> c02we.a
    connect col2is0.eq -> c02we.b
    node result_c02: Register
    connect col2psumD.q -> result_c02.data
    connect c02we.out -> result_c02.we
    connect clk -> result_c02.clk

    node c12we: And
    connect col2validD.q -> c12we.a
    connect col2is1.eq -> c12we.b
    node result_c12: Register
    connect col2psumD.q -> result_c12.data
    connect c12we.out -> result_c12.we
    connect clk -> result_c12.clk

    node c22we: And
    connect col2validD.q -> c22we.a
    connect col2is2.eq -> c22we.b
    node result_c22: Register
    connect col2psumD.q -> result_c22.data
    connect c22we.out -> result_c22.we
    connect clk -> result_c22.clk

    // ===== Outputs =====
    connect result_c00.q -> c00
    connect result_c01.q -> c01
    connect result_c02.q -> c02
    connect result_c10.q -> c10
    connect result_c11.q -> c11
    connect result_c12.q -> c12
    connect result_c20.q -> c20
    connect result_c21.q -> c21
    connect result_c22.q -> c22

    // Done: registered — fires one cycle AFTER all results are captured.
    // This is standard hardware practice: status signals are registered
    // so consumers are guaranteed all data outputs are stable when done=1.
    node col0done: Comparator
    node col1done: Comparator
    node col2done: Comparator
    connect col0count.q -> col0done.a
    connect three.out -> col0done.b
    connect col1count.q -> col1done.a
    connect three.out -> col1done.b
    connect col2count.q -> col2done.a
    connect three.out -> col2done.b
    node doneAnd1: And
    node doneAnd2: And
    connect col0done.eq -> doneAnd1.a
    connect col1done.eq -> doneAnd1.b
    connect doneAnd1.out -> doneAnd2.a
    connect col2done.eq -> doneAnd2.b
    // Register the done signal — guarantees all result registers are stable
    node doneReg: DFlipFlop
    connect doneAnd2.out -> doneReg.d
    connect clk -> doneReg.clk
    connect doneReg.q -> done
  }
}

circuit TestSystolic3x3 {
  clock clk
  impl {
    node sys: Systolic3x3

    // Matrix A = [[1,2,3],[4,5,6],[7,8,9]]
    node a00: Input(value=1)
    node a01: Input(value=2)
    node a02: Input(value=3)
    node a10: Input(value=4)
    node a11: Input(value=5)
    node a12: Input(value=6)
    node a20: Input(value=7)
    node a21: Input(value=8)
    node a22: Input(value=9)

    // Matrix B = [[2,0,1],[0,2,0],[1,0,2]]
    node b00: Input(value=2)
    node b01: Input(value=0)
    node b02: Input(value=1)
    node b10: Input(value=0)
    node b11: Input(value=2)
    node b12: Input(value=0)
    node b20: Input(value=1)
    node b21: Input(value=0)
    node b22: Input(value=2)

    node start: Switch

    connect a00.out -> sys.a00
    connect a01.out -> sys.a01
    connect a02.out -> sys.a02
    connect a10.out -> sys.a10
    connect a11.out -> sys.a11
    connect a12.out -> sys.a12
    connect a20.out -> sys.a20
    connect a21.out -> sys.a21
    connect a22.out -> sys.a22
    connect b00.out -> sys.b00
    connect b01.out -> sys.b01
    connect b02.out -> sys.b02
    connect b10.out -> sys.b10
    connect b11.out -> sys.b11
    connect b12.out -> sys.b12
    connect b20.out -> sys.b20
    connect b21.out -> sys.b21
    connect b22.out -> sys.b22

    connect start.out -> sys.start
    connect clk -> sys.clk

    node display_c00: HexDisplay
    node display_c01: HexDisplay
    node display_c02: HexDisplay
    node display_c10: HexDisplay
    node display_c11: HexDisplay
    node display_c12: HexDisplay
    node display_c20: HexDisplay
    node display_c21: HexDisplay
    node display_c22: HexDisplay
    node done_led: Led

    connect sys.c00 -> display_c00.in
    connect sys.c01 -> display_c01.in
    connect sys.c02 -> display_c02.in
    connect sys.c10 -> display_c10.in
    connect sys.c11 -> display_c11.in
    connect sys.c12 -> display_c12.in
    connect sys.c20 -> display_c20.in
    connect sys.c21 -> display_c21.in
    connect sys.c22 -> display_c22.in
    connect sys.done -> done_led.in
  }
}
`;
