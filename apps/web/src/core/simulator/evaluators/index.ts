/**
 * Evaluator Table for Fast Simulation
 *
 * Maps primitive type indices to evaluator functions.
 * Hot path does a single array lookup: EVALUATORS[typeIndex](ctx)
 */

import type { EvalContext, NumericEvaluator } from './types';
import { readInput, writeOutput } from './types';
import { PRIMITIVE_TYPE_INDICES } from '../numeric-types';

// Import evaluators from modules
import {
  evalAdder,
  evalSubtractor,
  evalMultiplier,
  evalSignedAdder,
  evalSignedMultiplier,
  evalComparator,
  evalSignedComparator,
  evalLeftShifter,
  evalRightShifter,
} from './arithmetic';

import {
  evalMux,
  evalDecoder,
  evalSplitter,
  evalSplitter8to8,
  evalBitSlice,
  evalConcat,
  evalCombiner8to8,
} from './routing';

import {
  evalDFlipFlop,
  evalRegister,
  evalConsole,
  evalRasterDisplay,
  evalScreen,
} from './sequential';

import {
  evalROM,
  evalRAM,
  evalDualPortRAM,
} from './memory';

// ============================================================================
// Inline evaluators for common primitives (same as fast-simulator.ts)
// These are kept inline for maximum JIT optimization
// ============================================================================

function evalAnd(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  const b = readInput(ctx, 1);
  writeOutput(ctx, 0, (a && b) ? 1 : 0);
}

function evalOr(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  const b = readInput(ctx, 1);
  writeOutput(ctx, 0, (a || b) ? 1 : 0);
}

function evalNot(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  writeOutput(ctx, 0, a ? 0 : 1);
}

function evalNand(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  const b = readInput(ctx, 1);
  writeOutput(ctx, 0, (a && b) ? 0 : 1);
}

function evalNor(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  const b = readInput(ctx, 1);
  writeOutput(ctx, 0, (a || b) ? 0 : 1);
}

function evalXor(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  const b = readInput(ctx, 1);
  writeOutput(ctx, 0, (a !== b) ? 1 : 0);
}

function evalXnor(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  const b = readInput(ctx, 1);
  writeOutput(ctx, 0, (a === b) ? 1 : 0);
}

function evalBuffer(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  writeOutput(ctx, 0, a);
}

function evalSwitch(ctx: EvalContext): void {
  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const val = Boolean(node.arguments.value ?? false);
  writeOutput(ctx, 0, val ? 1 : 0);
}

function evalButton(ctx: EvalContext): void {
  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const val = Boolean(node.arguments.value ?? false);
  writeOutput(ctx, 0, val ? 1 : 0);
}

function evalInput(ctx: EvalContext): void {
  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const val = typeof node.arguments.value === 'number' ? node.arguments.value : 0;
  writeOutput(ctx, 0, val);
}

function evalConstant(ctx: EvalContext): void {
  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const val = typeof node.arguments.value === 'number' ? node.arguments.value : 0;
  writeOutput(ctx, 0, val);
}

function evalLed(_ctx: EvalContext): void {
  // Sink - no outputs
}

function evalOutput(_ctx: EvalContext): void {
  // Sink - no outputs
}

function evalSevenSegment(_ctx: EvalContext): void {
  // Sink - no outputs
}

function evalHexDisplay(_ctx: EvalContext): void {
  // Sink - no outputs
}

function evalBusAnd(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  const b = readInput(ctx, 1);
  writeOutput(ctx, 0, a & b);
}

function evalBusOr(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  const b = readInput(ctx, 1);
  writeOutput(ctx, 0, a | b);
}

function evalBusNot(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  writeOutput(ctx, 0, ~a);
}

function evalBusXor(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  const b = readInput(ctx, 1);
  writeOutput(ctx, 0, a ^ b);
}

function evalIncrementer(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  writeOutput(ctx, 0, (a + 1) & 0xFF);
}

function evalProbe(ctx: EvalContext): void {
  const a = readInput(ctx, 0);
  writeOutput(ctx, 0, a);
}

