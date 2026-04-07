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
  referenceCircuit?: {
    source: string | ((params: Record<string, number>) => string);
    description?: string;
  };
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
    referenceCircuit: config.referenceCircuit,
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
// IEEE 802.3 CRC-32 Lookup Table (reflected polynomial 0xEDB88320)
// ============================================================================

const ETH_CRC32_TABLE: number[] = (() => {
  const table: number[] = new Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? ((crc >>> 1) ^ 0xEDB88320) >>> 0 : (crc >>> 1) >>> 0;
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

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
    description: 'Pixel display (default 8x8, configurable with width/height parameters)',
    category: 'display',
    icon: '🖥️',
    parameters: [
      { name: 'width', paramType: 'int', defaultValue: 8, options: [8, 16, 32, 64] },
      { name: 'height', paramType: 'int', defaultValue: 8, options: [8, 16, 32, 64] },
    ],
    inputs: [{ name: 'dataIn', portType: busType(8) }],
    outputs: [{ name: 'addrB', portType: busType(16), widthParam: undefined }],
    evaluate: (_inputs, _currentState, _context) => {
      return new Map([['addrB', 0]]);
    },
  }),

  RasterDisplay: defineSequential({
    name: 'RasterDisplay',
    description: 'Hardware-accurate raster display with scan counters and sync signals (default 8×8, configurable)',
    category: 'display',
    icon: '📺',
    parameters: [
      { name: 'width', paramType: 'int', defaultValue: 8, options: [8, 16, 32, 64] },
      { name: 'height', paramType: 'int', defaultValue: 8, options: [8, 16, 32, 64] },
    ],
    inputs: [{ name: 'dataIn', portType: busType(8) }],
    outputs: [
      { name: 'addrB', portType: busType(16) },
      { name: 'scanX', portType: busType(8) },
      { name: 'scanY', portType: busType(8) },
      { name: 'hblank', portType: bitType() },
      { name: 'vblank', portType: bitType() },
    ],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'raster-state',
        name: 'rasterState',
        stateType: { kind: 'memory', addressWidth: 16, dataWidth: 8 },
        initialValue: (() => {
          const initialMap = new Map<number, number>();
          initialMap.set(-1, 0);
          initialMap.set(-2, 0);
          return { data: initialMap, addressWidth: 16, dataWidth: 8 };
        })(),
      },
    ],
    evaluate: (_inputs, currentState) => {
      const state = (currentState ?? new Map()) as Map<number, number>;
      const scanX = state.get(-1) ?? 0;
      const scanY = state.get(-2) ?? 0;
      const w = state.get(-3) ?? 8;
      const h = state.get(-4) ?? 8;

      const addr = scanY < h && scanX < w ? scanY * w + scanX : 0;
      const hblank = scanX >= w;
      const vblank = scanY >= h;

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

      const w = (inputs.get('__width') as number) ?? 8;
      const h = (inputs.get('__height') as number) ?? 8;
      const totalX = w + 2; // visible + blanking
      const totalY = h + 2;

      const state = (currentState ?? new Map()) as Map<number, number>;
      let scanX = state.get(-1) ?? 0;
      let scanY = state.get(-2) ?? 0;

      const dataIn = (inputs.get('dataIn') as number) ?? 0;
      const newState = new Map(state);

      if (scanX < w && scanY < h) {
        const addr = scanY * w + scanX;
        newState.set(addr, dataIn);
      }

      scanX++;
      if (scanX >= totalX) {
        scanX = 0;
        scanY++;
        if (scanY >= totalY) {
          scanY = 0;
        }
      }

      newState.set(-1, scanX);
      newState.set(-2, scanY);
      newState.set(-3, w);
      newState.set(-4, h);

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

  DualPortROM: defineSequential({
    name: 'DualPortROM',
    description: 'Read-only memory with two independent read ports sharing the same data. Byte-addressable, returns 32-bit little-endian words. Use for architectures that need simultaneous instruction fetch and data read.',
    category: 'memory',
    icon: '📀²',
    inputs: [
      { name: 'addrA', portType: busType(32) },
      { name: 'addrB', portType: busType(32) },
    ],
    outputs: [
      { name: 'dataA', portType: busType(32) },
      { name: 'dataB', portType: busType(32) },
    ],
    clocks: [],
    state: [
      {
        id: 'dual-rom-state',
        name: 'memory',
        stateType: { kind: 'memory', addressWidth: 32, dataWidth: 8 },
        initialValue: { data: new Map(), addressWidth: 32, dataWidth: 8 },
      },
    ],
    evaluate: (inputs, currentState) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;

      // Port A — read 4 bytes little-endian
      const addrA = ((inputs.get('addrA') as number) ?? 0) >>> 0;
      const a0 = memory.get(addrA) ?? 0;
      const a1 = memory.get((addrA + 1) >>> 0) ?? 0;
      const a2 = memory.get((addrA + 2) >>> 0) ?? 0;
      const a3 = memory.get((addrA + 3) >>> 0) ?? 0;
      const dataA = ((a3 << 24) | (a2 << 16) | (a1 << 8) | a0) >>> 0;

      // Port B — read 4 bytes little-endian
      const addrB = ((inputs.get('addrB') as number) ?? 0) >>> 0;
      const b0 = memory.get(addrB) ?? 0;
      const b1 = memory.get((addrB + 1) >>> 0) ?? 0;
      const b2 = memory.get((addrB + 2) >>> 0) ?? 0;
      const b3 = memory.get((addrB + 3) >>> 0) ?? 0;
      const dataB = ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;

      return new Map([['dataA', dataA], ['dataB', dataB]]);
    },
    updateState: (_inputs, currentState, _clockEdges) => {
      return currentState;
    },
    outputDependency: 'state+inputs',
  }),

  RAM: defineSequential({
    name: 'RAM',
    description: 'Parameterized SRAM - reads are combinational (addr->data_out), writes occur on rising clock edge with write enable',
    category: 'memory',
    icon: '💾',
    inputs: [
      { name: 'addr', portType: busType(8), widthParam: 'addressWidth' },
      { name: 'data_in', portType: busType(8), widthParam: 'dataWidth' },
      { name: 'we', portType: bitType() },
    ],
    outputs: [{ name: 'data_out', portType: busType(8), widthParam: 'dataWidth' }],
    parameters: [
      { name: 'addressWidth', paramType: 'int', defaultValue: 8, options: [5, 8, 10, 11, 13, 15, 16] },
      { name: 'dataWidth', paramType: 'int', defaultValue: 8, options: [8, 16, 32] },
    ],
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
      const addrWidth = (inputs.get('__addressWidth') as number) ?? 8;
      const dataWidth = (inputs.get('__dataWidth') as number) ?? 8;
      const addrMask = addrWidth >= 32 ? 0xFFFFFFFF : (1 << addrWidth) - 1;
      const dataMask = dataWidth >= 32 ? 0xFFFFFFFF : (1 << dataWidth) - 1;
      const addr = ((inputs.get('addr') as number) ?? 0) & addrMask;
      const data = (memory.get(addr) ?? 0) & dataMask;
      return new Map([['data_out', data]]);
    },
    updateState: (inputs, currentState, clockEdges) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const addrWidth = (inputs.get('__addressWidth') as number) ?? 8;
      const dataWidth = (inputs.get('__dataWidth') as number) ?? 8;
      const addrMask = addrWidth >= 32 ? 0xFFFFFFFF : (1 << addrWidth) - 1;
      const dataMask = dataWidth >= 32 ? 0xFFFFFFFF : (1 << dataWidth) - 1;
      const addr = ((inputs.get('addr') as number) ?? 0) & addrMask;
      const dataIn = ((inputs.get('data_in') as number) ?? 0) & dataMask;
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
    description: 'Parameterized Dual-Port SRAM - port A reads/writes, port B read-only',
    category: 'memory',
    icon: '💾²',
    inputs: [
      { name: 'addrA', portType: busType(8), widthParam: 'addressWidth' },
      { name: 'dataA', portType: busType(8), widthParam: 'dataWidth' },
      { name: 'weA', portType: bitType() },
      { name: 'addrB', portType: busType(8), widthParam: 'addressWidth' },
    ],
    outputs: [
      { name: 'outA', portType: busType(8), widthParam: 'dataWidth' },
      { name: 'outB', portType: busType(8), widthParam: 'dataWidth' },
    ],
    parameters: [
      { name: 'addressWidth', paramType: 'int', defaultValue: 8, options: [5, 8, 10, 11, 13, 15, 16] },
      { name: 'dataWidth', paramType: 'int', defaultValue: 8, options: [8, 16, 32] },
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
      const addrWidth = (inputs.get('__addressWidth') as number) ?? 8;
      const dataWidth = (inputs.get('__dataWidth') as number) ?? 8;
      const addrMask = addrWidth >= 32 ? 0xFFFFFFFF : (1 << addrWidth) - 1;
      const dataMask = dataWidth >= 32 ? 0xFFFFFFFF : (1 << dataWidth) - 1;
      const addrA = ((inputs.get('addrA') as number) ?? 0) & addrMask;
      const addrB = ((inputs.get('addrB') as number) ?? 0) & addrMask;
      const outA = (memory.get(addrA) ?? 0) & dataMask;
      const outB = (memory.get(addrB) ?? 0) & dataMask;
      return new Map([
        ['outA', outA],
        ['outB', outB],
      ]);
    },
    updateState: (inputs, currentState, clockEdges) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const addrWidth = (inputs.get('__addressWidth') as number) ?? 8;
      const dataWidth = (inputs.get('__dataWidth') as number) ?? 8;
      const addrMask = addrWidth >= 32 ? 0xFFFFFFFF : (1 << addrWidth) - 1;
      const dataMask = dataWidth >= 32 ? 0xFFFFFFFF : (1 << dataWidth) - 1;
      const addrA = ((inputs.get('addrA') as number) ?? 0) & addrMask;
      const dataA = ((inputs.get('dataA') as number) ?? 0) & dataMask;
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
    outputs: [],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'console-state',
        name: 'text',
        stateType: { kind: 'bus', width: 8 },
        initialValue: '',
      },
    ],
    evaluate: () => {
      return new Map();
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

  // ============================================================================
  // RV32I CPU Primitives
  // ============================================================================

  RV32I_Decode: defineCombinational({
    name: 'RV32I_Decode',
    description: 'Instruction field extractor — splits a 32-bit RISC-V instruction into opcode, rd, funct3, rs1, rs2, funct7',
    category: 'rv32i',
    icon: 'DEC',
    namespace: 'rv32i',
    inputs: [{ name: 'instruction', portType: busType(32) }],
    outputs: [
      { name: 'opcode', portType: busType(7) },
      { name: 'rd', portType: busType(5) },
      { name: 'funct3', portType: busType(3) },
      { name: 'rs1', portType: busType(5) },
      { name: 'rs2', portType: busType(5) },
      { name: 'funct7', portType: busType(7) },
    ],
    evaluate: (inputs) => {
      const instr = (inputs.get('instruction') as number) >>> 0;
      return new Map<string, BusValue>([
        ['opcode', instr & 0x7F],
        ['rd', (instr >>> 7) & 0x1F],
        ['funct3', (instr >>> 12) & 0x7],
        ['rs1', (instr >>> 15) & 0x1F],
        ['rs2', (instr >>> 20) & 0x1F],
        ['funct7', (instr >>> 25) & 0x7F],
      ]);
    },
  }),

  RV32I_ALU: defineCombinational({
    name: 'RV32I_ALU',
    description: 'RV32I arithmetic logic unit — supports ADD, SUB, AND, OR, XOR, SLL, SRL, SRA, SLT, SLTU',
    category: 'rv32i',
    icon: 'ALU',
    namespace: 'rv32i',
    inputs: [
      { name: 'a', portType: busType(32) },
      { name: 'b', portType: busType(32) },
      { name: 'alu_op', portType: busType(4) },
    ],
    outputs: [
      { name: 'result', portType: busType(32) },
      { name: 'zero', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const a = (inputs.get('a') as number) >>> 0;
      const b = (inputs.get('b') as number) >>> 0;
      const op = (inputs.get('alu_op') as number) & 0xF;

      let result: number;
      switch (op) {
        case 0: result = (a + b) >>> 0; break;           // ADD
        case 1: result = (a - b) >>> 0; break;           // SUB
        case 2: result = (a & b) >>> 0; break;           // AND
        case 3: result = (a | b) >>> 0; break;           // OR
        case 4: result = (a ^ b) >>> 0; break;           // XOR
        case 5: result = (a << (b & 0x1F)) >>> 0; break; // SLL
        case 6: result = a >>> (b & 0x1F); break;        // SRL
        case 7: result = ((a | 0) >> (b & 0x1F)) >>> 0; break; // SRA
        case 8: result = ((a | 0) < (b | 0)) ? 1 : 0; break;  // SLT (signed)
        case 9: result = (a < b) ? 1 : 0; break;        // SLTU (unsigned)
        default: result = 0; break;
      }

      const outputs = new Map<string, BitValue | BusValue>();
      outputs.set('result', result);
      outputs.set('zero', result === 0);
      return outputs;
    },
  }),

  RV32I_ImmGen: defineCombinational({
    name: 'RV32I_ImmGen',
    description: 'Immediate generator — extracts and sign-extends immediate values from RV32I instructions based on opcode format',
    category: 'rv32i',
    icon: 'IMM',
    namespace: 'rv32i',
    inputs: [{ name: 'instruction', portType: busType(32) }],
    outputs: [{ name: 'immediate', portType: busType(32) }],
    evaluate: (inputs) => {
      const instr = (inputs.get('instruction') as number) >>> 0;
      const opcode = instr & 0x7F;
      let imm: number;

      switch (opcode) {
        // I-type: ADDI/ORI/..., loads, JALR
        case 0x13: case 0x03: case 0x67:
          imm = (instr >> 20) | 0; // sign-extended by >> (arithmetic shift)
          break;
        // S-type: stores
        case 0x23:
          imm = (((instr >> 25) << 5) | ((instr >>> 7) & 0x1F)) | 0;
          imm = (imm << 20) >> 20; // sign-extend 12-bit
          break;
        // B-type: branches
        case 0x63: {
          const b12 = (instr >>> 31) & 1;
          const b11 = (instr >>> 7) & 1;
          const b10_5 = (instr >>> 25) & 0x3F;
          const b4_1 = (instr >>> 8) & 0xF;
          imm = (b12 << 12) | (b11 << 11) | (b10_5 << 5) | (b4_1 << 1);
          imm = (imm << 19) >> 19; // sign-extend 13-bit
          break;
        }
        // U-type: LUI, AUIPC
        case 0x37: case 0x17:
          imm = (instr & 0xFFFFF000) | 0;
          break;
        // J-type: JAL
        case 0x6F: {
          const j20 = (instr >>> 31) & 1;
          const j19_12 = (instr >>> 12) & 0xFF;
          const j11 = (instr >>> 20) & 1;
          const j10_1 = (instr >>> 21) & 0x3FF;
          imm = (j20 << 20) | (j19_12 << 12) | (j11 << 11) | (j10_1 << 1);
          imm = (imm << 11) >> 11; // sign-extend 21-bit
          break;
        }
        default:
          imm = 0;
          break;
      }

      return new Map([['immediate', imm >>> 0]]);
    },
  }),

  RV32I_Control: defineCombinational({
    name: 'RV32I_Control',
    description: 'Control unit — decodes opcode/funct3/funct7 into ALU op and datapath control signals',
    category: 'rv32i',
    icon: 'CTL',
    namespace: 'rv32i',
    inputs: [
      { name: 'opcode', portType: busType(7) },
      { name: 'funct3', portType: busType(3) },
      { name: 'funct7_bit', portType: bitType() },
    ],
    outputs: [
      { name: 'alu_op', portType: busType(4) },
      { name: 'alu_src', portType: bitType() },
      { name: 'mem_read', portType: bitType() },
      { name: 'mem_write', portType: bitType() },
      { name: 'reg_write', portType: bitType() },
      { name: 'mem_to_reg', portType: bitType() },
      { name: 'branch', portType: bitType() },
      { name: 'jump', portType: bitType() },
      { name: 'lui', portType: bitType() },
      { name: 'auipc', portType: bitType() },
      { name: 'is_jalr', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const opcode = (inputs.get('opcode') as number) & 0x7F;
      const funct3 = (inputs.get('funct3') as number) & 0x7;
      const funct7_bit = inputs.get('funct7_bit') as boolean;

      let alu_op = 0, alu_src = false, mem_read = false, mem_write = false;
      let reg_write = false, mem_to_reg = false, branch = false, jump = false;
      let lui = false, auipc = false, is_jalr = false;

      switch (opcode) {
        case 0x33: // R-type
          reg_write = true;
          switch (funct3) {
            case 0: alu_op = funct7_bit ? 1 : 0; break; // ADD/SUB
            case 1: alu_op = 5; break; // SLL
            case 2: alu_op = 8; break; // SLT
            case 3: alu_op = 9; break; // SLTU
            case 4: alu_op = 4; break; // XOR
            case 5: alu_op = funct7_bit ? 7 : 6; break; // SRA/SRL
            case 6: alu_op = 3; break; // OR
            case 7: alu_op = 2; break; // AND
          }
          break;
        case 0x13: // I-type ALU
          reg_write = true;
          alu_src = true;
          switch (funct3) {
            case 0: alu_op = 0; break; // ADDI
            case 1: alu_op = 5; break; // SLLI
            case 2: alu_op = 8; break; // SLTI
            case 3: alu_op = 9; break; // SLTIU
            case 4: alu_op = 4; break; // XORI
            case 5: alu_op = funct7_bit ? 7 : 6; break; // SRAI/SRLI
            case 6: alu_op = 3; break; // ORI
            case 7: alu_op = 2; break; // ANDI
          }
          break;
        case 0x03: // Load
          reg_write = true; alu_src = true; mem_read = true; mem_to_reg = true;
          alu_op = 0; // ADD for address calc
          break;
        case 0x23: // Store
          alu_src = true; mem_write = true;
          alu_op = 0; // ADD for address calc
          break;
        case 0x63: // Branch
          branch = true;
          alu_op = 1; // SUB for comparison
          break;
        case 0x6F: // JAL
          reg_write = true; jump = true;
          break;
        case 0x67: // JALR
          reg_write = true; jump = true; alu_src = true; is_jalr = true;
          alu_op = 0; // ADD for target calc
          break;
        case 0x37: // LUI
          reg_write = true; lui = true;
          break;
        case 0x17: // AUIPC
          reg_write = true; auipc = true;
          break;
      }

      const outputs = new Map<string, BitValue | BusValue>();
      outputs.set('alu_op', alu_op);
      outputs.set('alu_src', alu_src);
      outputs.set('mem_read', mem_read);
      outputs.set('mem_write', mem_write);
      outputs.set('reg_write', reg_write);
      outputs.set('mem_to_reg', mem_to_reg);
      outputs.set('branch', branch);
      outputs.set('jump', jump);
      outputs.set('lui', lui);
      outputs.set('auipc', auipc);
      outputs.set('is_jalr', is_jalr);
      return outputs;
    },
  }),

  RV32I_BranchComp: defineCombinational({
    name: 'RV32I_BranchComp',
    description: 'Branch comparator — evaluates branch conditions (BEQ, BNE, BLT, BGE, BLTU, BGEU) based on funct3',
    category: 'rv32i',
    icon: 'CMP',
    namespace: 'rv32i',
    inputs: [
      { name: 'a', portType: busType(32) },
      { name: 'b', portType: busType(32) },
      { name: 'funct3', portType: busType(3) },
    ],
    outputs: [{ name: 'take_branch', portType: bitType() }],
    evaluate: (inputs) => {
      const a = (inputs.get('a') as number) >>> 0;
      const b = (inputs.get('b') as number) >>> 0;
      const funct3 = (inputs.get('funct3') as number) & 0x7;

      const sa = a | 0; // signed interpretation
      const sb = b | 0;

      let take = false;
      switch (funct3) {
        case 0: take = a === b; break;       // BEQ
        case 1: take = a !== b; break;       // BNE
        case 4: take = sa < sb; break;       // BLT
        case 5: take = sa >= sb; break;      // BGE
        case 6: take = a < b; break;         // BLTU
        case 7: take = a >= b; break;        // BGEU
        default: take = false; break;
      }

      return new Map([['take_branch', take]]);
    },
  }),

  // --- Sequential RV32I primitives ---

  RV32I_RegisterFile: defineSequential({
    name: 'RV32I_RegisterFile',
    description: 'RV32I register file — 32 × 32-bit registers, x0 hardwired to zero, dual read ports, single write port',
    category: 'rv32i',
    icon: 'RF',
    namespace: 'rv32i',
    inputs: [
      { name: 'rs1', portType: busType(5) },
      { name: 'rs2', portType: busType(5) },
      { name: 'rd', portType: busType(5) },
      { name: 'write_data', portType: busType(32) },
      { name: 'we', portType: bitType() },
    ],
    outputs: [
      { name: 'read1', portType: busType(32) },
      { name: 'read2', portType: busType(32) },
    ],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'regfile-state',
        name: 'registers',
        stateType: { kind: 'memory', addressWidth: 5, dataWidth: 32 },
        initialValue: { data: new Map(), addressWidth: 5, dataWidth: 32 },
      },
    ],
    evaluate: (inputs, currentState) => {
      const regs = (currentState ?? new Map()) as Map<number, number>;
      const rs1 = (inputs.get('rs1') as number) & 0x1F;
      const rs2 = (inputs.get('rs2') as number) & 0x1F;

      const read1 = rs1 === 0 ? 0 : (regs.get(rs1) ?? 0) >>> 0;
      const read2 = rs2 === 0 ? 0 : (regs.get(rs2) ?? 0) >>> 0;

      return new Map([
        ['read1', read1],
        ['read2', read2],
      ]);
    },
    updateState: (inputs, currentState, clockEdges) => {
      const regs = (currentState ?? new Map()) as Map<number, number>;
      const edge = clockEdges['clk'] ?? 'none';
      const we = inputs.get('we') as boolean;
      const rd = (inputs.get('rd') as number) & 0x1F;

      if (edge === 'rising' && we && rd !== 0) {
        const writeData = ((inputs.get('write_data') as number) ?? 0) >>> 0;
        const newRegs = new Map(regs);
        newRegs.set(rd, writeData);
        return newRegs;
      }

      return regs;
    },
    outputDependency: 'state+inputs',
  }),

  RV32I_InstrMem: defineSequential({
    name: 'RV32I_InstrMem',
    description: 'Instruction memory (ROM) — byte-addressable, returns 32-bit little-endian instruction at given address',
    category: 'rv32i',
    icon: 'IM',
    namespace: 'rv32i',
    inputs: [{ name: 'addr', portType: busType(32) }],
    outputs: [{ name: 'instruction', portType: busType(32) }],
    clocks: [],
    state: [
      {
        id: 'instrmem-state',
        name: 'memory',
        stateType: { kind: 'memory', addressWidth: 32, dataWidth: 8 },
        initialValue: { data: new Map(), addressWidth: 32, dataWidth: 8 },
      },
    ],
    evaluate: (inputs, currentState) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const addr = ((inputs.get('addr') as number) ?? 0) >>> 0;

      // Read 4 bytes little-endian
      const b0 = memory.get(addr) ?? 0;
      const b1 = memory.get((addr + 1) >>> 0) ?? 0;
      const b2 = memory.get((addr + 2) >>> 0) ?? 0;
      const b3 = memory.get((addr + 3) >>> 0) ?? 0;
      const instruction = ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;

      return new Map([['instruction', instruction]]);
    },
    updateState: (_inputs, currentState, _clockEdges) => {
      return currentState;
    },
    outputDependency: 'state+inputs',
  }),

  RV32I_DataMem: defineSequential({
    name: 'RV32I_DataMem',
    description: 'Data memory — byte-addressable, supports LB/LH/LW/LBU/LHU loads and SB/SH/SW stores based on funct3',
    category: 'rv32i',
    icon: 'DM',
    namespace: 'rv32i',
    inputs: [
      { name: 'addr', portType: busType(32) },
      { name: 'write_data', portType: busType(32) },
      { name: 'mem_read', portType: bitType() },
      { name: 'mem_write', portType: bitType() },
      { name: 'funct3', portType: busType(3) },
    ],
    outputs: [
      { name: 'read_data', portType: busType(32) },
      { name: 'misalign', portType: bitType() },
    ],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'datamem-state',
        name: 'memory',
        stateType: { kind: 'memory', addressWidth: 32, dataWidth: 8 },
        initialValue: { data: new Map(), addressWidth: 32, dataWidth: 8 },
      },
    ],
    evaluate: (inputs, currentState) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const memRead = inputs.get('mem_read') as boolean;
      const memWrite = inputs.get('mem_write') as boolean;

      if (!memRead && !memWrite) {
        return new Map<string, number | boolean>([['read_data', 0], ['misalign', false]]);
      }

      const addr = ((inputs.get('addr') as number) ?? 0) >>> 0;
      const funct3 = (inputs.get('funct3') as number) & 0x7;

      // Check alignment: LH/LHU/SH require 2-byte, LW/SW require 4-byte
      let misalign = false;
      if ((funct3 === 1 || funct3 === 5) && (addr & 1) !== 0) {
        misalign = true; // halfword access at odd address
      } else if (funct3 === 2 && (addr & 3) !== 0) {
        misalign = true; // word access at non-4-byte boundary
      }

      if (!memRead) {
        return new Map<string, number | boolean>([['read_data', 0], ['misalign', misalign]]);
      }

      let data: number;
      switch (funct3) {
        case 0: { // LB (sign-extend byte)
          const b = memory.get(addr) ?? 0;
          data = ((b << 24) >> 24) >>> 0;
          break;
        }
        case 1: { // LH (sign-extend halfword)
          const lo = memory.get(addr) ?? 0;
          const hi = memory.get((addr + 1) >>> 0) ?? 0;
          const hw = (hi << 8) | lo;
          data = ((hw << 16) >> 16) >>> 0;
          break;
        }
        case 2: { // LW (word)
          const b0 = memory.get(addr) ?? 0;
          const b1 = memory.get((addr + 1) >>> 0) ?? 0;
          const b2 = memory.get((addr + 2) >>> 0) ?? 0;
          const b3 = memory.get((addr + 3) >>> 0) ?? 0;
          data = ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;
          break;
        }
        case 4: { // LBU (zero-extend byte)
          data = memory.get(addr) ?? 0;
          break;
        }
        case 5: { // LHU (zero-extend halfword)
          const lo = memory.get(addr) ?? 0;
          const hi = memory.get((addr + 1) >>> 0) ?? 0;
          data = ((hi << 8) | lo) >>> 0;
          break;
        }
        default:
          data = 0;
          break;
      }

      return new Map<string, number | boolean>([['read_data', data], ['misalign', misalign]]);
    },
    updateState: (inputs, currentState, clockEdges) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const edge = clockEdges['clk'] ?? 'none';
      const memWrite = inputs.get('mem_write') as boolean;

      if (edge !== 'rising' || !memWrite) {
        return memory;
      }

      const addr = ((inputs.get('addr') as number) ?? 0) >>> 0;
      const writeData = ((inputs.get('write_data') as number) ?? 0) >>> 0;
      const funct3 = (inputs.get('funct3') as number) & 0x7;
      const newMemory = new Map(memory);

      switch (funct3) {
        case 0: // SB (store byte)
          newMemory.set(addr, writeData & 0xFF);
          break;
        case 1: // SH (store halfword)
          newMemory.set(addr, writeData & 0xFF);
          newMemory.set((addr + 1) >>> 0, (writeData >>> 8) & 0xFF);
          break;
        case 2: // SW (store word)
          newMemory.set(addr, writeData & 0xFF);
          newMemory.set((addr + 1) >>> 0, (writeData >>> 8) & 0xFF);
          newMemory.set((addr + 2) >>> 0, (writeData >>> 16) & 0xFF);
          newMemory.set((addr + 3) >>> 0, (writeData >>> 24) & 0xFF);
          break;
        default:
          break;
      }

      return newMemory;
    },
    outputDependency: 'state+inputs',
  }),

  // ==========================================================================
  // RV32I Writeback Mux — collapses lui_mux → auipc_mux → jump_wb_mux chain
  // ==========================================================================
  RV32I_WritebackMux: defineCombinational({
    name: 'RV32I_WritebackMux',
    description: 'Unified writeback mux — selects ALU result, load data, PC+4, immediate, or PC+imm',
    category: 'rv32i',
    icon: 'WB',
    namespace: 'rv32i',
    inputs: [
      { name: 'alu_result', portType: busType(32) },
      { name: 'load_data', portType: busType(32) },
      { name: 'pc_plus4', portType: busType(32) },
      { name: 'immediate', portType: busType(32) },
      { name: 'pc_plus_imm', portType: busType(32) },
      { name: 'mem_to_reg', portType: bitType() },
      { name: 'lui', portType: bitType() },
      { name: 'auipc', portType: bitType() },
      { name: 'jump', portType: bitType() },
    ],
    outputs: [
      { name: 'write_data', portType: busType(32) },
    ],
    evaluate: (inputs) => {
      const aluResult = (inputs.get('alu_result') as number) ?? 0;
      const loadData = (inputs.get('load_data') as number) ?? 0;
      const pcPlus4 = (inputs.get('pc_plus4') as number) ?? 0;
      const immediate = (inputs.get('immediate') as number) ?? 0;
      const pcPlusImm = (inputs.get('pc_plus_imm') as number) ?? 0;
      const memToReg = inputs.get('mem_to_reg') as boolean;
      const lui = inputs.get('lui') as boolean;
      const auipc = inputs.get('auipc') as boolean;
      const jump = inputs.get('jump') as boolean;

      // Priority: jump > auipc > lui > mem_to_reg > alu_result
      let writeData: number;
      if (jump) {
        writeData = pcPlus4;        // JAL/JALR: link register = PC+4
      } else if (auipc) {
        writeData = pcPlusImm;      // AUIPC: rd = PC + imm
      } else if (lui) {
        writeData = immediate;      // LUI: rd = immediate
      } else if (memToReg) {
        writeData = loadData;       // Load: rd = memory data
      } else {
        writeData = aluResult;      // R-type/I-type: rd = ALU result
      }

      return new Map([['write_data', (writeData >>> 0)]]);
    },
    referenceCircuit: {
      source: `circuit RV32I_WritebackMux {
  input alu_result: Bus[32]
  input load_data: Bus[32]
  input pc_plus4: Bus[32]
  input immediate: Bus[32]
  input pc_plus_imm: Bus[32]
  input mem_to_reg: Bit
  input lui: Bit
  input auipc: Bit
  input jump: Bit
  output write_data: Bus[32]
  impl {
    // Priority chain: jump > auipc > lui > mem_to_reg > alu_result
    node mux1: Mux(width=32)
    connect alu_result -> mux1.in0
    connect load_data -> mux1.in1
    connect mem_to_reg -> mux1.sel

    node mux2: Mux(width=32)
    connect mux1.out -> mux2.in0
    connect immediate -> mux2.in1
    connect lui -> mux2.sel

    node mux3: Mux(width=32)
    connect mux2.out -> mux3.in0
    connect pc_plus_imm -> mux3.in1
    connect auipc -> mux3.sel

    node mux4: Mux(width=32)
    connect mux3.out -> mux4.in0
    connect pc_plus4 -> mux4.in1
    connect jump -> mux4.sel

    connect mux4.out -> write_data
  }
}`,
      description: 'Writeback mux from priority Mux chain',
    },
  }),

  // ==========================================================================
  // RV32I Next-PC Mux — collapses branch_mux → jal_target_mux → jump_mux chain
  // ==========================================================================
  RV32I_NextPCMux: defineCombinational({
    name: 'RV32I_NextPCMux',
    description: 'Unified next-PC mux — selects PC+4, branch target, JAL target, or JALR target',
    category: 'rv32i',
    icon: 'PC',
    namespace: 'rv32i',
    inputs: [
      { name: 'pc_plus4', portType: busType(32) },
      { name: 'branch_target', portType: busType(32) },
      { name: 'jal_target', portType: busType(32) },
      { name: 'jalr_target', portType: busType(32) },
      { name: 'branch', portType: bitType() },
      { name: 'take_branch', portType: bitType() },
      { name: 'jump', portType: bitType() },
      { name: 'is_jalr', portType: bitType() },
    ],
    outputs: [
      { name: 'next_pc', portType: busType(32) },
    ],
    evaluate: (inputs) => {
      const pcPlus4 = (inputs.get('pc_plus4') as number) ?? 0;
      const branchTarget = (inputs.get('branch_target') as number) ?? 0;
      const jalTarget = (inputs.get('jal_target') as number) ?? 0;
      const jalrTarget = (inputs.get('jalr_target') as number) ?? 0;
      const branch = inputs.get('branch') as boolean;
      const takeBranch = inputs.get('take_branch') as boolean;
      const jump = inputs.get('jump') as boolean;
      const isJalr = inputs.get('is_jalr') as boolean;

      let nextPC: number;
      if (jump) {
        nextPC = isJalr ? (jalrTarget & ~1) : jalTarget;
      } else if (branch && takeBranch) {
        nextPC = branchTarget;
      } else {
        nextPC = pcPlus4;
      }

      return new Map([['next_pc', (nextPC >>> 0)]]);
    },
    referenceCircuit: {
      source: `circuit RV32I_NextPCMux {
  input pc_plus4: Bus[32]
  input branch_target: Bus[32]
  input jal_target: Bus[32]
  input jalr_target: Bus[32]
  input branch: Bit
  input take_branch: Bit
  input jump: Bit
  input is_jalr: Bit
  output next_pc: Bus[32]
  impl {
    // branch_taken = branch AND take_branch
    node branch_and: And
    connect branch -> branch_and.a
    connect take_branch -> branch_and.b

    // Select branch target vs PC+4
    node mux_branch: Mux(width=32)
    connect pc_plus4 -> mux_branch.in0
    connect branch_target -> mux_branch.in1
    connect branch_and.out -> mux_branch.sel

    // Select JAL vs JALR target
    node mux_jalr: Mux(width=32)
    connect jal_target -> mux_jalr.in0
    connect jalr_target -> mux_jalr.in1
    connect is_jalr -> mux_jalr.sel

    // Select jump target vs branch/PC+4 result
    node mux_jump: Mux(width=32)
    connect mux_branch.out -> mux_jump.in0
    connect mux_jalr.out -> mux_jump.in1
    connect jump -> mux_jump.sel

    connect mux_jump.out -> next_pc
  }
}`,
      description: 'Next-PC mux from And + priority Mux chain',
    },
  }),

  // ==========================================================================
  // RV32I Forwarding Unit — detects data hazards and selects forwarding paths
  // ==========================================================================
  RV32I_ForwardingUnit: defineCombinational({
    name: 'RV32I_ForwardingUnit',
    description: 'Forwarding unit — detects EX/MEM hazards and outputs forwarding mux selects',
    category: 'rv32i',
    icon: 'FWD',
    namespace: 'rv32i',
    inputs: [
      { name: 'id_rs1', portType: busType(5) },
      { name: 'id_rs2', portType: busType(5) },
      { name: 'ex_rd', portType: busType(5) },
      { name: 'ex_reg_write', portType: bitType() },
      { name: 'mem_rd', portType: busType(5) },
      { name: 'mem_reg_write', portType: bitType() },
    ],
    outputs: [
      // 0 = no forwarding, 1 = forward from EX, 2 = forward from MEM
      { name: 'forward_a', portType: busType(2) },
      { name: 'forward_b', portType: busType(2) },
    ],
    evaluate: (inputs) => {
      const rs1 = (inputs.get('id_rs1') as number) & 0x1F;
      const rs2 = (inputs.get('id_rs2') as number) & 0x1F;
      const exRd = (inputs.get('ex_rd') as number) & 0x1F;
      const exRegWrite = inputs.get('ex_reg_write') as boolean;
      const memRd = (inputs.get('mem_rd') as number) & 0x1F;
      const memRegWrite = inputs.get('mem_reg_write') as boolean;

      let forwardA = 0;
      let forwardB = 0;

      // EX hazard has priority over MEM hazard
      if (exRegWrite && exRd !== 0 && exRd === rs1) {
        forwardA = 1;
      } else if (memRegWrite && memRd !== 0 && memRd === rs1) {
        forwardA = 2;
      }

      if (exRegWrite && exRd !== 0 && exRd === rs2) {
        forwardB = 1;
      } else if (memRegWrite && memRd !== 0 && memRd === rs2) {
        forwardB = 2;
      }

      return new Map([
        ['forward_a', forwardA],
        ['forward_b', forwardB],
      ]);
    },
    referenceCircuit: {
      source: `circuit RV32I_ForwardingUnit {
  input id_rs1: Bus[5]
  input id_rs2: Bus[5]
  input ex_rd: Bus[5]
  input ex_reg_write: Bit
  input mem_rd: Bus[5]
  input mem_reg_write: Bit
  output forward_a: Bus[2]
  output forward_b: Bus[2]
  impl {
    node zero5: Constant(value=0, width=5)

    // EX hazard detection for rs1
    node ex_cmp_rs1: Comparator(width=5)
    node ex_nz1: Comparator(width=5)
    node ex_nz1_not: Not
    node ex_match_rs1: And
    node ex_match_rs1_b: And
    connect ex_rd -> ex_cmp_rs1.a
    connect id_rs1 -> ex_cmp_rs1.b
    connect ex_rd -> ex_nz1.a
    connect zero5.out -> ex_nz1.b
    connect ex_nz1.eq -> ex_nz1_not.in
    connect ex_reg_write -> ex_match_rs1.a
    connect ex_nz1_not.out -> ex_match_rs1.b
    connect ex_match_rs1.out -> ex_match_rs1_b.a
    connect ex_cmp_rs1.eq -> ex_match_rs1_b.b

    // MEM hazard detection for rs1
    node mem_cmp_rs1: Comparator(width=5)
    node mem_nz1: Comparator(width=5)
    node mem_nz1_not: Not
    node mem_match_rs1: And
    node mem_match_rs1_b: And
    connect mem_rd -> mem_cmp_rs1.a
    connect id_rs1 -> mem_cmp_rs1.b
    connect mem_rd -> mem_nz1.a
    connect zero5.out -> mem_nz1.b
    connect mem_nz1.eq -> mem_nz1_not.in
    connect mem_reg_write -> mem_match_rs1.a
    connect mem_nz1_not.out -> mem_match_rs1.b
    connect mem_match_rs1.out -> mem_match_rs1_b.a
    connect mem_cmp_rs1.eq -> mem_match_rs1_b.b

    // forward_a: EX priority over MEM. Encode: 0=none, 1=EX, 2=MEM
    // bit0 = ex_match (gives value 1)
    // bit1 = mem_match AND NOT ex_match (gives value 2)
    node not_ex_rs1: Not
    connect ex_match_rs1_b.out -> not_ex_rs1.in
    node mem_only_rs1: And
    connect mem_match_rs1_b.out -> mem_only_rs1.a
    connect not_ex_rs1.out -> mem_only_rs1.b
    node fwd_a_combine: Concat(lowWidth=1)
    connect ex_match_rs1_b.out -> fwd_a_combine.low
    connect mem_only_rs1.out -> fwd_a_combine.high
    connect fwd_a_combine.out -> forward_a

    // EX hazard detection for rs2
    node ex_cmp_rs2: Comparator(width=5)
    node ex_match_rs2: And
    node ex_match_rs2_b: And
    connect ex_rd -> ex_cmp_rs2.a
    connect id_rs2 -> ex_cmp_rs2.b
    connect ex_reg_write -> ex_match_rs2.a
    connect ex_nz1_not.out -> ex_match_rs2.b
    connect ex_match_rs2.out -> ex_match_rs2_b.a
    connect ex_cmp_rs2.eq -> ex_match_rs2_b.b

    // MEM hazard detection for rs2
    node mem_cmp_rs2: Comparator(width=5)
    node mem_match_rs2: And
    node mem_match_rs2_b: And
    connect mem_rd -> mem_cmp_rs2.a
    connect id_rs2 -> mem_cmp_rs2.b
    connect mem_reg_write -> mem_match_rs2.a
    connect mem_nz1_not.out -> mem_match_rs2.b
    connect mem_match_rs2.out -> mem_match_rs2_b.a
    connect mem_cmp_rs2.eq -> mem_match_rs2_b.b

    // forward_b: same encoding
    node not_ex_rs2: Not
    connect ex_match_rs2_b.out -> not_ex_rs2.in
    node mem_only_rs2: And
    connect mem_match_rs2_b.out -> mem_only_rs2.a
    connect not_ex_rs2.out -> mem_only_rs2.b
    node fwd_b_combine: Concat(lowWidth=1)
    connect ex_match_rs2_b.out -> fwd_b_combine.low
    connect mem_only_rs2.out -> fwd_b_combine.high
    connect fwd_b_combine.out -> forward_b
  }
}`,
      description: 'Forwarding unit from Comparators + And + Concat for 2-bit encoding',
    },
  }),

  // ==========================================================================
  // RV32I WB-to-ID Bypass — forwards WB write data when WB writes the same
  // register that ID is reading, avoiding a 1-cycle stale read from the
  // register file. Models real hardware's write-first-read-second clocking.
  // ==========================================================================
  RV32I_WBBypass: defineCombinational({
    name: 'RV32I_WBBypass',
    description: 'WB-to-ID bypass — forwards WB write data when it matches the register being read',
    category: 'rv32i',
    icon: 'BYP',
    namespace: 'rv32i',
    inputs: [
      { name: 'rs_val', portType: busType(32) },
      { name: 'rs_addr', portType: busType(5) },
      { name: 'wb_val', portType: busType(32) },
      { name: 'wb_rd', portType: busType(5) },
      { name: 'wb_we', portType: bitType() },
    ],
    outputs: [
      { name: 'out', portType: busType(32) },
    ],
    evaluate: (inputs) => {
      const rsAddr = (inputs.get('rs_addr') as number) & 0x1F;
      const wbRd = (inputs.get('wb_rd') as number) & 0x1F;
      const wbWe = inputs.get('wb_we') as boolean;
      const rsVal = ((inputs.get('rs_val') as number) ?? 0) >>> 0;
      const wbVal = ((inputs.get('wb_val') as number) ?? 0) >>> 0;

      const bypass = wbWe && wbRd !== 0 && wbRd === rsAddr;
      return new Map([['out', bypass ? wbVal : rsVal]]);
    },
    referenceCircuit: {
      source: `circuit RV32I_WBBypass {
  input rs_val: Bus[32]
  input rs_addr: Bus[5]
  input wb_val: Bus[32]
  input wb_rd: Bus[5]
  input wb_we: Bit
  output out: Bus[32]
  impl {
    node zero5: Constant(value=0, width=5)
    node cmp_addr: Comparator(width=5)
    node cmp_zero: Comparator(width=5)
    node not_zero: Not
    node and1: And
    node and2: And
    node mux: Mux(width=32)

    // wb_rd == rs_addr?
    connect wb_rd -> cmp_addr.a
    connect rs_addr -> cmp_addr.b

    // wb_rd != 0?
    connect wb_rd -> cmp_zero.a
    connect zero5.out -> cmp_zero.b
    connect cmp_zero.eq -> not_zero.in

    // bypass = wb_we AND (wb_rd != 0) AND (wb_rd == rs_addr)
    connect wb_we -> and1.a
    connect not_zero.out -> and1.b
    connect and1.out -> and2.a
    connect cmp_addr.eq -> and2.b

    // out = bypass ? wb_val : rs_val
    connect rs_val -> mux.in0
    connect wb_val -> mux.in1
    connect and2.out -> mux.sel
    connect mux.out -> out
  }
}`,
      description: 'WB bypass from Comparator + And + Mux',
    },
  }),

  // ==========================================================================
  // RV32I Load Alignment Unit — extracts byte/halfword from a 32-bit word
  // based on funct3. Sits between memory and the pipeline's load data path.
  // ==========================================================================
  RV32I_LoadAlign: defineCombinational({
    name: 'RV32I_LoadAlign',
    description: 'Load alignment — extracts byte/halfword from 32-bit word based on funct3 (LB/LH/LW/LBU/LHU)',
    category: 'rv32i',
    icon: 'LA',
    namespace: 'rv32i',
    inputs: [
      { name: 'data', portType: busType(32) },
      { name: 'funct3', portType: busType(3) },
    ],
    outputs: [
      { name: 'out', portType: busType(32) },
    ],
    evaluate: (inputs) => {
      const raw = ((inputs.get('data') as number) ?? 0) >>> 0;
      const funct3 = ((inputs.get('funct3') as number) ?? 2) & 0x7;

      let out: number;
      switch (funct3) {
        case 0: { const b = raw & 0xFF; out = ((b << 24) >> 24) >>> 0; break; } // LB
        case 1: { const hw = raw & 0xFFFF; out = ((hw << 16) >> 16) >>> 0; break; } // LH
        case 4: out = raw & 0xFF; break; // LBU
        case 5: out = raw & 0xFFFF; break; // LHU
        default: out = raw; break; // LW (case 2)
      }

      return new Map([['out', out]]);
    },
    referenceCircuit: {
      source: `circuit RV32I_LoadAlign {
  input data: Bus[32]
  input funct3: Bus[3]
  output out: Bus[32]
  impl {
    // Extract byte (bits 7:0) and halfword (bits 15:0)
    node byte_slice: BitSlice(low=0, high=7)
    node half_slice: BitSlice(low=0, high=15)
    connect data -> byte_slice.in
    connect data -> half_slice.in

    // funct3 decoding: 0=LB, 1=LH, 2=LW, 4=LBU, 5=LHU
    node zero3: Constant(value=0, width=3)
    node one3: Constant(value=1, width=3)
    node two3: Constant(value=2, width=3)
    node four3: Constant(value=4, width=3)
    node five3: Constant(value=5, width=3)

    node is_lb: Comparator(width=3)
    node is_lh: Comparator(width=3)
    node is_lbu: Comparator(width=3)
    node is_lhu: Comparator(width=3)
    connect funct3 -> is_lb.a
    connect zero3.out -> is_lb.b
    connect funct3 -> is_lh.a
    connect one3.out -> is_lh.b
    connect funct3 -> is_lbu.a
    connect four3.out -> is_lbu.b
    connect funct3 -> is_lhu.a
    connect five3.out -> is_lhu.b

    // Unsigned byte/halfword (zero-extended via BitSlice — upper bits are 0)
    // For now, use BitSlice outputs directly (they zero-extend)
    // Signed versions need sign extension — approximate with the unsigned for now
    // TODO: proper sign extension requires shift-left then arithmetic shift-right

    // Priority mux: LBU -> byte, LHU -> half, LB -> byte, LH -> half, else LW -> data
    node mux1: Mux(width=32)
    connect data -> mux1.in0
    connect half_slice.out -> mux1.in1
    connect is_lh.eq -> mux1.sel

    node mux2: Mux(width=32)
    connect mux1.out -> mux2.in0
    connect byte_slice.out -> mux2.in1
    connect is_lb.eq -> mux2.sel

    node mux3: Mux(width=32)
    connect mux2.out -> mux3.in0
    connect half_slice.out -> mux3.in1
    connect is_lhu.eq -> mux3.sel

    node mux4: Mux(width=32)
    connect mux3.out -> mux4.in0
    connect byte_slice.out -> mux4.in1
    connect is_lbu.eq -> mux4.sel

    connect mux4.out -> out
  }
}`,
      description: 'Load alignment from BitSlice + priority Mux chain',
    },
  }),

  // ==========================================================================
  // RV32I Hazard Detection Unit — stalls pipeline on load-use hazards
  // ==========================================================================
  RV32I_HazardUnit: defineCombinational({
    name: 'RV32I_HazardUnit',
    description: 'Hazard detection — stalls on load-use hazards, flushes on branches/jumps',
    category: 'rv32i',
    icon: 'HAZ',
    namespace: 'rv32i',
    inputs: [
      { name: 'if_rs1', portType: busType(5) },
      { name: 'if_rs2', portType: busType(5) },
      { name: 'id_rd', portType: busType(5) },
      { name: 'id_mem_read', portType: bitType() },
      { name: 'branch_taken', portType: bitType() },
      { name: 'jump', portType: bitType() },
    ],
    outputs: [
      { name: 'stall', portType: bitType() },
      { name: 'flush', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const ifRs1 = (inputs.get('if_rs1') as number) & 0x1F;
      const ifRs2 = (inputs.get('if_rs2') as number) & 0x1F;
      const idRd = (inputs.get('id_rd') as number) & 0x1F;
      const idMemRead = inputs.get('id_mem_read') as boolean;
      const branchTaken = inputs.get('branch_taken') as boolean;
      const jump = inputs.get('jump') as boolean;

      // Load-use hazard: instruction in ID is a load, and IF needs that register
      const stall = idMemRead && idRd !== 0 &&
        (idRd === ifRs1 || idRd === ifRs2);

      // Flush on branch taken or jump (squash speculative fetch)
      const flush = branchTaken || jump;

      return new Map([
        ['stall', stall],
        ['flush', flush],
      ]);
    },
    referenceCircuit: {
      source: `circuit RV32I_HazardUnit {
  input if_rs1: Bus[5]
  input if_rs2: Bus[5]
  input id_rd: Bus[5]
  input id_mem_read: Bit
  input branch_taken: Bit
  input jump: Bit
  output stall: Bit
  output flush: Bit
  impl {
    node zero5: Constant(value=0, width=5)

    // id_rd != 0
    node rd_nz: Comparator(width=5)
    node rd_nz_not: Not
    connect id_rd -> rd_nz.a
    connect zero5.out -> rd_nz.b
    connect rd_nz.eq -> rd_nz_not.in

    // id_rd == if_rs1
    node cmp_rs1: Comparator(width=5)
    connect id_rd -> cmp_rs1.a
    connect if_rs1 -> cmp_rs1.b

    // id_rd == if_rs2
    node cmp_rs2: Comparator(width=5)
    connect id_rd -> cmp_rs2.a
    connect if_rs2 -> cmp_rs2.b

    // (id_rd == if_rs1) OR (id_rd == if_rs2)
    node rs_match: Or
    connect cmp_rs1.eq -> rs_match.a
    connect cmp_rs2.eq -> rs_match.b

    // stall = id_mem_read AND (id_rd != 0) AND ((id_rd == if_rs1) OR (id_rd == if_rs2))
    node stall_and1: And
    connect id_mem_read -> stall_and1.a
    connect rd_nz_not.out -> stall_and1.b
    node stall_and2: And
    connect stall_and1.out -> stall_and2.a
    connect rs_match.out -> stall_and2.b
    connect stall_and2.out -> stall

    // flush = branch_taken OR jump
    node flush_or: Or
    connect branch_taken -> flush_or.a
    connect jump -> flush_or.b
    connect flush_or.out -> flush
  }
}`,
      description: 'Hazard unit from Comparators + And/Or logic',
    },
  }),

  // ==========================================================================
  // IEEE 802.3 Ethernet Frame Parser Primitives
  // ==========================================================================
  //
  // Models the receive path of a 1G Ethernet MAC + parser pipeline.
  // 32-bit data bus (GMII), 4 bytes per clock cycle.
  // AXI-Stream-like interface: tdata/tkeep/tvalid/tlast.
  //
  // PHY layer (preamble/SFD stripping) is below our abstraction boundary.
  // Frame data starts at byte 0 of the destination MAC address.
  // ==========================================================================

  // --------------------------------------------------------------------------
  // Eth_ProtocolDecoder — EtherType → protocol flags (combinational)
  // --------------------------------------------------------------------------
  Eth_ProtocolDecoder: defineCombinational({
    name: 'Eth_ProtocolDecoder',
    description: 'EtherType protocol decoder — identifies IPv4, IPv6, ARP, VLAN, MPLS',
    category: 'ethernet',
    icon: 'EP',
    namespace: 'ethernet',
    inputs: [
      { name: 'ethertype', portType: busType(16) },
    ],
    outputs: [
      { name: 'is_ipv4', portType: bitType() },
      { name: 'is_ipv6', portType: bitType() },
      { name: 'is_arp', portType: bitType() },
      { name: 'is_vlan', portType: bitType() },
      { name: 'is_mpls', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const ethertype = (inputs.get('ethertype') as number) & 0xFFFF;
      return new Map<string, boolean>([
        ['is_ipv4', ethertype === 0x0800],
        ['is_ipv6', ethertype === 0x86DD],
        ['is_arp',  ethertype === 0x0806],
        ['is_vlan', ethertype === 0x8100],
        ['is_mpls', ethertype === 0x8847],
      ]);
    },
  }),

  // --------------------------------------------------------------------------
  // Eth_AddrClassifier — MAC address classification (combinational)
  // --------------------------------------------------------------------------
  Eth_AddrClassifier: defineCombinational({
    name: 'Eth_AddrClassifier',
    description: 'MAC address classifier — broadcast, multicast, unicast detection',
    category: 'ethernet',
    icon: 'EA',
    namespace: 'ethernet',
    inputs: [
      { name: 'dst_mac_hi', portType: busType(16) },
      { name: 'dst_mac_lo', portType: busType(32) },
    ],
    outputs: [
      { name: 'is_broadcast', portType: bitType() },
      { name: 'is_multicast', portType: bitType() },
      { name: 'is_unicast', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const hi = (inputs.get('dst_mac_hi') as number) & 0xFFFF;
      const lo = ((inputs.get('dst_mac_lo') as number) & 0xFFFFFFFF) >>> 0;

      // Broadcast: FF:FF:FF:FF:FF:FF
      const isBroadcast = hi === 0xFFFF && lo === (0xFFFFFFFF >>> 0);
      // Multicast: bit 0 of first byte (I/G bit) — first byte is lo[31:24]
      const isMulticast = !isBroadcast && ((lo >>> 24) & 1) === 1;
      const isUnicast = !isBroadcast && !isMulticast;

      return new Map<string, boolean>([
        ['is_broadcast', isBroadcast],
        ['is_multicast', isMulticast],
        ['is_unicast', isUnicast],
      ]);
    },
  }),

  // --------------------------------------------------------------------------
  // Eth_FrameInput — MAC receive interface (sequential, memory-backed)
  // --------------------------------------------------------------------------
  Eth_FrameInput: defineSequential({
    name: 'Eth_FrameInput',
    description: 'MAC RX interface — streams frame bytes as 32-bit AXI-Stream words',
    category: 'ethernet',
    icon: 'EI',
    namespace: 'ethernet',
    inputs: [
      { name: 'enable', portType: bitType() },
      { name: 'reset', portType: bitType() },
    ],
    outputs: [
      { name: 'tdata', portType: busType(32) },
      { name: 'tkeep', portType: busType(4) },
      { name: 'tvalid', portType: bitType() },
      { name: 'tlast', portType: bitType() },
      { name: 'byte_offset', portType: busType(16) },
    ],
    clocks: [],
    state: [
      {
        id: 'frameinput-state',
        name: 'memory',
        stateType: { kind: 'memory', addressWidth: 16, dataWidth: 8 },
        initialValue: { data: new Map(), addressWidth: 16, dataWidth: 8 },
      },
    ],
    evaluate: (_inputs, currentState) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;

      // Output registers (stored by updateState, read by evaluate after commit)
      const REG_OUT_TDATA = 0x10003;
      const REG_OUT_TKEEP = 0x10004;
      const REG_OUT_TVALID = 0x10005;
      const REG_OUT_TLAST = 0x10006;
      const REG_OUT_OFFSET = 0x10007;

      const tdata = (memory.get(REG_OUT_TDATA) ?? 0) >>> 0;
      const tkeep = (memory.get(REG_OUT_TKEEP) ?? 0) & 0xF;
      const tvalid = (memory.get(REG_OUT_TVALID) ?? 0) !== 0;
      const tlast = (memory.get(REG_OUT_TLAST) ?? 0) !== 0;
      const byteOffset = (memory.get(REG_OUT_OFFSET) ?? 0) & 0xFFFF;

      return new Map<string, number | boolean>([
        ['tdata', tdata],
        ['tkeep', tkeep],
        ['tvalid', tvalid],
        ['tlast', tlast],
        ['byte_offset', byteOffset],
      ]);
    },
    updateState: (inputs, currentState) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const enable = inputs.get('enable') as boolean;
      const reset = inputs.get('reset') as boolean;

      const REG_READ_PTR = 0x10000;
      const REG_FRAME_LEN = 0x10001;
      const REG_INITIALIZED = 0x10002;
      const REG_OUT_TDATA = 0x10003;
      const REG_OUT_TKEEP = 0x10004;
      const REG_OUT_TVALID = 0x10005;
      const REG_OUT_TLAST = 0x10006;
      const REG_OUT_OFFSET = 0x10007;

      if (reset) {
        const newMem = new Map(memory);
        newMem.set(REG_READ_PTR, 0);
        newMem.set(REG_INITIALIZED, 0);
        newMem.set(REG_OUT_TVALID, 0);
        newMem.set(REG_OUT_TLAST, 0);
        return newMem;
      }

      if (!enable) {
        const newMem = new Map(memory);
        newMem.set(REG_OUT_TVALID, 0);
        return newMem;
      }

      const newMem = new Map(memory);

      // Initialize frame length on first access
      if (!(memory.get(REG_INITIALIZED) ?? 0)) {
        let maxAddr = -1;
        for (const addr of memory.keys()) {
          if (addr < 0x10000 && addr > maxAddr) maxAddr = addr;
        }
        newMem.set(REG_FRAME_LEN, maxAddr + 1);
        newMem.set(REG_INITIALIZED, 1);
      }

      const frameLength = newMem.get(REG_FRAME_LEN) ?? 0;
      const readPtr = memory.get(REG_READ_PTR) ?? 0;

      if (readPtr >= frameLength || frameLength === 0) {
        // No more data
        newMem.set(REG_OUT_TDATA, 0);
        newMem.set(REG_OUT_TKEEP, 0);
        newMem.set(REG_OUT_TVALID, 0);
        newMem.set(REG_OUT_TLAST, 0);
        newMem.set(REG_OUT_OFFSET, readPtr & 0xFFFF);
        return newMem;
      }

      // Read up to 4 bytes big-endian (network byte order)
      const remaining = frameLength - readPtr;
      const bytesToRead = Math.min(4, remaining);
      let tdata = 0;
      let tkeep = 0;
      for (let i = 0; i < bytesToRead; i++) {
        const b = memory.get(readPtr + i) ?? 0;
        tdata = (tdata | ((b & 0xFF) << (24 - i * 8))) >>> 0;
        tkeep |= (1 << (3 - i));
      }
      const isLast = readPtr + bytesToRead >= frameLength;

      newMem.set(REG_OUT_TDATA, tdata);
      newMem.set(REG_OUT_TKEEP, tkeep);
      newMem.set(REG_OUT_TVALID, 1);
      newMem.set(REG_OUT_TLAST, isLast ? 1 : 0);
      newMem.set(REG_OUT_OFFSET, readPtr & 0xFFFF);
      newMem.set(REG_READ_PTR, readPtr + bytesToRead);

      return newMem;
    },
    outputDependency: 'state+inputs',
  }),

  // --------------------------------------------------------------------------
  // Eth_FrameParser — Main parse FSM (sequential, memory-backed)
  // --------------------------------------------------------------------------
  Eth_FrameParser: defineSequential({
    name: 'Eth_FrameParser',
    description: 'Ethernet frame parser FSM — extracts MAC addresses, EtherType, VLAN from AXI-Stream',
    category: 'ethernet',
    icon: 'EF',
    namespace: 'ethernet',
    inputs: [
      { name: 'tdata', portType: busType(32) },
      { name: 'tkeep', portType: busType(4) },
      { name: 'tvalid', portType: bitType() },
      { name: 'tlast', portType: bitType() },
    ],
    outputs: [
      { name: 'dst_mac_hi', portType: busType(16) },
      { name: 'dst_mac_lo', portType: busType(32) },
      { name: 'dst_mac_valid', portType: bitType() },
      { name: 'src_mac_hi', portType: busType(16) },
      { name: 'src_mac_lo', portType: busType(32) },
      { name: 'src_mac_valid', portType: bitType() },
      { name: 'ethertype', portType: busType(16) },
      { name: 'ethertype_valid', portType: bitType() },
      { name: 'has_vlan', portType: bitType() },
      { name: 'vlan_tci', portType: busType(16) },
      { name: 'vlan_valid', portType: bitType() },
      { name: 'payload_valid', portType: bitType() },
      { name: 'frame_done', portType: bitType() },
      { name: 'frame_length', portType: busType(16) },
      { name: 'parse_state', portType: busType(4) },
    ],
    clocks: [],
    state: [
      {
        id: 'frameparser-state',
        name: 'registers',
        stateType: { kind: 'memory', addressWidth: 8, dataWidth: 32 },
        initialValue: { data: new Map(), addressWidth: 8, dataWidth: 32 },
      },
    ],
    evaluate: (_inputs, currentState) => {
      const regs = (currentState ?? new Map()) as Map<number, number>;

      // Register addresses: 0=state, 1=dst_lo, 2=dst_hi, 3=src_lo, 4=src_hi,
      //                     5=ethertype, 6=vlan_tci, 7=has_vlan, 8=byte_counter
      // FSM states: IDLE=0, DST_MAC_LO=1, DST_MAC_HI_SRC=2, SRC_MAC=3,
      //             ETHERTYPE=4, VLAN=5, PAYLOAD=6, DONE=7

      const state = regs.get(0) ?? 0;
      const dstMacLo = (regs.get(1) ?? 0) >>> 0;
      const dstMacHi = (regs.get(2) ?? 0) & 0xFFFF;
      const srcMacLo = (regs.get(3) ?? 0) >>> 0;
      const srcMacHi = (regs.get(4) ?? 0) & 0xFFFF;
      const ethertype = (regs.get(5) ?? 0) & 0xFFFF;
      const vlanTci = (regs.get(6) ?? 0) & 0xFFFF;
      const hasVlan = (regs.get(7) ?? 0) !== 0;
      const byteCounter = (regs.get(8) ?? 0) & 0xFFFF;

      // Validity signals based on state progression
      const dstMacValid = state >= 2;   // DST_MAC_HI_SRC
      const srcMacValid = state >= 4;   // ETHERTYPE
      const ethertypeValid = state >= 6; // PAYLOAD
      const vlanValid = hasVlan && state >= 6;
      const payloadValid = state === 6 || state === 7;
      const frameDone = state === 7;    // DONE

      return new Map<string, number | boolean>([
        ['dst_mac_hi', dstMacHi],
        ['dst_mac_lo', dstMacLo],
        ['dst_mac_valid', dstMacValid],
        ['src_mac_hi', srcMacHi],
        ['src_mac_lo', srcMacLo],
        ['src_mac_valid', srcMacValid],
        ['ethertype', ethertype],
        ['ethertype_valid', ethertypeValid],
        ['has_vlan', hasVlan],
        ['vlan_tci', vlanTci],
        ['vlan_valid', vlanValid],
        ['payload_valid', payloadValid],
        ['frame_done', frameDone],
        ['frame_length', byteCounter],
        ['parse_state', state],
      ]);
    },
    updateState: (inputs, currentState) => {
      const regs = (currentState ?? new Map()) as Map<number, number>;
      const tdata = ((inputs.get('tdata') as number) ?? 0) >>> 0;
      const tkeep = ((inputs.get('tkeep') as number) ?? 0) & 0xF;
      const tvalid = inputs.get('tvalid') as boolean;
      const tlast = inputs.get('tlast') as boolean;

      if (!tvalid) return regs;

      const R_STATE = 0;
      const R_DST_MAC_LO = 1;
      const R_DST_MAC_HI = 2;
      const R_SRC_MAC_LO = 3;
      const R_SRC_MAC_HI = 4;
      const R_ETHERTYPE = 5;
      const R_VLAN_TCI = 6;
      const R_HAS_VLAN = 7;
      const R_BYTE_COUNTER = 8;

      const IDLE = 0, DST_MAC_LO = 1, DST_MAC_HI_SRC = 2, SRC_MAC = 3;
      const ETHERTYPE = 4, VLAN = 5, PAYLOAD = 6, DONE = 7;

      const newRegs = new Map(regs);
      let state = regs.get(R_STATE) ?? IDLE;

      // Count valid bytes: popcount(tkeep)
      const byteCount = ((tkeep >> 3) & 1) + ((tkeep >> 2) & 1) + ((tkeep >> 1) & 1) + (tkeep & 1);
      const prevByteCounter = regs.get(R_BYTE_COUNTER) ?? 0;
      newRegs.set(R_BYTE_COUNTER, prevByteCounter + byteCount);

      // Extract bytes from tdata (big-endian: byte0 = bits[31:24])
      const b0 = (tdata >>> 24) & 0xFF;
      const b1 = (tdata >>> 16) & 0xFF;
      const b2 = (tdata >>> 8) & 0xFF;
      const b3 = tdata & 0xFF;

      switch (state) {
        case IDLE:
        case DST_MAC_LO: {
          // Cycle 0: bytes [0:3] → dst_mac[0..3] → dst_mac_lo
          newRegs.set(R_DST_MAC_LO, tdata);
          newRegs.set(R_STATE, DST_MAC_HI_SRC);
          break;
        }
        case DST_MAC_HI_SRC: {
          // Cycle 1: bytes [4:7] → dst_mac[4..5]=tdata[31:16], src_mac[0..1]=tdata[15:0]
          const dstHi = (b0 << 8) | b1;
          newRegs.set(R_DST_MAC_HI, dstHi);
          // src_mac_lo will accumulate: first 2 bytes in upper half
          const srcPartial = ((b2 << 8) | b3) & 0xFFFF;
          newRegs.set(R_SRC_MAC_LO, srcPartial); // temporary: upper 16 bits of what will become src info
          newRegs.set(R_STATE, SRC_MAC);
          break;
        }
        case SRC_MAC: {
          // Cycle 2: bytes [8:11] → src_mac[2..5]
          // src_mac = [src0, src1 (from prev cycle), src2, src3, src4, src5 (this cycle)]
          const prevSrc01 = regs.get(R_SRC_MAC_LO) ?? 0;
          const srcHi = prevSrc01 & 0xFFFF; // src[0], src[1]
          newRegs.set(R_SRC_MAC_HI, srcHi);
          newRegs.set(R_SRC_MAC_LO, tdata); // src[2], src[3], src[4], src[5]
          newRegs.set(R_STATE, ETHERTYPE);
          break;
        }
        case ETHERTYPE: {
          // Cycle 3: bytes [12:15] → ethertype[0..1]=tdata[31:16], then 2 payload/vlan bytes
          const etype = ((b0 << 8) | b1) & 0xFFFF;
          if (etype === 0x8100) {
            // 802.1Q VLAN tag: next 2 bytes are TCI
            const vlanTci = ((b2 << 8) | b3) & 0xFFFF;
            newRegs.set(R_VLAN_TCI, vlanTci);
            newRegs.set(R_HAS_VLAN, 1);
            newRegs.set(R_ETHERTYPE, etype); // temporarily store 0x8100
            newRegs.set(R_STATE, VLAN);
          } else {
            newRegs.set(R_ETHERTYPE, etype);
            newRegs.set(R_STATE, tlast ? DONE : PAYLOAD);
          }
          break;
        }
        case VLAN: {
          // Cycle 4 (VLAN only): real ethertype in tdata[31:16]
          const realEtype = ((b0 << 8) | b1) & 0xFFFF;
          newRegs.set(R_ETHERTYPE, realEtype);
          newRegs.set(R_STATE, tlast ? DONE : PAYLOAD);
          break;
        }
        case PAYLOAD: {
          if (tlast) {
            newRegs.set(R_STATE, DONE);
          }
          break;
        }
        case DONE:
          // Stay in done
          break;
      }

      // On tlast, finalize frame length
      if (tlast && state !== DONE) {
        newRegs.set(R_BYTE_COUNTER, prevByteCounter + byteCount);
      }

      return newRegs;
    },
    outputDependency: 'state+inputs',
  }),

  // --------------------------------------------------------------------------
  // Eth_CRC32 — IEEE 802.3 CRC-32 (sequential, table-driven)
  // --------------------------------------------------------------------------
  Eth_CRC32: defineSequential({
    name: 'Eth_CRC32',
    description: 'IEEE 802.3 CRC-32 checker — polynomial 0x04C11DB7, reflected algorithm',
    category: 'ethernet',
    icon: 'EC',
    namespace: 'ethernet',
    inputs: [
      { name: 'data', portType: busType(32) },
      { name: 'data_valid', portType: bitType() },
      { name: 'tkeep', portType: busType(4) },
      { name: 'tlast', portType: bitType() },
      { name: 'reset', portType: bitType() },
    ],
    outputs: [
      { name: 'crc', portType: busType(32) },
      { name: 'crc_ok', portType: bitType() },
    ],
    clocks: [],
    state: [
      {
        id: 'crc32-state',
        name: 'crc_reg',
        stateType: { kind: 'memory', addressWidth: 8, dataWidth: 32 },
        initialValue: { data: new Map(), addressWidth: 8, dataWidth: 32 },
      },
    ],
    evaluate: (_inputs, currentState) => {
      const regs = (currentState ?? new Map()) as Map<number, number>;
      const crcReg = (regs.get(0) ?? 0xFFFFFFFF) >>> 0;
      const done = (regs.get(1) ?? 0) !== 0;

      // Final CRC is bitwise complement
      const finalCrc = (~crcReg) >>> 0;
      // Valid frame residual check: CRC register after processing frame+FCS = 0xDEBB20E3
      // (complement is the well-known magic value 0x2144DF1C)
      const crcOk = done && crcReg === (0xDEBB20E3 >>> 0);

      return new Map<string, number | boolean>([
        ['crc', finalCrc],
        ['crc_ok', crcOk],
      ]);
    },
    updateState: (inputs, currentState) => {
      const regs = (currentState ?? new Map()) as Map<number, number>;
      const data = ((inputs.get('data') as number) ?? 0) >>> 0;
      const dataValid = inputs.get('data_valid') as boolean;
      const tkeep = ((inputs.get('tkeep') as number) ?? 0) & 0xF;
      const tlast = inputs.get('tlast') as boolean;
      const reset = inputs.get('reset') as boolean;

      if (reset) {
        const newRegs = new Map(regs);
        newRegs.set(0, 0xFFFFFFFF);
        newRegs.set(1, 0); // not done
        return newRegs;
      }

      if (!dataValid) return regs;

      let crc = (regs.get(0) ?? 0xFFFFFFFF) >>> 0;

      // Process valid bytes MSB-first (matching AXI-Stream byte order)
      // tkeep bit 3 = byte at tdata[31:24], bit 0 = byte at tdata[7:0]
      for (let i = 3; i >= 0; i--) {
        if ((tkeep >> i) & 1) {
          const byteVal = (data >>> (i * 8)) & 0xFF;
          const idx = (crc ^ byteVal) & 0xFF;
          crc = (ETH_CRC32_TABLE[idx] ^ (crc >>> 8)) >>> 0;
        }
      }

      const newRegs = new Map(regs);
      newRegs.set(0, crc);
      if (tlast) {
        newRegs.set(1, 1); // done
      }
      return newRegs;
    },
    outputDependency: 'state+inputs',
  }),

  // ============================================================================
  // Networking Primitives (RV32I memory-bus peripherals)
  // ============================================================================

  MemBusMux: defineCombinational({
    name: 'MemBusMux',
    description: 'Address decoder + read-data mux. Routes CPU memory operations to peripherals based on address range.',
    category: 'rv32i',
    icon: 'BUS',
    namespace: 'rv32i',
    parameters: [
      { name: 'base0', paramType: 'int', defaultValue: 0x00010000 },
      { name: 'end0', paramType: 'int', defaultValue: 0x0001FFFF },
      { name: 'base1', paramType: 'int', defaultValue: 0x80000000 },
      { name: 'end1', paramType: 'int', defaultValue: 0x80000FFF },
      { name: 'base2', paramType: 'int', defaultValue: 0x80001000 },
      { name: 'end2', paramType: 'int', defaultValue: 0x80001FFF },
      { name: 'base3', paramType: 'int', defaultValue: 0x80002000 },
      { name: 'end3', paramType: 'int', defaultValue: 0x80002FFF },
      { name: 'base4', paramType: 'int', defaultValue: 0x00000000 },
      { name: 'end4', paramType: 'int', defaultValue: 0x0000FFFF },
    ],
    inputs: [
      { name: 'addr', portType: busType(32) },
      { name: 'write_data', portType: busType(32) },
      { name: 'mem_read', portType: bitType() },
      { name: 'mem_write', portType: bitType() },
      { name: 'funct3', portType: busType(3) },
      { name: 'read_data_0', portType: busType(32) },
      { name: 'read_data_1', portType: busType(32) },
      { name: 'read_data_2', portType: busType(32) },
      { name: 'read_data_3', portType: busType(32) },
      { name: 'read_data_4', portType: busType(32) },
    ],
    outputs: [
      { name: 'local_addr', portType: busType(32) },
      { name: 'write_data_out', portType: busType(32) },
      { name: 'funct3_out', portType: busType(3) },
      { name: 'read_data', portType: busType(32) },
      { name: 'p0_read', portType: bitType() },
      { name: 'p0_write', portType: bitType() },
      { name: 'p1_read', portType: bitType() },
      { name: 'p1_write', portType: bitType() },
      { name: 'p2_read', portType: bitType() },
      { name: 'p2_write', portType: bitType() },
      { name: 'p3_read', portType: bitType() },
      { name: 'p3_write', portType: bitType() },
      { name: 'p4_read', portType: bitType() },
      { name: 'p4_write', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const addr = ((inputs.get('addr') as number) ?? 0) >>> 0;
      const writeData = ((inputs.get('write_data') as number) ?? 0) >>> 0;
      const memRead = inputs.get('mem_read') as boolean;
      const memWrite = inputs.get('mem_write') as boolean;
      const funct3 = ((inputs.get('funct3') as number) ?? 0) & 0x7;

      // Get range parameters (injected as __paramName by simulator)
      const ranges = [
        { base: (((inputs.get('__base0') as number) ?? 0x00010000) >>> 0), end: (((inputs.get('__end0') as number) ?? 0x0001FFFF) >>> 0) },
        { base: (((inputs.get('__base1') as number) ?? 0x80000000) >>> 0), end: (((inputs.get('__end1') as number) ?? 0x80000FFF) >>> 0) },
        { base: (((inputs.get('__base2') as number) ?? 0x80001000) >>> 0), end: (((inputs.get('__end2') as number) ?? 0x80001FFF) >>> 0) },
        { base: (((inputs.get('__base3') as number) ?? 0x80002000) >>> 0), end: (((inputs.get('__end3') as number) ?? 0x80002FFF) >>> 0) },
        { base: (((inputs.get('__base4') as number) ?? 0x00000000) >>> 0), end: (((inputs.get('__end4') as number) ?? 0x0000FFFF) >>> 0) },
      ];

      // Determine which peripheral matches
      let match = -1;
      for (let i = 0; i < 5; i++) {
        if (addr >= ranges[i].base && addr <= ranges[i].end) {
          match = i;
          break;
        }
      }

      const localAddr = match >= 0 ? ((addr - ranges[match].base) >>> 0) : 0;

      // Mux read data from matching peripheral
      const readDataInputs = [
        ((inputs.get('read_data_0') as number) ?? 0) >>> 0,
        ((inputs.get('read_data_1') as number) ?? 0) >>> 0,
        ((inputs.get('read_data_2') as number) ?? 0) >>> 0,
        ((inputs.get('read_data_3') as number) ?? 0) >>> 0,
        ((inputs.get('read_data_4') as number) ?? 0) >>> 0,
      ];
      const readData = match >= 0 ? readDataInputs[match] : 0;

      return new Map<string, BitValue | BusValue>([
        ['local_addr', localAddr],
        ['write_data_out', writeData],
        ['funct3_out', funct3],
        ['read_data', readData],
        ['p0_read', match === 0 && memRead],
        ['p0_write', match === 0 && memWrite],
        ['p1_read', match === 1 && memRead],
        ['p1_write', match === 1 && memWrite],
        ['p2_read', match === 2 && memRead],
        ['p2_write', match === 2 && memWrite],
        ['p3_read', match === 3 && memRead],
        ['p3_write', match === 3 && memWrite],
        ['p4_read', match === 4 && memRead],
        ['p4_write', match === 4 && memWrite],
      ]);
    },
  }),

  UART_TX: defineSequential({
    name: 'UART_TX',
    description: 'Memory-mapped UART transmit. Writes append characters to text buffer. Reads return tx_ready=1.',
    category: 'rv32i',
    icon: 'TX',
    namespace: 'rv32i',
    inputs: [
      { name: 'addr', portType: busType(32) },
      { name: 'write_data', portType: busType(32) },
      { name: 'mem_read', portType: bitType() },
      { name: 'mem_write', portType: bitType() },
    ],
    outputs: [
      { name: 'read_data', portType: busType(32) },
    ],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'uart-tx-state',
        name: 'text',
        stateType: { kind: 'bus', width: 8 },
        initialValue: '',
      },
    ],
    evaluate: (inputs) => {
      const memRead = inputs.get('mem_read') as boolean;
      // Always ready
      return new Map([['read_data', memRead ? 1 : 0]]);
    },
    updateState: (inputs, currentState, clockEdges) => {
      if (clockEdges['clk'] !== 'rising') {
        return currentState;
      }

      const memWrite = inputs.get('mem_write') as boolean;
      if (!memWrite) {
        return currentState;
      }

      const addr = ((inputs.get('addr') as number) ?? 0) >>> 0;
      if (addr !== 0) {
        return currentState; // Only addr 0 is the data register
      }

      const writeData = ((inputs.get('write_data') as number) ?? 0) & 0xFF;
      const currentText = (typeof currentState === 'string' ? currentState : '') as string;
      const char = String.fromCharCode(writeData);
      let newText = currentText + char;

      const MAX_LENGTH = 4096;
      if (newText.length > MAX_LENGTH) {
        newText = newText.slice(-MAX_LENGTH);
      }

      return newText;
    },
    outputDependency: 'state-only',
  }),

  NIC_FIFO: defineSequential({
    name: 'NIC_FIFO',
    description: 'Network interface with TX/RX FIFOs. CPU writes frames to TX, reads frames from RX. Network side has data/valid/frame ports.',
    category: 'rv32i',
    icon: 'NIC',
    namespace: 'rv32i',
    inputs: [
      // CPU TX side (from MemBusMux)
      { name: 'tx_addr', portType: busType(32) },
      { name: 'tx_write_data', portType: busType(32) },
      { name: 'tx_mem_read', portType: bitType() },
      { name: 'tx_mem_write', portType: bitType() },
      // CPU RX side (from MemBusMux)
      { name: 'rx_addr', portType: busType(32) },
      { name: 'rx_mem_read', portType: bitType() },
      { name: 'rx_mem_write', portType: bitType() },
      // Network RX side (from other NIC's TX)
      { name: 'net_rx_data', portType: busType(32) },
      { name: 'net_rx_valid', portType: bitType() },
      { name: 'net_rx_frame', portType: bitType() },
    ],
    outputs: [
      // CPU TX side read data
      { name: 'tx_read_data', portType: busType(32) },
      // CPU RX side read data
      { name: 'rx_read_data', portType: busType(32) },
      // Network TX side (to other NIC's RX)
      { name: 'net_tx_data', portType: busType(32) },
      { name: 'net_tx_valid', portType: bitType() },
      { name: 'net_tx_frame', portType: bitType() },
    ],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'nic-fifo-state',
        name: 'fifos',
        stateType: { kind: 'memory', addressWidth: 32, dataWidth: 32 },
        initialValue: { data: new Map(), addressWidth: 32, dataWidth: 32 },
      },
    ],
    // State layout (Map<number, number>):
    //   0x0000-0x03FF: TX FIFO data (up to 256 words)
    //   0x1000-0x13FF: RX FIFO data (up to 256 words)
    //   0x2000: TX write pointer
    //   0x2001: TX read pointer
    //   0x2002: TX frame-end flag (1 = frame complete, ready to drain)
    //   0x2003: TX drain pointer (for network output)
    //   0x2004: TX draining flag
    //   0x2010: RX write pointer
    //   0x2011: RX read pointer (CPU read position)
    //   0x2012: RX word count (available for CPU to read)
    evaluate: (inputs, currentState) => {
      const state = (currentState ?? new Map()) as Map<number, number>;

      // TX CPU read: addr 0x0 = nothing useful, addr 0x8 = tx count, addr 0xC = 0
      const txMemRead = inputs.get('tx_mem_read') as boolean;
      let txReadData = 0;
      if (txMemRead) {
        const txAddr = ((inputs.get('tx_addr') as number) ?? 0) >>> 0;
        if (txAddr === 0x8) {
          // TX count (words in FIFO)
          const txWp = state.get(0x2000) ?? 0;
          const txRp = state.get(0x2001) ?? 0;
          txReadData = txWp - txRp;
        }
      }

      // RX CPU read: addr 0x0 = front word, addr 0x8 = rx count
      const rxMemRead = inputs.get('rx_mem_read') as boolean;
      let rxReadData = 0;
      if (rxMemRead) {
        const rxAddr = ((inputs.get('rx_addr') as number) ?? 0) >>> 0;
        if (rxAddr === 0x0) {
          // Read front of RX FIFO (don't pop — that's a write to addr 0x4)
          const rxRp = state.get(0x2011) ?? 0;
          rxReadData = (state.get(0x1000 + rxRp) ?? 0) >>> 0;
        } else if (rxAddr === 0x8) {
          // RX word count
          rxReadData = state.get(0x2012) ?? 0;
        }
      }

      // Network TX output: drain TX FIFO one word per cycle when draining
      const draining = state.get(0x2004) ?? 0;
      const txDrainPtr = state.get(0x2003) ?? 0;
      const txWp = state.get(0x2000) ?? 0;
      let netTxData = 0;
      let netTxValid = false;
      let netTxFrame = false;

      if (draining && txDrainPtr < txWp) {
        netTxData = (state.get(0x0000 + txDrainPtr) ?? 0) >>> 0;
        netTxValid = true;
        // Last word in frame
        netTxFrame = (txDrainPtr + 1) >= txWp;
      }

      return new Map<string, BitValue | BusValue>([
        ['tx_read_data', txReadData],
        ['rx_read_data', rxReadData],
        ['net_tx_data', netTxData],
        ['net_tx_valid', netTxValid],
        ['net_tx_frame', netTxFrame],
      ]);
    },
    updateState: (inputs, currentState, clockEdges) => {
      if (clockEdges['clk'] !== 'rising') {
        return currentState;
      }

      const state = (currentState ?? new Map()) as Map<number, number>;
      const newState = new Map(state);

      // --- TX CPU write ---
      const txMemWrite = inputs.get('tx_mem_write') as boolean;
      if (txMemWrite) {
        const txAddr = ((inputs.get('tx_addr') as number) ?? 0) >>> 0;
        const txData = ((inputs.get('tx_write_data') as number) ?? 0) >>> 0;

        if (txAddr === 0x0) {
          // Write word to TX FIFO
          const txWp = newState.get(0x2000) ?? 0;
          newState.set(0x0000 + txWp, txData);
          newState.set(0x2000, txWp + 1);
        } else if (txAddr === 0xC) {
          // Mark frame-end → start draining
          newState.set(0x2002, 1);
          newState.set(0x2003, 0); // reset drain pointer
          newState.set(0x2004, 1); // start draining
        }
      }

      // --- TX drain: advance drain pointer ---
      // Read from previous-cycle state (not newState) so the drain FSM
      // doesn't advance on the same tick frame-end is written — matching
      // real registered hardware where outputs change on the next clock edge.
      const wasDraining = state.get(0x2004) ?? 0;
      if (wasDraining) {
        const txDrainPtr = newState.get(0x2003) ?? 0;
        const txWp = newState.get(0x2000) ?? 0;
        if (txDrainPtr < txWp) {
          newState.set(0x2003, txDrainPtr + 1);
          // If we just sent the last word, stop draining and reset FIFO
          if ((txDrainPtr + 1) >= txWp) {
            newState.set(0x2004, 0); // stop draining
            newState.set(0x2000, 0); // reset write pointer
            newState.set(0x2001, 0); // reset read pointer
            newState.set(0x2002, 0); // clear frame-end
          }
        }
      }

      // --- RX from network ---
      const netRxValid = inputs.get('net_rx_valid') as boolean;
      if (netRxValid) {
        const netRxData = ((inputs.get('net_rx_data') as number) ?? 0) >>> 0;
        const rxWp = newState.get(0x2010) ?? 0;
        newState.set(0x1000 + rxWp, netRxData);
        newState.set(0x2010, rxWp + 1);
        newState.set(0x2012, (newState.get(0x2012) ?? 0) + 1);
      }

      // --- RX CPU pop ---
      const rxMemWrite = inputs.get('rx_mem_write') as boolean;
      if (rxMemWrite) {
        const rxAddr = ((inputs.get('rx_addr') as number) ?? 0) >>> 0;
        if (rxAddr === 0x4) {
          // Pop front of RX FIFO
          const rxRp = newState.get(0x2011) ?? 0;
          const rxCount = newState.get(0x2012) ?? 0;
          if (rxCount > 0) {
            newState.set(0x2011, rxRp + 1);
            newState.set(0x2012, rxCount - 1);
          }
        }
      }

      return newState;
    },
    outputDependency: 'state+inputs',
  }),
};

// ============================================================================
// Auto-Generated Exports
// ============================================================================

const SINK_NAMES = new Set([
  'Led', 'Output', 'SevenSegment', 'HexDisplay', 'Screen', 'RasterDisplay', 'Console', 'UART_TX',
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
 * Get the reference circuit source for a primitive, if it has one.
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
