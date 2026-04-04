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
const PE_SYSTOLIC_DEFINITION = `
const PE_Systolic = component('PE_Systolic')
  .in('dataIn', bus(8))
  .in('weightIn', bus(8))
  .in('partialSumIn', bus(16))
  .in('weightValid', bit)
  .in('validIn', bit)
  .out('dataOut', bus(8))
  .out('partialSumOut', bus(16))
  .out('validOut', bit)
  .node('weightReg', Register, { width: 8 })
  .node('mult', Multiplier)
  .node('adder', Adder, { width: 16 })
  .node('psumReg', Register, { width: 16 })
  .node('dataPipe', Register, { width: 8 })
  .node('validPipe', DFlipFlop)
  .node('one', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .connect(({ in: inp, out, weightReg, mult, adder, psumReg, dataPipe, validPipe, one, zero }) => [
    inp.weightIn.to(weightReg.data),
    inp.weightValid.to(weightReg.we),
    inp.dataIn.to(mult.a, dataPipe.data),
    weightReg.q.to(mult.b),
    inp.partialSumIn.to(adder.a),
    mult.product.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(psumReg.data),
    one.out.to(psumReg.we, dataPipe.we),
    psumReg.q.to(out.partialSumOut),
    dataPipe.q.to(out.dataOut),
    inp.validIn.to(validPipe.d),
    validPipe.q.to(out.validOut),
  ])
  .build()
`;

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
    displayDsl: `
const MultiplyAdd = component('MultiplyAdd')
  .node('data', Input, { value: 3 })
  .node('weight', Input, { value: 5 })
  .node('partialSumIn', Input, { value: 10 })
  .node('mult', Multiplier)
  .node('adder', Adder, { width: 16 })
  .node('zero', Constant, { value: 0 })
  .node('result', HexDisplay)
  .connect(({ in: inp, out, data, weight, partialSumIn, mult, adder, zero, result }) => [
    data.out.to(mult.a),
    weight.out.to(mult.b),
    partialSumIn.out.to(adder.a),
    mult.product.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(result.in),
  ])
  .build()
`,
    dsl: `
const MultiplyAdd = component('MultiplyAdd')
  .node('data', Input, { value: 3 })
  .node('weight', Input, { value: 5 })
  .node('partialSumIn', Input, { value: 10 })
  .node('mult', Multiplier)
  .node('adder', Adder, { width: 16 })
  .node('zero', Constant, { value: 0 })
  .node('result', HexDisplay)
  .connect(({ in: inp, out, data, weight, partialSumIn, mult, adder, zero, result }) => [
    data.out.to(mult.a),
    weight.out.to(mult.b),
    partialSumIn.out.to(adder.a),
    mult.product.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(result.in),
  ])
  .build()
`,
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
    displayDsl: `
const WeightRegister = component('WeightRegister')
  .node('weightIn', Input, { value: 7 })
  .node('weightValid', Switch)
  .node('dataIn', Input, { value: 3 })
  .node('weightReg', Register)
  .node('storedWeight', HexDisplay)
  .node('mult', Multiplier)
  .node('product', HexDisplay)
  .connect(({ in: inp, out, weightIn, weightValid, dataIn, weightReg, storedWeight, mult, product }) => [
    weightIn.out.to(weightReg.data),
    weightValid.out.to(weightReg.we),
    weightReg.q.to(storedWeight.in, mult.b),
    dataIn.out.to(mult.a),
    mult.product.to(product.in),
  ])
  .build()
`,
    dsl: `
const WeightRegister = component('WeightRegister')
  .node('weightIn', Input, { value: 7 })
  .node('weightValid', Switch)
  .node('dataIn', Input, { value: 3 })
  .node('weightReg', Register)
  .node('storedWeight', HexDisplay)
  .node('mult', Multiplier)
  .node('product', HexDisplay)
  .connect(({ in: inp, out, weightIn, weightValid, dataIn, weightReg, storedWeight, mult, product }) => [
    weightIn.out.to(weightReg.data),
    weightValid.out.to(weightReg.we),
    weightReg.q.to(storedWeight.in, mult.b),
    dataIn.out.to(mult.a),
    mult.product.to(product.in),
  ])
  .build()
`,
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
    displayDsl: `
const TestPE = component('TestPE')
  .node('pe', PE_Systolic)
  .node('dataIn', Input, { value: 3 })
  .node('weightIn', Input, { value: 5 })
  .node('weightValid', Switch)
  .node('partialSumIn', Input, { value: 0 })
  .node('partialSumOut', HexDisplay)
  .node('dataOut', HexDisplay)
  .connect(({ in: inp, out, pe, dataIn, weightIn, weightValid, partialSumIn, partialSumOut, dataOut }) => [
    dataIn.out.to(pe.dataIn),
    weightIn.out.to(pe.weightIn),
    weightValid.out.to(pe.weightValid),
    partialSumIn.out.to(pe.partialSumIn),
    pe.partialSumOut.to(partialSumOut.in),
    pe.dataOut.to(dataOut.in),
  ])
  .build()
`,
    dsl: `
${PE_SYSTOLIC_DEFINITION}

const TestPE = component('TestPE')
  .node('pe', PE_Systolic)
  .node('dataIn', Input, { value: 3 })
  .node('weightIn', Input, { value: 5 })
  .node('weightValid', Switch)
  .node('partialSumIn', Input, { value: 0 })
  .node('partialSumOut', HexDisplay)
  .node('dataOut', HexDisplay)
  .connect(({ in: inp, out, pe, dataIn, weightIn, weightValid, partialSumIn, partialSumOut, dataOut }) => [
    dataIn.out.to(pe.dataIn),
    weightIn.out.to(pe.weightIn),
    weightValid.out.to(pe.weightValid),
    partialSumIn.out.to(pe.partialSumIn),
    pe.partialSumOut.to(partialSumOut.in),
    pe.dataOut.to(dataOut.in),
  ])
  .build()
`,
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
    displayDsl: `
const TwoPERow = component('TwoPERow')
  .node('pe0', PE_Systolic)
  .node('pe1', PE_Systolic)
  .node('data0', Input, { value: 2 })
  .node('weight0', Input, { value: 3 })
  .node('weight1', Input, { value: 5 })
  .node('weightValid', Switch)
  .node('zero16', Constant, { value: 0 })
  .node('result0', HexDisplay)
  .node('result1', HexDisplay)
  .connect(({ in: inp, out, pe0, pe1, data0, weight0, weight1, weightValid, zero16, result0, result1 }) => [
    data0.out.to(pe0.dataIn),
    pe0.dataOut.to(pe1.dataIn),
    weight0.out.to(pe0.weightIn),
    weight1.out.to(pe1.weightIn),
    weightValid.out.to(pe0.weightValid, pe1.weightValid),
    zero16.out.to(pe0.partialSumIn, pe1.partialSumIn),
    pe0.partialSumOut.to(result0.in),
    pe1.partialSumOut.to(result1.in),
  ])
  .build()
`,
    dsl: `
${PE_SYSTOLIC_DEFINITION}

const TwoPERow = component('TwoPERow')
  .node('pe0', PE_Systolic)
  .node('pe1', PE_Systolic)
  .node('data0', Input, { value: 2 })
  .node('weight0', Input, { value: 3 })
  .node('weight1', Input, { value: 5 })
  .node('weightValid', Switch)
  .node('zero16', Constant, { value: 0 })
  .node('result0', HexDisplay)
  .node('result1', HexDisplay)
  .connect(({ in: inp, out, pe0, pe1, data0, weight0, weight1, weightValid, zero16, result0, result1 }) => [
    data0.out.to(pe0.dataIn),
    pe0.dataOut.to(pe1.dataIn),
    weight0.out.to(pe0.weightIn),
    weight1.out.to(pe1.weightIn),
    weightValid.out.to(pe0.weightValid, pe1.weightValid),
    zero16.out.to(pe0.partialSumIn, pe1.partialSumIn),
    pe0.partialSumOut.to(result0.in),
    pe1.partialSumOut.to(result1.in),
  ])
  .build()
`,
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
    displayDsl: `
const TwoPEColumn = component('TwoPEColumn')
  .node('pe0', PE_Systolic)
  .node('pe1', PE_Systolic)
  .node('dataIn', Input, { value: 4 })
  .node('weight0', Input, { value: 3 })
  .node('weight1', Input, { value: 5 })
  .node('weightValid', Switch)
  .node('zero16', Constant, { value: 0 })
  .node('topResult', HexDisplay)
  .node('bottomResult', HexDisplay)
  .connect(({ in: inp, out, pe0, pe1, dataIn, weight0, weight1, weightValid, zero16, topResult, bottomResult }) => [
    dataIn.out.to(pe0.dataIn, pe1.dataIn),
    weight0.out.to(pe0.weightIn),
    weight1.out.to(pe1.weightIn),
    weightValid.out.to(pe0.weightValid, pe1.weightValid),
    zero16.out.to(pe0.partialSumIn),
    pe0.partialSumOut.to(pe1.partialSumIn, topResult.in),
    pe1.partialSumOut.to(bottomResult.in),
  ])
  .build()
`,
    dsl: `
${PE_SYSTOLIC_DEFINITION}

const TwoPEColumn = component('TwoPEColumn')
  .node('pe0', PE_Systolic)
  .node('pe1', PE_Systolic)
  .node('dataIn', Input, { value: 4 })
  .node('weight0', Input, { value: 3 })
  .node('weight1', Input, { value: 5 })
  .node('weightValid', Switch)
  .node('zero16', Constant, { value: 0 })
  .node('topResult', HexDisplay)
  .node('bottomResult', HexDisplay)
  .connect(({ in: inp, out, pe0, pe1, dataIn, weight0, weight1, weightValid, zero16, topResult, bottomResult }) => [
    dataIn.out.to(pe0.dataIn, pe1.dataIn),
    weight0.out.to(pe0.weightIn),
    weight1.out.to(pe1.weightIn),
    weightValid.out.to(pe0.weightValid, pe1.weightValid),
    zero16.out.to(pe0.partialSumIn),
    pe0.partialSumOut.to(pe1.partialSumIn, topResult.in),
    pe1.partialSumOut.to(bottomResult.in),
  ])
  .build()
`,
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
    displayDsl: `
const WavefrontController = component('WavefrontController')
  .node('phase', Register, { initial: 0 })
  .node('enable', Switch)
  .node('inc', Incrementer)
  .node('phaseMux', Mux)
  .node('one', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .node('const1', Constant, { value: 1 })
  .node('const2', Constant, { value: 2 })
  .node('const3', Constant, { value: 3 })
  .node('isPhase0', Comparator)
  .node('isPhase1', Comparator)
  .node('isPhase2', Comparator)
  .node('isPhase3', Comparator)
  .node('led0', Led)
  .node('led1', Led)
  .node('led2', Led)
  .node('led3', Led)
  .node('display', HexDisplay)
  .connect(({ in: inp, out, phase, enable, inc, phaseMux, one, zero, const1, const2, const3, isPhase0, isPhase1, isPhase2, isPhase3, led0, led1, led2, led3, display }) => [
    phase.q.to(inc.in, phaseMux.in0, isPhase0.a, isPhase1.a, isPhase2.a, isPhase3.a, display.in),
    inc.out.to(phaseMux.in1),
    enable.out.to(phaseMux.sel),
    phaseMux.out.to(phase.data),
    one.out.to(phase.we),
    zero.out.to(isPhase0.b),
    const1.out.to(isPhase1.b),
    const2.out.to(isPhase2.b),
    const3.out.to(isPhase3.b),
    isPhase0.eq.to(led0.in),
    isPhase1.eq.to(led1.in),
    isPhase2.eq.to(led2.in),
    isPhase3.eq.to(led3.in),
  ])
  .build()
`,
    dsl: `
const WavefrontController = component('WavefrontController')
  .node('phase', Register, { initial: 0 })
  .node('enable', Switch)
  .node('inc', Incrementer)
  .node('phaseMux', Mux)
  .node('one', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .node('const1', Constant, { value: 1 })
  .node('const2', Constant, { value: 2 })
  .node('const3', Constant, { value: 3 })
  .node('isPhase0', Comparator)
  .node('isPhase1', Comparator)
  .node('isPhase2', Comparator)
  .node('isPhase3', Comparator)
  .node('led0', Led)
  .node('led1', Led)
  .node('led2', Led)
  .node('led3', Led)
  .node('display', HexDisplay)
  .connect(({ in: inp, out, phase, enable, inc, phaseMux, one, zero, const1, const2, const3, isPhase0, isPhase1, isPhase2, isPhase3, led0, led1, led2, led3, display }) => [
    phase.q.to(inc.in, phaseMux.in0, isPhase0.a, isPhase1.a, isPhase2.a, isPhase3.a, display.in),
    inc.out.to(phaseMux.in1),
    enable.out.to(phaseMux.sel),
    phaseMux.out.to(phase.data),
    one.out.to(phase.we),
    zero.out.to(isPhase0.b),
    const1.out.to(isPhase1.b),
    const2.out.to(isPhase2.b),
    const3.out.to(isPhase3.b),
    isPhase0.eq.to(led0.in),
    isPhase1.eq.to(led1.in),
    isPhase2.eq.to(led2.in),
    isPhase3.eq.to(led3.in),
  ])
  .build()
`,
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

