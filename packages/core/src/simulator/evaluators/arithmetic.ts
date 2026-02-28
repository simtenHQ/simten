/**
 * Arithmetic Evaluators for Fast Simulation
 *
 * Numeric evaluators for arithmetic primitives.
 * All evaluators read inputs directly via typed arrays - no Map allocations.
 */

import type { EvalContext } from './types.js';
import { readInput, writeOutput, bitMask } from './types.js';

/**
 * Adder: n-bit adder with carry in/out
 * Inputs: a, b, carry_in
 * Outputs: sum, carry_out
 */
export function evalAdder(ctx: EvalContext): void {
  // Use >>> 0 to interpret Int32Array values as unsigned for correct carry detection
  const a = readInput(ctx, 0) >>> 0;
  const b = readInput(ctx, 1) >>> 0;
  const carryIn = readInput(ctx, 2) ? 1 : 0;

  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const width = (node.arguments.width as number) ?? 8;
  const mask = bitMask(width);

  const result = a + b + carryIn;
  const sum = result & mask;
  const carryOut = result > mask ? 1 : 0;

  writeOutput(ctx, 0, sum);
  writeOutput(ctx, 1, carryOut);
}

/**
 * Subtractor: n-bit subtractor with borrow in/out
 * Inputs: a, b, borrow_in
 * Outputs: difference, borrow_out
 */
export function evalSubtractor(ctx: EvalContext): void {
  const a = readInput(ctx, 0) >>> 0;
  const b = readInput(ctx, 1) >>> 0;
  const borrowIn = readInput(ctx, 2) ? 1 : 0;

  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const width = (node.arguments.width as number) ?? 8;
  const mask = bitMask(width);

  const result = a - b - borrowIn;
  const difference = result & mask;
  const borrowOut = result < 0 ? 1 : 0;

  writeOutput(ctx, 0, difference);
  writeOutput(ctx, 1, borrowOut);
}

/**
 * Multiplier: n×n bit multiplier
 * Inputs: a, b
 * Outputs: product
 */
export function evalMultiplier(ctx: EvalContext): void {
  const a = readInput(ctx, 0) >>> 0;
  const b = readInput(ctx, 1) >>> 0;

  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const width = (node.arguments.width as number) ?? 8;
  const outputMask = bitMask(width * 2);

  // Use modular arithmetic instead of bitwise AND for wide outputs
  // (bitwise AND coerces to Int32, turning large unsigned products negative)
  const raw = a * b;
  const product = width * 2 >= 32 ? (raw >>> 0) : (raw & outputMask);

  writeOutput(ctx, 0, product);
}

/**
 * SignedAdder: Signed n-bit adder with overflow detection
 * Inputs: a, b, carry_in
 * Outputs: sum, overflow, carry_out
 */
export function evalSignedAdder(ctx: EvalContext): void {
  const aRaw = readInput(ctx, 0);
  const bRaw = readInput(ctx, 1);
  const carryIn = readInput(ctx, 2) ? 1 : 0;

  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const width = (node.arguments.width as number) ?? 8;
  const mask = bitMask(width);
  const signBit = 1 << (width - 1);

  // Unsigned for carry detection
  const result = (aRaw >>> 0) + (bRaw >>> 0) + carryIn;
  const sum = result & mask;
  const carryOut = result > mask ? 1 : 0;

  // Overflow uses sign bits from original values
  const aSign = (aRaw & signBit) !== 0;
  const bSign = (bRaw & signBit) !== 0;
  const sumSign = (sum & signBit) !== 0;
  const overflow = aSign === bSign && aSign !== sumSign ? 1 : 0;

  writeOutput(ctx, 0, sum);
  writeOutput(ctx, 1, overflow);
  writeOutput(ctx, 2, carryOut);
}

/**
 * SignedMultiplier: Signed n×n bit multiplier
 * Inputs: a, b
 * Outputs: product
 */
export function evalSignedMultiplier(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  const b = readInput(ctx, 1);

  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const width = (node.arguments.width as number) ?? 8;
  // Use 2** instead of 1<< to avoid JS shift mod-32 bug at width=16
  const signBit = width >= 32 ? 0x80000000 : (1 << (width - 1));
  const maxValue = 2 ** width;

  // Convert to signed
  const aSigned = (a & signBit) ? a - maxValue : a;
  const bSigned = (b & signBit) ? b - maxValue : b;

  const productSigned = aSigned * bSigned;

  // Convert back to unsigned representation
  // Use 2** for outputRange to avoid 1 << 32 === 1 bug
  const outputRange = 2 ** (width * 2);
  const product = productSigned >= 0
    ? (width * 2 >= 32 ? (productSigned >>> 0) : productSigned)
    : ((productSigned + outputRange) >>> 0);

  writeOutput(ctx, 0, product);
}

/**
 * Comparator: n-bit unsigned comparator
 * Inputs: a, b
 * Outputs: eq, lt, gt
 */
export function evalComparator(ctx: EvalContext): void {
  const a = readInput(ctx, 0) >>> 0;
  const b = readInput(ctx, 1) >>> 0;

  writeOutput(ctx, 0, a === b ? 1 : 0);  // eq
  writeOutput(ctx, 1, a < b ? 1 : 0);    // lt
  writeOutput(ctx, 2, a > b ? 1 : 0);    // gt
}

/**
 * SignedComparator: Signed n-bit comparator
 * Inputs: a, b
 * Outputs: eq, lt, gt, lte, gte
 */
export function evalSignedComparator(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  const b = readInput(ctx, 1);

  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const width = (node.arguments.width as number) ?? 8;
  const signBit = 1 << (width - 1);
  const maxValue = 1 << width;

  // Convert to signed
  const aSigned = (a & signBit) ? a - maxValue : a;
  const bSigned = (b & signBit) ? b - maxValue : b;

  writeOutput(ctx, 0, aSigned === bSigned ? 1 : 0);  // eq
  writeOutput(ctx, 1, aSigned < bSigned ? 1 : 0);    // lt
  writeOutput(ctx, 2, aSigned > bSigned ? 1 : 0);    // gt
  writeOutput(ctx, 3, aSigned <= bSigned ? 1 : 0);   // lte
  writeOutput(ctx, 4, aSigned >= bSigned ? 1 : 0);   // gte
}

/**
 * LeftShifter: Logical left shift
 * Inputs: value, shift
 * Outputs: result
 */
export function evalLeftShifter(ctx: EvalContext): void {
  const value = readInput(ctx, 0);
  const shift = readInput(ctx, 1);

  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const width = (node.arguments.width as number) ?? 8;
  const mask = bitMask(width);

  const result = shift >= width ? 0 : (value << shift) & mask;

  writeOutput(ctx, 0, result);
}

/**
 * RightShifter: Logical right shift
 * Inputs: value, shift
 * Outputs: result
 */
export function evalRightShifter(ctx: EvalContext): void {
  const value = readInput(ctx, 0);
  const shift = readInput(ctx, 1);

  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const width = (node.arguments.width as number) ?? 8;

  const result = shift >= width ? 0 : value >>> shift;

  writeOutput(ctx, 0, result);
}
