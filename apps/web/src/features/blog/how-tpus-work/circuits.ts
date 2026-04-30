/**
 * Circuit definitions for the "How TPUs Do Calculations" blog post.
 *
 * Builds up from a simple multiply-add to a full 3x3 systolic array
 * with wavefront control, all defined with the circuit() builder.
 *
 * All building blocks use the same PE_Systolic architecture as the final array:
 *   - Weight register with valid-bit gating
 *   - Multiplier: dataIn × stored weight
 *   - Registered adder: partialSumIn + product → psumReg → partialSumOut
 *   - Data pipeline register: 1-cycle delay for horizontal flow
 *   - Both partial sums and data are registered (1 cycle per PE in each direction)
 */

import { circuit, bit, bus } from "@simten/core/circuit";
import type { BlogCircuit } from '../types';
import {
  Input, Switch, HexDisplay, Constant, Led,
  Register, DFlipFlop, Adder, Multiplier, Comparator,
  Mux, Incrementer, And, Or,
} from "@simten/core/std";

/** The PE definition used by all circuits — registered partial-sum output */
const PE_Systolic = circuit('PE_Systolic', {
  inputs: { dataIn: bus(8), weightIn: bus(8), partialSumIn: bus(16), weightValid: bit, validIn: bit },
  outputs: { dataOut: bus(8), partialSumOut: bus(16), validOut: bit },
  nodes: { weightReg: Register, mult: Multiplier, adder: Adder, psumReg: Register, dataPipe: Register, validPipe: DFlipFlop, one: Constant, zero: Constant },
  nodeArgs: { weightReg: { width: 8 }, adder: { width: 16 }, psumReg: { width: 16 }, dataPipe: { width: 8 }, one: { value: 1 }, zero: { value: 0 } },
  connect: ({ inputs, outputs, nodes: { weightReg, mult, adder, psumReg, dataPipe, validPipe, one, zero } }) => [
    inputs.weightIn.to(weightReg.data),
    inputs.weightValid.to(weightReg.we),
    inputs.dataIn.to(mult.a, dataPipe.data),
    weightReg.q.to(mult.b),
    inputs.partialSumIn.to(adder.a),
    mult.product.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(psumReg.data),
    one.out.to(psumReg.we, dataPipe.we),
    psumReg.q.to(outputs.partialSumOut),
    dataPipe.q.to(outputs.dataOut),
    inputs.validIn.to(validPipe.d),
    validPipe.q.to(outputs.validOut),
  ],
});

const MultiplyAdd = circuit('MultiplyAdd', {
  nodes: { data: Input, weight: Input, partialSumIn: Input, mult: Multiplier, adder: Adder, zero: Constant, result: HexDisplay },
  nodeArgs: { data: { value: 3 }, weight: { value: 5 }, partialSumIn: { value: 10 }, adder: { width: 16 }, zero: { value: 0 } },
  connect: ({ nodes: { data, weight, partialSumIn, mult, adder, zero, result } }) => [
    data.out.to(mult.a),
    weight.out.to(mult.b),
    partialSumIn.out.to(adder.a),
    mult.product.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(result.in),
  ],
});

const WeightRegister = circuit('WeightRegister', {
  nodes: { weightIn: Input, weightValid: Switch, dataIn: Input, weightReg: Register, storedWeight: HexDisplay, mult: Multiplier, product: HexDisplay },
  nodeArgs: { weightIn: { value: 7 }, dataIn: { value: 3 } },
  connect: ({ nodes: { weightIn, weightValid, dataIn, weightReg, storedWeight, mult, product } }) => [
    weightIn.out.to(weightReg.data),
    weightValid.out.to(weightReg.we),
    weightReg.q.to(storedWeight.in, mult.b),
    dataIn.out.to(mult.a),
    mult.product.to(product.in),
  ],
});