const Systolic2x2 = component('Systolic2x2')
  .in('a00', bus(8))
  .in('a01', bus(8))
  .in('a10', bus(8))
  .in('a11', bus(8))
  .in('b00', bus(8))
  .in('b01', bus(8))
  .in('b10', bus(8))
  .in('b11', bus(8))
  .in('start', bit)
  .out('c00', bus(16))
  .out('c01', bus(16))
  .out('c10', bus(16))
  .out('c11', bus(16))
  .out('done', bit)
  // Processing Elements (2x2 grid)
  .node('pe00', PE_Systolic)
  .node('pe01', PE_Systolic)
  .node('pe10', PE_Systolic)
  .node('pe11', PE_Systolic)
  // Constants
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('two', Constant, { value: 2 })
  .node('three', Constant, { value: 3 })
  .node('four', Constant, { value: 4 })
  .node('five', Constant, { value: 5 })
  .node('six', Constant, { value: 6 })
  // Cycle Counter (0..6, stops at 6)
  .node('counter', Register, { initial: 0 })
  .node('counterInc', Incrementer)
  .node('counterMux', Mux)
  .node('notDone', Comparator)
  .node('shouldAdvance', And)
  // Cycle Decoder
  .node('isCycle0', Comparator)
  .node('isCycle1', Comparator)
  .node('isCycle2', Comparator)
  .node('isCycle3', Comparator)
  .node('isCycle4', Comparator)
  .node('isCycle5', Comparator)
  // Weight Loading
  .node('loadWeights', And)
  // Data Injection Muxes
  .node('muxR0a', Mux)
  .node('muxR0b', Mux)
  .node('muxR1a', Mux)
  .node('muxR1b', Mux)
  // Result Registers
  .node('result_c00', Register)
  .node('result_c10', Register)
  .node('result_c01', Register)
  .node('result_c11', Register)
  // Done detection
  .node('isDone', Comparator)
  .connect(({ in: inp, out, pe00, pe01, pe10, pe11, zero, one, two, three, four, five, six, counter, counterInc, counterMux, notDone, shouldAdvance, isCycle0, isCycle1, isCycle2, isCycle3, isCycle4, isCycle5, loadWeights, muxR0a, muxR0b, muxR1a, muxR1b, result_c00, result_c10, result_c01, result_c11, isDone }) => [
    // Cycle Counter
    counter.q.to(counterInc.in, notDone.a, isCycle0.a, isCycle1.a, isCycle2.a, isCycle3.a, isCycle4.a, isCycle5.a, counterMux.in0, isDone.a),
    six.out.to(notDone.b, isDone.b),
    inp.start.to(shouldAdvance.a),
    notDone.lt.to(shouldAdvance.b),
    shouldAdvance.out.to(counterMux.sel),
    counterInc.out.to(counterMux.in1),
    counterMux.out.to(counter.data),
    one.out.to(counter.we),
    // Cycle Decoder
    zero.out.to(isCycle0.b, muxR0a.in0, muxR1a.in0, pe00.partialSumIn, pe01.partialSumIn),
    one.out.to(isCycle1.b),
    two.out.to(isCycle2.b),
    three.out.to(isCycle3.b),
    four.out.to(isCycle4.b),
    five.out.to(isCycle5.b),
    // Weight Loading (cycle 0 only)
    isCycle0.eq.to(loadWeights.a),
    inp.start.to(loadWeights.b),
    inp.b00.to(pe00.weightIn),
    inp.b01.to(pe01.weightIn),
    inp.b10.to(pe10.weightIn),
    inp.b11.to(pe11.weightIn),
    loadWeights.out.to(pe00.weightValid, pe01.weightValid, pe10.weightValid, pe11.weightValid),
    // Data Injection Row 0: cycle 1 -> A[0][0], cycle 2 -> A[1][0]
    isCycle1.eq.to(muxR0a.sel),
    inp.a00.to(muxR0a.in1),
    isCycle2.eq.to(muxR0b.sel, muxR1a.sel),
    muxR0a.out.to(muxR0b.in0),
    inp.a10.to(muxR0b.in1),
    // Data Injection Row 1: cycle 2 -> A[0][1], cycle 3 -> A[1][1]
    inp.a01.to(muxR1a.in1),
    isCycle3.eq.to(muxR1b.sel),
    muxR1a.out.to(muxR1b.in0),
    inp.a11.to(muxR1b.in1),
    // Horizontal Data Flow
    muxR0b.out.to(pe00.dataIn),
    pe00.dataOut.to(pe01.dataIn),
    muxR1b.out.to(pe10.dataIn),
    pe10.dataOut.to(pe11.dataIn),
    // Vertical Partial-Sum Flow
    pe00.partialSumOut.to(pe10.partialSumIn),
    pe01.partialSumOut.to(pe11.partialSumIn),
    // Result Registers
    pe10.partialSumOut.to(result_c00.data, result_c10.data),
    isCycle3.eq.to(result_c00.we),
    isCycle4.eq.to(result_c10.we, result_c01.we),
    pe11.partialSumOut.to(result_c01.data, result_c11.data),
    isCycle5.eq.to(result_c11.we),
    // Outputs
    result_c00.q.to(out.c00),
    result_c01.q.to(out.c01),
    result_c10.q.to(out.c10),
    result_c11.q.to(out.c11),
    isDone.eq.to(out.done),
  ])
  .build()