function evalAddressCombiner(ctx: EvalContext): void {
  const lo = readInput(ctx, 0);
  const hi = readInput(ctx, 1);
  writeOutput(ctx, 0, ((hi & 0xFF) << 8) | (lo & 0xFF));
}

// ============================================================================
// Build EVALUATORS table
// ============================================================================

// Pre-allocate array with null entries
const maxIndex = Math.max(...Object.values(PRIMITIVE_TYPE_INDICES)) + 1;
export const EVALUATORS: (NumericEvaluator | null)[] = new Array(maxIndex).fill(null);

// Logic gates
EVALUATORS[PRIMITIVE_TYPE_INDICES.And] = evalAnd;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Or] = evalOr;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Not] = evalNot;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Nand] = evalNand;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Nor] = evalNor;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Xor] = evalXor;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Xnor] = evalXnor;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Buffer] = evalBuffer;

// I/O components
EVALUATORS[PRIMITIVE_TYPE_INDICES.Switch] = evalSwitch;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Led] = evalLed;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Output] = evalOutput;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Button] = evalButton;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Input] = evalInput;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Constant] = evalConstant;

// Utilities
EVALUATORS[PRIMITIVE_TYPE_INDICES.Splitter] = evalSplitter;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Splitter8to8] = evalSplitter8to8;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Combiner8to8] = evalCombiner8to8;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Probe] = evalProbe;
EVALUATORS[PRIMITIVE_TYPE_INDICES.BitSlice] = evalBitSlice;
EVALUATORS[PRIMITIVE_TYPE_INDICES.AddressCombiner] = evalAddressCombiner;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Concat] = evalConcat;

// Bus operations
EVALUATORS[PRIMITIVE_TYPE_INDICES.BusAnd] = evalBusAnd;
EVALUATORS[PRIMITIVE_TYPE_INDICES.BusOr] = evalBusOr;
EVALUATORS[PRIMITIVE_TYPE_INDICES.BusNot] = evalBusNot;
EVALUATORS[PRIMITIVE_TYPE_INDICES.BusXor] = evalBusXor;

// Arithmetic
EVALUATORS[PRIMITIVE_TYPE_INDICES.Incrementer] = evalIncrementer;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Adder] = evalAdder;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Multiplier] = evalMultiplier;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Comparator] = evalComparator;
EVALUATORS[PRIMITIVE_TYPE_INDICES.LeftShifter] = evalLeftShifter;
EVALUATORS[PRIMITIVE_TYPE_INDICES.RightShifter] = evalRightShifter;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Subtractor] = evalSubtractor;
EVALUATORS[PRIMITIVE_TYPE_INDICES.SignedAdder] = evalSignedAdder;
EVALUATORS[PRIMITIVE_TYPE_INDICES.SignedComparator] = evalSignedComparator;
EVALUATORS[PRIMITIVE_TYPE_INDICES.SignedMultiplier] = evalSignedMultiplier;

// Plexers
EVALUATORS[PRIMITIVE_TYPE_INDICES.Mux] = evalMux;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Decoder] = evalDecoder;

// Display
EVALUATORS[PRIMITIVE_TYPE_INDICES.SevenSegment] = evalSevenSegment;
EVALUATORS[PRIMITIVE_TYPE_INDICES.HexDisplay] = evalHexDisplay;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Screen] = evalScreen;
EVALUATORS[PRIMITIVE_TYPE_INDICES.RasterDisplay] = evalRasterDisplay;

// Sequential
EVALUATORS[PRIMITIVE_TYPE_INDICES.DFlipFlop] = evalDFlipFlop;
EVALUATORS[PRIMITIVE_TYPE_INDICES.Register] = evalRegister;

// Memory
EVALUATORS[PRIMITIVE_TYPE_INDICES.ROM] = evalROM;
EVALUATORS[PRIMITIVE_TYPE_INDICES.RAM] = evalRAM;
EVALUATORS[PRIMITIVE_TYPE_INDICES.DualPortRAM] = evalDualPortRAM;

// I/O Devices
EVALUATORS[PRIMITIVE_TYPE_INDICES.Console] = evalConsole;

// Re-export types
export type { EvalContext, NumericEvaluator, NumericSequentialState } from './types';
export { readInput, writeOutput } from './types';
