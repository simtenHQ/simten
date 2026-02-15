/**
 * Core Primitive Component Definitions
 *
 * Pure primitive evaluators for the simulator engine.
 * This module provides evaluation logic without UI dependencies.
 *
 * For full primitive definitions including UI metadata, see:
 * src/features/visual-editor/lib/primitives.ts
 */

import type {
  BitValue,
  BusValue,
  Circuit,
  PortDescriptor,
  ClockDescriptor,
  StateBlock,
  Parameter,
  PrimitiveState,
} from './types';
import { bitType, busType } from './types';
import {
  createCombinationalEvaluator,
  createSequentialEvaluator,
  type PrimitiveEvaluator,
  type InputValue,
  type ClockEdges,
  type EvaluationContext,
} from './primitive-interface';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Core primitive definition (subset for simulator)
 */
export interface CorePrimitiveDefinition {
  name: string;
  description: string;
  inputs: PortDescriptor[];
  outputs: PortDescriptor[];
  clocks?: ClockDescriptor[];
  state?: StateBlock[];
  parameters?: Parameter[];
  evaluator: PrimitiveEvaluator;
  outputDependency?: 'state-only' | 'state+inputs' | 'input-dependent';
}

// ============================================================================
// Helper Functions for Defining Primitives
// ============================================================================

function defineCombinational(config: {
  name: string;
  description: string;
  inputs: PortDescriptor[];
  outputs: PortDescriptor[];
  parameters?: Parameter[];
  evaluate: (
    inputs: Map<string, InputValue>,
    currentState?: PrimitiveState,
    context?: EvaluationContext
  ) => Map<string, BitValue | BusValue>;
}): CorePrimitiveDefinition {
  return {
    name: config.name,
    description: config.description,
    inputs: config.inputs,
    outputs: config.outputs,
    parameters: config.parameters,
    evaluator: createCombinationalEvaluator(config.evaluate),
  };
}

function defineSequential(config: {
  name: string;
  description: string;
  inputs: PortDescriptor[];
  outputs: PortDescriptor[];
  clocks: ClockDescriptor[];
  state: StateBlock[];
  parameters?: Parameter[];
  evaluate: (
    inputs: Map<string, InputValue>,
    currentState?: PrimitiveState
  ) => Map<string, BitValue | BusValue>;
  updateState: (inputs: Map<string, InputValue>, currentState: PrimitiveState, clockEdges: ClockEdges) => PrimitiveState;
  outputDependency?: 'state-only' | 'state+inputs' | 'input-dependent';
}): CorePrimitiveDefinition {
  return {
    name: config.name,
    description: config.description,
    inputs: config.inputs,
    outputs: config.outputs,
    clocks: config.clocks,
    state: config.state,
    parameters: config.parameters,
    evaluator: createSequentialEvaluator(config.evaluate, config.updateState),
    outputDependency: config.outputDependency,
  };
}

// ============================================================================
// Primitive Definitions
// ============================================================================