const TestWavefront = component('TestWavefront')
  .node('sys', Systolic2x2)
  .node('a00', Input, { value: 1 })
  .node('a01', Input, { value: 2 })
  .node('a10', Input, { value: 3 })
  .node('a11', Input, { value: 4 })
  .node('b00', Input, { value: 5 })
  .node('b01', Input, { value: 6 })
  .node('b10', Input, { value: 7 })
  .node('b11', Input, { value: 8 })
  .node('start', Switch)
  .node('display_c00', HexDisplay)
  .node('display_c01', HexDisplay)
  .node('display_c10', HexDisplay)
  .node('display_c11', HexDisplay)
  .node('done_led', Led)
  .connect(({ in: inp, out, sys, a00, a01, a10, a11, b00, b01, b10, b11, start, display_c00, display_c01, display_c10, display_c11, done_led }) => [
    a00.out.to(sys.a00),
    a01.out.to(sys.a01),
    a10.out.to(sys.a10),
    a11.out.to(sys.a11),
    b00.out.to(sys.b00),
    b01.out.to(sys.b01),
    b10.out.to(sys.b10),
    b11.out.to(sys.b11),
    start.out.to(sys.start),
    sys.c00.to(display_c00.in),
    sys.c01.to(display_c01.in),
    sys.c10.to(display_c10.in),
    sys.c11.to(display_c11.in),
    sys.done.to(done_led.in),
  ])
  .build()
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