const TestPE = circuit('TestPE', {
  nodes: { pe: PE_Systolic, dataIn: Input, weightIn: Input, weightValid: Switch, partialSumIn: Input, partialSumOut: HexDisplay, dataOut: HexDisplay },
  nodeArgs: { dataIn: { value: 3 }, weightIn: { value: 5 }, partialSumIn: { value: 0 } },
  connect: ({ nodes: { pe, dataIn, weightIn, weightValid, partialSumIn, partialSumOut, dataOut } }) => [
    dataIn.out.to(pe.dataIn),
    weightIn.out.to(pe.weightIn),
    weightValid.out.to(pe.weightValid),
    partialSumIn.out.to(pe.partialSumIn),
    pe.partialSumOut.to(partialSumOut.in),
    pe.dataOut.to(dataOut.in),
  ],
});

const TwoPERow = circuit('TwoPERow', {
  nodes: { pe0: PE_Systolic, pe1: PE_Systolic, data0: Input, weight0: Input, weight1: Input, weightValid: Switch, zero16: Constant, result0: HexDisplay, result1: HexDisplay },
  nodeArgs: { data0: { value: 2 }, weight0: { value: 3 }, weight1: { value: 5 }, zero16: { value: 0 } },
  connect: ({ nodes: { pe0, pe1, data0, weight0, weight1, weightValid, zero16, result0, result1 } }) => [
    data0.out.to(pe0.dataIn),
    pe0.dataOut.to(pe1.dataIn),
    weight0.out.to(pe0.weightIn),
    weight1.out.to(pe1.weightIn),
    weightValid.out.to(pe0.weightValid, pe1.weightValid),
    zero16.out.to(pe0.partialSumIn, pe1.partialSumIn),
    pe0.partialSumOut.to(result0.in),
    pe1.partialSumOut.to(result1.in),
  ],
});

const TwoPEColumn = circuit('TwoPEColumn', {
  nodes: { pe0: PE_Systolic, pe1: PE_Systolic, dataIn: Input, weight0: Input, weight1: Input, weightValid: Switch, zero16: Constant, topResult: HexDisplay, bottomResult: HexDisplay },
  nodeArgs: { dataIn: { value: 4 }, weight0: { value: 3 }, weight1: { value: 5 }, zero16: { value: 0 } },
  connect: ({ nodes: { pe0, pe1, dataIn, weight0, weight1, weightValid, zero16, topResult, bottomResult } }) => [
    dataIn.out.to(pe0.dataIn, pe1.dataIn),
    weight0.out.to(pe0.weightIn),
    weight1.out.to(pe1.weightIn),
    weightValid.out.to(pe0.weightValid, pe1.weightValid),
    zero16.out.to(pe0.partialSumIn),
    pe0.partialSumOut.to(pe1.partialSumIn, topResult.in),
    pe1.partialSumOut.to(bottomResult.in),
  ],
});

const WavefrontController = circuit('WavefrontController', {
  nodes: { phase: Register, enable: Switch, inc: Incrementer, phaseMux: Mux, one: Constant, zero: Constant, const1: Constant, const2: Constant, const3: Constant, isPhase0: Comparator, isPhase1: Comparator, isPhase2: Comparator, isPhase3: Comparator, led0: Led, led1: Led, led2: Led, led3: Led, display: HexDisplay },
  nodeArgs: { phase: { initial: 0 }, one: { value: 1 }, zero: { value: 0 }, const1: { value: 1 }, const2: { value: 2 }, const3: { value: 3 } },
  connect: ({ nodes: { phase, enable, inc, phaseMux, one, zero, const1, const2, const3, isPhase0, isPhase1, isPhase2, isPhase3, led0, led1, led2, led3, display } }) => [
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
  ],
});

/**
 * 2x2 systolic array with registered partial-sum flow.
 *
 * With registered psumOut, partial sums take 1 cycle per PE vertically.
 * Data injection is staggered: row r starts at cycle 1+r.
 * C[k][j] emerges at PE(N-1,j) on cycle k+j+N+1 (N=2).
 * Total: 3N = 6 ticks for N=2.
 */