export const PRIMITIVE_DEFINITIONS: Record<string, CorePrimitiveDefinition> = {
  // ============================================================================
  // Logic Gates
  // ============================================================================

  And: defineCombinational({
    name: 'And',
    description: 'Logical AND gate - outputs true when both inputs are true',
    inputs: [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as boolean;
      const b = inputs.get('b') as boolean;
      return new Map([['out', a && b]]);
    },
  }),

  Or: defineCombinational({
    name: 'Or',
    description: 'Logical OR gate - outputs true when at least one input is true',
    inputs: [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as boolean;
      const b = inputs.get('b') as boolean;
      return new Map([['out', a || b]]);
    },
  }),

  Not: defineCombinational({
    name: 'Not',
    description: 'Logical NOT gate - inverts the input',
    inputs: [{ name: 'in', portType: bitType() }],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const a = inputs.get('in') as boolean;
      return new Map([['out', !a]]);
    },
  }),

  Nand: defineCombinational({
    name: 'Nand',
    description: 'Logical NAND gate - outputs false only when both inputs are true',
    inputs: [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as boolean;
      const b = inputs.get('b') as boolean;
      return new Map([['out', !(a && b)]]);
    },
  }),

  Nor: defineCombinational({
    name: 'Nor',
    description: 'Logical NOR gate - outputs true only when both inputs are false',
    inputs: [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as boolean;
      const b = inputs.get('b') as boolean;
      return new Map([['out', !(a || b)]]);
    },
  }),

  Xor: defineCombinational({
    name: 'Xor',
    description: 'Logical XOR gate - outputs true when inputs are different',
    inputs: [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as boolean;
      const b = inputs.get('b') as boolean;
      return new Map([['out', a !== b]]);
    },
  }),

  Xnor: defineCombinational({
    name: 'Xnor',
    description: 'Logical XNOR gate - outputs true when inputs are the same',
    inputs: [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as boolean;
      const b = inputs.get('b') as boolean;
      return new Map([['out', a === b]]);
    },
  }),

  Buffer: defineCombinational({
    name: 'Buffer',
    description: 'Buffer - passes the input through unchanged',
    inputs: [{ name: 'in', portType: bitType() }],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const a = inputs.get('in') as boolean;
      return new Map([['out', a]]);
    },
  }),

  // ============================================================================
  // I/O Components
  // ============================================================================

  Switch: defineCombinational({
    name: 'Switch',
    description: 'User-controllable input switch',
    inputs: [],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (_inputs) => {
      return new Map([['out', false]]);
    },
  }),

  Led: defineCombinational({
    name: 'Led',
    description: 'Visual output LED indicator',
    inputs: [{ name: 'in', portType: bitType() }],
    outputs: [],
    evaluate: (_inputs) => {
      return new Map();
    },
  }),

  Output: defineCombinational({
    name: 'Output',
    description: 'Multi-bit output sink (for testbenches)',
    inputs: [{ name: 'in', portType: busType(8) }],
    outputs: [],
    evaluate: (_inputs) => {
      return new Map();
    },
  }),

  Button: defineCombinational({
    name: 'Button',
    description: 'Push button input (momentary, user-controlled)',
    inputs: [],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (_inputs) => {
      return new Map([['out', false]]);
    },
  }),

  Input: defineCombinational({
    name: 'Input',
    description: 'Multi-bit numeric input (runtime editable, default: 8-bit)',
    inputs: [],
    outputs: [{ name: 'out', portType: busType(8) }],
    evaluate: (inputs) => {
      const value = (inputs.get('__value') as number) ?? 0;
      return new Map([['out', value]]);
    },
  }),

  // ============================================================================
  // Utilities
  // ============================================================================

  Constant: defineCombinational({
    name: 'Constant',
    description: 'Constant value source (parameterized by value)',
    inputs: [],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const value = inputs.get('__value') as BitValue | BusValue | undefined;
      return new Map([['out', value ?? 0]]);
    },
  }),

  Splitter: defineCombinational({
    name: 'Splitter',
    description: 'Bus splitter - splits a bus into smaller buses',
    inputs: [{ name: 'in', portType: busType(8) }],
    outputs: [
      { name: 'out0', portType: busType(4) },
      { name: 'out1', portType: busType(4) },
    ],
    evaluate: (inputs) => {
      const inputValue = inputs.get('in') as number;
      const widthsOutParam = inputs.get('__widths_out');
      const widthsOut = (Array.isArray(widthsOutParam) ? widthsOutParam : [4, 4]) as number[];

      const outputs = new Map<string, boolean | number>();
      let bitOffset = 0;

      for (let i = 0; i < widthsOut.length; i++) {
        const width = widthsOut[i];
        const mask = (1 << width) - 1;
        const value = (inputValue >> bitOffset) & mask;

        if (width === 1) {
          outputs.set(`out${i}`, value !== 0);
        } else {
          outputs.set(`out${i}`, value);
        }

        bitOffset += width;
      }

      return outputs;
    },
  }),

  Splitter8to8: defineCombinational({
    name: 'Splitter8to8',
    description: 'Splits an 8-bit bus into 8 individual bit outputs',
    inputs: [{ name: 'in', portType: busType(8) }],
    outputs: [
      { name: 'bit0', portType: bitType() },
      { name: 'bit1', portType: bitType() },
      { name: 'bit2', portType: bitType() },
      { name: 'bit3', portType: bitType() },
      { name: 'bit4', portType: bitType() },
      { name: 'bit5', portType: bitType() },
      { name: 'bit6', portType: bitType() },
      { name: 'bit7', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const inputValue = inputs.get('in') as number;
      const outputs = new Map<string, boolean | number>();

      for (let i = 0; i < 8; i++) {
        const bitValue = (inputValue >> i) & 1;
        outputs.set(`bit${i}`, bitValue !== 0);
      }

      return outputs;
    },
  }),

  Combiner8to8: defineCombinational({
    name: 'Combiner8to8',
    description: 'Combines 8 individual bit inputs into an 8-bit bus',
    inputs: [
      { name: 'bit0', portType: bitType() },
      { name: 'bit1', portType: bitType() },
      { name: 'bit2', portType: bitType() },
      { name: 'bit3', portType: bitType() },
      { name: 'bit4', portType: bitType() },
      { name: 'bit5', portType: bitType() },
      { name: 'bit6', portType: bitType() },
      { name: 'bit7', portType: bitType() },
    ],
    outputs: [{ name: 'out', portType: busType(8) }],
    evaluate: (inputs) => {
      let result = 0;

      for (let i = 0; i < 8; i++) {
        const bitValue = inputs.get(`bit${i}`) as boolean | number | undefined;
        if (bitValue) {
          result |= 1 << i;
        }
      }

      return new Map([['out', result]]);
    },
  }),

  Probe: defineCombinational({
    name: 'Probe',
    description: 'Debug observation point - passes signal through unchanged',
    inputs: [{ name: 'in', portType: bitType() }],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const value = inputs.get('in') as BitValue | BusValue | undefined;
      return new Map([['out', value ?? false]]);
    },
  }),

  BitSlice: defineCombinational({
    name: 'BitSlice',
    description: 'Extract bits [low..high] from input',
    inputs: [{ name: 'in', portType: busType(8) }],
    outputs: [{ name: 'out', portType: busType(8) }],
    evaluate: (inputs) => {
      const value = inputs.get('in') as number;
      const low = (inputs.get('__low') as number) ?? 0;
      const high = (inputs.get('__high') as number) ?? 2;

      const numBits = high - low + 1;
      const mask = (1 << numBits) - 1;
      const result = (value >> low) & mask;

      return new Map([['out', result]]);
    },
  }),

  AddressCombiner: defineCombinational({
    name: 'AddressCombiner',
    description: 'Combines two 8-bit buses into one 16-bit bus (hi << 8 | lo)',
    inputs: [
      { name: 'lo', portType: busType(8) },
      { name: 'hi', portType: busType(8) },
    ],
    outputs: [{ name: 'out', portType: busType(16) }],
    evaluate: (inputs) => {
      const lo = (inputs.get('lo') as number) ?? 0;
      const hi = (inputs.get('hi') as number) ?? 0;
      return new Map([['out', ((hi & 0xff) << 8) | (lo & 0xff)]]);
    },
  }),

  // ============================================================================
  // Bus Operations
  // ============================================================================

  BusAnd: defineCombinational({
    name: 'BusAnd',
    description: 'Bitwise AND operation on 8-bit buses',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    outputs: [{ name: 'out', portType: busType(8) }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;
      return new Map([['out', a & b]]);
    },
  }),

  BusOr: defineCombinational({
    name: 'BusOr',
    description: 'Bitwise OR operation on 8-bit buses',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    outputs: [{ name: 'out', portType: busType(8) }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;
      return new Map([['out', a | b]]);
    },
  }),

  BusNot: defineCombinational({
    name: 'BusNot',
    description: 'Bitwise NOT operation on 8-bit bus',
    inputs: [{ name: 'in', portType: busType(8) }],
    outputs: [{ name: 'out', portType: busType(8) }],
    evaluate: (inputs) => {
      const a = inputs.get('in') as number;
      return new Map([['out', ~a]]);
    },
  }),

  BusXor: defineCombinational({
    name: 'BusXor',
    description: 'Bitwise XOR operation on 8-bit buses',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    outputs: [{ name: 'out', portType: busType(8) }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;
      return new Map([['out', a ^ b]]);
    },
  }),

  // ============================================================================
  // Arithmetic Operations
  // ============================================================================

  Incrementer: defineCombinational({
    name: 'Incrementer',
    description: 'Incrementer - adds 1 to the input (wraps around at 255)',
    inputs: [{ name: 'in', portType: busType(8) }],
    outputs: [{ name: 'out', portType: busType(8) }],
    evaluate: (inputs) => {
      const value = inputs.get('in') as number;
      const width = 8;
      const maxValue = (1 << width) - 1;
      const result = (value + 1) & maxValue;
      return new Map([['out', result]]);
    },
  }),

  Adder: defineCombinational({
    name: 'Adder',
    description: 'Parameterized n-bit adder with carry in/out',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
      { name: 'carry_in', portType: bitType() },
    ],
    outputs: [
      { name: 'sum', portType: busType(8) },
      { name: 'carry_out', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;
      const carryIn = (inputs.get('carry_in') as boolean) ?? false ? 1 : 0;

      const width = (inputs.get('__width') as number) ?? 8;
      const mask = (1 << width) - 1;

      const result = a + b + carryIn;
      const sum = result & mask;
      const carryOut = (result >> width) !== 0;

      return new Map<string, boolean | number>([
        ['sum', sum],
        ['carry_out', carryOut],
      ]);
    },
  }),

  Multiplier: defineCombinational({
    name: 'Multiplier',
    description: 'Parameterized n×n bit multiplier',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    outputs: [{ name: 'product', portType: busType(16) }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;

      const width = (inputs.get('__width') as number) ?? 8;
      const mask = (1 << (width * 2)) - 1;

      const product = (a * b) & mask;

      return new Map([['product', product]]);
    },
  }),

  Comparator: defineCombinational({
    name: 'Comparator',
    description: 'Parameterized n-bit comparator',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    outputs: [
      { name: 'eq', portType: bitType() },
      { name: 'lt', portType: bitType() },
      { name: 'gt', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;

      return new Map([
        ['eq', a === b],
        ['lt', a < b],
        ['gt', a > b],
      ]);
    },
  }),

  LeftShifter: defineCombinational({
    name: 'LeftShifter',
    description: 'Logical left bit shift (value << n)',
    inputs: [
      { name: 'value', portType: busType(8) },
      { name: 'shift', portType: busType(8) },
    ],
    outputs: [{ name: 'result', portType: busType(8) }],
    evaluate: (inputs) => {
      const value = inputs.get('value') as number;
      const shift = inputs.get('shift') as number;
      const width = (inputs.get('__width') as number) ?? 8;

      const mask = (1 << width) - 1;
      const result = shift >= width ? 0 : (value << shift) & mask;

      return new Map([['result', result]]);
    },
  }),

  RightShifter: defineCombinational({
    name: 'RightShifter',
    description: 'Logical right bit shift (value >> n)',
    inputs: [
      { name: 'value', portType: busType(8) },
      { name: 'shift', portType: busType(8) },
    ],
    outputs: [{ name: 'result', portType: busType(8) }],
    evaluate: (inputs) => {
      const value = inputs.get('value') as number;
      const shift = inputs.get('shift') as number;
      const width = (inputs.get('__width') as number) ?? 8;

      const result = shift >= width ? 0 : value >>> shift;

      return new Map([['result', result]]);
    },
  }),

  Subtractor: defineCombinational({
    name: 'Subtractor',
    description: 'Parameterized n-bit subtractor with borrow in/out',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
      { name: 'borrow_in', portType: bitType() },
    ],
    outputs: [
      { name: 'difference', portType: busType(8) },
      { name: 'borrow_out', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;
      const borrowIn = (inputs.get('borrow_in') as boolean) ?? false ? 1 : 0;

      const width = (inputs.get('__width') as number) ?? 8;
      const mask = (1 << width) - 1;

      const result = a - b - borrowIn;
      const difference = result & mask;
      const borrowOut = result < 0;

      return new Map<string, boolean | number>([
        ['difference', difference],
        ['borrow_out', borrowOut],
      ]);
    },
  }),

  SignedAdder: defineCombinational({
    name: 'SignedAdder',
    description: 'Signed n-bit adder with overflow detection',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
      { name: 'carry_in', portType: bitType() },
    ],
    outputs: [
      { name: 'sum', portType: busType(8) },
      { name: 'overflow', portType: bitType() },
      { name: 'carry_out', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;
      const carryIn = (inputs.get('carry_in') as boolean) ?? false ? 1 : 0;

      const width = (inputs.get('__width') as number) ?? 8;
      const mask = (1 << width) - 1;
      const signBit = 1 << (width - 1);

      const result = a + b + carryIn;
      const sum = result & mask;
      const carryOut = (result >> width) !== 0;

      const aSign = (a & signBit) !== 0;
      const bSign = (b & signBit) !== 0;
      const sumSign = (sum & signBit) !== 0;
      const overflow = aSign === bSign && aSign !== sumSign;

      return new Map<string, boolean | number>([
        ['sum', sum],
        ['overflow', overflow],
        ['carry_out', carryOut],
      ]);
    },
  }),

  SignedComparator: defineCombinational({
    name: 'SignedComparator',
    description: 'Signed n-bit comparator with all comparison flags',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    outputs: [
      { name: 'eq', portType: bitType() },
      { name: 'lt', portType: bitType() },
      { name: 'gt', portType: bitType() },
      { name: 'lte', portType: bitType() },
      { name: 'gte', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;

      const width = (inputs.get('__width') as number) ?? 8;
      const signBit = 1 << (width - 1);
      const maxValue = 1 << width;

      const aSigned = (a & signBit) ? a - maxValue : a;
      const bSigned = (b & signBit) ? b - maxValue : b;

      const eq = aSigned === bSigned;
      const lt = aSigned < bSigned;
      const gt = aSigned > bSigned;
      const lte = aSigned <= bSigned;
      const gte = aSigned >= bSigned;

      return new Map([
        ['eq', eq],
        ['lt', lt],
        ['gt', gt],
        ['lte', lte],
        ['gte', gte],
      ]);
    },
  }),

  SignedMultiplier: defineCombinational({
    name: 'SignedMultiplier',
    description: 'Signed n×n bit multiplier',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    outputs: [{ name: 'product', portType: busType(16) }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;

      const width = (inputs.get('__width') as number) ?? 8;
      const signBit = 1 << (width - 1);
      const maxValue = 1 << width;
      const outputMask = (1 << (width * 2)) - 1;

      const aSigned = (a & signBit) ? a - maxValue : a;
      const bSigned = (b & signBit) ? b - maxValue : b;

      const productSigned = aSigned * bSigned;

      const product = productSigned >= 0
        ? productSigned
        : (productSigned + (1 << (width * 2))) & outputMask;

      return new Map([['product', product]]);
    },
  }),

  // ============================================================================
  // Plexers
  // ============================================================================

  Mux: defineCombinational({
    name: 'Mux',
    description: 'Parameterized multiplexer',
    inputs: [
      { name: 'in0', portType: bitType() },
      { name: 'in1', portType: bitType() },
      { name: 'sel', portType: bitType() },
    ],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const inputCount = (inputs.get('__input_count') as number) ?? 2;
      const width = (inputs.get('__width') as number) ?? 1;
      const selValue = inputs.get('sel');
      const sel = typeof selValue === 'boolean' ? (selValue ? 1 : 0) : (typeof selValue === 'number' ? selValue : 0);

      const actualSel = Math.max(0, Math.min(Math.floor(sel), inputCount - 1));
      const value = inputs.get(`in${actualSel}`) as BitValue | BusValue | undefined;

      const fallback = (width === 1) ? false : 0;
      const output = value !== undefined ? value : fallback;

      return new Map([['out', output]]);
    },
  }),

  Decoder: defineCombinational({
    name: 'Decoder',
    description: 'Parameterized n-to-2^n decoder',
    inputs: [{ name: 'in', portType: busType(2) }],
    outputs: [
      { name: 'out0', portType: bitType() },
      { name: 'out1', portType: bitType() },
      { name: 'out2', portType: bitType() },
      { name: 'out3', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const inputWidth = (inputs.get('__input_width') as number) ?? 2;
      const inputValue = inputs.get('in') as number;
      const outputCount = 1 << inputWidth;

      const outputs = new Map<string, boolean | number>();
      for (let i = 0; i < outputCount; i++) {
        outputs.set(`out${i}`, i === inputValue);
      }

      return outputs;
    },
  }),

  // ============================================================================
  // Display Components
  // ============================================================================

  SevenSegment: defineCombinational({
    name: 'SevenSegment',
    description: '7-segment display for hexadecimal digits',
    inputs: [{ name: 'in', portType: busType(4) }],
    outputs: [],
    evaluate: (_inputs) => {
      return new Map();
    },
  }),

  HexDisplay: defineCombinational({
    name: 'HexDisplay',
    description: 'Hexadecimal display for multi-bit values',
    inputs: [{ name: 'in', portType: busType(8) }],
    outputs: [],
    evaluate: (_inputs) => {
      return new Map();
    },
  }),

  Screen: defineCombinational({
    name: 'Screen',
    description: '8x8 pixel display',
    inputs: [{ name: 'dataIn', portType: busType(8) }],
    outputs: [{ name: 'addrB', portType: busType(8) }],
    evaluate: (_inputs, _currentState, _context) => {
      return new Map([['addrB', 0]]);
    },
  }),

  RasterDisplay: defineSequential({
    name: 'RasterDisplay',
    description: 'Hardware-accurate 8×8 raster display with scan counters',
    inputs: [{ name: 'dataIn', portType: busType(8) }],
    outputs: [
      { name: 'addrB', portType: busType(8) },
      { name: 'scanX', portType: busType(4) },
      { name: 'scanY', portType: busType(4) },
      { name: 'hblank', portType: bitType() },
      { name: 'vblank', portType: bitType() },
    ],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'raster-state',
        name: 'rasterState',
        stateType: { kind: 'memory', addressWidth: 8, dataWidth: 8 },
        initialValue: (() => {
          const initialMap = new Map<number, number>();
          initialMap.set(-1, 0);
          initialMap.set(-2, 0);
          return { data: initialMap, addressWidth: 8, dataWidth: 8 };
        })(),
      },
    ],
    evaluate: (inputs, currentState) => {
      const state = (currentState ?? new Map()) as Map<number, number>;
      const scanX = state.get(-1) ?? 0;
      const scanY = state.get(-2) ?? 0;

      const addr = scanY < 8 && scanX < 8 ? scanY * 8 + scanX : 0;
      const hblank = scanX >= 8;
      const vblank = scanY >= 8;

      return new Map<string, boolean | number>([
        ['addrB', addr],
        ['scanX', scanX],
        ['scanY', scanY],
        ['hblank', hblank],
        ['vblank', vblank],
      ]);
    },
    updateState: (inputs, currentState, clockEdges) => {
      if (clockEdges['clk'] !== 'rising') {
        return currentState;
      }

      const state = (currentState ?? new Map()) as Map<number, number>;
      let scanX = state.get(-1) ?? 0;
      let scanY = state.get(-2) ?? 0;

      const dataIn = (inputs.get('dataIn') as number) ?? 0;
      const newState = new Map(state);

      if (scanX < 8 && scanY < 8) {
        const addr = scanY * 8 + scanX;
        newState.set(addr, dataIn);
      }

      scanX++;
      if (scanX >= 10) {
        scanX = 0;
        scanY++;
        if (scanY >= 10) {
          scanY = 0;
        }
      }

      newState.set(-1, scanX);
      newState.set(-2, scanY);

      return newState;
    },
    outputDependency: 'state-only',
  }),

  // ============================================================================
  // Sequential Components
  // ============================================================================

  DFlipFlop: defineSequential({
    name: 'DFlipFlop',
    description: 'D Flip-Flop - stores 1 bit of state',
    inputs: [{ name: 'd', portType: bitType() }],
    outputs: [
      { name: 'q', portType: bitType() },
      { name: 'q_bar', portType: bitType() },
    ],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'dff-state',
        name: 'value',
        stateType: bitType(),
        initialValue: false,
      },
    ],
    evaluate: (_inputs, currentState) => {
      const state = (currentState ?? false) as boolean;
      return new Map([
        ['q', state],
        ['q_bar', !state],
      ]);
    },
    updateState: (inputs, currentState, clockEdges) => {
      // Convert to boolean - fast simulator passes numbers (0/1)
      const d = Boolean(inputs.get('d'));
      const edge = clockEdges['clk'] ?? 'none';

      if (edge === 'rising') {
        return d;
      }

      return currentState;
    },
    outputDependency: 'state-only',
  }),

  Register: defineSequential({
    name: 'Register',
    description: '8-bit Register - stores data on rising clock edge',
    inputs: [
      { name: 'data', portType: busType(8) },
      { name: 'we', portType: bitType() },
    ],
    outputs: [{ name: 'q', portType: busType(8) }],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'reg-state',
        name: 'value',
        stateType: busType(8),
        initialValue: 0,
      },
    ],
    evaluate: (_inputs, currentState) => {
      const state = typeof currentState === 'number' ? currentState : 0;
      return new Map([['q', state]]);
    },
    updateState: (inputs, currentState, clockEdges) => {
      const rawData = inputs.get('data');
      const data = typeof rawData === 'number' ? rawData : (rawData ? 1 : 0);
      const we = inputs.get('we');
      const edge = clockEdges['clk'] ?? 'none';

      if (edge === 'rising' && we) {
        return data;
      }

      return typeof currentState === 'number' ? currentState : 0;
    },
    outputDependency: 'state-only',
  }),

  // ============================================================================
  // Memory Components
  // ============================================================================

  ROM: defineSequential({
    name: 'ROM',
    description: 'Read-only memory with address decoding',
    inputs: [{ name: 'addr', portType: busType(16) }],
    outputs: [{ name: 'data_out', portType: busType(8) }],
    clocks: [],
    state: [
      {
        id: 'rom-state',
        name: 'memory',
        stateType: { kind: 'memory', addressWidth: 16, dataWidth: 8 },
        initialValue: { data: new Map(), addressWidth: 16, dataWidth: 8 },
      },
    ],
    evaluate: (inputs, currentState) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const addr = inputs.get('addr') as number;

      const baseAddress = (inputs.get('__baseAddress') as number) ?? 0;
      const internalAddr = (addr - baseAddress) & 0xFFFF;

      const data = memory.get(internalAddr) ?? 0;

      return new Map([['data_out', data]]);
    },
    updateState: (_inputs, currentState, _clockEdges) => {
      return currentState;
    },
    outputDependency: 'state+inputs',
  }),

  RAM: defineSequential({
    name: 'RAM',
    description: '256x8 RAM - reads are combinational, writes occur on rising clock',
    inputs: [
      { name: 'addr', portType: busType(8) },
      { name: 'data_in', portType: busType(8) },
      { name: 'we', portType: bitType() },
    ],
    outputs: [{ name: 'data_out', portType: busType(8) }],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'ram-state',
        name: 'memory',
        stateType: { kind: 'memory', addressWidth: 8, dataWidth: 8 },
        initialValue: { data: new Map(), addressWidth: 8, dataWidth: 8 },
      },
    ],
    evaluate: (inputs, currentState) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const addr = inputs.get('addr') as number;
      const data = memory.get(addr) ?? 0;
      return new Map([['data_out', data]]);
    },
    updateState: (inputs, currentState, clockEdges) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const addr = inputs.get('addr') as number;
      const dataIn = inputs.get('data_in') as number;
      const we = inputs.get('we') as boolean;
      const edge = clockEdges['clk'] ?? 'none';

      if (edge === 'rising' && we) {
        const newMemory = new Map(memory);
        newMemory.set(addr, dataIn);
        return newMemory;
      }

      return memory;
    },
    outputDependency: 'state+inputs',
  }),

  DualPortRAM: defineSequential({
    name: 'DualPortRAM',
    description: '256x8 Dual-Port RAM',
    inputs: [
      { name: 'addrA', portType: busType(8) },
      { name: 'dataA', portType: busType(8) },
      { name: 'weA', portType: bitType() },
      { name: 'addrB', portType: busType(8) },
    ],
    outputs: [
      { name: 'dataA', portType: busType(8) },
      { name: 'dataB', portType: busType(8) },
    ],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'dualram-state',
        name: 'memory',
        stateType: { kind: 'memory', addressWidth: 8, dataWidth: 8 },
        initialValue: { data: new Map(), addressWidth: 8, dataWidth: 8 },
      },
    ],
    evaluate: (inputs, currentState) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const addrA = inputs.get('addrA') as number;
      const addrB = inputs.get('addrB') as number;
      const dataA = memory.get(addrA) ?? 0;
      const dataB = memory.get(addrB) ?? 0;
      return new Map([
        ['dataA', dataA],
        ['dataB', dataB],
      ]);
    },
    updateState: (inputs, currentState, clockEdges) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const addrA = inputs.get('addrA') as number;
      const dataA = inputs.get('dataA') as number;
      const weA = inputs.get('weA') as boolean;
      const edge = clockEdges['clk'] ?? 'none';

      if (edge === 'rising' && weA) {
        const newMemory = new Map(memory);
        newMemory.set(addrA, dataA);
        return newMemory;
      }

      return memory;
    },
  }),

  // ============================================================================
  // I/O Devices
  // ============================================================================

  Console: defineSequential({
    name: 'Console',
    description: 'Memory-mapped console output device',
    inputs: [
      { name: 'data', portType: busType(8) },
      { name: 'we', portType: bitType() },
    ],
    outputs: [
      { name: 'text', portType: { kind: 'bus', width: 8 } },
    ],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'console-state',
        name: 'text',
        stateType: { kind: 'bus', width: 8 },
        initialValue: '',
      },
    ],
    evaluate: (_inputs, currentState) => {
      return new Map([['text', 0]]);
    },
    updateState: (inputs, currentState, clockEdges) => {
      if (clockEdges['clk'] !== 'rising') {
        return currentState;
      }

      const we = inputs.get('we') as boolean;
      if (!we) {
        return currentState;
      }

      const data = (inputs.get('data') as number) ?? 0;
      const currentText = (typeof currentState === 'string' ? currentState : '') as string;

      const char = String.fromCharCode(data & 0xFF);
      let newText = currentText + char;

      const MAX_LENGTH = 4096;
      if (newText.length > MAX_LENGTH) {
        newText = newText.slice(-MAX_LENGTH);
      }

      return newText;
    },
    outputDependency: 'state-only',
  }),
};

