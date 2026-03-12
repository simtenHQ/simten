/**
 * Core Primitive Component Definitions
 *
 * SINGLE SOURCE OF TRUTH for all primitive circuit structure and evaluators.
 * This module owns: ports, parameters, descriptions, evaluator logic, state.
 *
 * UI metadata (icons, categories, component creation) is layered on top
 * by visual-editor/lib/primitive-registry.ts which extends CorePrimitiveDefinition.
 */

import type {
  BitValue,
  BusValue,
  Circuit,
  PortDescriptor,
  ClockDescriptor,
  StateBlock,
  Parameter,
} from '../types/circuit.js';
import { bitType, busType } from '../types/circuit.js';
import type { PrimitiveState } from '../types/simulator.js';
import {
  createCombinationalEvaluator,
  createSequentialEvaluator,
  type PrimitiveEvaluator,
  type InputValue,
  type ClockEdges,
  type EvaluationContext,
} from './primitive-interface.js';

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
  referenceCircuit?: {
    source: string | ((params: Record<string, number>) => string);
    description?: string;
  };
  /** Category for component palette organization */
  category: string;
  /** Display icon (emoji or unicode symbol) */
  icon: string;
  /** Namespace for grouping (e.g., 'core', 'rv32i') */
  namespace?: string;
  /** Name of the argument key that holds environmental state (e.g., 'value' for Switch/Button/Input) */
  environmentalState?: string;
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
  category: string;
  icon: string;
  namespace?: string;
  environmentalState?: string;
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
    category: config.category,
    icon: config.icon,
    namespace: config.namespace,
    environmentalState: config.environmentalState,
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
  category: string;
  icon: string;
  namespace?: string;
  environmentalState?: string;
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
    category: config.category,
    icon: config.icon,
    namespace: config.namespace,
    environmentalState: config.environmentalState,
  };
}