export const Systolic2x2 = circuit('Systolic2x2', {
  inputs: { a00: bus(8), a01: bus(8), a10: bus(8), a11: bus(8), b00: bus(8), b01: bus(8), b10: bus(8), b11: bus(8), start: bit },
  outputs: { c00: bus(16), c01: bus(16), c10: bus(16), c11: bus(16), done: bit },
  nodes: { pe00: PE_Systolic, pe01: PE_Systolic, pe10: PE_Systolic, pe11: PE_Systolic, zero: Constant, one: Constant, two: Constant, three: Constant, four: Constant, five: Constant, six: Constant, counter: Register, counterInc: Incrementer, counterMux: Mux, notDone: Comparator, shouldAdvance: And, isCycle0: Comparator, isCycle1: Comparator, isCycle2: Comparator, isCycle3: Comparator, isCycle4: Comparator, isCycle5: Comparator, loadWeights: And, muxR0a: Mux, muxR0b: Mux, muxR1a: Mux, muxR1b: Mux, result_c00: Register, result_c10: Register, result_c01: Register, result_c11: Register, isDone: Comparator },
  nodeArgs: { zero: { value: 0 }, one: { value: 1 }, two: { value: 2 }, three: { value: 3 }, four: { value: 4 }, five: { value: 5 }, six: { value: 6 }, counter: { initial: 0 } },
  connect: ({ inputs, outputs, nodes: { pe00, pe01, pe10, pe11, zero, one, two, three, four, five, six, counter, counterInc, counterMux, notDone, shouldAdvance, isCycle0, isCycle1, isCycle2, isCycle3, isCycle4, isCycle5, loadWeights, muxR0a, muxR0b, muxR1a, muxR1b, result_c00, result_c10, result_c01, result_c11, isDone } }) => [
    // Cycle Counter
    counter.q.to(counterInc.in, notDone.a, isCycle0.a, isCycle1.a, isCycle2.a, isCycle3.a, isCycle4.a, isCycle5.a, counterMux.in0, isDone.a),
    six.out.to(notDone.b, isDone.b),
    inputs.start.to(shouldAdvance.a),
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
    inputs.start.to(loadWeights.b),
    inputs.b00.to(pe00.weightIn),
    inputs.b01.to(pe01.weightIn),
    inputs.b10.to(pe10.weightIn),
    inputs.b11.to(pe11.weightIn),
    loadWeights.out.to(pe00.weightValid, pe01.weightValid, pe10.weightValid, pe11.weightValid),
    // Data Injection Row 0: cycle 1 -> A[0][0], cycle 2 -> A[1][0]
    isCycle1.eq.to(muxR0a.sel),
    inputs.a00.to(muxR0a.in1),
    isCycle2.eq.to(muxR0b.sel, muxR1a.sel),
    muxR0a.out.to(muxR0b.in0),
    inputs.a10.to(muxR0b.in1),
    // Data Injection Row 1: cycle 2 -> A[0][1], cycle 3 -> A[1][1]
    inputs.a01.to(muxR1a.in1),
    isCycle3.eq.to(muxR1b.sel),
    muxR1a.out.to(muxR1b.in0),
    inputs.a11.to(muxR1b.in1),
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
    result_c00.q.to(outputs.c00),
    result_c01.q.to(outputs.c01),
    result_c10.q.to(outputs.c10),
    result_c11.q.to(outputs.c11),
    isDone.eq.to(outputs.done),
  ],
});