// ============================================================================
// Auto-Generated Exports
// ============================================================================

/**
 * Generate Circuit IR definitions from primitive definitions
 */
export function generatePrimitives(defs: Record<string, CorePrimitiveDefinition>): Circuit[] {
  return Object.values(defs).map((def) => ({
    id: `primitive:${def.name}`,
    name: def.name,
    parameters: def.parameters ?? [],
    inputs: def.inputs,
    outputs: def.outputs,
    clocks: def.clocks ?? [],
    state: def.state ?? [],
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' as const },
    metadata: {
      description: def.description,
      outputDependency: def.outputDependency,
    },
  }));
}

/**
 * Generate evaluator registry from primitive definitions
 */
export function generateEvaluators(
  defs: Record<string, CorePrimitiveDefinition>
): Record<string, PrimitiveEvaluator> {
  return Object.fromEntries(
    Object.entries(defs).map(([name, def]) => [name, def.evaluator])
  );
}

/**
 * Primitive evaluator registry (auto-generated)
 */
export const PRIMITIVE_EVALUATORS: Record<string, PrimitiveEvaluator> =
  generateEvaluators(PRIMITIVE_DEFINITIONS);

/**
 * Primitive circuit IR definitions (auto-generated)
 */
export const PRIMITIVES: Circuit[] = generatePrimitives(PRIMITIVE_DEFINITIONS);

/**
 * Get all primitive circuits
 */
export function getPrimitives(): Circuit[] {
  return PRIMITIVES;
}

/**
 * Get primitive evaluator by name
 */
export function getPrimitiveEvaluator(name: string): PrimitiveEvaluator | undefined {
  return PRIMITIVE_EVALUATORS[name];
}

/**
 * Check if a component is a primitive
 */
export function isPrimitive(name: string): boolean {
  return name in PRIMITIVE_DEFINITIONS;
}

/**
 * Get primitive circuit definition by name
 */
export function getPrimitiveCircuit(name: string): Circuit | undefined {
  return PRIMITIVES.find((p) => p.name === name);
}