// ============================================================================
// Reference Circuit Constants
// ============================================================================

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
    category: 'logic-gates',
    icon: '&',
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
    category: 'logic-gates',
    icon: '≥1',
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
    category: 'logic-gates',
    icon: '¬',
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
    category: 'logic-gates',
    icon: '⊼',
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
    category: 'logic-gates',
    icon: '⊽',
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
    category: 'logic-gates',
    icon: '⊕',
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
    category: 'logic-gates',
    icon: '⊙',
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
    category: 'logic-gates',
    icon: '▷',
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
    description: 'User-controllable 1-bit toggle. Use for enable signals (write-enable, reset, etc.)',
    category: 'input-output',
    icon: '⚡',
    environmentalState: 'value',
    inputs: [],
    outputs: [{ name: 'out', portType: bitType() }],
    parameters: [{ name: 'value', paramType: 'int', defaultValue: 0 }],
    evaluate: (inputs) => {
      const value = inputs.get('__value') as boolean | undefined;
      return new Map([['out', Boolean(value ?? false)]]);
    },
  }),

  Led: defineCombinational({
    name: 'Led',
    description: 'Visual output LED indicator',
    category: 'input-output',
    icon: '💡',
    inputs: [{ name: 'in', portType: bitType() }],
    outputs: [],
    evaluate: (_inputs) => {
      return new Map();
    },
  }),

  Output: defineCombinational({
    name: 'Output',
    description: 'Multi-bit output sink (for testbenches)',
    category: 'input-output',
    icon: '📤',
    inputs: [{ name: 'in', portType: busType(8) }],
    outputs: [],
    evaluate: (_inputs) => {
      return new Map();
    },
  }),

  Button: defineCombinational({
    name: 'Button',
    description: 'Push button input (momentary, user-controlled)',
    category: 'input-output',
    icon: '🔘',
    environmentalState: 'value',
    inputs: [],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const value = inputs.get('__value') as boolean | undefined;
      return new Map([['out', Boolean(value ?? false)]]);
    },
  }),

  Input: defineCombinational({
    name: 'Input',
    description: 'Multi-bit numeric input (runtime editable). Use for bus values the student can change.',
    category: 'input-output',
    icon: '🔢',
    environmentalState: 'value',
    inputs: [],
    outputs: [{ name: 'out', portType: busType(8), widthParam: 'width' }],
    parameters: [
      { name: 'value', paramType: 'int', defaultValue: 0 },
      { name: 'width', paramType: 'int', defaultValue: 8, options: [4, 8, 16, 32] },
    ],
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
    description: 'Fixed value source. Always specify value parameter — bare Constant defaults to 0.',
    category: 'utilities',
    icon: 'K',
    inputs: [],
    outputs: [{ name: 'out', portType: bitType() }],
    parameters: [{ name: 'value', paramType: 'int', defaultValue: 0 }],
    evaluate: (inputs) => {
      const value = inputs.get('__value') as BitValue | BusValue | undefined;
      return new Map([['out', value ?? 0]]);
    },
  }),

  Splitter: defineCombinational({
    name: 'Splitter',
    description: 'Bus splitter - splits a bus into smaller buses (default: 8-bit to 2x4-bit)',
    category: 'utilities',
    icon: '⊢',
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
        const mask = width >= 32 ? 0xFFFFFFFF : (1 << width) - 1;
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
    description: 'Splits an 8-bit bus into 8 individual bit outputs (bit0=LSB, bit7=MSB)',
    category: 'utilities',
    icon: '⊢8',
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
    description: 'Combines 8 individual bit inputs into an 8-bit bus (bit0=LSB, bit7=MSB)',
    category: 'utilities',
    icon: '⊣8',
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
    category: 'utilities',
    icon: '🔍',
    inputs: [{ name: 'in', portType: bitType() }],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const value = inputs.get('in') as BitValue | BusValue | undefined;
      return new Map([['out', value ?? false]]);
    },
  }),

  BitSlice: defineCombinational({
    name: 'BitSlice',
    description: 'Extract bits [low..high] from input (wire routing, zero logic cost)',
    category: 'utilities',
    icon: '[]',
    inputs: [{ name: 'in', portType: busType(8) }],
    outputs: [{ name: 'out', portType: busType(8) }],
    parameters: [
      { name: 'high', paramType: 'int', defaultValue: 7 },
      { name: 'low', paramType: 'int', defaultValue: 0 },
    ],
    evaluate: (inputs) => {
      const value = inputs.get('in') as number;
      const low = (inputs.get('__low') as number) ?? 0;
      const high = (inputs.get('__high') as number) ?? 7;

      const numBits = high - low + 1;
      const mask = numBits >= 32 ? 0xFFFFFFFF : (1 << numBits) - 1;
      const result = (value >> low) & mask;

      return new Map([['out', result]]);
    },
  }),

  AddressCombiner: defineCombinational({
    name: 'AddressCombiner',
    description: 'Combines two 8-bit buses into one 16-bit bus (hi << 8 | lo)',
    category: 'utilities',
    icon: '⊕16',
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

  Concat: defineCombinational({
    name: 'Concat',
    description: 'Concatenate two buses into a wider bus (out = high << lowWidth | low)',
    category: 'utilities',
    icon: '||',
    inputs: [
      { name: 'high', portType: busType(4) },
      { name: 'low', portType: busType(4) },
    ],
    outputs: [{ name: 'out', portType: busType(8) }],
    parameters: [{ name: 'lowWidth', paramType: 'int', defaultValue: 4 }],
    evaluate: (inputs) => {
      const high = (inputs.get('high') as number) ?? 0;
      const low = (inputs.get('low') as number) ?? 0;
      const lowWidth = (inputs.get('__lowWidth') as number) ?? 4;
      return new Map([['out', (high << lowWidth) | low]]);
    },
  }),

  // ============================================================================
  // Bus Operations
  // ============================================================================

  BusAnd: defineCombinational({
    name: 'BusAnd',
    description: 'Bitwise AND operation on 8-bit buses',
    category: 'bus-operations',
    icon: '&8',
    inputs: [
      { name: 'a', portType: busType(8), widthParam: 'width' },
      { name: 'b', portType: busType(8), widthParam: 'width' },
    ],
    outputs: [{ name: 'out', portType: busType(8), widthParam: 'width' }],
    parameters: [{ name: 'width', paramType: 'int', defaultValue: 8, options: [4, 8, 16, 32] }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;
      return new Map([['out', a & b]]);
    },
  }),

  BusOr: defineCombinational({
    name: 'BusOr',
    description: 'Bitwise OR operation on 8-bit buses',
    category: 'bus-operations',
    icon: '|8',
    inputs: [
      { name: 'a', portType: busType(8), widthParam: 'width' },
      { name: 'b', portType: busType(8), widthParam: 'width' },
    ],
    outputs: [{ name: 'out', portType: busType(8), widthParam: 'width' }],
    parameters: [{ name: 'width', paramType: 'int', defaultValue: 8, options: [4, 8, 16, 32] }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;
      return new Map([['out', a | b]]);
    },
  }),

  BusNot: defineCombinational({
    name: 'BusNot',
    description: 'Bitwise NOT operation on 8-bit bus',
    category: 'bus-operations',
    icon: '¬8',
    inputs: [{ name: 'in', portType: busType(8), widthParam: 'width' }],
    outputs: [{ name: 'out', portType: busType(8), widthParam: 'width' }],
    parameters: [{ name: 'width', paramType: 'int', defaultValue: 8, options: [4, 8, 16, 32] }],
    evaluate: (inputs) => {
      const a = inputs.get('in') as number;
      const width = (inputs.get('__width') as number) ?? 8;
      const mask = width >= 32 ? 0xFFFFFFFF : (1 << width) - 1;
      return new Map([['out', (~a) & mask]]);
    },
  }),

  BusXor: defineCombinational({
    name: 'BusXor',
    description: 'Bitwise XOR operation on 8-bit buses',
    category: 'bus-operations',
    icon: '⊕8',
    inputs: [
      { name: 'a', portType: busType(8), widthParam: 'width' },
      { name: 'b', portType: busType(8), widthParam: 'width' },
    ],
    outputs: [{ name: 'out', portType: busType(8), widthParam: 'width' }],
    parameters: [{ name: 'width', paramType: 'int', defaultValue: 8, options: [4, 8, 16, 32] }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;
      return new Map([['out', a ^ b]]);
    },
  }),

  // ============================================================================
  // Arithmetic Operations
  // ============================================================================

  Incrementer: {
    ...defineCombinational({
      name: 'Incrementer',
      description: 'Incrementer - adds 1 to the input (wraps around at max value)',
      category: 'arithmetic',
      icon: '+1',
      inputs: [{ name: 'in', portType: busType(8), widthParam: 'width' }],
      outputs: [{ name: 'out', portType: busType(8), widthParam: 'width' }],
      parameters: [{ name: 'width', paramType: 'int', defaultValue: 8, options: [4, 8, 16, 32] }],
      evaluate: (inputs) => {
        const value = inputs.get('in') as number;
        const width = (inputs.get('__width') as number) ?? 8;
        const maxValue = width >= 32 ? 0xFFFFFFFF : (1 << width) - 1;
        const result = (value + 1) & maxValue;
        return new Map([['out', result]]);
      },
    }),
    referenceCircuit: {
      source: `circuit Incrementer {
  input data: Bus[8]
  output result: Bus[8]

  impl {
    node one: Constant(value=1)
    node add: Adder

    connect data -> add.a
    connect one.out -> add.b
    connect add.sum -> result
  }
}`,
      description: 'Incrementer built from Adder + Constant(1)',
    },
  },

  Adder: {
    ...defineCombinational({
      name: 'Adder',
      description: 'Parameterized n-bit adder with carry in/out (default: 8-bit)',
      category: 'arithmetic',
      icon: '➕',
      inputs: [
        { name: 'a', portType: busType(8), widthParam: 'width' },
        { name: 'b', portType: busType(8), widthParam: 'width' },
        { name: 'carry_in', portType: bitType(), defaultValue: false },
      ],
      outputs: [
        { name: 'sum', portType: busType(8), widthParam: 'width' },
        { name: 'carry_out', portType: bitType() },
      ],
      parameters: [{ name: 'width', paramType: 'int', defaultValue: 8, options: [4, 8, 16, 32] }],
      evaluate: (inputs) => {
        const a = (inputs.get('a') as number) >>> 0;
        const b = (inputs.get('b') as number) >>> 0;
        const carryIn = (inputs.get('carry_in') as boolean) ?? false ? 1 : 0;

        const width = (inputs.get('__width') as number) ?? 8;
        const mask = width >= 32 ? 0xFFFFFFFF : (1 << width) - 1;

        const result = a + b + carryIn;
        const sum = result & mask;
        const carryOut = result > mask;

        return new Map<string, boolean | number>([
          ['sum', sum],
          ['carry_out', carryOut],
        ]);
      },
    }),
    referenceCircuit: {
      source: (params) => {
        const w = params.width ?? 8;
        if (w <= 8) return `circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit
  impl {
    node xor1: Xor
    node and1: And
    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum
    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}
circuit FullAdder {
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit
  impl {
    node ha1: HalfAdder
    node ha2: HalfAdder
    node or1: Or
    connect a -> ha1.a
    connect b -> ha1.b
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b
    connect ha2.sum -> sum
    connect ha1.carry -> or1.a
    connect ha2.carry -> or1.b
    connect or1.out -> cout
  }
}
circuit Adder {
  input a: Bus[8]
  input b: Bus[8]
  input carry_in: Bit
  output sum: Bus[8]
  output carry_out: Bit
  impl {
    node splitA: Splitter8to8
    node splitB: Splitter8to8
    connect a -> splitA.in
    connect b -> splitB.in
    node fa0: FullAdder
    node fa1: FullAdder
    node fa2: FullAdder
    node fa3: FullAdder
    node fa4: FullAdder
    node fa5: FullAdder
    node fa6: FullAdder
    node fa7: FullAdder
    connect splitA.bit0 -> fa0.a
    connect splitB.bit0 -> fa0.b
    connect carry_in -> fa0.cin
    connect splitA.bit1 -> fa1.a
    connect splitB.bit1 -> fa1.b
    connect fa0.cout -> fa1.cin
    connect splitA.bit2 -> fa2.a
    connect splitB.bit2 -> fa2.b
    connect fa1.cout -> fa2.cin
    connect splitA.bit3 -> fa3.a
    connect splitB.bit3 -> fa3.b
    connect fa2.cout -> fa3.cin
    connect splitA.bit4 -> fa4.a
    connect splitB.bit4 -> fa4.b
    connect fa3.cout -> fa4.cin
    connect splitA.bit5 -> fa5.a
    connect splitB.bit5 -> fa5.b
    connect fa4.cout -> fa5.cin
    connect splitA.bit6 -> fa6.a
    connect splitB.bit6 -> fa6.b
    connect fa5.cout -> fa6.cin
    connect splitA.bit7 -> fa7.a
    connect splitB.bit7 -> fa7.b
    connect fa6.cout -> fa7.cin
    node combine: Combiner8to8
    connect fa0.sum -> combine.bit0
    connect fa1.sum -> combine.bit1
    connect fa2.sum -> combine.bit2
    connect fa3.sum -> combine.bit3
    connect fa4.sum -> combine.bit4
    connect fa5.sum -> combine.bit5
    connect fa6.sum -> combine.bit6
    connect fa7.sum -> combine.bit7
    connect combine.out -> sum
    connect fa7.cout -> carry_out
  }
}`;
        const half = w / 2;
        const lo = half - 1;
        const hi = w - 1;
        return `circuit Adder {
  input a: Bus[${w}]
  input b: Bus[${w}]
  input carry_in: Bit
  output sum: Bus[${w}]
  output carry_out: Bit
  impl {
    node sliceA_lo: BitSlice(low=0, high=${lo})
    node sliceA_hi: BitSlice(low=${half}, high=${hi})
    node sliceB_lo: BitSlice(low=0, high=${lo})
    node sliceB_hi: BitSlice(low=${half}, high=${hi})
    connect a -> sliceA_lo.in
    connect a -> sliceA_hi.in
    connect b -> sliceB_lo.in
    connect b -> sliceB_hi.in
    node lo: Adder(width=${half})
    node hi: Adder(width=${half})
    connect sliceA_lo.out -> lo.a
    connect sliceB_lo.out -> lo.b
    connect carry_in -> lo.carry_in
    connect sliceA_hi.out -> hi.a
    connect sliceB_hi.out -> hi.b
    connect lo.carry_out -> hi.carry_in
    node combine: Concat(lowWidth=${half})
    connect lo.sum -> combine.low
    connect hi.sum -> combine.high
    connect combine.out -> sum
    connect hi.carry_out -> carry_out
  }
}`;
      },
      description: 'Ripple-carry adder (8-bit: full adders, wider: recursive half-width split)',
    },
  },

  Multiplier: defineCombinational({
    name: 'Multiplier',
    description: 'Parameterized n×n bit multiplier, outputs 2n-bit product (default: 8×8=16-bit)',
    category: 'arithmetic',
    icon: '✖️',
    inputs: [
      { name: 'a', portType: busType(8), widthParam: 'width' },
      { name: 'b', portType: busType(8), widthParam: 'width' },
    ],
    outputs: [{ name: 'product', portType: busType(16), widthParam: 'width', widthMultiplier: 2 }],
    parameters: [{ name: 'width', paramType: 'int', defaultValue: 8, options: [4, 8, 16] }],
    evaluate: (inputs) => {
      const a = (inputs.get('a') as number) >>> 0;
      const b = (inputs.get('b') as number) >>> 0;

      const width = (inputs.get('__width') as number) ?? 8;
      const raw = a * b;
      const product = width * 2 >= 32 ? (raw >>> 0) : (raw & ((1 << (width * 2)) - 1));

      return new Map([['product', product]]);
    },
  }),

  Comparator: {
    ...defineCombinational({
      name: 'Comparator',
      description: 'Parameterized n-bit comparator (default: 8-bit)',
      category: 'arithmetic',
      icon: '⚖️',
      inputs: [
        { name: 'a', portType: busType(8), widthParam: 'width' },
        { name: 'b', portType: busType(8), widthParam: 'width' },
      ],
      parameters: [{ name: 'width', paramType: 'int', defaultValue: 8, options: [4, 8, 16, 32] }],
      outputs: [
        { name: 'eq', portType: bitType() },
        { name: 'lt', portType: bitType() },
        { name: 'gt', portType: bitType() },
      ],
      evaluate: (inputs) => {
        const a = (inputs.get('a') as number) >>> 0;
        const b = (inputs.get('b') as number) >>> 0;

        return new Map([
          ['eq', a === b],
          ['lt', a < b],
          ['gt', a > b],
        ]);
      },
    }),
    referenceCircuit: {
      source: `// 8-bit comparator from subtractor + zero detection
circuit Comparator {
  input a: Bus[8]
  input b: Bus[8]
  output eq: Bit
  output lt: Bit
  output gt: Bit

  impl {
    // Subtract a - b: borrow_out means a < b
    node sub: Subtractor

    connect a -> sub.a
    connect b -> sub.b

    // lt = borrow_out (unsigned a < b)
    connect sub.borrow_out -> lt

    // Zero detection on difference: eq = (difference == 0)
    // Split difference into bits, OR-tree, invert
    node split: Splitter8to8
    connect sub.difference -> split.in

    node or01: Or
    node or23: Or
    node or45: Or
    node or67: Or
    connect split.bit0 -> or01.a
    connect split.bit1 -> or01.b
    connect split.bit2 -> or23.a
    connect split.bit3 -> or23.b
    connect split.bit4 -> or45.a
    connect split.bit5 -> or45.b
    connect split.bit6 -> or67.a
    connect split.bit7 -> or67.b

    node or_lo: Or
    node or_hi: Or
    connect or01.out -> or_lo.a
    connect or23.out -> or_lo.b
    connect or45.out -> or_hi.a
    connect or67.out -> or_hi.b

    node or_all: Or
    connect or_lo.out -> or_all.a
    connect or_hi.out -> or_all.b

    // eq = NOT(any bit set)
    node not_eq: Not
    connect or_all.out -> not_eq.in
    connect not_eq.out -> eq

    // gt = NOT(eq OR lt)
    node eq_or_lt: Or
    connect not_eq.out -> eq_or_lt.a
    connect sub.borrow_out -> eq_or_lt.b

    node not_gt: Not
    connect eq_or_lt.out -> not_gt.in
    connect not_gt.out -> gt
  }
}`,
      description: '8-bit comparator from Subtractor + OR-tree zero detection',
    },
  },

  LeftShifter: defineCombinational({
    name: 'LeftShifter',
    description: 'Logical left bit shift (value << n) with zero fill',
    category: 'arithmetic',
    icon: '<<',
    inputs: [
      { name: 'value', portType: busType(8), widthParam: 'width' },
      { name: 'shift', portType: busType(8), widthParam: 'width' },
    ],
    outputs: [{ name: 'result', portType: busType(8), widthParam: 'width' }],
    parameters: [{ name: 'width', paramType: 'int', defaultValue: 8, options: [4, 8, 16, 32] }],
    evaluate: (inputs) => {
      const value = inputs.get('value') as number;
      const shift = inputs.get('shift') as number;
      const width = (inputs.get('__width') as number) ?? 8;

      const mask = width >= 32 ? 0xFFFFFFFF : (1 << width) - 1;
      const result = shift >= width ? 0 : (value << shift) & mask;

      return new Map([['result', result]]);
    },
  }),

  RightShifter: defineCombinational({
    name: 'RightShifter',
    description: 'Logical right bit shift (value >> n) with zero fill',
    category: 'arithmetic',
    icon: '>>',
    inputs: [
      { name: 'value', portType: busType(8), widthParam: 'width' },
      { name: 'shift', portType: busType(8), widthParam: 'width' },
    ],
    outputs: [{ name: 'result', portType: busType(8), widthParam: 'width' }],
    parameters: [{ name: 'width', paramType: 'int', defaultValue: 8, options: [4, 8, 16, 32] }],
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
    description: 'Parameterized n-bit subtractor with borrow in/out (default: 8-bit)',
    category: 'arithmetic',
    icon: '➖',
    inputs: [
      { name: 'a', portType: busType(8), widthParam: 'width' },
      { name: 'b', portType: busType(8), widthParam: 'width' },
      { name: 'borrow_in', portType: bitType(), defaultValue: false },
    ],
    outputs: [
      { name: 'difference', portType: busType(8), widthParam: 'width' },
      { name: 'borrow_out', portType: bitType() },
    ],
    parameters: [{ name: 'width', paramType: 'int', defaultValue: 8, options: [4, 8, 16, 32] }],
    evaluate: (inputs) => {
      const a = (inputs.get('a') as number) >>> 0;
      const b = (inputs.get('b') as number) >>> 0;
      const borrowIn = (inputs.get('borrow_in') as boolean) ?? false ? 1 : 0;

      const width = (inputs.get('__width') as number) ?? 8;
      const mask = width >= 32 ? 0xFFFFFFFF : (1 << width) - 1;

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
    description: 'Signed n-bit adder with overflow detection (default: 8-bit)',
    category: 'arithmetic',
    icon: '±',
    inputs: [
      { name: 'a', portType: busType(8), widthParam: 'width' },
      { name: 'b', portType: busType(8), widthParam: 'width' },
      { name: 'carry_in', portType: bitType(), defaultValue: false },
    ],
    outputs: [
      { name: 'sum', portType: busType(8), widthParam: 'width' },
      { name: 'overflow', portType: bitType() },
      { name: 'carry_out', portType: bitType() },
    ],
    parameters: [{ name: 'width', paramType: 'int', defaultValue: 8, options: [4, 8, 16, 32] }],
    evaluate: (inputs) => {
      const aRaw = inputs.get('a') as number;
      const bRaw = inputs.get('b') as number;
      const carryIn = (inputs.get('carry_in') as boolean) ?? false ? 1 : 0;

      const width = (inputs.get('__width') as number) ?? 8;
      const mask = width >= 32 ? 0xFFFFFFFF : (1 << width) - 1;
      const signBit = width >= 32 ? 0x80000000 : 1 << (width - 1);

      const result = (aRaw >>> 0) + (bRaw >>> 0) + carryIn;
      const sum = result & mask;
      const carryOut = result > mask;

      const aSign = (aRaw & signBit) !== 0;
      const bSign = (bRaw & signBit) !== 0;
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
    description: 'Signed n-bit comparator with all comparison flags (default: 8-bit)',
    category: 'arithmetic',
    icon: '⚖',
    inputs: [
      { name: 'a', portType: busType(8), widthParam: 'width' },
      { name: 'b', portType: busType(8), widthParam: 'width' },
    ],
    parameters: [{ name: 'width', paramType: 'int', defaultValue: 8, options: [4, 8, 16, 32] }],
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
      const signBit = width >= 32 ? 0x80000000 : 1 << (width - 1);
      const maxValue = width >= 32 ? 0x100000000 : 1 << width;

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
    description: 'Signed n×n bit multiplier, outputs 2n-bit product (default: 8×8=16-bit)',
    category: 'arithmetic',
    icon: '×',
    inputs: [
      { name: 'a', portType: busType(8), widthParam: 'width' },
      { name: 'b', portType: busType(8), widthParam: 'width' },
    ],
    outputs: [{ name: 'product', portType: busType(16), widthParam: 'width', widthMultiplier: 2 }],
    parameters: [{ name: 'width', paramType: 'int', defaultValue: 8, options: [4, 8, 16] }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;

      const width = (inputs.get('__width') as number) ?? 8;
      const signBit = width >= 32 ? 0x80000000 : (1 << (width - 1));
      const maxValue = 2 ** width;

      const aSigned = (a & signBit) ? a - maxValue : a;
      const bSigned = (b & signBit) ? b - maxValue : b;

      const productSigned = aSigned * bSigned;
      const outputRange = 2 ** (width * 2);

      const product = productSigned >= 0
        ? (width * 2 >= 32 ? (productSigned >>> 0) : productSigned)
        : ((productSigned + outputRange) >>> 0);

      return new Map([['product', product]]);
    },
  }),

  // ============================================================================
  // Plexers
  // ============================================================================

  Mux: {
    ...defineCombinational({
      name: 'Mux',
      description: 'Parameterized multiplexer (default: 2-input, 1-bit). Use width for bus muxing.',
      category: 'plexers',
      icon: '⊓',
      inputs: [
        { name: 'in0', portType: bitType(), widthParam: 'width' },
        { name: 'in1', portType: bitType(), widthParam: 'width' },
        { name: 'sel', portType: bitType() },
      ],
      outputs: [{ name: 'out', portType: bitType(), widthParam: 'width' }],
      parameters: [{ name: 'width', paramType: 'int', defaultValue: 1, options: [1, 4, 8, 16, 32] }],
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
    referenceCircuit: {
      source: `circuit Mux {
  input in0: Bit
  input in1: Bit
  input sel: Bit
  output out: Bit

  impl {
    node not_sel: Not
    node and0: And
    node and1: And
    node or1: Or

    connect sel -> not_sel.in
    connect not_sel.out -> and0.a
    connect in0 -> and0.b
    connect sel -> and1.a
    connect in1 -> and1.b
    connect and0.out -> or1.a
    connect and1.out -> or1.b
    connect or1.out -> out
  }
}`,
      description: '2:1 mux from And, Or, Not gates: out = (sel AND in1) OR (NOT sel AND in0)',
    },
  },

  Decoder: defineCombinational({
    name: 'Decoder',
    description: 'Parameterized n-to-2^n decoder (default: 2-to-4)',
    category: 'plexers',
    icon: '⊔',
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
    description: '7-segment display for hexadecimal digits (0-F)',
    category: 'display',
    icon: '8.',
    inputs: [{ name: 'in', portType: busType(4) }],
    outputs: [],
    evaluate: (_inputs) => {
      return new Map();
    },
  }),

  HexDisplay: defineCombinational({
    name: 'HexDisplay',
    description: 'Hexadecimal display for multi-bit values (default: 8-bit)',
    category: 'display',
    icon: '0xFF',
    inputs: [{ name: 'in', portType: busType(8), widthParam: 'width' }],
    outputs: [],
    parameters: [{ name: 'width', paramType: 'int', defaultValue: 8, options: [4, 8, 16, 32] }],
    evaluate: (_inputs) => {
      return new Map();
    },
  }),

  Screen: defineCombinational({
    name: 'Screen',
    description: '8x8 pixel display',
    category: 'display',
    icon: '🖥️',
    inputs: [{ name: 'dataIn', portType: busType(8) }],
    outputs: [{ name: 'addrB', portType: busType(8) }],
    evaluate: (_inputs, _currentState, _context) => {
      return new Map([['addrB', 0]]);
    },
  }),

  RasterDisplay: defineSequential({
    name: 'RasterDisplay',
    description: 'Hardware-accurate 8×8 raster display with scan counters and sync signals',
    category: 'display',
    icon: '📺',
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
    description: 'D Flip-Flop - stores 1 bit of state, updates on rising clock edge',
    category: 'sequential',
    icon: 'D',
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
    description: 'Parameterized n-bit register - stores data on rising clock edge when write enable is high (default: 8-bit)',
    category: 'sequential',
    icon: 'REG',
    inputs: [
      { name: 'data', portType: busType(8), widthParam: 'width' },
      { name: 'we', portType: bitType() },
    ],
    outputs: [{ name: 'q', portType: busType(8), widthParam: 'width' }],
    parameters: [{ name: 'width', paramType: 'int', defaultValue: 8, options: [4, 8, 16, 32] }],
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
    description: 'Read-only memory with address decoding. Use baseAddress parameter to set memory mapping.',
    category: 'memory',
    icon: '📀',
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
    description: '256x8 RAM - reads are combinational (addr->data_out), writes occur on rising clock edge with write enable',
    category: 'memory',
    icon: '💾',
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
    category: 'memory',
    icon: '💾²',
    inputs: [
      { name: 'addrA', portType: busType(8) },
      { name: 'dataA', portType: busType(8) },
      { name: 'weA', portType: bitType() },
      { name: 'addrB', portType: busType(8) },
    ],
    outputs: [
      { name: 'outA', portType: busType(8) },
      { name: 'outB', portType: busType(8) },
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
      const outA = memory.get(addrA) ?? 0;
      const outB = memory.get(addrB) ?? 0;
      return new Map([
        ['outA', outA],
        ['outB', outB],
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
    outputDependency: 'state+inputs',
  }),

  // ============================================================================
  // I/O Devices
  // ============================================================================

  Console: defineSequential({
    name: 'Console',
    description: 'Memory-mapped console output device. Characters written accumulate in buffer.',
    category: 'io',
    icon: '📺',
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

const SINK_NAMES = new Set([
  'Led', 'Output', 'SevenSegment', 'HexDisplay', 'Screen', 'RasterDisplay', 'Console',
]);

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
      kind: SINK_NAMES.has(def.name)
        ? 'sink' as const
        : ((def.clocks && def.clocks.length > 0) || def.outputDependency === 'state-only' || def.outputDependency === 'state+inputs')
          ? 'sequential' as const
          : 'combinational' as const,
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

/**
 * Get the reference circuit DSL source for a primitive, if it has one.
 * Pass params to resolve function-based generators (e.g. width-aware circuits).
 */
export function getReferenceCircuit(name: string, params?: Record<string, number>): string | undefined {
  const ref = PRIMITIVE_DEFINITIONS[name]?.referenceCircuit;
  if (!ref) return undefined;
  if (typeof ref.source === 'function') {
    return ref.source(params ?? {});
  }
  return ref.source;
}