export const TestWavefront = circuit('TestWavefront', {
  nodes: { sys: Systolic2x2, a00: Input, a01: Input, a10: Input, a11: Input, b00: Input, b01: Input, b10: Input, b11: Input, start: Switch, display_c00: HexDisplay, display_c01: HexDisplay, display_c10: HexDisplay, display_c11: HexDisplay, done_led: Led },
  nodeArgs: { a00: { value: 1 }, a01: { value: 2 }, a10: { value: 3 }, a11: { value: 4 }, b00: { value: 5 }, b01: { value: 6 }, b10: { value: 7 }, b11: { value: 8 } },
  connect: ({ nodes: { sys, a00, a01, a10, a11, b00, b01, b10, b11, start, display_c00, display_c01, display_c10, display_c11, done_led } }) => [
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
  ],
});

/**
 * Full 3x3 systolic array: PE_Systolic + Systolic3x3 + TestSystolic3x3
 *
 * Architecture: weight-stationary with registered partial-sum flow.
 * Test: A=[[1,2,3],[4,5,6],[7,8,9]] × B=[[2,0,1],[0,2,0],[1,0,2]]
 * Expected C = [[5,4,7],[14,10,16],[23,16,25]]
 */
const Systolic3x3 = circuit('Systolic3x3', {
  inputs: { a00: bus(8), a01: bus(8), a02: bus(8), a10: bus(8), a11: bus(8), a12: bus(8), a20: bus(8), a21: bus(8), a22: bus(8), b00: bus(8), b01: bus(8), b02: bus(8), b10: bus(8), b11: bus(8), b12: bus(8), b20: bus(8), b21: bus(8), b22: bus(8), start: bit },
  outputs: { c00: bus(16), c01: bus(16), c02: bus(16), c10: bus(16), c11: bus(16), c12: bus(16), c20: bus(16), c21: bus(16), c22: bus(16), done: bit },
  nodes: { pe00: PE_Systolic, pe01: PE_Systolic, pe02: PE_Systolic, pe10: PE_Systolic, pe11: PE_Systolic, pe12: PE_Systolic, pe20: PE_Systolic, pe21: PE_Systolic, pe22: PE_Systolic, zero: Constant, one: Constant, two: Constant, three: Constant, four: Constant, five: Constant, nine: Constant, counter: Register, counterInc: Incrementer, counterMux: Mux, notDone: Comparator, shouldAdvance: And, isCycle0: Comparator, isCycle1: Comparator, isCycle2: Comparator, isCycle3: Comparator, isCycle4: Comparator, isCycle5: Comparator, loadWeights: And, muxR0a: Mux, muxR0b: Mux, muxR0c: Mux, muxR1a: Mux, muxR1b: Mux, muxR1c: Mux, muxR2a: Mux, muxR2b: Mux, muxR2c: Mux, r0validA: Or, r0valid: Or, r1validA: Or, r1valid: Or, r2validA: Or, r2valid: Or, col0validD: DFlipFlop, col0psumD: Register, col0count: Register, col0countInc: Incrementer, col0is0: Comparator, col0is1: Comparator, col0is2: Comparator, c00we: And, result_c00: Register, c10we: And, result_c10: Register, c20we: And, result_c20: Register, col1validD: DFlipFlop, col1psumD: Register, col1count: Register, col1countInc: Incrementer, col1is0: Comparator, col1is1: Comparator, col1is2: Comparator, c01we: And, result_c01: Register, c11we: And, result_c11: Register, c21we: And, result_c21: Register, col2validD: DFlipFlop, col2psumD: Register, col2count: Register, col2countInc: Incrementer, col2is0: Comparator, col2is1: Comparator, col2is2: Comparator, c02we: And, result_c02: Register, c12we: And, result_c12: Register, c22we: And, result_c22: Register, col0done: Comparator, col1done: Comparator, col2done: Comparator, doneAnd1: And, doneAnd2: And, doneReg: DFlipFlop },
  nodeArgs: { zero: { value: 0, width: 16 }, one: { value: 1, width: 8 }, two: { value: 2, width: 8 }, three: { value: 3, width: 8 }, four: { value: 4, width: 8 }, five: { value: 5, width: 8 }, nine: { value: 9, width: 8 }, counter: { initial: 0 }, col0count: { initial: 0 }, col1count: { initial: 0 }, col2count: { initial: 0 } },
  connect: ({ inputs, outputs, nodes: { pe00, pe01, pe02, pe10, pe11, pe12, pe20, pe21, pe22, zero, one, two, three, four, five, nine, counter, counterInc, counterMux, notDone, shouldAdvance, isCycle0, isCycle1, isCycle2, isCycle3, isCycle4, isCycle5, loadWeights, muxR0a, muxR0b, muxR0c, muxR1a, muxR1b, muxR1c, muxR2a, muxR2b, muxR2c, r0validA, r0valid, r1validA, r1valid, r2validA, r2valid, col0validD, col0psumD, col0count, col0countInc, col0is0, col0is1, col0is2, c00we, result_c00, c10we, result_c10, c20we, result_c20, col1validD, col1psumD, col1count, col1countInc, col1is0, col1is1, col1is2, c01we, result_c01, c11we, result_c11, c21we, result_c21, col2validD, col2psumD, col2count, col2countInc, col2is0, col2is1, col2is2, c02we, result_c02, c12we, result_c12, c22we, result_c22, col0done, col1done, col2done, doneAnd1, doneAnd2, doneReg } }) => [
    // Cycle Counter
    counter.q.to(counterInc.in, notDone.a, counterMux.in0, isCycle0.a, isCycle1.a, isCycle2.a, isCycle3.a, isCycle4.a, isCycle5.a),
    nine.out.to(notDone.b),
    inputs.start.to(shouldAdvance.a, loadWeights.b),
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
    inputs.b00.to(pe00.weightIn),
    inputs.b01.to(pe01.weightIn),
    inputs.b02.to(pe02.weightIn),
    inputs.b10.to(pe10.weightIn),
    inputs.b11.to(pe11.weightIn),
    inputs.b12.to(pe12.weightIn),
    inputs.b20.to(pe20.weightIn),
    inputs.b21.to(pe21.weightIn),
    inputs.b22.to(pe22.weightIn),
    loadWeights.out.to(pe00.weightValid, pe01.weightValid, pe02.weightValid, pe10.weightValid, pe11.weightValid, pe12.weightValid, pe20.weightValid, pe21.weightValid, pe22.weightValid),
    // Data Injection Row 0
    isCycle1.eq.to(muxR0a.sel, r0validA.a),
    inputs.a00.to(muxR0a.in1),
    isCycle2.eq.to(muxR0b.sel, muxR1a.sel, r0validA.b, r1validA.a),
    muxR0a.out.to(muxR0b.in0),
    inputs.a10.to(muxR0b.in1),
    isCycle3.eq.to(muxR0c.sel, muxR1b.sel, muxR2a.sel, r0valid.b, r1validA.b, r2validA.a),
    muxR0b.out.to(muxR0c.in0),
    inputs.a20.to(muxR0c.in1),
    // Data Injection Row 1
    inputs.a01.to(muxR1a.in1),
    muxR1a.out.to(muxR1b.in0),
    inputs.a11.to(muxR1b.in1),
    isCycle4.eq.to(muxR1c.sel, muxR2b.sel, r1valid.b, r2validA.b),
    muxR1b.out.to(muxR1c.in0),
    inputs.a21.to(muxR1c.in1),
    // Data Injection Row 2
    inputs.a02.to(muxR2a.in1),
    muxR2a.out.to(muxR2b.in0),
    inputs.a12.to(muxR2b.in1),
    isCycle5.eq.to(muxR2c.sel, r2valid.b),
    muxR2b.out.to(muxR2c.in0),
    inputs.a22.to(muxR2c.in1),
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
    result_c00.q.to(outputs.c00),
    result_c01.q.to(outputs.c01),
    result_c02.q.to(outputs.c02),
    result_c10.q.to(outputs.c10),
    result_c11.q.to(outputs.c11),
    result_c12.q.to(outputs.c12),
    result_c20.q.to(outputs.c20),
    result_c21.q.to(outputs.c21),
    result_c22.q.to(outputs.c22),
    // Done detection
    col0done.eq.to(doneAnd1.a),
    col1done.eq.to(doneAnd1.b),
    doneAnd1.out.to(doneAnd2.a),
    col2done.eq.to(doneAnd2.b),
    doneAnd2.out.to(doneReg.d),
    doneReg.q.to(outputs.done),
  ],
});