const Systolic3x3 = component('Systolic3x3')
  .in('a00', bus(8))
  .in('a01', bus(8))
  .in('a02', bus(8))
  .in('a10', bus(8))
  .in('a11', bus(8))
  .in('a12', bus(8))
  .in('a20', bus(8))
  .in('a21', bus(8))
  .in('a22', bus(8))
  .in('b00', bus(8))
  .in('b01', bus(8))
  .in('b02', bus(8))
  .in('b10', bus(8))
  .in('b11', bus(8))
  .in('b12', bus(8))
  .in('b20', bus(8))
  .in('b21', bus(8))
  .in('b22', bus(8))
  .in('start', bit)
  .out('c00', bus(16))
  .out('c01', bus(16))
  .out('c02', bus(16))
  .out('c10', bus(16))
  .out('c11', bus(16))
  .out('c12', bus(16))
  .out('c20', bus(16))
  .out('c21', bus(16))
  .out('c22', bus(16))
  .out('done', bit)
  // Processing Elements (3x3 grid)
  .node('pe00', PE_Systolic)
  .node('pe01', PE_Systolic)
  .node('pe02', PE_Systolic)
  .node('pe10', PE_Systolic)
  .node('pe11', PE_Systolic)
  .node('pe12', PE_Systolic)
  .node('pe20', PE_Systolic)
  .node('pe21', PE_Systolic)
  .node('pe22', PE_Systolic)
  // Constants
  .node('zero', Constant, { value: 0, width: 16 })
  .node('one', Constant, { value: 1, width: 8 })
  .node('two', Constant, { value: 2, width: 8 })
  .node('three', Constant, { value: 3, width: 8 })
  .node('four', Constant, { value: 4, width: 8 })
  .node('five', Constant, { value: 5, width: 8 })
  .node('nine', Constant, { value: 9, width: 8 })
  // Cycle Counter
  .node('counter', Register, { initial: 0 })
  .node('counterInc', Incrementer)
  .node('counterMux', Mux)
  .node('notDone', Comparator)
  .node('shouldAdvance', And)
  // Cycle Decoder
  .node('isCycle0', Comparator)
  .node('isCycle1', Comparator)
  .node('isCycle2', Comparator)
  .node('isCycle3', Comparator)
  .node('isCycle4', Comparator)
  .node('isCycle5', Comparator)
  // Weight Loading
  .node('loadWeights', And)
  // Data Injection Muxes
  .node('muxR0a', Mux)
  .node('muxR0b', Mux)
  .node('muxR0c', Mux)
  .node('muxR1a', Mux)
  .node('muxR1b', Mux)
  .node('muxR1c', Mux)
  .node('muxR2a', Mux)
  .node('muxR2b', Mux)
  .node('muxR2c', Mux)
  // Valid Signal Injection
  .node('r0validA', Or)
  .node('r0valid', Or)
  .node('r1validA', Or)
  .node('r1valid', Or)
  .node('r2validA', Or)
  .node('r2valid', Or)
  // Column 0 result capture
  .node('col0validD', DFlipFlop)
  .node('col0psumD', Register)
  .node('col0count', Register, { initial: 0 })
  .node('col0countInc', Incrementer)
  .node('col0is0', Comparator)
  .node('col0is1', Comparator)
  .node('col0is2', Comparator)
  .node('c00we', And)
  .node('result_c00', Register)
  .node('c10we', And)
  .node('result_c10', Register)
  .node('c20we', And)
  .node('result_c20', Register)
  // Column 1 result capture
  .node('col1validD', DFlipFlop)
  .node('col1psumD', Register)
  .node('col1count', Register, { initial: 0 })
  .node('col1countInc', Incrementer)
  .node('col1is0', Comparator)
  .node('col1is1', Comparator)
  .node('col1is2', Comparator)
  .node('c01we', And)
  .node('result_c01', Register)
  .node('c11we', And)
  .node('result_c11', Register)
  .node('c21we', And)
  .node('result_c21', Register)
  // Column 2 result capture
  .node('col2validD', DFlipFlop)
  .node('col2psumD', Register)
  .node('col2count', Register, { initial: 0 })
  .node('col2countInc', Incrementer)
  .node('col2is0', Comparator)
  .node('col2is1', Comparator)
  .node('col2is2', Comparator)
  .node('c02we', And)
  .node('result_c02', Register)
  .node('c12we', And)
  .node('result_c12', Register)
  .node('c22we', And)
  .node('result_c22', Register)
  // Done detection
  .node('col0done', Comparator)
  .node('col1done', Comparator)
  .node('col2done', Comparator)
  .node('doneAnd1', And)
  .node('doneAnd2', And)
  .node('doneReg', DFlipFlop)
  .connect(({ in: inp, out, pe00, pe01, pe02, pe10, pe11, pe12, pe20, pe21, pe22, zero, one, two, three, four, five, nine, counter, counterInc, counterMux, notDone, shouldAdvance, isCycle0, isCycle1, isCycle2, isCycle3, isCycle4, isCycle5, loadWeights, muxR0a, muxR0b, muxR0c, muxR1a, muxR1b, muxR1c, muxR2a, muxR2b, muxR2c, r0validA, r0valid, r1validA, r1valid, r2validA, r2valid, col0validD, col0psumD, col0count, col0countInc, col0is0, col0is1, col0is2, c00we, result_c00, c10we, result_c10, c20we, result_c20, col1validD, col1psumD, col1count, col1countInc, col1is0, col1is1, col1is2, c01we, result_c01, c11we, result_c11, c21we, result_c21, col2validD, col2psumD, col2count, col2countInc, col2is0, col2is1, col2is2, c02we, result_c02, c12we, result_c12, c22we, result_c22, col0done, col1done, col2done, doneAnd1, doneAnd2, doneReg }) => [
    // Cycle Counter
    counter.q.to(counterInc.in, notDone.a, counterMux.in0, isCycle0.a, isCycle1.a, isCycle2.a, isCycle3.a, isCycle4.a, isCycle5.a),
    nine.out.to(notDone.b),
    inp.start.to(shouldAdvance.a, loadWeights.b),
    notDone.lt.to(shouldAdvance.b),
    shouldAdvance.out.to(counterMux.sel),
    counterInc.out.to(counterMux.in1),
    counterMux.out.to(counter.data),
    one.out.to(counter.we, isCycle1.b, col0is0.b, col1is0.b, col2is0.b, col0psumD.we, col1psumD.we, col2psumD.we),
    // Cycle Decoder
    zero.out.to(isCycle0.b, muxR0a.in0, muxR1a.in0, muxR2a.in0, pe00.partialSumIn, pe01.partialSumIn, pe02.partialSumIn),
    two.out.to(isCycle2.b, col0is1.b, col1is1.b, col2is1.b),
    three.out.to(isCycle3.b, col0is2.b, col1is2.b, col2is2.b, col0done.b, col1done.b, col2done.b),
    four.out.to(isCycle4.b),
    five.out.to(isCycle5.b),
    // Weight Loading (cycle 0 only)
    isCycle0.eq.to(loadWeights.a),
    inp.b00.to(pe00.weightIn),
    inp.b01.to(pe01.weightIn),
    inp.b02.to(pe02.weightIn),
    inp.b10.to(pe10.weightIn),
    inp.b11.to(pe11.weightIn),
    inp.b12.to(pe12.weightIn),
    inp.b20.to(pe20.weightIn),
    inp.b21.to(pe21.weightIn),
    inp.b22.to(pe22.weightIn),
    loadWeights.out.to(pe00.weightValid, pe01.weightValid, pe02.weightValid, pe10.weightValid, pe11.weightValid, pe12.weightValid, pe20.weightValid, pe21.weightValid, pe22.weightValid),
    // Data Injection Row 0
    isCycle1.eq.to(muxR0a.sel, r0validA.a),
    inp.a00.to(muxR0a.in1),
    isCycle2.eq.to(muxR0b.sel, muxR1a.sel, r0validA.b, r1validA.a),
    muxR0a.out.to(muxR0b.in0),
    inp.a10.to(muxR0b.in1),
    isCycle3.eq.to(muxR0c.sel, muxR1b.sel, muxR2a.sel, r0valid.b, r1validA.b, r2validA.a),
    muxR0b.out.to(muxR0c.in0),
    inp.a20.to(muxR0c.in1),
    // Data Injection Row 1
    inp.a01.to(muxR1a.in1),
    muxR1a.out.to(muxR1b.in0),
    inp.a11.to(muxR1b.in1),
    isCycle4.eq.to(muxR1c.sel, muxR2b.sel, r1valid.b, r2validA.b),
    muxR1b.out.to(muxR1c.in0),
    inp.a21.to(muxR1c.in1),
    // Data Injection Row 2
    inp.a02.to(muxR2a.in1),
    muxR2a.out.to(muxR2b.in0),
    inp.a12.to(muxR2b.in1),
    isCycle5.eq.to(muxR2c.sel, r2valid.b),
    muxR2b.out.to(muxR2c.in0),
    inp.a22.to(muxR2c.in1),
    // Valid Signal Injection
    r0validA.out.to(r0valid.a),
    r1validA.out.to(r1valid.a),
    r2validA.out.to(r2valid.a),
    // Horizontal Data Flow
    muxR0c.out.to(pe00.dataIn),
    pe00.dataOut.to(pe01.dataIn),
    pe01.dataOut.to(pe02.dataIn),
    muxR1c.out.to(pe10.dataIn),
    pe10.dataOut.to(pe11.dataIn),
    pe11.dataOut.to(pe12.dataIn),
    muxR2c.out.to(pe20.dataIn),
    pe20.dataOut.to(pe21.dataIn),
    pe21.dataOut.to(pe22.dataIn),
    // Valid Signal Flow
    r0valid.out.to(pe00.validIn),
    pe00.validOut.to(pe01.validIn),
    pe01.validOut.to(pe02.validIn),
    r1valid.out.to(pe10.validIn),
    pe10.validOut.to(pe11.validIn),
    pe11.validOut.to(pe12.validIn),
    r2valid.out.to(pe20.validIn),
    pe20.validOut.to(pe21.validIn),
    pe21.validOut.to(pe22.validIn),
    // Vertical Partial-Sum Flow
    pe00.partialSumOut.to(pe10.partialSumIn),
    pe01.partialSumOut.to(pe11.partialSumIn),
    pe02.partialSumOut.to(pe12.partialSumIn),
    pe10.partialSumOut.to(pe20.partialSumIn),
    pe11.partialSumOut.to(pe21.partialSumIn),
    pe12.partialSumOut.to(pe22.partialSumIn),
    // Column 0 result capture
    pe20.validOut.to(col0validD.d, col0count.we),
    pe20.partialSumOut.to(col0psumD.data),
    col0count.q.to(col0countInc.in, col0is0.a, col0is1.a, col0is2.a, col0done.a),
    col0countInc.out.to(col0count.data),
    col0validD.q.to(c00we.a, c10we.a, c20we.a),
    col0is0.eq.to(c00we.b),
    col0psumD.q.to(result_c00.data, result_c10.data, result_c20.data),
    c00we.out.to(result_c00.we),
    col0is1.eq.to(c10we.b),
    c10we.out.to(result_c10.we),
    col0is2.eq.to(c20we.b),
    c20we.out.to(result_c20.we),
    // Column 1 result capture
    pe21.validOut.to(col1validD.d, col1count.we),
    pe21.partialSumOut.to(col1psumD.data),
    col1count.q.to(col1countInc.in, col1is0.a, col1is1.a, col1is2.a, col1done.a),
    col1countInc.out.to(col1count.data),
    col1validD.q.to(c01we.a, c11we.a, c21we.a),
    col1is0.eq.to(c01we.b),
    col1psumD.q.to(result_c01.data, result_c11.data, result_c21.data),
    c01we.out.to(result_c01.we),
    col1is1.eq.to(c11we.b),
    c11we.out.to(result_c11.we),
    col1is2.eq.to(c21we.b),
    c21we.out.to(result_c21.we),
    // Column 2 result capture
    pe22.validOut.to(col2validD.d, col2count.we),
    pe22.partialSumOut.to(col2psumD.data),
    col2count.q.to(col2countInc.in, col2is0.a, col2is1.a, col2is2.a, col2done.a),
    col2countInc.out.to(col2count.data),
    col2validD.q.to(c02we.a, c12we.a, c22we.a),
    col2is0.eq.to(c02we.b),
    col2psumD.q.to(result_c02.data, result_c12.data, result_c22.data),
    c02we.out.to(result_c02.we),
    col2is1.eq.to(c12we.b),
    c12we.out.to(result_c12.we),
    col2is2.eq.to(c22we.b),
    c22we.out.to(result_c22.we),
    // Outputs
    result_c00.q.to(out.c00),
    result_c01.q.to(out.c01),
    result_c02.q.to(out.c02),
    result_c10.q.to(out.c10),
    result_c11.q.to(out.c11),
    result_c12.q.to(out.c12),
    result_c20.q.to(out.c20),
    result_c21.q.to(out.c21),
    result_c22.q.to(out.c22),
    // Done detection
    col0done.eq.to(doneAnd1.a),
    col1done.eq.to(doneAnd1.b),
    doneAnd1.out.to(doneAnd2.a),
    col2done.eq.to(doneAnd2.b),
    doneAnd2.out.to(doneReg.d),
    doneReg.q.to(out.done),
  ])
  .build()

