/**
 * Arithmetic Evaluators for Fast Simulation
 *
 * Numeric evaluators for arithmetic primitives.
 * All evaluators read inputs directly via typed arrays - no Map allocations.
 */

import type { EvalContext } from './types.js';
import { readInput, writeOutput } from './types.js';

/**
 * Adder: n-bit adder with carry in/out
 * Inputs: a, b, carry_in
 * Outputs: sum, carry_out
 */
export function evalAdder(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  const b = readInput(ctx, 1);
  const carryIn = readInput(ctx, 2) ? 1 : 0;

  // Get width from node arguments
  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const width = (node.arguments.width as number) ?? 8;
  const mask = (1 << width) - 1;

  const result = a + b + carryIn;
  const sum = result & mask;
  const carryOut = (result >> width) !== 0 ? 1 : 0;

  writeOutput(ctx, 0, sum);
  writeOutput(ctx, 1, carryOut);
}

/**
 * Subtractor: n-bit subtractor with borrow in/out
 * Inputs: a, b, borrow_in
 * Outputs: difference, borrow_out
 */
export function evalSubtractor(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  const b = readInput(ctx, 1);
  const borrowIn = readInput(ctx, 2) ? 1 : 0;

  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const width = (node.arguments.width as number) ?? 8;
  const mask = (1 << width) - 1;

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
  const a = readInput(ctx, 0);
  const b = readInput(ctx, 1);

  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const width = (node.arguments.width as number) ?? 8;
  const mask = (1 << (width * 2)) - 1;

  const product = (a * b) & mask;

  writeOutput(ctx, 0, product);
}

/**
 * SignedAdder: Signed n-bit adder with overflow detection
 * Inputs: a, b, carry_in
 * Outputs: sum, overflow, carry_out
 */
export function evalSignedAdder(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  const b = readInput(ctx, 1);
  const carryIn = readInput(ctx, 2) ? 1 : 0;

  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const width = (node.arguments.width as number) ?? 8;
  const mask = (1 << width) - 1;
  const signBit = 1 << (width - 1);

  const result = a + b + carryIn;
  const sum = result & mask;
  const carryOut = (result >> width) !== 0 ? 1 : 0;

  // Overflow: both inputs have same sign, but result has different sign
  const aSign = (a & signBit) !== 0;
  const bSign = (b & signBit) !== 0;
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
  const signBit = 1 << (width - 1);
  const maxValue = 1 << width;
  const outputMask = (1 << (width * 2)) - 1;

  // Convert to signed
  const aSigned = (a & signBit) ? a - maxValue : a;
  const bSigned = (b & signBit) ? b - maxValue : b;

  const productSigned = aSigned * bSigned;

  // Convert back to unsigned representation
  const product = productSigned >= 0
    ? productSigned
    : (productSigned + (1 << (width * 2))) & outputMask;

  writeOutput(ctx, 0, product);
}

/**
 * Comparator: n-bit unsigned comparator
 * Inputs: a, b
 * Outputs: eq, lt, gt
 */
export function evalComparator(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  const b = readInput(ctx, 1);

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
  const mask = (1 << width) - 1;

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