export const TestSystolic3x3 = circuit('TestSystolic3x3', {
  // Formal `done` output port — asserts when the systolic array finishes
  // its compute pipeline. Replaces a hook-side substring scan over
  // portValues looking for a node named "done_led". The visual done_led
  // stays for on-canvas rendering.
  outputs: { done: bit },
  nodes: { sys: Systolic3x3, a00: Input, a01: Input, a02: Input, a10: Input, a11: Input, a12: Input, a20: Input, a21: Input, a22: Input, b00: Input, b01: Input, b02: Input, b10: Input, b11: Input, b12: Input, b20: Input, b21: Input, b22: Input, start: Switch, display_c00: HexDisplay, display_c01: HexDisplay, display_c02: HexDisplay, display_c10: HexDisplay, display_c11: HexDisplay, display_c12: HexDisplay, display_c20: HexDisplay, display_c21: HexDisplay, display_c22: HexDisplay, done_led: Led },
  nodeArgs: { a00: { value: 1 }, a01: { value: 2 }, a02: { value: 3 }, a10: { value: 4 }, a11: { value: 5 }, a12: { value: 6 }, a20: { value: 7 }, a21: { value: 8 }, a22: { value: 9 }, b00: { value: 2 }, b01: { value: 0 }, b02: { value: 1 }, b10: { value: 0 }, b11: { value: 2 }, b12: { value: 0 }, b20: { value: 1 }, b21: { value: 0 }, b22: { value: 2 } },
  connect: ({ outputs, nodes: { sys, a00, a01, a02, a10, a11, a12, a20, a21, a22, b00, b01, b02, b10, b11, b12, b20, b21, b22, start, display_c00, display_c01, display_c02, display_c10, display_c11, display_c12, display_c20, display_c21, display_c22, done_led } }) => [
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
    sys.c10.to(display_c10.in),
    sys.c11.to(display_c11.in),
    sys.c12.to(display_c12.in),
    sys.c20.to(display_c20.in),
    sys.c21.to(display_c21.in),
    sys.c22.to(display_c22.in),
    sys.done.to(done_led.in, outputs.done),
  ],
});