const TestSystolic3x3 = component('TestSystolic3x3')
  .node('sys', Systolic3x3)
  // Matrix A = [[1,2,3],[4,5,6],[7,8,9]]
  .node('a00', Input, { value: 1 })
  .node('a01', Input, { value: 2 })
  .node('a02', Input, { value: 3 })
  .node('a10', Input, { value: 4 })
  .node('a11', Input, { value: 5 })
  .node('a12', Input, { value: 6 })
  .node('a20', Input, { value: 7 })
  .node('a21', Input, { value: 8 })
  .node('a22', Input, { value: 9 })
  // Matrix B = [[2,0,1],[0,2,0],[1,0,2]]
  .node('b00', Input, { value: 2 })
  .node('b01', Input, { value: 0 })
  .node('b02', Input, { value: 1 })
  .node('b10', Input, { value: 0 })
  .node('b11', Input, { value: 2 })
  .node('b12', Input, { value: 0 })
  .node('b20', Input, { value: 1 })
  .node('b21', Input, { value: 0 })
  .node('b22', Input, { value: 2 })
  .node('start', Switch)
  .node('display_c00', HexDisplay)
  .node('display_c01', HexDisplay)
  .node('display_c02', HexDisplay)
  .node('display_c10', HexDisplay)
  .node('display_c11', HexDisplay)
  .node('display_c12', HexDisplay)
  .node('display_c20', HexDisplay)
  .node('display_c21', HexDisplay)
  .node('display_c22', HexDisplay)
  .node('done_led', Led)
  .connect(({ in: inp, out, sys, a00, a01, a02, a10, a11, a12, a20, a21, a22, b00, b01, b02, b10, b11, b12, b20, b21, b22, start, display_c00, display_c01, display_c02, display_c10, display_c11, display_c12, display_c20, display_c21, display_c22, done_led }) => [
    a00.out.to(sys.a00),
    a01.out.to(sys.a01),
    a02.out.to(sys.a02),
    a10.out.to(sys.a10),
    a11.out.to(sys.a11),
    a12.out.to(sys.a12),
    a20.out.to(sys.a20),
    a21.out.to(sys.a21),
    a22.out.to(sys.a22),
    b00.out.to(sys.b00),
    b01.out.to(sys.b01),
    b02.out.to(sys.b02),
    b10.out.to(sys.b10),
    b11.out.to(sys.b11),
    b12.out.to(sys.b12),
    b20.out.to(sys.b20),
    b21.out.to(sys.b21),
    b22.out.to(sys.b22),
    start.out.to(sys.start),
    sys.c00.to(display_c00.in),
    sys.c01.to(display_c01.in),
    sys.c02.to(display_c02.in),
    sys.c10.to(display_c10.in),
    sys.c11.to(display_c11.in),
    sys.c12.to(display_c12.in),
    sys.c20.to(display_c20.in),
    sys.c21.to(display_c21.in),
    sys.c22.to(display_c22.in),
    sys.done.to(done_led.in),
  ])
  .build()
`;
