/**
 * Routing Evaluators for Fast Simulation
 *
 * Numeric evaluators for routing/plexer primitives.
 * All evaluators read inputs directly via typed arrays - no Map allocations.
 */

import type { EvalContext } from './types.js';
import { readInput, writeOutput } from './types.js';

/**
 * Mux: Parameterized multiplexer
 * Inputs: in0, in1, ..., inN-1, sel
 * Outputs: out
 */
export function evalMux(ctx: EvalContext): void {
  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const inputCount = (node.arguments.input_count as number) ?? 2;

  // sel is the last input
  const sel = readInput(ctx, inputCount);

  // Clamp selector to valid range
  const actualSel = Math.max(0, Math.min(Math.floor(sel), inputCount - 1));

  // Read selected input
  const value = readInput(ctx, actualSel);

  writeOutput(ctx, 0, value);
}

/**
 * Decoder: n-to-2^n decoder
 * Inputs: in
 * Outputs: out0, out1, ..., out(2^n-1)
 */
export function evalDecoder(ctx: EvalContext): void {
  const inputValue = readInput(ctx, 0);

  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const inputWidth = (node.arguments.input_width as number) ?? 2;
  const outputCount = 1 << inputWidth;

  // Only one output is high - the one at index == inputValue
  for (let i = 0; i < outputCount; i++) {
    writeOutput(ctx, i, i === inputValue ? 1 : 0);
  }
}

/**
 * Splitter: Splits a bus into smaller buses
 * Inputs: in
 * Outputs: out0, out1, ...
 */
export function evalSplitter(ctx: EvalContext): void {
  const inputValue = readInput(ctx, 0);

  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const widthsOutParam = node.arguments.widths_out;
  const widthsOut = (Array.isArray(widthsOutParam) ? widthsOutParam : [4, 4]) as number[];

  let bitOffset = 0;
  for (let i = 0; i < widthsOut.length; i++) {
    const width = widthsOut[i];
    const mask = (1 << width) - 1;
    const value = (inputValue >> bitOffset) & mask;
    writeOutput(ctx, i, value);
    bitOffset += width;
  }
}

/**
 * Splitter8to8: Splits 8-bit bus into 8 individual bits
 * Inputs: in
 * Outputs: bit0, bit1, ..., bit7
 */
export function evalSplitter8to8(ctx: EvalContext): void {
  const inputValue = readInput(ctx, 0);

  for (let i = 0; i < 8; i++) {
    const bitValue = (inputValue >> i) & 1;
    writeOutput(ctx, i, bitValue);
  }
}

/**
 * BitSlice: Extract bits [low..high] from input
 * Inputs: in
 * Outputs: out
 */
export function evalBitSlice(ctx: EvalContext): void {
  const value = readInput(ctx, 0);

  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const low = (node.arguments.low as number) ?? 0;
  const high = (node.arguments.high as number) ?? 7;

  const numBits = high - low + 1;
  const mask = numBits >= 32 ? 0xFFFFFFFF : (1 << numBits) - 1;
  const result = (value >> low) & mask;

  writeOutput(ctx, 0, result);
}

/**
 * Concat: Concatenate two buses (out = high << lowWidth | low)
 * Inputs: high, low
 * Outputs: out
 */
export function evalConcat(ctx: EvalContext): void {
  const high = readInput(ctx, 0);
  const low = readInput(ctx, 1);

  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const lowWidth = (node.arguments.lowWidth as number) ?? 4;

  writeOutput(ctx, 0, (high << lowWidth) | low);
}

/**
 * Combiner8to8: Combines 8 individual bits into 8-bit bus
 * Inputs: bit0, bit1, ..., bit7
 * Outputs: out
 */
export function evalCombiner8to8(ctx: EvalContext): void {
  let result = 0;

  for (let i = 0; i < 8; i++) {
    const bitValue = readInput(ctx, i);
    if (bitValue) {
      result |= 1 << i;
    }
  }

  writeOutput(ctx, 0, result);
}