export const TPU_CIRCUITS: Record<string, BlogCircuit> = {
  /**
   * Section 1: Multiply-Add — the fundamental operation.
   */
  multiplyAdd: {
    name: "Multiply-Add Unit",
    description:
      "Multiply two numbers and add to a partial sum. The fundamental operation inside every PE.",
    circuit: MultiplyAdd,
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

  weightRegister: {
    name: "Weight Register",
    description:
      "A register that stores a weight only when the valid signal is high. The weight stays fixed while data streams through.",
    circuit: WeightRegister,
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

  processingElement: {
    name: "Processing Element",
    description:
      "A full PE with weight register, multiplier, registered partial-sum adder, and data pipeline. The building block of the systolic array.",
    circuit: TestPE,
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

  twoPERow: {
    name: "Two-PE Row",
    description:
      "Two PEs connected horizontally. Data flows left to right with a one-cycle delay between elements.",
    circuit: TwoPERow,
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

  twoPEColumn: {
    name: "Two-PE Column",
    description:
      "Two PEs stacked vertically. Partial sums flow down through registers — one PE per clock cycle, just like real hardware.",
    circuit: TwoPEColumn,
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

  wavefrontController: {
    name: "Wavefront Controller",
    description:
      "A phase register drives multi-step computation. Each phase has its own enable counter. LEDs show the active phase.",
    circuit: WavefrontController,
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
